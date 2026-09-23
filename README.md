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
  interact/annotate modes, inspect-pick with CSS-selector addressing)
- `shell/` — minimal Electron main process (one BrowserWindow, quits on close)
- `skills/ui-mock/` — parent-facing skill: how to spawn and reap the design
  session
- `skills/design-subagent/` — subagent-facing skill: loop mechanics + taste

## Prerequisite

`pi-subagents` needs a `profile=` kwarg (`subagents.agent(..., profile="design-subagents", cwd=...)`,
default `"subagents"`) — see PLAN.md §2.

## Install (once real)

- `pi-subagents`: add the `profile` kwarg
- create `~/.config/pi/profiles/design-subagents` (mirror the `subagents`
  profile) with pi-ui-forge in its `packages`
- main profile: install `skills/ui-mock/`
