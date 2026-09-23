# pi-ui-forge — design

> Status: draft v3. Decisions locked: Electron shell, real React mocks, no
> hot reload (GUI updates only on explicit review), durable `mock_folder` cwd
> owned by the parent, dedicated `design-subagents` pi profile, questionnaire-
> style blocking feedback loop, **no main-profile plugin at all** — the
> frontend talks to the design subagent directly, all server-side code lives
> inside the subagent's pi process, TypeScript end to end.

## 1. Concept

A Lovable-style design loop, run by a **design subagent**:

```
user prompt → parent agent spawns a design subagent (its cwd = a mock_folder)
            → subagent proposes 1+ React mock pages → they appear in the GUI
            → user picks pages, annotates, describes changes
            → send back → subagent revises → back to the GUI
            → loop until the user approves everything or closes the window
```

The parent's loop ownership is dropped as overcomplicated. The **GUI and the
design subagent talk directly**; the parent only spawns the subagent and
reads its final result. The parent never runs a plugin — it uses pi-subagents
normally via PTC, guided by a skill. **Alternating by construction**: the
subagent blocks in a feedback tool call while the user marks up; it acts only
when the markup comes back.

## 2. Prerequisite: profile selection in pi-subagents

The one change outside this repo: `subagents.agent(...)` gains a `profile`
kwarg (default `"subagents"`):

```python
subagents.agent(brief, name="designer", profile="design-subagents", cwd=<mock_folder>)
```

- `tmuxenv.spawn_pi_window` already sets `PI_CODING_AGENT_DIR=<profile dir>`;
  the kwarg threads through `agent()` → `spawn_pi_window_handle()` →
  `spawn_pi_window(..., profile=...)`, defaulting to today's
  `PI_SUBAGENTS_PROFILE` behavior.
- pi-ptc-next needs no change (it spawns through pi-subagents; depth/limits
  are profile-independent).
- Model catalog (`capabilities()`, `best_model_match`) currently reads the
  default profile's `pi --list-models`; acceptable to leave shared, or resolve
  per-profile later.
- Without the kwarg the whole design collapses to spawning via the plain
  `subagents` profile, which is why it's a hard prerequisite.

## 3. The `design-subagents` profile

A pi profile set up like `~/.config/pi/profiles/subagents` (settings.json,
APPEND_SYSTEM.md, skills, sessions; auth/models can symlink to the shared
agent dir), differing in `packages`:

- pi-ptc-next, pi-sock, pi-tool-tree, block/exit plugins (parity with
  `subagents`), plus **pi-ui-forge** (this repo) — the GUI extension and its
  tools exist only here.
- `APPEND_SYSTEM.md` enforces the loop discipline: propose → build → ask for
  review (blocking) → revise → … → settle only when the user approves or
  closes the window.
- Skills: `design-subagent` (loop mechanics, this repo) + **taste skills**
  (typography, spacing, interaction patterns — the "taste" half of quality).
- Image-capable default model is preferred here: self-inspection needs it.

## 4. Architecture — everything in the subagent's pi process

No sidecar, no pi-sock between GUI and subagent, no main-profile plugin:

```
parent agent (main profile — unchanged, skill-guided)
  └─ PTC: subagents.agent(brief, profile="design-subagents", cwd=<mock_folder>)
        └─ design subagent (pi in a tmux window)
             ├─ pi-ui-forge extension  ── owns everything server-side:
             │    HTTP/WS server (node http + ws), Electron child spawn,
             │    esbuild build, tool implementations
             └─ editor (React + tldraw, iframe pages) ◀──WS──▶ extension
```

Because the server lives *inside the subagent's pi process*, the feedback
tool and the GUI are in-process: `mock_review` blocks the tool call, the GUI
flips to annotate mode, and the tool result is exactly the markup package.
The loop is a **tool lifecycle**, not a message relay.

### 4.1 `mock_folder` — durable, parent-owned

`mock_folder` is not ours to choose: the **parent passes the subagent's
cwd**, so the session lives wherever the parent thinks best — project dir, or
a dedicated worktree if the user wants the mock synced to git. Layout inside:

```
mock_folder/
  app/          subagent's React source: app/pages/<name>.tsx, app/components/
  build.mjs     shipped build script (esbuild; one entry per page)
  dist/         bundle + manifest.json (pages: [{name, hash}])
  ann/          user draw crops (PNG) per revision round
  shots/        mock screenshots (subagent self-inspection / parent reference)
  design-notes.md  subagent's running notes; final summary at the end
  .forge.json   session descriptor: port, token, editor URL, electron pid
```

Durable by default: the parent (and the user, and git) can refer to the
source, screenshots, and notes long after the window closes. `/tmp` is gone
from the design.

### 4.2 Tools (registered by the extension, called by the subagent's model)

| Tool | Blocks? | Purpose |
| --- | --- | --- |
| `mock_open` | no | start HTTP/WS server + open the Electron window; idempotent |
| `mock_build` | no | run `build.mjs` (esbuild), push `manifest.json` → new pages appear on canvas |
| `mock_screenshot` | no | capture current pages **without changing the user's view** (DOM-serialization capture), write `shots/<n>/`, return paths/content for the model to inspect |
| `mock_review` | **yes** | flip GUI to annotate mode, block until the user sends back markup / approves / closes; result = markup package |

`mock_review` is the questionnaire-style beat: the model calls it when its
turn's work is done; the tool call blocks the subagent's main thread; the
user annotates; the tool result carries the feedback; the agent revises.
**No `agent_settled`-driven bounce-back** — nothing about the GUI state
depends on turn boundaries. A build with errors mid-edit is never shown to
the user, because the GUI only changes on `mock_build` / `mock_review`.

Termination:
- user **approves** → `mock_review` returns `{approved: true}` → skill says:
  finalize `design-notes.md`, settle with a summary for the parent.
- user **closes the window** → Electron exit detected by the extension → any
  pending/next `mock_review` returns `{closed: true}` immediately → same
  finalize-and-settle path. (The tmux window dies with the subagent's normal
  lifecycle; parent `finish()`es the handle.)
- The parent's `await handle` resolves naturally at that settle — no special
  orchestration beyond spawning.

### 4.3 The editor

- **Pages as same-origin iframes, one per tldraw frame** (custom
  `mock-page` shape, `ShapeUtil.component()` renders the iframe). Isolation
  between proposed variants, real interactivity, clean DOM roots for
  picking/capture. Frames laid out on the canvas; user selects one or more.
- **Interact mode**: tldraw tool events disabled; pointer events flow into
  the iframe (real React state).
- **Annotate mode** (entered on `mock_review`): tldraw tools active —
  draw (canvas-wide, across/around frames), **inspect-pick**
  (`contentDocument.elementFromPoint`, same-origin), text comments, and a
  typed **description box** per send-back.
- Send back → WS → the extension resolves the pending `mock_review` with the
  markup package; GUI flips back to interact/await state.

### 4.4 Annotation addressing (CSS selectors, per revision)

The design skill mandates liberal `id` usage. Pick resolution:

- nearest self-or-ancestor with an `id` → anchor; downward steps as
  (nth-child, tag, classes);
- resolves to a precise CSS selector:
  `#panel > div:nth-child(1) > button:nth-child(1)` — **no human-readable
  string** (that was description, not spec); the selector is the address;
- if the pick lands outside any id'd ancestor, anchor is the page root.

Stability: React re-renders don't disturb ids or structure; across
revisions, shapes persist in the tldraw store and targets are re-resolved by
selector, unmatched ones flagged in the next markup package.

## 5. Send-back payload (tool result of `mock_review`)

```json
{
  "picked": ["home"],
  "description": "make the hero feel less cramped",
  "comments": [
    { "text": "CTA invisible on dark bg", "page": "home",
      "target": "#panel > div:nth-child(2) > button:nth-child(1)" }
  ],
  "draws": [
    { "page": "home", "image": "ann/r2-2026-09-23-0412-a.png",
      "nearTargets": ["#signup-cta"] }
  ],
  "approved": false, "closed": false
}
```

- Draw crops: rasterize the page render (same-origin DOM → canvas via
  foreignObject serialization; does not move the user's view) cropped to the
  stroke bbox, composited with the stroke. `nearTargets`: targets whose
  boxes intersect the stroke bbox.
- The extension renders this struct as the tool result text/JSON the
  subagent's model reads — comments and description inlined, image paths
  referenced (the model reads them from disk with its read tool, or receives
  them as image content directly — same turn, no relay).

## 6. Skills

### `ui-mock` (parent, main profile) — the only thing installed outside the subagent profile

Not a plugin; just a skill. Teaches the parent:

1. spawn **one** design subagent:
   `subagents.agent(brief, name="designer", profile="design-subagents", cwd=<mock_folder>)`;
   choose `mock_folder` per the user's intent (worktree for git sync);
2. write the brief: what the user asked for, pages to propose, constraints;
3. `await handle` — the subagent blocks in `mock_review` for as long as the
   user is marking up; that's expected, not a hang (set generous
   `wait_async` timeouts);
4. on settle: read `mock_folder/design-notes.md` + `shots/` for the summary;
   `subagents.finish()`.

### `design-subagent` (design-subagents profile) — loop mechanics

1. workspace contract (`app/pages/*.tsx`, `build.mjs`, `design-notes.md`);
2. **ids, liberally** — every section/card/control gets a stable semantic
   `id`; annotations attach to them; without ids feedback degrades to
   hierarchical guesses;
3. **self-inspect before review** — `mock_screenshot`, read every changed
   page, iterate internally; never push visual regressions to the user;
4. **real React** — idiomatic components, real state, CSS as in any project;
5. **alternation discipline** — `mock_review` is the only way to hand over;
   when it returns, act on exactly that feedback; settle only on
   approve/close; never loop autonomously.

## 7. Build order

1. **M0 — prerequisite**: pi-subagents `profile` kwarg (+ smoke test spawning
   into a scratch profile).
2. **M1 — pipeline proof**: extension serves the editor; Electron opens;
   `build.mjs` compiles a demo app in `mock_folder`; pages mount as iframes
   in tldraw frames; interact mode works.
3. **M2 — the loop**: `mock_review` blocking round-trip (send back → tool
   result), `mock_build`, annotate mode (draw/text/pick with selector
   addressing, description box), approve/close termination.
4. **M3 — polish**: `mock_screenshot` (view-preserving capture),
   draw-crop rasterization + stroke compositing, selector re-resolve across
   revisions, WS reconnect, page-selection UX, revision history as tldraw
   app-state (canvas keeps prior frames for comparison).
5. **Later**: Tauri shell, taste-skill library, parent-side diffing of
   revisions, exporting mock → code PR.

## 8. Open questions

1. Proposal page cap (draft: subagent's call, up to ~4 frames).
2. Enforce image-capable model selection in the parent skill, or degrade?
3. When the window closes mid-subagent-turn (not blocked in `mock_review`),
   should the extension hard-abort the run, or let the current turn finish
   and rely on the next tool call returning `{closed: true}`?
   (Draft: the latter — less machinery.)
4. Should `mock_review` also stream "user is typing / drew something"
   previews to the subagent, or strictly batch per round? (Draft: batch.)
