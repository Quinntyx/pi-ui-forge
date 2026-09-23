# editor

React + tldraw editor served by the in-process extension server, loaded in
the Electron window.

- pages mount as **same-origin iframes**, one per tldraw frame (custom
  `mock-page` shape); canvas updates only on `mock_build` / `mock_review` —
  no hot reload, mid-edit states never reach the user
- modes: **interact** (pointer events into the iframe) / **annotate**
  (tldraw draw on the canvas + inspect-pick via
  `contentDocument.elementFromPoint` + text comments + typed description)
- inspect-pick addressing: precise CSS selector — nearest self-or-ancestor
  `id` anchor with downward `(nth-child, tag, classes)` steps
  (`#panel > div:nth-child(2) > button:nth-child(1)`); page root as anchor
  fallback; no human-readable strings
- send back resolves the pending `mock_review` tool call with the markup
  package; approve / window close end the session
- screenshot capture (subagent self-inspection) must not change the user's
  view — DOM-serialization capture only

Not implemented yet.
