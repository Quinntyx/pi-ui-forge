# editor

React + tldraw editor served by the sidecar, loaded in the Electron window.

- pages mount as **same-origin iframes**, one per tldraw frame (custom
  `mock-page` shape); bundle swaps reload iframes without touching layout
- modes: **interact** (pointer events into the iframe) / **annotate**
  (tldraw draw on the canvas + inspect-pick via
  `contentDocument.elementFromPoint` + text comments + typed description)
- inspect-pick addressing: nearest self-or-ancestor `id` anchor, with
  hierarchical fallback (`button.btn, first child of first child of #panel`)
- send back: picks pages, posts annotation package (§6 of ../PLAN.md)
- screenshot capture (subagent self-inspection, agent view) must not change
  the user's view — DOM-serialization capture only

Not implemented yet.
