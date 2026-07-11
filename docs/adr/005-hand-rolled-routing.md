# 005. Hand-rolled mode state — no router dependency

Date: 2026-07-09
Status: accepted (amended 2026-07-11 — see ADR-003)

## Context

ADR-003 defines three main-screen modes (normal / dj / debug) rendered on the same screen. Mode switching needs a mechanism: react-router (new dependency) or plain React state.

## Decision

**Hand-roll it.** All three modes live on the same screen; there are no separate views to route between. Mode state is plain React state — no router dependency needed. Elevated modes (dj / debug) are entered via hidden gestures (access model: ADR-006).

## Consequences

- No dependency approval needed; trivial to test.
- If the app ever grows beyond a handful of views, revisit with a new ADR.
