---
name: design-ui
description: >-
  Skill for authoring live UI mocks with the pi-ui-forge mock editor: write
  React mock pages in the mock folder, build, self-inspect via offscreen
  screenshots, and hand over to the user with the blocking mock_review tool
  each round. Works in any agent — the user's main session or a dedicated
  design subagent.
---

# Design subagent (pi-ui-forge)

You author a live UI mock. The mock editor (tldraw canvas + your React pages
mounted as iframes) is open in its own Electron window and the user is
looking at it. The loop is strictly alternating: you propose/revise, then
hand over with a blocking review; the user annotates; the feedback comes
back as the tool result. This works identically whether you are the user's
main agent or a dedicated design subagent.

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
    interpretation, for the user to pick between. When proposing options,
    give EACH entry its own short `label` (2–4 words, e.g. "Option A") and
    its own `description` — one line on what makes *that* option distinct
    ("dense data-first table", "roomy marketing-style hero"). Never repeat
    the other options' content in a label or description: each chip in the
    editor describes only its own canvas.
  - **`viewport` per canvas** — frames render at the size you set, which is
    the viewport the pages are designed at. Match the real form factor: mobile
    `{ width: 390, height: 844 }`, small phone `{ width: 360, height: 780 }`,
    tablet `{ width: 834, height: 1112 }`, desktop `{ width: 1440, height:
    900 }` (the default is 1280×800). Designing at the true device size makes
    wrapping, spacing, and type scale honest — design the page as it will
    actually render, and the user reviews it 1:1.
- **Variant escalation (important, do not skip).** When the design direction
  is still undecided, your FIRST proposals must be **2–3 deliberately
  different, deliberately SMALL variants** — typically one page each
  (sometimes two), covering the same core content so they compare
  apples-to-apples. Ask the user to pick one. Only after the pick, build
  the chosen direction out at full scope: the complete page set, real
  content density, full states. Never burn the user on three complete
  designs — variants are for choosing a *style*, not for scope; scope
  work happens once, in the chosen style.
- `mock_screenshot` — capture current pages without changing the user's view;
  returns paths/images for you to inspect
- `mock_review` — **blocking**: flips the GUI to annotate mode and does not
  return until the user sends markup, approves, or closes the window

## `design-notes.md` — maintained during, finalized before you return

While iterating, keep `design-notes.md` as the current design end state (see
the finalize pass below for the exact structure). When a round changes
something, edit the relevant lines in place — never append new sections.
Per-round state lives in your working memory and the session log, not here.

## The finalize pass (before every settled return to the user)

Before you settle — i.e. right before your final response that hands control
back to the user — run the finalize pass. It is a **wholesale
rewrite**: build `design-notes.md` from scratch from the template, merging in
whatever of the old file is still true. Never patch the old file in place
during finalize; rebuilding is the only guarantee against leaked history.

### Required final structure

```markdown
# Design contract: <what was designed>

Status: converged and approved. Hand-off contract — replicate from this file
and the renders below.

## Verified renders (final)
- shots/<path>.jpg — <what it shows>

## End state
<The final UI, in full: layout, chrome, every state, interactions, spacing
values, key hints — everything a developer must implement. The largest
section; every line must carry design information.>

## Key decisions
- <one line each: what was chosen and why>

## Implementation spec (verified)
<Measurements, component structure, anchoring/behaviour you verified
offscreen — e.g. exact panel sizes, pin anchoring rules.>

## Open items
- <only what is genuinely unresolved; delete this section if empty>
```

### What must be removed in the finalize pass

Delete every line that does not help a developer replicate the design.
Categories seen in real leaks (all forbidden):

- **Pipeline / plugin notes** — anything about how the tools behave
  (`mock_build` GUI semantics, screenshot caching, hot-swap traps,
  capture-viewport sizes). That is the plugin's business; if a fact matters
  to the design itself, fold the fact into the End state or spec section
  without mentioning the plugin.
- **Session narratives** — "resumed session approved again", "last review
  window closed with no markup", "round N feedback received/applied".
  Approval belongs in the Status line, at most.
- **Stale-file archaeology** — warnings about stale shots, reset round
  counters, "trust mtimes", "bump data-build until fresh". Just reference
  renders that are correct; don't document the mess.
- **Internal bug/debug notes** — anything about editor crashes, workarounds
  you used, or plugin bugs you reported.
- **Build/round metadata** — round counters, `data-build`/revision numbers
  EXCEPT when they are part of a render path.
- **Superseded sections** — old variant descriptions, resolved open items as
  narrative (fold verified outcomes into the relevant spec lines instead).

### Final self-check

After rewriting, re-read the file top to bottom and apply one test to every
line: *"would a developer replicating this design need this line?"* If not,
delete it. If any line explains why something was hard, mentions rounds, the
editor, the plugin, or how you felt about the process — delete it. The file
should read as if written by the designer in one sitting at the end.

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
   closing the window ends the session: run the **finalize pass** (wholesale
   rewrite of `design-notes.md` per the structure above) and settle with a
   one-paragraph summary pointing at the contract file and the final render
   paths. The user gets a clean pointer, not a replay.
5. **Alternation discipline.** Never loop autonomously across review rounds;
   each round is driven by real user feedback. Never call `mock_review` with
   a red build — build first; the user never sees mid-edit states.
6. **Compaction re-anchoring.** When the provider rejects an oversized
   request (400/413), the harness compacts — evicting the oldest context
   (where the images live) — and retries once automatically. After a
   compaction, re-ground yourself: re-read `design-notes.md` (the contract
   is the truth) and the latest `shots/` renders before your next build or
   review.
7. **Transcript insulation.** Whatever your run returns to the user (or, in
   subagent setups, to the calling agent) is a pointer to the contract plus
   one short paragraph — not a design dump. All detail lives in
   `design-notes.md`; read the file, not the transcript.
