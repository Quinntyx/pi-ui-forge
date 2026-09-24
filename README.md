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
- `skills/design-ui/` — the bundled skill: how to author mocks with the
  forge tools (works in any agent)
- `skills/ui-mock/` — optional, NOT installed by the package: the
  pi-ptc-next + pi-subagents orchestration skill (spawn a design subagent
  on the dedicated profile, collect the contract, replicate pixel-near)

## Install & usage

```sh
pi install git:git.quinntyx.dev/quinntyx/pi-ui-forge
```

Generic usage (any agent, main profile is fine): the bundled `design-ui`
skill covers the loop — the agent writes the mock app into a folder of its
choosing, drives the editor tools, and hands over with `mock_review`.

## Using it as a design-subagent loop (author's setup)

If you run [pi-ptc-next](https://github.com/Quinntyx/pi-ptc-next) with
pi-subagents, the editor becomes the control plane for a dedicated design
subagent: your main agent spawns one (profile `design-subagents` with
pi-ui-forge in its packages, cwd = the mock folder), the subagent drives the
editor, and closing the window returns the final design contract to the
parent. Setup:

- create a `~/.config/pi/profiles/design-subagents` profile (mirror the
  `subagents` profile) with pi-ui-forge in its `packages`
- **manually copy `skills/ui-mock/` from this repo into your main profile's
  `skills/` directory** — it is deliberately excluded from package
  installation (it is only useful with the pi-ptc-next/pi-subagents stack,
  and pi has no way to install a skill into a different profile than the
  package's). It's a plain folder — copy it once, update it when the repo
  moves.
- `pi-subagents` needs the `profile=` kwarg (`subagents.agent(...,
  profile="design-subagents", cwd=...)`), which pi-ptc-next's PTC venv
  auto-provisions alongside.

## Development

```sh
npm install                # deps incl. electron + esbuild
npm run build:editor       # rebuild editor/dist after editor/src changes
npm run smoke              # end-to-end smoke test (needs a display; tmux OK)
```
