# Editor chrome — design contract (converged, FINAL r28)

## Post-replication verification (r1/r2 rounds, rebuilt editor)
After the chrome was replicated pixel-near in the real editor, the mock was
reopened in the rebuilt editor (build ok) and pages a / a-work / a-interact
were rebuilt and self-inspected against this contract, then handed over via
mock_review. The review window was closed with zero markup — no annotations,
no regressions reported. Renders: shots/r1/a.jpg (annotate), shots/r1/a-work.jpg
(work), shots/r2/a-interact.jpg (interact).

Status: converged and approved (twice — initial and resumed session, both
closed with zero markup). This file is the hand-off contract; replicate from
it and the renders below.

## Verified renders (final)
- shots/r3/a.jpg — annotate state, wiki (`encyclopedia · r3`)
- shots/r4/a-work.jpg — working state (`encyclopedia · r3 → r4`)
- shots/r2/a-interact.jpg — interact state
- shots/r5/glass.jpg — glass design, annotate (pin anchor verification)
- shots/r6/brutal.jpg — brutalist design, annotate (pin anchor verification)

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
- Topbar layout (APPROVED r52): interact/annotate mode toggle on the LEFT;
  theme toggle + approve on the right in a `.topbar-right` group with 7px
  gap; bar padding 0 7px 0 10px so approve sits 7px from the right edge —
  x/y spacing balanced (7px vertical breathing room in the 36px bar).
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

## APPROVED — final layout specification (build r51, data r52)

- Topbar: mode toggle (interact/annotate, key badges) LEFT; `.topbar-right`
  (theme sun/moon + approve, 7px gap) RIGHT; bar padding 0 7px 0 10px.
  NO tabs — design proposals are a squared tab-strip (`#design-options`,
  flush to the prompt-bar's left edge, green bottom-inset on active) above
  the prompt input, with a "⏎ continue with <name>" hint, only on proposal
  turns; enter commits the pick, others hidden.
- Left rail: pick-element floats in its own `#pick-panel` (single border
  shell, 30px icon-only button, 17px icon) above `#tool-dock`; both render
  in annotate/work/interact; both disabled (real `disabled`) while working.
- Comment popup: centered above the corner-pinned number badge, shows the
  `.wiki-toc` selector line like pin hover tooltips.
- Two-up canvas: dashed-blue selected main frame + dimmed 0.45-scale ghost
  of the next design to its left.
- Statusline: REVIEW/WORKING/INTERACT console chrome; send-back glyph
  nudged 1px down.

Final page images: shots/r52/a.jpg, shots/r52/a-work.jpg,
shots/r52/a-interact.jpg (canvas: shots/r52/canvas.jpg).
Resumed-session review canvas: shots/r4/canvas.jpg.

## Pin anchoring (verified)
Pins are children of their target elements (wiki: infobox image / Behaviour
h2 / lead paragraph; glass: nav / hero / stat row; brutal: index-card image
/ BEHAVIOUR button / headline), so they can never drift outside the card or
hide behind the popup comment editor. Popup comment editor anchors correctly
on wiki (TOC) and glass (active pill) with down-arrow + finalize/cancel
hints.
