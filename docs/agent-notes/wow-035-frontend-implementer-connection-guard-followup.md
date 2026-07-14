# WOW-035 — frontend-implementer handoff (connection-guard follow-up)

Executor: Claude Sonnet 5 (spawned as a follow-up task from the WOW-024 session, `task_094a1ced`)
Branch: `feat/wow-033-connection-guard-followup`, based on `feat/wow-019-frontend-reconnect-resync` (PR #23, open) — not `main`. The `'connect'` re-fetch listener this ticket's guard protects, and the "extensive test coverage" it extends, only exist on that branch.
Scope: `src/context/hook/useAbletonContextProviderState.ts` (guard condition + its comment), `src/context/hook/test/useAbletonContextProviderState.test.tsx` (one new test + one stale comment). Two files, no behavioral change beyond widening when listeners attach.

## What happened

WOW-024's fix-round commit (`a3482b6`, PR #24) fixed a Copilot-caught bug in `DebugModalContainer.tsx`: gating `'connect'`/`'disconnect'` listener attachment on `if (!socket.connected) return;` conflates "still the bare placeholder" with "a real socket that's momentarily disconnected." If that effect ever ran while an already-real socket was mid-reconnect, no listeners would attach, and since the socket's object reference never changes again on a live reconnect, the component would be stuck forever — even after the socket actually reconnects.

That commit's message explicitly flagged the identical pattern in `useAbletonContextProviderState.ts`'s subscription effect (WOW-019's file) as a deferred follow-up rather than fixing it in the same PR. This ticket is that follow-up.

## Fix

Mirrored WOW-024's fix exactly — guard on socket shape, not connection state:

```diff
-    if (!socket.connected) {
+    if (typeof socket.on !== 'function' || typeof socket.off !== 'function') {
       // TODO: Show in UI
       return;
     }
```

Left everything else in the effect untouched, including `getTracksAndClips()` firing unconditionally once the guard passes. One side effect worth flagging explicitly (not fixed — out of scope per the ticket, same as WOW-024's minimal guard-only fix): for a real-but-currently-disconnected socket, this now calls `getTracksAndClips()` immediately at mount (previously it wouldn't have, since the old guard blocked entry). socket.io-client buffers emits made while disconnected and flushes them on `'connect'`, so this isn't a correctness bug — but combined with the `'connect'` listener re-fetching too, a socket that mounts disconnected and then connects will fetch tracks/clips twice instead of once. Purely a minor efficiency nit in an already "very likely unreachable" scenario; noted here rather than silently expanding this ticket's scope to redesign it.

## Tests

Added one test to the existing WOW-019 suite (`describe('useAbletonContextProviderState reconnect behavior (WOW-019)')`), placed right after the "true placeholder" test for contrast: a `createFakeSocket(false)` (real `on`/`off`/`emit`, just `connected: false`) gets every listener attached immediately on mount, and a live `fake.trigger('connect')` correctly triggers the resync fetch. Verified this test fails against the pre-fix guard (`fake.handlerCount('connect')` is `0`, not `1`) and passes after — confirmed by temporarily stashing just the source change and re-running.

Updated the first test's comment, which quoted the old guard's exact code and was now stale.

## Verification

- `yarn test` (full suite): 14 files, 76 tests, all passing (was 75 pre-change; +1 new test).
- `npx tsc --noEmit`: clean.
- `yarn lint` fails from this worktree location for unrelated reasons — see `wow-pipeline-ops-notes` memory / below. Verified the two changed files directly via `npx eslint --resolve-plugins-relative-to . <files>`: no errors, one pre-existing warning (React version not specified in `eslint-plugin-react` settings — repo-wide config, not this diff).
- No browser/manual verification: this is a guard condition in socket lifecycle plumbing with no visible effect under normal mount order (the bug it fixes is a mid-reconnect race that doesn't occur in this app's actual single-mount usage pattern). Unit tests with mocked sockets are the correct verification surface here, not the running app.

## Repo-infra note (not fixed, out of scope)

`yarn lint` errors ("ESLint couldn't determine the plugin 'react' uniquely") when run from inside a `.claude/worktrees/*` checkout: the root `.eslintrc` lacks `root: true`, so ESLint's config cascade walks up past the worktree root into the main repo's own `.eslintrc`, finds a second independently-installed `eslint-plugin-react`, and can't disambiguate. Pre-existing, reproducible from any worktree, unrelated to this ticket's files — left alone per "no drive-by refactors." Workaround recorded in the `wow-pipeline-ops-notes` memory.

## Open questions

None. Fully specified by the WOW-024 precedent; no product/UX/musical decisions involved.
