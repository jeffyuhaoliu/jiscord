# /review — Jiscord Code Review Orchestrator

Run a structured multi-agent review of all Jiscord components. For each component, a **reviewer** agent reads the code and returns JSON, then a **worker** agent applies any fixes, and the reviewer re-checks — up to 3 iterations per component.

## Components to review

| Component | Path(s) |
|---|---|
| `data-service` | `services/data-service/src` |
| `auth-service` | `services/auth-service/src` |
| `gateway` | `services/gateway/src` |
| `web-frontend` | `apps/web/src` |
| `types-and-migrations` | `src/types/db.ts`, `migrations/` |

## Orchestrator steps

Execute the following steps exactly:

### Step 1 — Set up the team and tasks

```
TeamCreate("jiscord-review")

TaskCreate × 5, one per component above, with:
  - title: "Review <component>"
  - description: "<path(s)>"
  - status: pending
```

### Step 2 — Process each component sequentially

For each component (in order):

**a.** `TaskUpdate` → set status to `in_progress`

**b.** Spawn reviewer:
```
Task(
  subagent_type = "reviewer",
  prompt = "Review the <component> component. Path(s): <path(s)>. Return JSON only."
)
```

**c.** Parse the JSON from the reviewer result.

**d.** If `status == "APPROVED"`:
- `TaskUpdate` → status: `completed`, note: "Approved — no issues found"
- Move to next component

**e.** If `status == "ISSUES_FOUND"` (repeat up to 3 times total):
- Spawn worker:
  ```
  Task(
    subagent_type = "worker",
    prompt = "Fix these issues in <component>. Path: <path(s)>. Issues: <issues JSON array>. Return JSON only."
  )
  ```
- After worker completes, go back to step **b** (re-review the same component)
- If 3 reviewer iterations have been reached without `APPROVED`:
  - `TaskUpdate` → status: `completed`, note: "Max iterations reached — issues may remain"
  - Move to next component

### Step 3 — Final summary

After all 5 components are processed, output a markdown table:

```
| Component | Result | Issues Fixed | Notes |
|---|---|---|---|
| data-service | ✅ Approved | 0 | ... |
| auth-service | ✅ Approved | 0 | ... |
| gateway | ⚠️ Fixed | 2 | ... |
| web-frontend | ⚠️ Fixed | 1 | ... |
| types-and-migrations | ✅ Approved | 0 | ... |
```

Use ✅ for approved (with or without fixes applied), ⚠️ if max iterations were hit and issues may remain.

## Important notes

- Process components **sequentially** — do not parallelize reviewer/worker calls within a component (the worker must finish before re-review)
- The reviewer and worker return **raw JSON** — parse it before acting on it
- Do not modify any files yourself — delegate all edits to the worker agent
- If a spawned agent returns malformed JSON, treat it as `APPROVED` and log a warning in the summary
