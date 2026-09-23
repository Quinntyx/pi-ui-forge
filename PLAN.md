# pi-ui-forge — design

> Status: draft for discussion. Built against the existing stack: pi-sock,
> pi-subagents (Python, PTC-hosted), pi packages.

## 1. Requirements recap

1. Agent spins up a mock editor: **tldraw canvas** with a React mock mounted
   inside a rect shape ("mock-card").
2. Editor opens in its **own window** (Electron; not the user's browser).
3. While the window is open, the running agent can **update the mock live**.
4. User works in two modes: **interact** (real React events) and **annotate**
   (tldraw draw tool + DOM pick like inspect-element + text comments).
5. **Send back**: text comments + the component-tree subtrees they attach to +
   rasterized images of drawn annotations → model → **updated mock** pushed
   back into the same window.
6. **Design-subagent interop**: the design subagent is a real pi subagent
   (pi-subagents) reachable over **pi-sock**; the editor window is the control
   plane; revisions flow editor → subagent → editor without the calling agent
   in the hot path; **closing the window finishes the subagent** and returns
   its final summary to the calling agent.

## 2. What already exists and what it gives us

- **pi-sock**: unix-socket JSONL RPC into a *live pi*: `send` (steer/follow_up),
  `get_state`, `get_message`, `subscribe` (`agent_settled`, `activity_change`),
  `abort`. Settle detection is solved there (`agent_settled` drains retries,
  compaction, queued follow-ups). Socket path is
  `~/.pi/pi-sock/<PI_SOCK_NAME>.sock`.
- **pi-subagents**: `subagents.agent(...)` spawns a real pi in a tmux window
  under the `subagents` profile with `PI_SOCK_NAME=<handle.id>` — so a
  subagent's socket path is **deterministic**:
  `~/.pi/pi-sock/<handle.id>.sock`. `AgentHandle` gives await/steer/abort/
  resume/kill plus session introspection (`session.prose`, `session.trajectory()`).
  The PTC viewer panel shows the subagent live — the user can watch *and hand-
  steer the design subagent in its tmux window* while the mock window is open.
  That's a feature worth keeping: two windows, one for the artifact, one for
  the agent making it.
- **pi packages**: git repos with a `pi` manifest in package.json; installed
  with `pi install git:...`; extensions are TS loaded via jiti, no build step.

Key consequences:

- The bridge between the mock window and the design subagent only needs the
  **socket path**. It does not need pi_subagents itself — a plain JSONL client
  over that socket suffices (pi-sock's protocol is client-agnostic).
- Because `get_message` is a read (not destructive), several listeners can
  watch the same subagent: the bridge (for the editor) and the orchestrating
  chunk (for observability / final response) don't race.

## 3. Architecture

Four components, one repo:

```
┌─────────────┐  tools     ┌────────────────────┐  WS  ┌──────────────────┐
│ calling pi   │──────────▶│ pi_ui_forge sidecar │─────▶│ editor (React +   │
│ (extension)  │ control   │ (Python, localhost) │      │ tldraw) in        │
└─────────────┘  socket   │  - HTTP/WS hub      │      │ Electron window   │
                           │  - electron spawn   │      └──────────────────┘
       subagent mode       │  - pi-sock bridge   │
┌───────────────────┐      │  - annotation store │
│ design subagent    │◀────▶│                      │
│ (pi in tmux window)│ pi-sock└────────────────────┘
└───────────────────┘
```

### 3.1 The sidecar is Python, not embedded in the extension

The extension can hold HTTP servers fine, but the **subagent bridge wants
Python**: in PTC orchestration the same process that spawned the design
subagent can import the sidecar and drive it with real awaits, and the bridge
reuses pi-subagents' own `SockClient`/`AsyncSockClient` (importing
`pi_subagents.client` carries no tmux/env gate — the envcheck lives in
`envcheck.py`, not the client). One implementation of the pi-sock client
instead of three.

The sidecar is dual-faced:

- **Library**: `import pi_ui_forge; session = await forge.open(...)` from the
  orchestrating PTC chunk (subagent mode).
- **Process**: `python -m pi_ui_forge serve --control <sock>` spawned by the
  extension (agent mode), spoken to over a JSONL control socket
  (`~/.pi/ui-forge/<session>/control.sock` — same wire style as pi-sock).

### 3.2 The extension stays thin

`index.ts` registers three tools and manages the sidecar child process
(spawn, hold as long-lived resource, kill on `session_shutdown`):

| Tool | Mode | Returns |
| --- | --- | --- |
| `mock_open` | agent | immediately: session id, editor URL, port |
| `mock_open` | subagent | blocks (default) until window closes; streams revision events via `onUpdate`; final result = design subagent's last summary |
| `mock_update` | agent | ack; pushes full replacement tree to the editor |
| `mock_wait` | agent | blocks until "send back" → returns the annotation package, or window close |

The two modes are genuinely different control flows, so two tools + a mode
flag beats forcing one shape.

### 3.3 The Electron shell is intentionally boring

`shell/main.js`: one `BrowserWindow` loading `http://127.0.0.1:<port>/<session>?token=...`,
 quits when the window closes, so **process exit == window closed** — the
sidecar needs no heuristic. Run with `--ozone-platform-hint=auto` for
Wayland. Spawned with `stdio: 'ignore'`, detached from the terminal.

Electron over Tauri for v1: pure npm (no Rust toolchain, no per-machine
build), spawnable headlessly by an agent, devDependencies-only. Tauri v2 is a
drop-in later (same "load URL, quit on close" contract, ~10 MB binary); the
sidecar just shells out to whichever shell binary exists (`$PI_UI_FORGE_SHELL`).

### 3.4 The editor

- Custom tldraw shape `mock-card`: `ShapeUtil.component()` renders
  `<MockRoot tree={tree} />` from shape `props.tree` (JSON). The card is a
  normal tldraw shape — resizable, movable, zoomable; multiple cards on canvas
  = screen variants/states (annotations bind per-card).
- **Interact mode**: CSS `pointer-events: auto` on the mock root + stop
  propagation so tldraw tools don't swallow events; tldraw selection disabled
  (`editor.updateInstanceState({ isToolLocked: ... })` or equivalent). The
  mock is live: buttons click, inputs take focus, state is real React state.
- **Annotate mode**: pointer-events back to tldraw; three tools:
  - draw (tldraw's built-in draw tool, restyled),
  - **inspect-pick** (custom tldraw tool): on click, `elementFromPoint` inside
    the card's DOM, walk ancestors to the nearest `data-mock-id` boundary,
    create a tldraw **comment shape** bound to the card + target node ids;
  - text (built-in text tool for free-floating notes).
- **Send back**: builds a payload (§5) and posts it over the WS hub.

Mode state lives in tldraw instance state, toolbar overridden via tldraw UI
components — the editor is one page with a minimal top bar (mode toggle,
send-back button, revision status).

### 3.5 Lifecycle and window-close semantics

- Sidecar → electron child exit → mark session closed → close WS clients.
- Editor crash/refresh: WS reconnect with backoff (pi-sock's client guidance
  applies); server keeps last tree; editor pulls on connect.
- Extension → sidecar death: `mock_wait` resolves with a failed result; agent
  decides to reopen.
- Subagent mode + user closes window while a revision is in flight: sidecar
  aborts the subagent (`abort` over pi-sock), annotates the final summary
  ("interrupted during revision N").

## 4. The mock format — the central decision

Two candidate formats; **recommend A for v1**.

### A. Structured JSON tree (DSL)

```json
{
  "v": 1,
  "root": {
    "id": "n1",
    "type": "view",
    "style": "flex flex-col gap-2 p-4 bg-slate-900 rounded-xl",
    "children": [
      { "id": "n2", "type": "text", "text": "Balance", "style": "text-sm text-slate-400" },
      { "id": "n3", "type": "button", "label": "Send", "style": "bg-blue-600 text-white px-3 py-2 rounded-lg" }
    ]
  }
}
```

- Runtime maps `type` → primitive React components (`view/text/button/input/
  image/list/icon/...`) with **Tailwind classes** as the styling vehicle —
  models are excellent at Tailwind, and the tree stays compact and wholly
  replaceable per revision (no diffs to compute, no merges to break).
- Annotation targets are node ids by construction: **no id-recovery problem**.
- Subagent contract is trivial: *the reply is the tree*.
- Escape hatch for expressiveness later: `type: "custom"` node whose `code` is
  compiled in-browser (Babel standalone) and wrapped with the same
  `data-mock-id` injection.

### B. Real React/TSX

Agent writes actual component code; the editor compiles (esbuild-wasm/swc) and
hot-swaps the module. Most expressive, but: an in-browser compile loop, and
every revision re-derives annotation ids — you need a transform that injects
`data-mock-id` per JSX element and ids that stay stable across edits
(path-based ids like `Checkout/Card/Row[2]`, not hashes). Doable, and the
right endgame for fidelity — but it front-loads all the hard problems.

**Plan**: A first (§6 phases), B as a later `custom` node type, sharing the
same send-back payload shape either way.

## 5. The send-back payload and the subagent contract

```json
{
  "kind": "revision-request",
  "tree": { "...current full tree..." },
  "comments": [
    {
      "text": "this CTA is invisible on dark bg",
      "card": "card_1",
      "targets": ["n3"],
      "subtrees": { "n3": { "...subtree JSON..." } },
      "image": "ann/2026-09-23-0412-a.png"
    }
  ],
  "draws": [ { "card": "card_1", "image": "ann/2026-09-23-0413-b.png", "nearTargets": ["n1"] } ]
}
```

- **Images travel by reference, not through the socket.** PNG crops are saved
  under `~/.pi/ui-forge/<session>/ann/`; the request text names the paths.
  The design subagent is a real pi with tools — it **reads the images with its
  own read tool** (image-capable model permitting; the subagent profile can
  reach image models). Text comments are inlined in the request text.
- **Draw rasterization**: crop the card's DOM to canvas (html-to-image /
  foreignObject SVG) with the tldraw stroke shapes composited on top, clipped
  to the card bounds. `nearTargets` = node ids whose bounding boxes the stroke
  bbox intersects — a cheap spatial join that survives without pixel AI.
- **Contract for the design subagent** (injected at spawn):

  > Every reply must be a single fenced ```mock``` JSON block containing the
  > complete updated tree (schema above) plus a `"note"` field (one paragraph
  > of user-facing prose). Nothing else outside the block.

  The bridge: `send(request, mode="follow_up")` → subscribe `agent_settled` →
  `get_message` → extract the ```mock``` block → validate (JSON parse +
  node-id uniqueness; on failure, resend pi-subagents' schema-retry prompt
  pattern) → WS push → editor swaps the tree **in place** (tldraw shape
  update, no reload; canvas layout survives).

### 5.1 Who talks to whom (subagent mode)

```
user annotates → editor --WS--> sidecar --pi-sock send--> design subagent
                                                    (designs, reads images)
editor gets new tree <--WS-- sidecar <--agent_settled+get_message--┘
user closes window → electron exit → sidecar aborts subagent,
                    resolves the orchestrating await
calling agent ← final summary + final tree (from handle/session)
```

The orchestrating PTC chunk must **not** `await handle` directly — intermediate
settlements would resolve it. Instead:

```python
import pi_ui_forge as forge
import pi_subagents as subagents

h = subagents.agent(design_brief_with_contract, name="designer")
session = await forge.open(tree=initial_tree, subagent_socket=h.socket_path)
result = await session.wait_closed(timeout=3600)   # polls electron liveness
subagents.finish([h])                              # window closed ⇒ subagent done
return result.summary, result.tree                 # → calling agent's tool context
```

The chunk emits periodic progress lines (revision N applied / waiting for
user) to keep the PTC idle timer armed during long quiet stretches.

### 5.2 Agent mode flow

`mock_open` returns → agent calls `mock_update(tree)` → `mock_wait` →
annotation package arrives as the tool result → agent revises →
`mock_update` → `mock_wait` … `mock_wait` result on window close carries
`closed: true`. The extension can also offer `mock_screenshot` (card crop as
image content) so the agent can *see* the result before revising — with an
image-capable main model this closes the loop without any user round-trip.

## 6. Build order

1. **M1 — skeleton runs**: sidecar serves a static editor; electron window
   opens; one mock-card with a hardcoded tree; interact mode works. (Proves
   tldraw shape mounting + Electron + pointer-event plumbing.)
2. **M2 — agent mode**: JSON DSL renderer, `mock_update`/`mock_wait`,
   annotate mode (draw + text), send back → tool result. Inspect-pick lands
   here (it only needs `data-mock-id` walking).
3. **M3 — polish**: PNG crops (html-to-image), stroke compositing, multiple
   cards, revision-status UI, WS reconnect.
4. **M4 — subagent mode**: python API + pi-sock bridge + contract + viewer
   integration; extension `mock_open(mode="subagent")`.
5. **M5 — later**: `custom` code nodes (option B), tauri shell, prompt
   templates / skill for design briefs, mock-tree version history entries
   (`pi.appendEntry`) so the calling transcript shows the evolution.

## 7. Open questions

1. **DSL vs real React** — recommend DSL-first (§4); confirm.
2. In subagent mode, should the calling agent be able to veto revisions, or
   is the design subagent fully autonomous until window close? (Design assumes
   autonomous; a "reviewer mode" could forward each revision to the calling
   agent as a steer.)
3. Annotation persistence across revisions: keep tldraw shapes pinned to card
   positions and re-resolve node ids after each swap (best-effort, id
   match), or clear annotations on revision? (Draft: keep, mark unmatched.)
4. Does `mock_screenshot` (agent-visible card image) need to be in M2 or can
   it wait? It changes which models can run agent mode usefully.
5. Security posture: server binds 127.0.0.1 with a random token in the URL
   (mirrors pi-sock's "filesystem boundary is the model"); fine for v1?
