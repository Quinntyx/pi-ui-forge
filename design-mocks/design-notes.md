# Editor chrome — design contract (converged)

## End state
A pi-ui-forge editor-chrome mock: dense, tmux/vim-flavored "Statusline Console"
theme (Everforest dark-medium, JetBrains Mono) around a tldraw-style canvas.

- 36px top bar: `[i]`-indexed underline tabs (encyclopedia / liquid glass /
  brutalist), `I`/`A` mode toggle with keycaps, DevTools-style inspect-element
  button + `P` keycap, ghost `approve` button in the corner (annotate only).
- Canvas: dotted grid, mock frames with `┌` frame labels (design name +
  revision, e.g. `encyclopedia · r3` / `… · r3 → r4`).
- Floating chrome on the viewport: vertical tldraw tool dock (bottom-left),
  tldraw-exact style MODAL (top-left): 2×5 rounded color swatches + active
  ring, blue opacity slider (thumb right), dash row, fill row, S/M/L/XL size
  row — reskinned to Everforest.
- Annotate state: agent banner + prompt bar stack (`#prompt-stack`) floats
  bottom-center; icon-only green send-back (`⏎`); popup comment editor
  appears at the picked element (numbered next-color badge + input +
  `⏎` finalize · esc cancel hint).
- Working state: progress bar (spinner, meta, esc to interrupt) replaces the
  prompt bar; pick control dimmed.
- Interact state: no pins/dock/panel/prompt; blue `I` keycap active.
- Bottom statusline replaces any status pill: accent segment signals state —
  green `REVIEW` / orange `WORKING` / blue `INTERACT` — plus round/page/
  comment counts and right-aligned key hints. No app identity, no version.
- Themes: everforest light-medium (DEFAULT on state pages) + dark-medium via
  working sun/moon `#theme-toggle` left of the mode toggle (one useState —
  the only interactive state in the mock). All chrome colors are CSS vars
  overridden under `.app.light`; mock frames keep their own palettes.
- Style modal is tldraw-exact: 3×4 grid of CIRCULAR swatches, black
  upper-left (12 everforest-reskinned hues as `--sw-*` vars, follow theme),
  blue opacity slider (thumb right), fill row (tldraw stacked-sheet icons),
  dash row (tldraw circle icons: solid/dashed/dotted/thin), S/M/L/XL size row
  (L active, blue ring). Panel shell squared-off (0 radius) per theme.
- Popup comment editor (`#comment-pop`) opens CENTERED above the picked
  element, arrow down — same geometry as the hover pin tooltips
  (`.pop-anchor` is width: fit-content for this).
- Pick-element is NOT a tldraw tool: it lives in its own floating panel
  (`#pick-panel`) above the tool dock in a shared `#dock-stack` (10px gap).
  Armed (orange) in annotate — which deselects any tldraw tool; hidden while
  working (nothing pickable); removed from the topbar.
- Work state shows ONLY the progress bar (banner dropped as redundant):
  spinner + "revising <design> — <detail>" + meta line.

## Key decisions
- Single shared `Chrome` component (`app/components/chrome.tsx`) + three
  deliberately-different mock designs (`wiki`, `glass`, `brutal`) proving the
  chrome works on any page. State pages: `a` (annotate), `a-work`, `a-interact`.
- Pins: numbered rounded squares, color-coded per comment
  (yellow/orange/purple, blue = new popup comment), hover tooltip shows
  `selector` + text. Pin ↔ comment color identity shared.
- No useState; all states are separate pages; everything is dummy data.
- Semantic ids liberally: `#topbar`, `#tabs`, `#pick-control`, `#pick-btn`,
  `#topbar-approve`, `#tool-dock`, `#style-panel`, `#prompt-stack`,
  `#review-banner`, `#prompt-bar`, `#send-back`, `#progress-bar`,
  `#statusline`, `#comment-pop`, `.pop-target`.

## Pipeline gotchas (current)
- mock_build only builds; the GUI updates on mock_review. mock_screenshot
  renders OFFSCREEN (fresh, works for undisplayed pages).
- The editor hot-swap hash covers bundle.js ONLY — CSS-only rebuilds do NOT
  hot-swap GUI iframes (stale-css trap; offscreen screenshots are immune).
  Force a reload by touching the TSX (any JS change) or renaming the canvas.
- Drawing crops can still arrive image:null — typed comment text + the
  whole-canvas image are reliable; zoom the canvas jpg for placed reference
  images.
- a-interact offscreen captures rendered clipped once (r25); a rebuild +
  solo canvas fixed it (r27).

## Open items (current round)
1. Full frame labels — applied + verified r28: every frame shows
   `design name · revision` (`encyclopedia · r3`; working state shows
   `encyclopedia · r3 → r4`).
2. Pin anchoring — applied + verified r28: pins are children of their target
   elements (wiki: infobox image / Behaviour h2 / lead paragraph; glass: nav /
   hero / stat row; brutal: index-card image / BEHAVIOUR button / headline),
   so they can never drift outside the card or hide behind the popup comment
   editor. Popup comment editor anchors correctly on wiki (TOC) and glass
   (active pill) with down-arrow + finalize/cancel hints.

## Session gotcha (r28, fresh subagent)
- mock_screenshot saves only ONE page per call in this environment — request
   pages solo ("[\"a\"]") and read each path; batched requests silently save
   just the first page. Old shots/r1..r7 dirs contain stale files from a
   reset round counter — trust file mtimes, not the round number.
