# 005. Hand-rolled routing for the two-page split

Date: 2026-07-09
Status: accepted (amended 2026-07-11 — applies to mode state, see ADR-003)

## Context

The visitor/operator split (ADR-003) needs navigation between exactly two views. Options: react-router (new dependency) or hand-rolled route state.

## Decision

**Hand-roll it.** Two views, no new dependency — simple React state (or `location.hash`) switching between visitor and operator views, entered via a hidden gesture (access model: ADR-006, pending gesture choice).

**Amendment 2026-07-11:** ADR-003's amendment replaced the two-view split with three main-screen modes (normal / dj / debug). The decision stands unchanged in substance: mode state is plain React state, no router dependency; there are no separate views to route between at all.

## Consequences

- No dependency approval needed; trivial to test.
- If the app ever grows beyond a handful of views, revisit with a new ADR.
