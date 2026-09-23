# pi-ui-forge — design

> Status: draft v2. Built against the existing stack: pi-sock, pi-subagents
> (Python, PTC-hosted), pi packages. Decisions locked so far: Electron shell,
> real React mocks (no JSON DSL), Lovable-style alternating loop, id-based
> annotation addressing, `/tmp/pi-ui-forge/<session>` for all session data.

## 1. Requirements recap

1. **tldraw canvas** in its own Electron window (never the user's browser);
   the design subagent's React app pages are mounted **one page per frame**
   on the canvas.
2. The subagent can update the mock **live** while the window is open.
3. User works in **interact** mode (real React interactivity) and **annotate**
   mode (tldraw draw on the canvas, element picking like inspect-element,
   text comments + typed change descriptions).
4. **Send back** ships the markup (comments + addressed elements + draw crops)
   to the design subagent; the subagent revises; the new version appears in
   the same window. **Strictly alternating** — the subagent is idle while the
   user marks up, the user is expected to mark up while the subagent works.
5. **Lovable-style loop**:
   `user prompt → agent spawns design subagent → subagent proposes 1+ mocks →
   mocks appear in the app → user picks 1+ pages, annotates / describes
   changes → send back → subagent modifies → back to the front end → loop
   until the user closes the window.`
6. **The subagent can see its work**: before settling a turn it may request
   screenshots of the mock's current state and inspect them (models benefit
   from intermediate-stage self-review). Screenshot capture must not disturb
   the user's view.
7. Annotation addressing is **HTML-id based** (the design skill mandates
   liberal `id` usage), with a hierarchical fallback for id-less elements.

## 2. What the existing stack gives us

- **pi-sock**: unix-socket JSONL RPC into a live pi (`send` steer/follow_up,
  `get_state`, `get_message`, `subscribe` → `agent_settled`, `abort`).
- **pi-subagents**: `subagents.agent(...)` spawns a real pi in a tmux window
  (the `subagents` profile) with `PI_SOCK_NAME=<handle.id>` ⇒ socket path
  `~/.pi/pi-sock/<handle.id>.sock` is **deterministic at spawn time**. The
  PTC viewer panel shows the subagent live; the user can hand-steer it.
- **pi packages**: git repos with a `pi` manifest; git installs run
  `npm install` on the clone — so the plugin can ship an esbuild build script
  as an npm dependency and rely on it being installed.

Consequences:

- The **file system is the transport** for the artifact: the design subagent
  writes React code into `/tmp/pi-ui-forge/<session>/app/` with its normal
  tools and runs the build. pi-sock is only the **control channel** (turn
  boundaries, status, screenshot requests). No mock trees through chat.
- The bridge only needs the subagent's socket path, known when the
  orchestrating chunk spawns it — the editor talks to the subagent
  **peer-to-peer through the sidecar**, not through the calling agent.
- `get_message` is a read, not a consume: the sidecar (for editor status) and
  the orchestrating chunk (for the final summary) can both watch.

## 3. Architecture

```
┌───────────────┐ tools/PTC  ┌─────────────────────┐  WS   ┌─────────────────────┐
│ calling agent  │──────────▶│ pi_ui_forge sidecar  │──────▶│ editor (React +      │
│ + orchestrating│  control  │ (Python)             │       │ tldraw) in Electron  │
│ PTC chunk      │           │  - control socket    │       │                      │
└───────┬───────┘           │  - static hub        │       │  pages = same-origin │
        │ spawn             │  - electron spawn    │       │  iframes in tldraw   │
        ▼                   │  - build trigger     │       │  frames              │
┌──────────────────┐  pi-sock│  - annotation relay  │       └─────────────────────┘
│ design subagent   │◀───────▶│                      │
│ (pi, tmux window) │ control └──────────┬───────────┘
│  writes/builds    │                     │ runs `node build.mjs`
│  React + ids      │◀─── file system ────┘
└──────────────────┘
        /tmp/pi-ui-forge/<session>/{app/, dist/, ann/, shots/, control.sock, meta.json}
```

### 3.1 Session layout (all under `/tmp/pi-ui-forge/<session>/`)

| Path | Owner | Purpose |
| --- | --- | --- |
| `app/` | **design subagent** (writes) | React source: `pages/<name>.tsx` etc. |
| `build.mjs` | plugin (shipped) | esbuild build: one entry per page → `dist/` |
| `dist/` | sidecar build runs | bundle + `manifest.json` (page list, hashes) |
| `ann/` | sidecar (writes) | user draw crops, PNG |
| `shots/` | sidecar (writes) | mock screenshots (subagent- and agent-readable) |
| `control.sock` | sidecar | JSONL control socket (extension tool + editor) |
| `meta.json` | sidecar | session descriptor: urls, tokens, subagent socket |

`/tmp` because sessions are disposable artifacts; a crashed pi never leaves
state to clean up manually. (If persistence is ever wanted, an env var
`PI_UI_FORGE_HOME` can override.)

### 3.2 The sidecar (Python) — the hub

Runs two ways:

- **Library** from the orchestrating PTC chunk (subagent mode):
  `import pi_ui_forge; session = await forge.open(...)`.
- **Process** spawned by the extension (agent mode):
  `python -m pi_ui_forge serve --home /tmp/pi-ui-forge/<session>`, spoken to
  over its JSONL control socket.

Responsibilities: serve the editor build + `dist/` (HTTP, 127.0.0.1, token in
URL), WS hub to the editor, spawn/monitor the Electron child (exit ⇒ session
closed), watch `dist/manifest.json` to push new bundles, relay control
traffic on `control.sock` (screenshot requests, status), and in subagent mode
run the pi-sock bridge (reusing `pi_subagents.client.AsyncSockClient`).

### 3.3 The extension stays thin

`index.ts` registers tools and owns sidecar child-process lifecycle:

| Tool | Mode | Returns |
| --- | --- | --- |
| `mock_open` | agent | immediately: session id, editor URL |
| `mock_open` | subagent | blocks until window close; streams revision events via `onUpdate`; final result = subagent's last summary |
| `mock_update` | agent | triggers a rebuild/push of `app/` (agent wrote files directly) |
| `mock_wait` | agent | blocks until "send back" (annotation package as tool result) or window close |
| `mock_screenshot` | agent | images of current pages as tool-result content |

### 3.4 The Electron shell

One `BrowserWindow` loading `http://127.0.0.1:<port>/<session>?token=...`,
quits when the window closes (process exit == closed). Spawn detached,
`stdio: 'ignore'`, `--ozone-platform-hint=auto` for Wayland. Electron over
Tauri for v1: pure npm, no Rust toolchain, spawnable by an agent. Tauri v2
later behind `$PI_UI_FORGE_SHELL` (same load-URL/quit-on-close contract).

### 3.5 The editor

- **Pages as iframes in tldraw frames.** Custom shape `mock-page`: renders a
  same-origin `<iframe src="/app/<page>/">`. Iframe-per-page gives CSS and JS
  isolation between proposed variants, real interactivity in interact mode,
  and a clean DOM root for picking/capture.
- **Interact mode**: tldraw tool events disabled; pointer events flow into
  the iframe (buttons click, inputs take focus, real React state).
- **Annotate mode**: tldraw tools active over the canvas:
  - **draw** — tldraw draw tool; users draw *on the canvas*, across and
    around page frames;
  - **inspect-pick** — click into the iframe (`contentDocument.elementFromPoint`,
    same-origin), walk to nearest self-or-ancestor with an `id` → build a
    comment bound to that page + target (§5);
  - **text** — free-floating notes; plus a per-send **description box** for
    typed change descriptions (Lovable-style "describe the change").
- **Page picking**: select one or more page frames; send-back includes the
  selection (unpicked proposal pages are dropped).
- Status bar: who owns the turn (designing… / awaiting markup / revising…),
  revision counter, subagent's note text.
- The canvas draws survive bundle swaps: shapes persist in tldraw store;
  after a reload of the iframe, comment targets are re-resolved by selector
  (best effort, unmatched flagged, §5).

## 4. Mock format — real React (locked)

The design subagent writes a genuine React app (vite-style layout, but built
by the plugin's build script with esbuild — no full vite dev server needed):

```
app/
  pages/
    home.tsx          # export default component
    settings.tsx
  components/ …       # shared bits
```

`build.mjs` (esbuild, shipped as a plugin dependency): one entry per
`pages/*.tsx` → `dist/<page>/index.js` + a static `dist/manifest.json`
(`pages: [{name, hash}]`). The sidecar pushes the manifest over WS; the
editor reloads changed iframes (hot-swap without touching tldraw layout).

Why this matches the goal: models' strong priors from web dev in React apply
directly — the subagent writes idiomatic React + CSS the way it would in any
codebase, and the user-facing artifact is that same code (not a DSL that
would have to be translated back).

## 5. Annotation addressing (locked)

The design skill mandates **liberal `id` attributes** on section/interactive
elements, so most picks resolve to a plain `#id`. For elements without an id
(forgetfulness, library internals), the editor generates a **hierarchical
tag** relative to the nearest id'd ancestor-or-self:

```json
{
  "anchor": "#panel",
  "steps": [
    { "nth": 1, "tag": "div", "classes": ["row"] },
    { "nth": 1, "tag": "button", "classes": ["btn"] }
  ],
  "css": "#panel > div:nth-child(1) > button:nth-child(1)",
  "human": "button.btn, first child of first child of #panel"
}
```

Generation (editor, on pick): walk up from the element to the nearest
self-or-ancestor with an `id` → `anchor`; record downward steps as
(nth-child index, tag, classes); resolve `css`; render `human` from the same
walk. This is simple, stable enough for meaningful attachment (React
re-renders don't disturb ids or structure), and avoids building a node-id
system into every mock. If a pick lands outside any id'd ancestor, the
fallback anchor is the page root (`#root` or `body`).

## 6. Send-back payload and the loop (locked: alternating)

```json
{
  "kind": "revision-request",
  "picked": ["home"],
  "description": "make the hero feel less cramped",
  "comments": [
    { "text": "CTA invisible on dark bg", "page": "home", "target": { "anchor": "#signup-cta", "human": "…" } }
  ],
  "draws": [
    { "page": "home", "image": "ann/2026-09-23-0412-a.png", "nearTargets": ["#signup-cta"] }
  ]
}
```

- Draw crops: for each draw shape, rasterize the *page render* (same-origin
  DOM → canvas via foreignObject serialization, which does not move the
  user's view) cropped to the stroke bbox, composited with the stroke.
  `nearTargets`: targets whose boxes intersect the stroke bbox.
- The sidecar renders this into a request text (comments + description
  inlined; image paths referenced) and sends it over pi-sock
  (`mode="follow_up"`; the subagent is idle in the alternating loop, so it
  starts immediately).
- **Screenshot self-inspection**: the design skill instructs the subagent to
  call `mock_request_screenshot` (a tool provided by this same plugin,
  installed in the `subagents` profile; active only when
  `PI_UI_FORGE_CONTROL` is set) before finishing a turn. The tool asks the
  sidecar → editor captures pages **without changing the user's view**
  (DOM-serialization capture, no scroll/zoom changes) → PNGs land in
  `shots/<n>/` → tool returns the paths → the subagent reads them like any
  image and iterates internally if needed.
- Turn end = `agent_settled` over pi-sock: sidecar checks `manifest.json`
  (new hashes?) → pushes the new bundle → editor hot-swaps and flips to
  "awaiting markup". The subagent's `get_message` prose shows as the status
  note.
- **Window close** (Electron exit): sidecar aborts the subagent if a turn is
  in flight, resolves the orchestrating await, and hands the final summary +
  page list to the calling agent.

Orchestrating chunk (the loop lives here, not in the extension):

```python
import pi_ui_forge as forge
import pi_subagents as subagents

h = subagents.agent(brief, name="designer")          # brief points at the design skill
session = await forge.open(home=tmp_session_dir, subagent_socket=h.socket_path)
result = await session.wait_closed(timeout=3600)     # alternation: settles are expected, close is the exit
subagents.finish([h])
return result.summary, result.pages                  # → calling agent
```

## 7. The design skill (for the design subagent)

A pi skill installed in the `subagents` profile (or injected into the brief).
Contents, in order of importance:

1. **Contract**: you are the mock's author. Work in
   `/tmp/pi-ui-forge/<session>/app/`; one file per page under `pages/`;
   build with `node build.mjs` (or let the sidecar detect). End every turn
   with the build green and a short prose note (what changed, what to look
   at).
2. **IDs, liberally**: every section, card, interactive control, and any
   element you expect feedback on gets a stable, semantic `id` (`#sidebar`,
   `#checkout-cta`). Annotations attach to these ids; without them feedback
   degrades to hierarchical guesses.
3. **Self-inspection**: before settling a turn, request screenshots
   (`mock_request_screenshot`) and look at every page you changed; iterate
   until it looks right. Do not rely on the user to report visual regressions
   you can catch yourself.
4. **React idioms**: real components, real state, CSS as you would in any web
   project; no mock-specific DSL, no build-time shims.
5. **Alternation discipline**: when you settle, stop. The next thing that
   happens is the user marking up the result; do not loop on your own beyond
   the current request.

## 8. Build order

1. **M1 — pipeline proof**: sidecar serves editor; Electron window opens;
   `build.mjs` compiles a demo app; pages mount as iframes in tldraw frames;
   interact mode works. (Proves iframe-in-shape mounting + build wiring.)
2. **M2 — annotate + send back (agent mode)**: inspect-pick with id/hierarchy
   addressing, draw + text + description box, send back → `mock_wait` tool
   result (with page screenshots), agent revises via `mock_update`.
3. **M3 — subagent mode**: python API + pi-sock bridge + alternating loop +
   `mock_request_screenshot` tool for the subagent; manifest watch →
   hot-swap.
4. **M4 — polish**: draw-crop rasterization + stroke compositing, annotation
   re-resolve across revisions (mark unmatched), WS reconnect, multi-page
   selection UX, revision-history entries (`pi.appendEntry`) so the calling
   transcript shows the evolution.
5. **Later**: Tauri shell, component-library presets for the subagent, mock
   history browsing on canvas.

## 9. Open questions

1. Does the initial proposal turn allow N pages on the canvas, with a cap?
   (Draft: up to 4 frames, subagent's call.)
2. Subagent self-inspection needs an image-capable model — should the
   orchestrator enforce `resolve_models(..., images=True)` when spawning the
   design subagent, or degrade gracefully (skip screenshots)?
3. In agent mode (no subagent), who builds — the calling agent runs
   `build.mjs` itself, or `mock_update` triggers the sidecar to build?
   (Draft: `mock_update` builds; one code path.)
4. Annotation persistence semantics across revisions: keep shapes and
   re-resolve selectors, mark unmatched; confirm.
5. `/tmp` cleanup: prune sessions older than N days at sidecar startup?
