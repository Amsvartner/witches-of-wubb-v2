# `backend/event/IncomingEvents.ts` test coverage — closing the WOW-014/WOW-017 gap

- Role: test-engineer (Claude Sonnet 5)
- Date: 2026-07-12
- Branch: `test/incoming-events-handler-coverage`, **stacked on `feat/wow-017-rfid-error-handling`** (PR #19, itself stacked on `feat/wow-014-crash-hardening`, PR #16) — same pattern PR #19 already uses against PR #16, for the same reason: the code this file tests (three try/catch-wrapped socket handlers from WOW-014, the `pillar === undefined` guard from WOW-017) only exists on those branches, neither merged to `main` yet.
- Not a numbered WOW ticket — a coverage gap identified directly by the human, following the same precedent as `docs/agent-notes/adr-004-backend-exception-batch.md` for unticketed process/gap work. Confirmed with the human before branching (WOW-014/WOW-015/WOW-017 all being unmerged, not just WOW-015, was more than the original ask anticipated).

## What triggered this

Two tickets touched `backend/event/IncomingEvents.ts` on the explicit assumption that a future harness would cover it, and neither followed through — both facts independently confirmed by reading the source documents directly, not taken on trust:

1. **WOW-014** (PR #16) wrapped `get_tempo`, `get_track_volumes`, and `set_track_volume` in try/catch to stop unhandled promise rejections from killing the process.
2. **WOW-017** (PR #19) added the `pillar === undefined` guard in `handleNewTag`/`handleDepartedTag`, stopping unknown-IP tag events before they reach a downstream crash in `AbletonAdapter.queueClip`. Its own "Allowed files" line names `backend/event/test/**` "(if WOW-015's harness exists)" — but its implementer handoff and the independent test-engineer review on that PR (`docs/agent-notes/wow-017-test-engineer-review.md`, inherited into this branch) both found **WOW-015's actual allowed-files list is `backend/service/test/**`and`backend/util/test/**` only** — it does not, and will not, cover this file. The WOW-017 review filed this exact gap as Should-fix #1 and specified the required assertions (Should-fix #2): pillar 0 must not trip the guard, unknown-IP must produce exactly one warning and zero downstream calls, and forced errors must log the error object, not a bare string. This PR implements exactly that spec.

## Branching decision

Three unmerged dependencies existed, not one: WOW-014 and WOW-017 hold the actual behavior under test; WOW-015 (approved, CI green, PR #20) sets test-style conventions but turned out **not** to be a hard technical dependency — the root `vite.config.ts` has no `test.include` restriction, so Vitest's default glob already discovers any `*.test.ts` file anywhere in the repo without WOW-015 landing first. Given that, stacking on `feat/wow-017-rfid-error-handling` alone (which already contains WOW-014's commits) was sufficient to get real target code under test, with WOW-015's branch consulted (not merged in) purely for style conventions (colocated `test/` dirs, plain `describe`/`it`, factory-function fixtures, irrelevant-field casts). Confirmed via `git merge-base --is-ancestor feat/wow-014-crash-hardening feat/wow-017-rfid-error-handling` before relying on it.

## What's covered

One new file, **zero production code changes**: `backend/event/test/IncomingEvents.test.ts`, 13 tests.

- **`get_tempo`, `get_track_volumes`, `set_track_volume`** (WOW-014): success path and mocked-rejection path for each. Rejection tests assert the handler resolves rather than throwing (proving the fix), that no stale callback fires, and that `Logger.error` receives the error object as the first arg, not a string.
- **`handleNewTag` / `handleDepartedTag` pillar guard** (WOW-017): pillar 0 (`192.168.0.101`, a real, valid, falsy index) proceeds normally and does not trip the guard; a known non-zero pillar also proceeds (control case, `handleNewTag` only); a genuinely-unmapped IP trips the guard with exactly one warning and zero `OutgoingEvents`/`AbletonAdapter` calls; a forced downstream error for a known pillar still logs the error object correctly. `handleDepartedTag`'s async `stopOrRemoveClipFromQueue(...).catch(...)` rejection path (WOW-014's contribution to this same function) is also covered, since it's directly inside the function already under test here.

Reached via `IncomingEvents.oscEventHandlers(message, rinfo)` with a fake `RequestInfo` (matching WOW-017's own ticket text: "handler unit test with a fake rinfo address") and `IncomingEvents.addSocketEventsHandlers(fakeSocket)` with a handler-capturing mock socket — both are the module's actual public API, no reach into unexported internals.

## Mocking approach

`AbletonAdapter` and `OutgoingEvents` are both mocked (`vi.doMock`, see below) — this file never loads `ableton-js`'s real client or `LightingAdapter`'s real `node-osc` UDP client (confirmed `LightingAdapter.ts` opens a real client at module-load time; mocking `OutgoingEvents` outright avoids ever importing it transitively). `MusicDatabaseService` is left real and unmocked: its CSV read is wrapped in try/catch and fails harmlessly (ENOENT, logged and swallowed) when the working directory isn't `backend/`, and `rfidToClipMap` is a plain mutable object tests seed directly per-case and clean up in `afterEach` — exactly the approach the WOW-017 review described as sufficient ("a fake socket + a fake/partial `MusicDatabaseService.rfidToClipMap` entry").

**A non-obvious discovery worth flagging for future backend test authors**: `vi.mock`'s auto-hoisting is not active in this project's vitest setup. This was already documented once, in `src/context/hook/test/useSocketContextProviderState.test.tsx`'s own comment — but it wasn't discoverable from `backend/`'s side (WOW-015's tests never mock anything, so nobody hit it there yet) until this file needed to mock `AbletonAdapter`/`OutgoingEvents`. Standard `vi.mock(path, factory)` silently no-ops here: the "mocked" binding resolves to the real module instead (confirmed empirically — `Object.keys()` on the "mocked" object returned the real module's 30+ exports, and `vi.isMockFunction()` on a supposedly-mocked function returned `false`). The fix, matching the existing frontend precedent: `vi.doMock(path, factory)` + dynamic `await import(...)` inside `beforeAll`, populating `let`-bound module references instead of static `import { X } from ...`. Separately, `AbletonAdapter.trackVolumes` is getter-only on the real module (`get trackVolumes() { return trackVolumes; }`, no setter) and Vitest preserves that accessor shape through the mock, so tests mutate the array in place (`.length = 0; .push(...)`) rather than reassigning the property.

## Verification performed

- `npx tsc --noEmit -p backend/tsconfig.json` — clean.
- `npx eslint --resolve-plugins-relative-to . backend/event/test/IncomingEvents.test.ts` — clean (same pre-existing "React version not specified" warning every prior backend PR in this batch has noted; unrelated, unchanged). Full-repo `eslint --ext .ts,.tsx` also clean.
- `yarn test` — **81/81 passed** (68 baseline + 13 new), 14 test files.
- **Non-vacuousness check** (the standard this batch's reviews hold each other to — WOW-015's review specifically praised "non-vacuous" as its own line item): temporarily reverted, on the working copy only, each production behavior this suite covers and re-ran `yarn test` before restoring from a backup:
  - Removed both `pillar === undefined` guard blocks → exactly the two "unrecognized IP" tests failed (one per handler), all 11 others (including both pillar-0 tests) stayed green. Confirms the suite isolates the guard's specific contribution rather than passing for unrelated reasons.
  - Removed `get_tempo`'s try/catch → exactly its rejection test failed, with the failure message itself demonstrating the risk this ticket closes: `promise rejected "Error: ableton unreachable" instead of resolving`.
  - Restored both times via a file backup; `git diff --stat backend/event/IncomingEvents.ts` against the base branch confirms zero production changes survived.
- **No agent ran `yarn start-backend`.** No hardware, no live Ableton/OSC/network reachable from this test run (see mocking approach above).

## Scope note

`git status` also showed `.eslintrc` reformatted (multi-line JSON arrays collapsed to single-line) after installing dependencies and running lint/format tooling in this worktree — not an intentional edit, not related to this ticket's scope, and not included in this PR's commit (left unstaged).

## How to verify (human)

- `yarn test backend/event/test/IncomingEvents.test.ts` from repo root.
- Diff review: confirm the PR is exactly one new file under `backend/event/test/`, no production code touched.
