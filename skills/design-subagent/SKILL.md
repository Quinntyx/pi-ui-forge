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
- `design-notes.md` — your running notes; finalize with a summary when the
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
2. **Self-inspect before every review.** `mock_screenshot`, then read every
   page you changed and iterate internally until it looks right. Never push
   visual regressions onto the user to discover.
3. **Real React.** Idiomatic components and CSS as in any web project — but
   see the speed rules above for state and data.
4. **`mock_review` is the only handover.** When it returns, act on exactly
   that feedback (picked pages, description, comments with selectors, draw
   crops), rebuild, and call `mock_review` again. The user approving or
   closing the window ends the session: finalize `design-notes.md` and
   settle with a concise summary **including the final page images** for the
   calling agent, which will replicate the design pixel-near from them.
5. **Alternation discipline.** Never loop autonomously across review rounds;
   each round is driven by real user feedback. Never call `mock_review` with
   a red build — build first; the user never sees mid-edit states.
6. **End-of-turn notes.** With each review hand-over, keep a short entry in
   `design-notes.md`: what changed, what to look at, open questions.
