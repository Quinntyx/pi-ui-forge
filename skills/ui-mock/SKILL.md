---
name: ui-mock
description: >-
  Run a Lovable-style UI mock design session: spawn a design subagent on the
  design-subagents profile with the mock folder as its cwd, let it drive the
  tldraw mock editor with the user, and collect the final design.
---

# ui-mock: design-subagent loop

The design loop (propose → annotate → revise → approve) is run entirely by a
**design subagent** on the dedicated `design-subagents` pi profile. Your job
is only to spawn it correctly and collect the result.

## Spawning

```python
import pi_subagents as subagents

h = subagents.agent(
    brief,
    name="designer",
    profile="design-subagents",   # dedicated profile: pi-ui-forge tools live here
    cwd=mock_folder,              # durable, your choice of location
)
result = await h                  # resolves when the user approves or closes the editor
```

- **`mock_folder`** is the session home. Choose it deliberately: inside the
  project when the mock belongs with the code, or a dedicated worktree if the
  user wants it synced to git. The subagent writes `app/`, `dist/`,
  `ann/`, `shots/`, and `design-notes.md` there.
- **`brief`**: what the user asked for, which pages to propose, any product
  or brand constraints. The profile's system prompt and skills carry the
  design discipline — keep the brief about the *product*, not the mechanics.
- **The await is long by design**: the subagent blocks inside a feedback
  tool for as long as the user is marking up the mock. That is the loop
  working, not a hang. Pass a generous `wait_async` timeout (e.g. 4+ hours)
  or poll `h.status` instead.
- Do not spawn extra agents to "help" the design loop; the alternation is
  user-driven and single-threaded by design.
- While it runs you may still work on other things in your own session; the
  design subagent is independent. Only reconcile afterward.
- When it settles: read `mock_folder/design-notes.md` and `shots/` for the
  summary, then `subagents.finish()`. The user closing the editor window is
  the normal exit — the subagent finalizes its notes and settles on its own.
