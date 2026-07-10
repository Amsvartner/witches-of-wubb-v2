# 005. Hand-rolled routing for the two-page split

Date: 2026-07-09
Status: accepted

## Context

The visitor/operator split (ADR-003) needs navigation between exactly two views. Options: react-router (new dependency) or hand-rolled route state.

## Decision

**Hand-roll it.** Two views, no new dependency — simple React state (or `location.hash`) switching between visitor and operator views, entered via a hidden gesture (access model: ADR-006, pending gesture choice).

## Consequences

- No dependency approval needed; trivial to test.
- If the app ever grows beyond a handful of views, revisit with a new ADR.
