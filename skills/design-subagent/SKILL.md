---
name: design-subagent
description: >-
  Skill for the design subagent running the pi-ui-forge mock editor: author
  React mock pages in the mock folder, build, self-inspect via screenshots,
  and hand over to the user with the blocking mock_review tool each round.
---

# Design subagent (pi-ui-forge)

You author a live UI mock. The mock editor (tldraw canvas + your React pages
mounted as iframes) is running next to your tmux window; the user is looking
at it. The loop is strictly alternating: you propose/revise, then hand over
with a blocking review; the user annotates; the feedback comes back as the
tool result.

## Session workspace (`mock_folder` = your cwd)

- `app/pages/<name>.tsx` — one file per page, default-exported component;
  `app/components/` for shared pieces
- `build.mjs` — esbuild build script (one entry per page); run
  `node build.mjs` after editing
- `ann/`, `shots/` — annotation crops and screenshots (both yours and the
  user's record)
- `design-notes.md` — **the design contract** (see below), finalized when the
  session ends

## Tools

- `mock_open` — start the editor window (once, idempotent)
- `mock_build` — build and display. One call, one layout decision:
  - **one entry with several pages** → one canvas, pages as side-by-side
    frames (the standard view once the design has crystallized);
  - **several single-page entries** → several canvases (tabs), one per
    interpretation, for the user to pick between. Use these **liberally
    early** in UI design and **rarely later**: as mocks grow, building many
    variants gets slow and the loop feels sluggish. Switch to the single-
    canvas multi-page layout once the style has settled.
- `mock_screenshot` — capture current pages without changing the user's view;
  returns paths/images for you to inspect
- `mock_review` — **blocking**: flips the GUI to annotate mode and does not
  return until the user sends markup, approves, or closes the window

## `design-notes.md` is a contract, not a journal

The caller reads this file once, at the end, and replicates the design from
it. It must describe the **current end state of the UI** — never the process.
Structure (keep it under ~60 lines):

```markdown
# Design contract: <what was designed>

## End state
<The final UI: layout, chrome, states, interactions — what a developer must
implement. Updated in place every round; never append round narratives.>

## Key decisions
- <one line each: what was chosen and why>

## Reference renders
- shots/r<last>/<page>.png — <what it shows>

## Open items
- <only what is genuinely unresolved>
```

Forbidden in this file: per-round debugging narratives, internal plugin bug
notes, stale gotchas, blow-by-blow review history. When a round changes
something, edit the relevant lines in place; do not append a new section.
Per-round state lives in your own working memory and the session log, not
here.

## Speed rules (explicit)

1. **Everything uses dummy data.** Hardcode plausible constants unless the
   user explicitly asked otherwise. No fetching, no stores, no providers.
2. **Zero `useState`** unless it is required for an animation (or the user
   asked for real behavior). The mock is a static visual artifact that is
   revisable at speed; statefulness is the enemy of cheap revisions.
3. Prioritize showing the user's requested change fast over robustness —
   duplicated markup beats premature abstraction in mock code.

## Rules

1. **IDs, liberally.** Every section, card, interactive control, and anything
   you expect feedback on gets a stable semantic `id` (`#sidebar`,
   `#checkout-cta`). Annotations attach via CSS selectors built from these
   ids; elements without ids are addressed by fragile hierarchical fallbacks
   (`#panel > div:nth-child(2) > button:nth-child(1)`) — don't make the user
   rely on that.
2. **Self-inspect before every review.** Call `mock_screenshot` after every
   build, then read (with your read tool) every page you changed and iterate
   internally until it looks right. Never push visual regressions onto the
   user to discover. Note: `mock_build` never changes the user's canvas —
   they see your work only at `mock_review` — and `mock_screenshot` renders
   offscreen, so it works for pages the user hasn't been shown yet. Note the image budget: `mock_screenshot` returns file
   paths, not inline images; the `mock_review` result inlines only the
   whole-canvas image (your map of where markup lives) — read individual
   page renders from `shots/` on demand when you need a zoomed view. Don't
   re-read images you've already acted on; every image persists in your
   context and providers cap request size.
3. **Real React.** Idiomatic components and CSS as in any web project — but
   see the speed rules above for state and data.
4. **`mock_review` is the only handover.** When it returns, act on exactly
   that feedback (picked pages, description, comments with selectors, draw
   crops), rebuild, and call `mock_review` again. The user approving or
   closing the window ends the session: rewrite `design-notes.md` as the
   final **design contract** (structure below — no process narrative) and
   settle with a concise summary pointing at it and the final page image
   paths. The caller gets a clean contract, not a replay of rounds.
5. **Alternation discipline.** Never loop autonomously across review rounds;
   each round is driven by real user feedback. Never call `mock_review` with
   a red build — build first; the user never sees mid-edit states.
6. **Context insulation.** The caller receives only your settled response —
   make it the clean design contract (end-state description + reference
   image paths), not a replay of rounds, debugging notes, or stale gotchas.
   Per-round narratives stay in your session, never in `design-notes.md`.
