# pi_ui_forge sidecar

Python sidecar process: HTTP/WS hub hosting the editor build, Electron shell
lifecycle, and (subagent mode) the pi-sock bridge to the design subagent.

Runs two ways:
- **library** — `import pi_ui_forge` from the orchestrating PTC chunk
  (`await forge.open(...)`, `await session.wait_closed()`)
- **process** — `python -m pi_ui_forge serve --control <sock>` spawned by the
  pi extension (agent mode); JSONL control socket protocol (see ../PLAN.md §3)

Not implemented yet.
