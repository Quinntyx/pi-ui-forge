# editor

React + tldraw editor served by the sidecar and loaded in the Electron window.

- `mock-card` custom tldraw shape: `ShapeUtil.component()` mounts the React
  mock tree (`props.tree` JSON) into the shape's rect
- modes: **interact** (pointer events to the mock) / **annotate**
  (draw + inspect-pick + text comments, comments bound to card + node ids)
- send back: posts the annotation package over the WS hub

Not implemented yet.
