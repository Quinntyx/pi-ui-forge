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
- NO topbar tabs: designs are PROPOSAL OPTIONS, not persistent tabs. They
  render as a squared tab-style strip (`#design-options`: 0 encyclopedia /
  1 liquid glass / 2 brutalist + "⏎ continue with <name>" hint) attached
  above the prompt input — old `.tab` look (square, green top-inset on the
  active one), NOT pills. Only on turns proposing multiple mocks; enter
  commits the selected one and the rest are hidden (code lingers for
  porting elements).
- Topbar layout: interact/annotate mode toggle on the LEFT; theme toggle +
  approve on the right.
- Themes: everforest light-medium (DEFAULT on state pages) + dark-medium via
  working sun/moon `#theme-toggle` left of the mode toggle (one useState —
  the only interactive state in the mock). All chrome colors are CSS vars
  overridden under `.app.light`; mock frames keep their own palettes.
- Style modal is tldraw-exact: 3×4 grid of CIRCULAR swatches, black
  upper-left (12 everforest-reskinned hues as `--sw-*` vars, follow theme),
  blue opacity slider (thumb right), fill row (tldraw stacked-sheet icons),
  dash row (tldraw circle icons: solid/dashed/dotted/thin), S/M/L/XL size row
  (L active, blue ring). Panel shell squared-off (0 radius) per theme.
- Annotate canvas is two-up: the picked design full-size with a dashed blue
  `frame-selected` outline, the next design as a dimmed 0.45-scale ghost
  frame to its LEFT (`frame-ghost`, slot + transform-scale — zoom is
  unreliable in the renderer). Main page must keep ≥130px left margin so the
  popup (centered over the badge) never clips.
- Comment popup editor (`#comment-pop`) is CENTERED above the number badge
  (`left: -125px` of the pop-anchor; arrow at 120px) and shows the target
  selector line (`.pop-sel`, like the pin hover tooltips). The badge stays
  pinned at the TOC's top-left corner — its final submitted spot.
- `#send-back` glyph nudged 1px down (padding-top 1px).
- Pick-element floats SEPARATELY from the tool dock (its own `#pick-panel`
  above the dock in `#dock-stack`), but styled like a dock tool: one border
  layer (the panel shell), 30px icon-only button, 17px icon. Armed
  (orange `pick-btn-on`) in annotate; present but disabled/grayed in work,
  plain in interact.
  Picking cancels the selected tldraw tool and vice versa.
- Tool dock AND pick button are disabled (real `disabled` attr, grayed) in
  the work state; pick panel + dock render in ALL three states.
- Work state shows ONLY the progress bar (banner dropped as redundant):
  spinner + "revising <design> — <detail>" + meta line.
- `#send-back` glyph nudged DOWN (padding-top 3px) — earlier nudge went the
  wrong way.

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
- The offscreen screenshot cache is keyed by page name AND can serve stale
  renders after relabels (r34/r35 identical); diff against an older shot to
  detect staleness, then bump data-build + relabel + rebuild until fresh.
- The capture viewport is ~1284 CSS px (1400px image at ~1.09 scale) —
  two 760px frames don't fit side by side at full size.

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
