# Architecture Decision Records

ADRs capture significant, hard-to-reverse decisions: architecture boundaries, protocols, data-model/schema changes, stack changes, hardware/Ableton integration approaches, and anything listed under "requires approval" in `AGENTS.md`.

## When to write one

- A human has **made** a decision from `docs/DECISIONS_NEEDED.md` → record it here and remove/annotate the open question.
- A change alters a contract (event names, ports, CSV schema, clip-naming assumptions) → ADR before code.

Do **not** write ADRs for decisions the human has not made — proposals belong in `docs/DECISIONS_NEEDED.md` under "Proposed ADRs".

## Format

`NNN-short-title.md`:

```markdown
# NNN. Title

Date: YYYY-MM-DD
Status: proposed | accepted | superseded by NNN

## Context

## Decision

## Consequences
```

## Index

- [001 — Offline simulator: standalone mock backend + shared core module](001-offline-simulator-mock-backend.md) (accepted, amended)
- [002 — Clip category naming follows the implementation](002-clip-category-naming.md) (accepted)
- [003 — UI audience, display, and operator surface](003-ui-audience-display-two-pages.md) (accepted, amended 2026-07-11: three main-screen modes — normal/dj/debug)
- [004 — Frontend-only scope for this project phase](004-frontend-only-scope.md) (accepted)
- [005 — Hand-rolled routing for the visitor/operator views](005-hand-rolled-routing.md) (accepted, human-authored; amended 2026-07-11: applies to mode state)
- [006 — Operator access via long-press on themed element](006-operator-access-gesture.md) (accepted, amended 2026-07-11: one gesture per elevated mode)
