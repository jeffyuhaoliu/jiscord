# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Definition of Done (DoD)
Every implementation task must conclude with:
- Self-Code Review: Critical review of the implementation to see if your changes align with architecture of this project. If this is code, take advantage of default PR Review subagent. 
- Architecture Verification: Ensure strict adherence to the TS/ScyllaDB/Redis architecture.
- Documentation: Update READMEs or API docs. For complex logic, generate a Mermaid diagram to document the flow.
- Git Commit: After everything has been completed, make sure to commit the changes.

# Architecture & Tech Stack
Backend: TypeScript (Node.js).
Real-time Layer: WebSockets (Gateway service) using Redis Pub/Sub for event distribution.
Storage: ScyllaDB (Docker) for message persistence. Use Query-First modeling (define access patterns before schema).
Data Service Layer: A dedicated TS service for ScyllaDB queries.
Constraint: Must implement Request Coalescing (e.g., Dataloader pattern) to prevent database hammering.
Frontend: React (TypeScript).
