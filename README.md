# pi-ui-forge

Lovable-style UI mock design loop for [pi](https://github.com/earendil-works/pi),
built on tldraw. A **design subagent** (dedicated `design-subagents` pi
profile) authors real React pages and drives a tldraw editor in its own
Electron window; the user annotates and approves; the loop is
questionnaire-style — the subagent blocks in a feedback tool while the user
marks up. Design doc: [PLAN.md](PLAN.md).

**No main-profile plugin.** The parent agent uses pi-subagents normally
(guided by the `ui-mock` skill); the frontend talks to the subagent directly,
in TypeScript, in-process.

## Layout

- `index.ts` — pi-ui-forge extension (design-subagents profile only):
  HTTP/WS server + Electron lifecycle + tools
  (`mock_open`, `mock_build`, `mock_screenshot`, `mock_review`)
- `editor/` — React + tldraw editor (pages as same-origin iframes in frames,
  interact/annotate modes, inspect-pick with CSS-selector addressing);
  `editor/dist` is committed prebuilt (pi git installs run `npm install`,
  not builds)
- `shell/` — minimal Electron main (one BrowserWindow, quit-on-close,
  Wayland-friendly, answers full-window capture requests)
- `scripts/` — `build.mjs` (esbuild mock-app build written into each mock
  folder), `runtime.js` (injected into mock pages: capture + inspect-pick),
  `smoke-server.mjs` (end-to-end smoke test harness)
- `skills/ui-mock/` — parent-facing skill: spawn, wait, replicate pixel-near
- `skills/design-subagent/` — subagent-facing skill: loop mechanics, taste,
  mock-speed rules (dummy data, no useState)

## Prerequisites

- `pi-subagents` ≥ the `profile=` kwarg version
  (`subagents.agent(..., profile="design-subagents", cwd=...)`)
- a `~/.config/pi/profiles/design-subagents` profile (mirror the `subagents`
  profile) with pi-ui-forge in its `packages`

## Development

```sh
npm install                # deps incl. electron + esbuild
npm run build:editor       # rebuild editor/dist after editor/src changes
npm run smoke              # end-to-end smoke test (needs a display; tmux OK)
```
