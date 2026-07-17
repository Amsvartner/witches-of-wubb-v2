# 005. Hand-rolled mode state — no router dependency

Date: 2026-07-09
Status: accepted (amended 2026-07-11 — see ADR-003; **partially superseded 2026-07-15** — per-mode URL routes now wanted, see amendment below)

## Context

ADR-003 defines three main-screen modes (**play / tutorial / DJ** since the 2026-07-15 rename; originally normal / dj / debug, with debug now a diagnostics panel) rendered on the same screen. Mode switching needs a mechanism: react-router (new dependency) or plain React state.

## Decision

**Hand-roll it.** All three modes live on the same screen; there are no separate views to route between. Mode state is plain React state — no router dependency needed. Elevated modes (dj / debug) are reached via a visible Settings modal (access model: ADR-006, amended 2026-07-15).

## Consequences

- No dependency approval needed; trivial to test.
- If the app ever grows beyond a handful of views, revisit with a new ADR.

## Amendment 2026-07-15 — per-mode URL routes now wanted (deferred)

**Human decision (2026-07-15).** Each mode should have its own **bookmarkable, reloadable URL route** (so an existing external bash script can open a mode directly). This **supersedes the "there are no separate views to route between" premise** of the decision above — there is now a reason to route.

- **Not decided here / still open:** the routing _approach_ and whether it needs a router dependency (which would require dependency approval per AGENTS.md). This gets its **own follow-up ticket** with a proper ADR-005 replacement/extension. **Tracked in `DECISIONS_NEEDED.md`.**
- **Until that ticket lands**, mode state remains plain hand-rolled React state; WOW-007A used only a temporary `#play-spike` hash demo switch (not routing, not a production cutover).
