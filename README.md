# pi-ui-forge

Lovable-style UI mock design loop for [pi](https://github.com/earendil-works/pi),
built on tldraw. The agent authors real React mock pages and drives a tldraw
editor in its own Electron window; the user annotates and approves; the loop
is questionnaire-style — the agent blocks in a feedback tool (`mock_review`)
while the user marks up, and acts only on the markup that comes back.
Design doc: [PLAN.md](PLAN.md).

## How it works

The forge runs directly in a pi agent — **any agent, main profile included**.
There is no subagent system involved in the base case and no main-profile
plugin needed. The only hard dependency is
[pi-sock](https://github.com/earendil-works/pi-sock): the editor talks to the
agent over an HTTP/WS server that the extension runs in-process, so the GUI
and the driving agent connect directly with no sidecar process.

The bundled [`design-ui` skill](skills/design-ui/SKILL.md) teaches the agent
the loop: write React mock pages into a mock folder, build them, self-inspect
via offscreen screenshots, and hand over to the user with the blocking
`mock_review` tool each round. It works identically whether the agent is the
user's main session or a dedicated design subagent.

## Layout

- `index.ts` — the pi-ui-forge extension: HTTP/WS server + Electron
  lifecycle + tools (`mock_open`, `mock_build`, `mock_screenshot`,
  `mock_review`)
- `editor/` — React + tldraw editor (pages as same-origin iframes in
  mock-page tldraw shapes, interact/annotate modes, inspect-pick with
  CSS-selector addressing); `editor/dist` is committed prebuilt (pi git
  installs run `npm install`, not builds)
- `shell/` — minimal Electron main (one BrowserWindow, quit-on-close,
  Wayland-friendly, answers full-window capture requests)
- `scripts/` — `build.mjs` (esbuild mock-app build written into each mock
  folder), `runtime.js` (injected into every mock page: capture +
  inspect-pick + highlight), `smoke-server.mjs` (end-to-end smoke test
  harness)
- `skills/design-ui/` — the bundled skill: how to author mocks with the
  forge tools (works in any agent; installed by the package)
- `skills/ui-mock/` — an **example**, NOT installed by the package: how to
  wire the forge into a subagent-orchestration stack (see below)

## Install

```sh
pi install git:git.quinntyx.dev/quinntyx/pi-ui-forge
```

## Usage

In any agent with the forge installed, the `design-ui` skill covers the
whole loop: the agent creates a mock folder, writes the React mock app
(`app/pages/`, built with the generated `build.mjs`), calls `mock_open` to
start the editor window, iterates with `mock_build` / `mock_screenshot`, and
blocks in `mock_review` for the user's markup. Approving or closing the
window ends the session with `design-notes.md` as the finalized design
contract.

## Optional: driving it from a subagent orchestration stack

If you run [pi-pycells](https://github.com/Quinntyx/pi-pycells) with
pi-subagents, the editor can instead be the control plane for a dedicated
design subagent: your main agent spawns one (its cwd = the mock folder), the
subagent drives the editor, and closing the window returns the final design
contract to the parent, which replicates it pixel-near in the real codebase.

This section is **optional** — the forge works fine without it. There is no
supported install for it; [`skills/ui-mock/`](skills/ui-mock/SKILL.md) is an
example of how such an integration looks, and it hardcodes the author's own
`~/.config/pi/profiles` layout. If you want this setup, **copy that skill
folder into your main agent's skills directory and adapt it to your setup**
(profile/agent dir, mock-folder conventions, brief structure). Two things
changed upstream to be aware of while adapting:

- the subagent profile needs pi-ui-forge in its packages, alongside
  pi-pycells and pi-subagents;
- `pi-subagents` no longer takes a `profile=` kwarg — pass `agentDir` (an
  absolute path to your profile/agent directory) instead, e.g.
  `subagents.agent(brief, name="designer", agentDir=<path>, cwd=mock_folder)`,
  so you are not tied to the `~/.config/pi/profiles` layout.

## Development

```sh
npm install                # deps incl. electron + esbuild
npm run build:editor       # rebuild editor/dist after editor/src changes
npm run smoke              # end-to-end smoke test (needs a display; tmux OK)
```

Typecheck the extension and editor with `npm run check`.
