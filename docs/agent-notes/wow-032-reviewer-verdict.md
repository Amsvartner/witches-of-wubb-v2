# WOW-032 PR #17 (startup timeout + version-mismatch alerting) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, phase E of the WOW ticket pipeline)
- Date: 2026-07-12
- Review target: `git diff feat/wow-014-crash-hardening...feat/wow-032-startup-timeout` (PR #17, `fix(wow-032): bounded ableton-js startup timeout + version-mismatch alerting`). **Stacked PR** — base is PR #16 (`feat/wow-014-crash-hardening`, not yet merged), not `main`. Diffed against the stated base throughout, never against `main`.
- Base: `feat/wow-014-crash-hardening` @ `c235678` (confirmed identical to `origin/feat/wow-014-crash-hardening`) · Head: `feat/wow-032-startup-timeout` @ `b79e53d` (single commit, confirmed identical to `origin/feat/wow-032-startup-timeout` — no rebase drift)
- Ground truth: `AGENTS.md` v0.4, WOW-032 in `docs/TICKETS_002_BUGS.md`, `docs/CODING_GUIDELINES.md` v1.0, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, implementer handoff (`docs/agent-notes/wow-032-creative-tech-integrator-startup-diagnostics.md`), reviewer profile, and the WOW-014 reviewer verdict as a format/rigor precedent.
- Method: read-only. Every equivalence/safety claim in the implementer's handoff and PR body was re-derived independently against the diff and against `ableton-js` v3.1.5's actual source (`backend/node_modules/ableton-js/index.js`, `ns/index.js`, `ns/internal.js`), not taken on faith. `npx tsc --noEmit -p backend/tsconfig.json`, `yarn lint`, `yarn test`, `yarn build` all re-run fresh by this reviewer. `yarn start-backend` never run.

## Verdict: **approve-with-nits** — required specialist sign-off is now in (APPROVE); NOT yet gate-ready (2/2 Copilot threads unresolved)

On the diff's own merits (scope, propagation-chain correctness, happy-path equivalence, tooling): **no blocking findings**. Three should-fix items and two nits, detailed below — none touch musical/volume/lighting/mapping logic, none are scope violations, none are credentials.

**Note on timing:** this note was drafted read-only and in parallel with the required specialist review, per this run's process. Two other notes materialized on disk mid-review (confirmed absent at the start of this session, present by the time this note was finalized):

- **hardware-safety-reviewer: APPROVE** @ `b79e53d` (`docs/agent-notes/wow-032-hardware-safety-reviewer-signoff.md`). Satisfies the ticket's required sign-off ("Hardware/Ableton/LED/RFID safety notes: startup/shutdown path (hardware-safety-reviewer per AGENTS.md scope)"). Traced the same propagation chain, the same `ableton.start(timeoutMs)`/`internal.get('version')` library internals, and the same `.env`/constructor-safety claims independently via its own reading of `ableton-js`'s source, and additionally checked the reconnect-storm/crash-supervision interaction against `docs/DECISIONS_NEEDED.md`'s still-open WOW-014 entry (no auto-restart supervisor exists yet, so a startup timeout today produces exactly one clean exit, not a restart loop). Four minor, explicitly non-blocking observations, none touching volume/light/live-command surfaces: an unnamed-in-the-task-summary private helper (`getShippedRemoteScriptVersionPath`); two lines outside try/catch whose only realistic failure mode fails closed before any live command; a note that the not-yet-implemented crash-supervisor decision should re-confirm backoff behavior once it exists; and a naming-adjacency note between the new one-shot startup timeout and the pre-existing idle/attractor timeout so the two aren't confused at the venue.
- **test-engineer (phase C, test review): approve-with-nits** (`docs/agent-notes/wow-032-test-engineer-review.md`). Independently confirmed the 7 new tests are sound, the "safe to import `AbletonAdapter.ts`" claim (traced all four namespace sub-constructors, not just the top-level one — `Song`, `SongView`, `Application`, `Internal`, `Midi`, none do I/O), and the `MusicDatabaseService.ts` CWD bug (pre-existing, untouched by this PR _or_ by WOW-014, traced back to WOW-011-era commits). It also independently found and confirmed the same 2 unresolved Copilot threads this review found. It surfaced one thing I had not independently checked: see Should-fix #3 below.
- With the required specialist sign-off now APPROVE, WOW-032's safety-review requirement is satisfied. Three independent reviews (this one, hardware-safety-reviewer, test-engineer) now converge on "no blocking finding" via different methods (call-chain/happy-path trace, live-command/volume/lighting/supervision trace, and test-coverage/import-safety trace).

**Independent of specialist sign-off**, this PR is not gate-ready: Copilot's round produced 2 comments and **both are unresolved** (`isResolved: false` on both threads, checked via `gh api graphql` — and independently re-confirmed by both other reviews above). The PR body's "Pipeline status" section shows every box unchecked including "Copilot round: pending" — stale, since Copilot has already run (same staleness pattern as PR #16/WOW-014).

## 1. Scope + call-chain propagation trace (independently re-derived)

`git diff feat/wow-014-crash-hardening...feat/wow-032-startup-timeout --name-only`: exactly `.env`, `README.md`, `backend/adapter/AbletonAdapter.ts`, `backend/adapter/test/AbletonAdapter.test.ts`, plus the implementer's own `docs/agent-notes/wow-032-creative-tech-integrator-startup-diagnostics.md` (standard per-ticket practice, same as WOW-014's and WOW-011's precedent). Every changed file is within WOW-032's allowed-files list (`backend/adapter/AbletonAdapter.ts`, `backend/index.ts`, `.env`, `backend/adapter/test/**` or `backend/util/test/**`, `README.md`); the test file matches the `backend/adapter/test/**` option. No `src/`, `sim/`, `package.json`, lockfile, `Arduino/`, or CSV changes.

`backend/index.ts` is allowed but genuinely untouched (absent from the diff's file list) — I read the current file directly rather than trusting the claim:

```
async function main() {
  await AbletonAdapter.startAbleton();
  ...
}
main().catch((err) => {
  Logger.error(err, 'Fatal error during backend startup');
  process.exit(1);
});
```

This is WOW-014's exit path, byte-for-byte as WOW-014's own reviewer verdict confirmed it. I traced the full chain independently against the current `AbletonAdapter.ts` head:

1. `ableton.start(ABLETON_START_TIMEOUT_MS)` — read `ableton-js`'s actual `Ableton.prototype.start` implementation (`index.js:189-348`). When `timeoutMs` is truthy, it does `Promise.race([connection, timeout])` where `timeout` is `new Promise((_, rej) => setTimeout(() => rej("Connection timed out."), timeoutMs))`. On a genuine timeout, this race rejects.
2. `startAbleton()`'s `try { await ableton.start(...) } catch (err) { throw new Error(...) }` — the rejection is caught, and a **new** `Error` is synchronously thrown from inside the `catch` block. Since `startAbleton` is `async`, this throw rejects `startAbleton()`'s own returned promise (ES2017 semantics — not a synchronous throw to the caller).
3. Back in `main()`, `await AbletonAdapter.startAbleton()` is not wrapped in its own try/catch, so the rejection propagates to reject `main()`'s own returned promise.
4. `main().catch((err) => { Logger.error(...); process.exit(1); })` in `index.ts` — unchanged, existing WOW-014 code — catches it, logs, exits.

No second exit path was added. The claim is correct, and I did not just trust the handoff's narrative — I independently reasoned through the `async`/`await` rejection-propagation semantics at each hop using the actual library source, not just its `.d.ts`.

## 2. Connected happy-path unchanged (independently re-derived, including inside the `ableton-js` library itself)

The full `AbletonAdapter.ts` diff against the base (`git diff feat/wow-014-crash-hardening...feat/wow-032-startup-timeout -- backend/adapter/AbletonAdapter.ts`) touches only: three new top-of-file consts/imports, four new functions (`parseRemoteScriptVersion`, `getShippedRemoteScriptVersionPath`, `checkRemoteScriptVersionPreflight`, `logConnectedRemoteScriptVersion`), the `startAbleton()` body, and two new keys in the bottom export object. I confirmed via the diff hunks that **nothing else in the file changed** — every other function (`queueClip`, `stopOrRemoveClipFromQueue`, `addPhraseLeader`, `getTracksAndClips`, `setTempo`, `transposeClipToNewKey`, etc., including all of WOW-014's `.catch()`/guard additions) is present in the current head exactly as WOW-014 left it. Grepped the diff for `TRIGGER_ORDER`, `KEY_LEADER_ORDER`, `TIMEOUT_IN_MILISECONDS`, `192.168`, `KeyTranspositionService`: zero hits — confirms no musical/mapping/timing constant touched.

`startAbleton()` before → after:

```
// before (WOW-014 head)
await ableton.start();
await getTracksAndClips();
await getTrackVolumes();

// after
checkRemoteScriptVersionPreflight();
try { await ableton.start(ABLETON_START_TIMEOUT_MS); } catch (err) { throw new Error(...); }
await logConnectedRemoteScriptVersion();
await getTracksAndClips();
await getTrackVolumes();
```

Two additions only, matching the claim. I went further than trusting "no Ableton command changed" and read `ableton-js`'s `start()` implementation to check whether merely _passing_ `timeoutMs` (as opposed to timing out) changes anything on the success path. It does not: `start()`'s state machine converges at the same code (case 9 onward in the compiled source — logs "Got connection!", sets `clientState`, `handleConnect`, starts the heartbeat interval, fires its own built-in one-directional version check) regardless of whether a race or a bare `await` got it there. The only behavioral difference `timeoutMs` introduces is what happens if the connection does _not_ arrive in time — exactly the ticket's intent. (The losing `setTimeout` timer for a fast/successful connection is left to fire once and get silently absorbed by `Promise.race`'s internal handler — not an unhandled-rejection risk, and not something this PR's diff controls anyway; it's `ableton-js`'s own implementation.)

I also checked whether the new post-connect `ableton.internal.get('version')` call is genuinely read-only and side-effect-free on Ableton's side: `Namespace.prototype.get` (`ns/index.js:48-69`) resolves to `this.ableton.getProp(...)`, a query, not a `sendCommand`/`set` mutation. More tellingly, **`ableton-js`'s own `start()` already calls this exact same `internal.get("version")` on every successful connection** (`index.js:334-343`, its own built-in one-directional `semver.lt` check) — so this PR's added call is a second, benign read of a property the library already queries by default on every startup. That is strong independent confirmation of the "read-only, no observable Ableton behavior change" claim, beyond just re-reading the diff.

## 3. Pure function placement + `Ableton` constructor I/O-safety claim

Re-read the ticket's allowed-files line directly: `backend/adapter/AbletonAdapter.ts`, `backend/index.ts`, `.env`, `backend/adapter/test/**` or `backend/util/test/**`, `README.md` — confirmed no new non-test source file is listed, only test-directory options. Placing `parseRemoteScriptVersion` inside `AbletonAdapter.ts` (module-private helpers `getShippedRemoteScriptVersionPath`/`checkRemoteScriptVersionPreflight`/`logConnectedRemoteScriptVersion`, only `parseRemoteScriptVersion` and `ABLETON_START_TIMEOUT_MS` added to the exported `AbletonAdapter` object) rather than a new `backend/util/` module is correctly scoped to the ticket as written.

Independently read `ableton-js`'s `Ableton` constructor (`index.js:121-141`) rather than trusting the handoff's characterization: it sets `options`, `msgMap`/`eventListeners` (empty `Map`s), `_isConnected = false`, `buffer = []`, `latency = 0`, constructs the `Song`/`Application`/`Internal`/`Midi` sub-namespaces (`ns/index.js`'s base `Namespace` constructor — confirmed itself only assigns `ableton`/`ns`/`nsid`/`transformers`/`cachedProps`, no I/O), sets `clientState = "closed"`, and computes `clientPortFile`/`serverPortFile` via `path.join(os.tmpdir(), ...)` — string concatenation, not a file operation. No socket is opened, no file is read or written, nothing network- or filesystem-adjacent happens until `.start()` is explicitly called. The module-level `const ableton = new Ableton({ logger: Logger });` (pre-existing, unchanged, line 53) is therefore safe to trigger via import in a test, confirmed by my own read of the constructor body, not just the handoff's summary. The new test file (`backend/adapter/test/AbletonAdapter.test.ts`) never calls `.start()`.

## 4. `.env` change — genuinely optional, working defaults

```
+# ABLETON_START_TIMEOUT_MS=45000
+# ABLETON_REMOTE_SCRIPT_VERSION_PATH=/path/to/Remote Scripts/AbletonJS/version.py
```

Both new lines are commented out (inactive by default). Checked the corresponding code:

```ts
const ABLETON_START_TIMEOUT_MS = Number(process.env.ABLETON_START_TIMEOUT_MS) || 45000;
const installedPath =
  process.env.ABLETON_REMOTE_SCRIPT_VERSION_PATH || DEFAULT_REMOTE_SCRIPT_VERSION_PATH;
```

With both vars unset (as shipped), `Number(undefined)` is `NaN` (falsy) → falls back to `45000`; `undefined || DEFAULT_REMOTE_SCRIPT_VERSION_PATH` → falls back to the computed `~/Music/Ableton/User Library/Remote Scripts/AbletonJS/version.py` default. Both defaults are real, working values, not placeholders. The "optional, not required" framing matches the implementation. No credentials, no new IPs/ports — `.env`'s pre-existing tracked-in-git status for non-secret config (ports/addresses) predates this PR (`git log --follow -- .env` shows this file has been committed since early project history); this PR follows that existing pattern, adding paths/timeouts, not secrets.

One nit on this pattern below (falsy-zero edge case).

## 5. Tooling — re-run fresh by this reviewer, all green

- `npx tsc --noEmit -p backend/tsconfig.json` — clean, exit 0. (Also confirms `require.resolve(...)`/`require` usage in `getShippedRemoteScriptVersionPath` is valid under this project's CommonJS-targeting tsconfig — not just assumed.)
- `yarn lint` — clean, exit 0.
- `yarn test` — **75/75 passed**, exit 0 (68 pre-existing + 7 new, matching the handoff's reported figure). I independently observed the pre-existing `MusicDatabaseService.ts` CWD-relative CSV path bug the handoff describes, firsthand in this run's own output (`ENOENT: ... open '/Users/vidar/dev/hexology/src/assets/Music Database.csv'`, logged via the existing try/catch, does not fail any test) — confirms that part of the claim accurately, see Should-fix #1 below for the one part of that claim that does _not_ hold up.
- `yarn build` — clean, exit 0, 160 modules (matches handoff's reported figure).

## 6. PR hygiene (`gh pr view 17`, `gh api graphql`)

- "⚠️ Stacked on #16 — merge that first." is the first line of the body. Confirmed.
- Template (`.github/pull_request_template.md`): every section present and filled substantively — Ticket, Summary, Changes, Out of scope, How to verify (3 concrete demo steps, no-Ableton-needed timeout path called out explicitly), Validation (4 checked + 1 honestly marked N/A with reasoning), Safety checklist (5 items, checked with explanations — the `.env`/`backend/` box is annotated as an approved exception rather than falsely claiming no backend changes, matching the WOW-011/WOW-014 precedent for how that box should read), Pipeline status, Decisions/questions. Not sparse.
- CI: `ci` check present, `SUCCESS`.
- Copilot round: **ran** (`copilot-pull-request-reviewer`, state `COMMENTED`, "generated 2 comments" per its own summary, `createdAt: 2026-07-12T01:17:34Z`) but the PR body's "Pipeline status" section still shows "Copilot round: pending" — stale relative to reality, same pattern flagged in the WOW-014 review. Queried `reviewThreads` via `gh api graphql`: **both threads are `isResolved: false`.**
- Per AGENTS.md ("the Copilot round resolves all its threads before agent reviews run; the gate fails on unresolved Copilot threads"), this PR has not completed the phase that precedes general review, even though general review (this phase) has now run. Noting as a pipeline-sequencing fact, not attempting to resolve or dismiss the threads (read-only).

### Copilot's two findings, independently assessed (not just relayed)

1. `backend/adapter/AbletonAdapter.ts:130-137` (line 138 in Copilot's numbering) — the timeout `catch` block does `throw new Error(actionable-message + ` Original error: ${err}` )`, discarding the original error's stack and `cause`. I traced what `err` can actually be here against `ableton-js`'s source: `waitForConnection()`'s own internal race swallows any rejection from `internal.get("ping")` into a promise that never settles (`.catch(() => new Promise(() => {}))`), so the *only* realistic rejection reason reaching this `catch` is the timeout branch's literal string `"Connection timed out."` — meaning `${err}`in practice yields a sensible message, not`[object Object]`, contrary to how severe Copilot's comment reads. That said, Copilot's underlying point stands on its own merits: string-concatenating an arbitrary caught value and discarding `err`'s original stack is a strictly worse debugging experience than `throw new Error(actionable-message, { cause: err })`, which preserves both. Agree this is a legitimate should-fix, on narrower grounds than Copilot stated.
2. `backend/adapter/test/AbletonAdapter.test.ts:29` — the test titled "parses a real ableton-js midi-script version.py (double-quoted)" in fact parses a synthetic fixture (`writeFixture('version = "3.1.5"\n')`); the actual real-file regression check is the last test in the file. Confirmed accurate by reading the test file — cosmetic naming nit, not a functional defect (the double-quote-parsing behavior it verifies is still correctly tested).

## Findings

### Blocking

None. No musical/timing/mapping change, no credential, no new dependency, no scope violation, no disallowed file, all tooling green.

### Should-fix

1. **PR body and handoff overclaim a filed follow-up.** Both `docs/agent-notes/wow-032-creative-tech-integrator-startup-diagnostics.md` ("Filed as a separate follow-up task rather than fixed here") and the PR body ("Follow-up filed (not part of this PR): `MusicDatabaseService.ts`'s CWD-fragile CSV path resolution...") assert this was filed. I checked: the diff's file list contains no `docs/TICKETS_002_BUGS.md` or `docs/DECISIONS_NEEDED.md` change, and grepping both docs for `MusicDatabaseService`, `cwd`, `process.cwd`, `ENOENT`, and related terms turns up nothing — WOW-032 is still the highest-numbered ticket in `TICKETS_002_BUGS.md` (no WOW-033 exists). Nothing was actually filed anywhere in the repo as of this diff. This is not a safety or correctness issue (the underlying bug is real, pre-existing, independently confirmed by this reviewer's own fresh `yarn test` run, non-fatal, and correctly out of this ticket's allowed-files scope to fix inline) — it's a documentation-accuracy gap. Suggested fix: either add the actual follow-up entry (a new `WOW-033` stub in `docs/TICKETS_002_BUGS.md`, or a `docs/DECISIONS_NEEDED.md` note) before merge, or soften the PR body/handoff language to "flagged here, not yet filed" so the record doesn't overstate what's been done.
2. **`backend/adapter/AbletonAdapter.ts:130-137`** — preserve the original error as `cause` rather than string-interpolating it, per Copilot's thread (independently assessed above as a legitimate, if narrower-than-stated, improvement). Suggested fix: `throw new Error(actionableMessage, { cause: err })`, keeping the actionable message as the primary text.
3. **`parseRemoteScriptVersion`'s regex (`AbletonAdapter.ts:64`, `/version\s*=\s*["']([\d.]+)["']/`) silently fails to match pre-release/build-suffixed version strings** — found by test-engineer's phase-C review, independently reproduced by me before incorporating it here rather than taking it on trust:

   ```
   "version = \"3.1.5\""           -> "3.1.5"
   "version = \"3.1.5-beta\""      -> null (no match)
   "version = \"2.2.1-0\""         -> null (no match)
   "version = \"3.1.5+build.123\"" -> null (no match)
   ```

   `[\d.]+` has no alternative for `-`/`+`/letters, and greedily consuming the numeric prefix leaves a non-quote character immediately after with no backtracking position that succeeds — so `.match()` returns `null` outright (not a partial capture that drops the suffix). This degrades safely: `parseRemoteScriptVersion` returns `undefined`, which both callers already treat as "could not read version, skip the check" (info-level, non-fatal) per the ticket's own "must be warn-and-continue" requirement — so this is a diagnostic-value gap, not a correctness or safety regression, and it's inert today since the actually-shipped `ableton-js` 3.1.5 version string has no suffix (confirmed via `xxd` on the real file per the test-engineer note). Test-engineer's review found a real historical precedent (`ableton-js`'s own `CHANGELOG.md` lists a past `2.2.1-0`-shaped version), so this isn't a manufactured edge case, just a currently-dormant one. Suggested fix: either a code comment documenting the intentional `X.Y.Z`-only scope, or broaden the pattern and add one test case. Not blocking — the ticket explicitly excludes `ableton-js` upgrades from scope, and no currently-installed version triggers this path.

4. **Cross-reference, not a new finding**: WOW-014's reviewer verdict already flagged (as its own should-fix #2, non-blocking there) that all three of `index.ts`'s exit paths call `process.exit(1)` on the same tick as `Logger.error(...)`, with no explicit flush guarantee for pino's writer. That risk is generic to any fatal-error path, but it is maximally relevant to WOW-032 specifically: this ticket's entire value proposition is that a startup failure produces a _visible, actionable_ message instead of silence. If that message races `process.exit(1)` to stdout under some deployment configuration, WOW-032's diagnostic payoff is undermined at exactly the moment it matters most. Not blocking this PR (the underlying risk is WOW-014's, not introduced or worsened here, and today's synchronous default pino writer makes it low-probability) — but worth the human weighting that existing WOW-014 should-fix a bit higher given WOW-032 now depends on it.

### Nits

1. **`backend/adapter/test/AbletonAdapter.test.ts:29`** — test title says "real," fixture is synthetic; rename per Copilot's thread (e.g., "parses a double-quoted version string").
2. **`backend/adapter/AbletonAdapter.ts:32`** — `Number(process.env.ABLETON_START_TIMEOUT_MS) || 45000`. If a human ever explicitly sets `ABLETON_START_TIMEOUT_MS=0`, `Number("0")` is `0`, which is falsy, so `|| 45000` silently overrides it back to the default rather than passing `0` through. This mirrors `ableton-js`'s own `start(timeoutMs)`, which treats falsy `timeoutMs` (including `0`) as "no timeout, wait forever" (`if (!timeoutMs) return ...` in `index.js`) — so a human trying to explicitly disable the timeout via `0`, consistent with the underlying library's own convention, can't actually do so through this env var. Very low practical impact (disabling the timeout contradicts this ticket's entire purpose, so it's unlikely anyone would want to), and the `Number(process.env.X)` pattern itself is already an established convention in this file's neighborhood (`LightingAdapter.ts:6` uses the same coercion, without a fallback default). Not suggesting a fix, just flagging the edge case for the record.

## Required follow-up reviewers

- **hardware-safety-reviewer — required, and now recorded: APPROVE** @ `b79e53d` (`docs/agent-notes/wow-032-hardware-safety-reviewer-signoff.md`). ✓ Landed mid-review (confirmed absent at session start, present before this note was finalized); four non-blocking observations, none affecting this verdict.
- **test-engineer (phase C) — also now recorded: approve-with-nits** (`docs/agent-notes/wow-032-test-engineer-review.md`). Not a required merge-gate sign-off under AGENTS.md's Ableton/hardware-path list, but its should-fix items are folded into this note (Should-fix #3 above; the same 2 Copilot threads as #2/nit #1 corroborated independently).
- **audio-ableton-reviewer — not required for this ticket.** WOW-032's own "Suggested agent(s)" line names only hardware-safety-reviewer, and my own trace (section 2 above) confirms the diff touches no musical triggering, key transposition, tempo, or clip-selection logic — only startup/connection diagnostics. Consistent with AGENTS.md's rule that audio-ableton-reviewer is for triggering/timing/musical-constraint changes specifically. hardware-safety-reviewer's note reaches the same conclusion independently.
- **Gate is not ready regardless of the above**: 2/2 Copilot review threads remain unresolved on PR #17 — now confirmed by three independent reviews (this one, hardware-safety-reviewer implicitly via its own clean read, and test-engineer explicitly). Per AGENTS.md, this needs to be closed out (each thread addressed or explicitly dismissed with reasoning) before the pipeline proceeds to the gate phase.
- Non-blocking follow-up worth the human's attention (not required before this PR merges): (1) actually filing the `MusicDatabaseService.ts` CWD-relative CSV path follow-up referenced in Should-fix #1, since right now it exists only as unbacked prose in two documents; (2) the regex pre-release-suffix gap (Should-fix #3); (3) re-confirming pino flush-before-exit behavior (Should-fix #4 / WOW-014's existing should-fix #2) given WOW-032's diagnostic payoff now depends on it.
