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

## Reference renders
- `shots/rN/` — per-round canvas captures (r11 = last push before this round).

## Open items (current round)
1. Full frame labels — applied: every frame shows `design name · revision`
   (`encyclopedia · r3`; working state shows `encyclopedia · r3 → r4`).
2. Pin anchoring — applied: pins are now children of their target elements
   (wiki: infobox image / Behaviour h2 / lead paragraph; glass: nav / hero /
   stat row), so they can never drift outside the card or hide behind the
   popup comment editor.
