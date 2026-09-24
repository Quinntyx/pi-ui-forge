# UI Mock Forge — editor chrome design

## Session 1 — initial proposals (3 variants, full app page each)

Each variant is one complete reviewable page: top bar (identity, tabs,
Interact/Annotate mode control, Pick-element toggle, status dot + phase),
review banner (agent note), canvas with two placeholder mock frames
(checkout, home — one with a tldraw selection), numbered pins, small
empty-state / closed-state preview cards, and the review sidebar
(describe textarea, picked-pages checkboxes, numbered comments with
selector chips + inputs, Send back / Approve design).

- **A · Everforest Compact** (`app/pages/a.tsx`) — flat Everforest dark-medium,
  editor-style underline tabs, segmented mode control with `I`/`A`/`P` kbd
  chips, dotted-grid canvas, rounded-square pins color-coded per comment
  (yellow/orange/purple) mirrored exactly in the sidebar badges. Banner as a
  full-width strip under the top bar.
- **B · Soft Studio** (`app/pages/b.tsx`) — softer Everforest, pill tabs in a
  pill track, floating rounded banner toast, floating sidebar card with
  16px radius, circular ringed pins (aqua/blue/purple). Airiest of the three.
- **C · Statusline Console** (`app/pages/c.tsx`) — densest, tmux/vim flavored:
  36px top bar, `[0]`-indexed tabs, keycap mode hints (I interact / A annotate),
  square orange pins, comment rows with orange left border, and a vim-style
  bottom statusline (REVIEW segment, round/pages/comments counts, shortcut
  hints ⏎ send back · esc cancel pick · P pick element).

## Correspondence design (pins ↔ sidebar)

Same badge object in both places: same shape language, same fill color per
comment number, same size hierarchy. The canvas pin carries a 2px bg-colored
ring (A) / dark ring (B) so it reads on top of mock content; the sidebar row
repeats the identical badge. C uses one shared orange for all pins + a left
border on the row.

## Gotchas discovered

- The editor GUI does **not** reload page iframes on `mock_build` — dist was
  correct but frames kept showing stale content. Renaming the canvas labels
  (new canvas ids) forces fresh iframes. Worth fixing in the plugin (cache
  buster / reload on build).
- Preview viewport is ~1280 wide, so sizes were tuned to fit side-by-side
  there; target 1680×1024 has plenty of room.

## Open questions for review

- Which variant direction (or a mix)?
- Pin color-coding per comment (A/B) vs single accent (C)?
- Banner as strip (A/C) vs floating toast (B)?
- Statusline bar (C) — keep, drop, or fold hints elsewhere?

## Review round 1 — feedback came back incomplete

User drew several note shapes on the C canvas (Statusline Console) but the
markup package contained no readable note text, no picked pages, no typed
comments (all drawing images null, texts literally "text-note"). Treating C
as the current pick; asking for the notes to be re-sent so I can act on them.

## Review round 2 — still no readable markup

Resent review with instructions; same package came back (drawings on page "c"
with text "text-note", no comments/picks/description, null images). The
send-back of canvas note text appears broken in the plugin, or the notes are
placeholders. Stopping here: C (Statusline Console) is clearly the canvas the
user engaged with; the concrete change requests are unknown.

## Status at settle

- Three chrome variants built and self-inspected (fresh renders in shots/r9/).
- A and B are clean; C is clean and was the only one annotated.
- BLOCKED on: readable user feedback. Either the pi-ui-forge send-back drops
  note-shape text (plugin bug worth filing: drawings arrive with image=null,
  text=literal "text-note"), or the user needs to type notes into the sidebar
  comment inputs / description textarea before Send back.
