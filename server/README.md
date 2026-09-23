# pi_ui_forge sidecar

Python hub: HTTP/WS server hosting the editor build and the mock app bundle,
Electron shell lifecycle, build trigger (`node build.mjs`, esbuild), and in
subagent mode the pi-sock bridge to the design subagent (reuses
`pi_subagents.client`).

Session data lives under `/tmp/pi-ui-forge/<session>/` (never `~/.pi`):

    app/          design subagent's React source (pages/, components/)
    build.mjs     shipped build script (esbuild, one entry per page)
    dist/         bundle + manifest.json (sidecar watches → WS push)
    ann/          user draw crops (PNG)
    shots/        mock screenshots (subagent self-inspection / agent view)
    control.sock  JSONL control socket (extension tools + editor relay)
    meta.json     session descriptor

Runs two ways:
- **library** — `import pi_ui_forge` from the orchestrating PTC chunk
  (`await forge.open(...)`, `await session.wait_closed()`)
- **process** — `python -m pi_ui_forge serve --home <dir>` spawned by the pi
  extension (agent mode); JSONL control socket protocol (see ../PLAN.md §3)

Not implemented yet.
