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
- [003 — UI audience, display, and operator surface](003-ui-audience-display-two-pages.md) (accepted, amended 2026-07-11: three main-screen modes; **amended 2026-07-15: renamed play/tutorial/DJ, debug demoted to a diagnostics panel**)
- [004 — Frontend-only scope for this project phase](004-frontend-only-scope.md) (accepted)
- [005 — Hand-rolled mode state (no router dependency)](005-hand-rolled-routing.md) (accepted, human-authored; amended 2026-07-11: applies to mode state; **partially superseded 2026-07-15: per-mode URL routes now wanted — own follow-up ticket**)
- [006 — Elevated-mode (DJ) access + debug panel](006-operator-access-gesture.md) (accepted; amended 2026-07-11: one gesture per mode; amended 2026-07-15: visible Settings-modal access supersedes hidden-gesture-only; **taxonomy note 2026-07-15: elevated access is DJ mode, debug is now a panel**)
