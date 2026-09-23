# pi-ui-forge

tldraw-based UI mock forge for [pi](https://github.com/earendil-works/pi).
The agent (or a design subagent) renders a React mock onto a tldraw canvas in
its own Electron window; the user interacts with it, annotates it, sends the
annotations back, and the mock is revised live. Design doc: [PLAN.md](PLAN.md).

Status: design / scaffold. Not implemented yet.

## Layout

- `index.ts` — pi extension: tools (`mock_open`, `mock_update`, `mock_wait`)
- `server/` — `pi_ui_forge` Python sidecar: editor hosting (HTTP/WS), Electron
  lifecycle, pi-sock bridge to the design subagent
- `editor/` — React + tldraw editor (mock-card shape, interact/annotate modes)
- `shell/` — minimal Electron main process (one BrowserWindow, quits on close)
- `docs/` — protocol specs as they stabilize

## Install (once real)

```sh
pi install git:git.quinntyx.dev/quinntyx/pi-ui-forge
```
