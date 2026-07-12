# WOW-032 PR #17 (startup timeout + version diagnostics) — test-engineer review

- Reviewer: test-engineer (Claude Sonnet 5, phase C / test-review of the WOW pipeline)
- Date: 2026-07-12
- Review target: `git diff feat/wow-014-crash-hardening...feat/wow-032-startup-timeout` (PR #17, `fix(wow-032): bounded ableton-js startup timeout + version-mismatch alerting`). This is a **stacked PR** — confirmed via `gh pr view 17`: `baseRefName: feat/wow-014-crash-hardening`, `headRefName: feat/wow-032-startup-timeout`, `state: OPEN`. `git merge-base feat/wow-014-crash-hardening feat/wow-032-startup-timeout` returns `c235678`, identical to `feat/wow-014-crash-hardening`'s own HEAD — no rebase drift, the three-dot diff is exactly this PR's contribution, nothing from WOW-014 leaking in.
- Base: `feat/wow-014-crash-hardening` @ `c235678` · Head: `feat/wow-032-startup-timeout` @ `b79e53d`.
- Ground truth: WOW-032 ticket text (`docs/TICKETS_002_BUGS.md`, "ID: WOW-032"), implementer handoff (`docs/agent-notes/wow-032-creative-tech-integrator-startup-diagnostics.md`), `ableton-js` 3.1.5 source read directly (`backend/node_modules/ableton-js/index.js`, `ns/*.js`, `midi-script/version.py`, `CHANGELOG.md`), `backend/service/MusicDatabaseService.ts`, `docs/CODING_GUIDELINES.md` testing section, `docs/agent-notes/wow-014-test-engineer-review.md` (format/rigor precedent).
- Method: read-only, no hardware, `yarn start-backend` never run. Did not take the PR body's, the implementer's, or Copilot's claims on faith anywhere they were checkable: read the actual `Ableton` constructor and every namespace class it constructs inline (not just the top-level one); ran the regex in isolation against constructed edge cases; reproduced the `MusicDatabaseService.ts` bug live in a real `yarn test` run rather than trusting the description of it; ran `tsc`/`lint`/`test`/`build` myself. Also independently pulled the PR's Copilot review thread state via the GitHub API, since "verify test coverage independently" extends to checking whether the pipeline's own prior gate actually closed before this phase started.

## Verdict: **approve-with-nits**

The test-coverage and testing-strategy claims in the PR body and implementer handoff hold up under independent re-verification: 7 new tests exist, all pass, and collectively cover exactly what's claimed (double-quote, single-quote, whitespace-tolerance, missing-file, no-version-line, empty-file, and — the one worth independently confirming rather than assuming — a genuine regression check against the real installed `ableton-js/midi-script/version.py`, not a second synthetic fixture wearing a trench coat). The "safe to import `AbletonAdapter.ts` in a test" claim is correct: I read the `Ableton` constructor and all four namespace sub-objects it constructs synchronously (`Song`, `Application`, `Internal`, `Midi`, plus `SongView` nested inside `Song`) and confirmed none of them touch a socket, file, or the network — only `.start()` does. `tsc`, `yarn lint`, `yarn test` (75/75), and `yarn build` (160 modules) are all green, matching the implementer's numbers exactly. One genuine, previously-unflagged gap exists in the regex's edge-case handling (see §3) — low real-world risk, not blocking, worth a named follow-up. Two Copilot review threads on this PR are still **unresolved**, which is a process finding independent of my own verdict (see below) — one of them lands squarely in test-file territory and I independently reached the same conclusion before cross-referencing it.

## Relationship to the Copilot round

AGENTS.md states the pipeline order as "Copilot round → test review," with the Copilot round expected to "resolve all its threads before agent reviews run." I checked this rather than assuming it already happened. `gh api graphql` against the PR's `reviewThreads` shows **two threads, both `isResolved: false`**:

1. `backend/adapter/AbletonAdapter.ts:138` — Copilot flags that the `catch` block's `throw new Error(...)` (the actionable-timeout-message rethrow) drops the original error's stack/cause via string interpolation (`Original error: ${err}`), and could stringify poorly for a non-`Error` rejection. This is accurate: I read `ableton-js`'s `start(timeoutMs)` implementation (`index.js:293-294`) and confirmed the timeout-race branch specifically rejects with a **bare string** (`rej("Connection timed out.")`), not an `Error` object, so `${err}` happens to read fine for the one scenario this ticket cares about most, but the general pattern (no `{ cause: err }`) does lose stack information for other rejection shapes. This is a production-code observability point, not a test-coverage gap — outside my lens as the primary finding, but I flag it here since it's unresolved and the ticket is squarely about diagnosability. No test currently exercises the rethrow's message/cause content either way.
2. `backend/adapter/test/AbletonAdapter.test.ts:29` — Copilot flags that the first test, named `'parses a real ableton-js midi-script version.py (double-quoted)'`, actually parses a **synthetic fixture** written via `writeFixture('version = "3.1.5"\n')` — not the real file. The actual real-file regression check is the _last_ test in the file (`'parses the real, currently-installed ableton-js midi-script version.py'`). I read the diff myself before pulling Copilot's comments and flagged this exact same line independently (see §1 below) — it's a legitimate naming-clarity nit squarely in test-file territory, confirmed correct, non-blocking (the test is functionally sound, just confusingly named — someone skimming a failure list could momentarily think the "real" regression guard failed when it was actually the synthetic-fixture test).

Neither thread blocks my own test-coverage verdict, but both should be resolved (or explicitly dispositioned) before this PR proceeds to general review / gate, per AGENTS.md's own stated gate condition on unresolved Copilot threads. Flagging as a **process finding**: this test-review phase appears to be running with the Copilot round not actually closed out yet.

## 1. Independent verification of the 7 new tests

Read `backend/adapter/test/AbletonAdapter.test.ts` in full (the diff, not a summary of it) and ran the suite myself rather than trusting the PR body's count.

| Test                                                                     | What it actually does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Verified correct?                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `parses a real ableton-js midi-script version.py (double-quoted)`        | Writes fixture `version = "3.1.5"\n` to a tmpdir, asserts `'3.1.5'`. **Name is misleading** (see Copilot thread #2 above) — this is a synthetic fixture, not a read of the real file, despite what the name says. It happens to be byte-identical in content to the real file (confirmed below), which is presumably why it was named this way, but the mechanism tested is "parse this string I wrote," not "parse the file ableton-js ships."                                                                     | Functionally yes; name is wrong. |
| `parses single-quoted version strings`                                   | Fixture `version = '3.7.0'\n` → `'3.7.0'`. Notable: `3.7.0` is the exact version cited in the ticket as the mismatched _installed_ remote-script version from the real incident — a nice touch, ties the test back to the actual bug, though it's still a synthetic fixture.                                                                                                                                                                                                                                        | Correct.                         |
| `tolerates extra whitespace around the equals sign`                      | Fixture `version   =   "1.2.3"\n` → `'1.2.3'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Correct.                         |
| `returns undefined for a missing file instead of throwing`               | Path that was never written to → `toBeUndefined()`. Exercises the `try/catch` around `fs.readFileSync`, confirming `ENOENT` is swallowed, not thrown.                                                                                                                                                                                                                                                                                                                                                               | Correct.                         |
| `returns undefined for a file with no version line`                      | Fixture with comment + `print(...)`, no `version =` line → `toBeUndefined()`. Exercises the "regex simply doesn't match" path (`.match()` → `null` → `?.[1]` → `undefined`), distinct code path from the missing-file case even though the assertion looks the same.                                                                                                                                                                                                                                                | Correct.                         |
| `returns undefined for an empty file`                                    | Fixture `''` → `toBeUndefined()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Correct.                         |
| `parses the real, currently-installed ableton-js midi-script version.py` | Uses `require.resolve('ableton-js/package.json')` (the _same_ resolution technique `getShippedRemoteScriptVersionPath()` itself uses in production code, at `AbletonAdapter.ts:70-73`) to locate and read the actual shipped file, asserting the shape `/^\d+\.\d+\.\d+$/` rather than a hardcoded string. This is the genuine regression guard against an `ableton-js` upgrade changing the file's format, and it deliberately does **not** hardcode `'3.1.5'` so it won't need updating on every dependency bump. | Correct, and well-designed.      |

Confirmed the real file's exact bytes (`xxd`): `version = "3.1.5"\n` (single line, 18 bytes + newline) — which is why the first (misleadingly-named) synthetic test and the real file happen to produce the same parse result; they are still testing different code paths (an in-memory tmp fixture vs. `require.resolve` against the installed package), and only the last test actually reads the real file.

Ran `yarn test` myself (full output captured, not excerpted from a log): **75/75 passed, 14 test files**, exit 0, 1.54s. All 7 new tests appear and pass:

```
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > parses a real ableton-js midi-script version.py (double-quoted)
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > parses single-quoted version strings
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > tolerates extra whitespace around the equals sign
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > returns undefined for a missing file instead of throwing
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > returns undefined for a file with no version line
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > returns undefined for an empty file
✓ backend/adapter/test/AbletonAdapter.test.ts > AbletonAdapter.parseRemoteScriptVersion > parses the real, currently-installed ableton-js midi-script version.py
```

75 = 68 pre-existing (matches the WOW-014 review's own count at that baseline) + 7 new. Matches the PR body and handoff note exactly. No test was skipped, no `.only`/`.skip` present (grepped the file — none).

Test isolation: `beforeEach`/`afterEach` create and destroy a fresh `fs.mkdtempSync(...)` tmpdir per test (`os.tmpdir()`-based, real OS temp directory — not the repo, not a fixture checked into git). No shared mutable state between tests, no ordering dependency. This is a real filesystem write/read, not mocked — an intentional and correct choice here, since the function under test (`parseRemoteScriptVersion`) _is_ a thin `fs.readFileSync` wrapper and the thing worth testing is its actual file-reading/regex behavior, not a mocked stand-in for it. Consistent with `docs/CODING_GUIDELINES.md`'s "verify behaviour, not implementation."

Style/convention check against the rest of the codebase (not just this file in isolation): `expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe(...)` — direct inline call inside `expect()`. Cross-checked against `src/util/test/ColorUtil.test.ts` (`expect(ColorUtil.getBackgroundColorFromType(ClipTypes.Vox)).toBe('bg-red-700')`) — this is the codebase's established pattern for pure-function tests, not a violation of the "avoid inline calculations inside function-call arguments" guideline (that guideline targets nested transformation chains like `toClipLabel(getClipFromRfid(tag))`, not a single direct call wrapped in an assertion). No `describe`/`it`/`expect` import needed or present, consistent with `vite.config.ts`'s `globals: true` and every other `backend`/`src` test file (only `sim/test/*.ts` explicitly imports from `'vitest'` — a pre-existing, unrelated inconsistency in the repo, not something this PR introduced or needs to fix).

## 2. Independent verification of the "safe to import `AbletonAdapter.ts`" claim

This is the claim that matters most if wrong — if `new Ableton({ logger: Logger })` at `AbletonAdapter.ts` module-eval time did any I/O, the entire test file would have a hidden side effect on every `yarn test` run, contradicting the "no test may open real network connections... or spawn the real backend against Ableton" rule. Read `backend/node_modules/ableton-js/index.js` directly rather than trusting the implementer's or Copilot's characterization of it.

`Ableton`'s constructor (`index.js:121-141`):

```js
function Ableton(options) {
    var _this = _super.call(this) || this;
    _this.options = options;
    _this.msgMap = new Map();
    _this.eventListeners = new Map();
    _this._isConnected = false;
    _this.buffer = [];
    _this.latency = 0;
    _this.song = new song_1.Song(_this);
    _this.application = new application_1.Application(_this);
    _this.internal = new internal_1.Internal(_this);
    _this.midi = new midi_1.Midi(_this);
    _this.clientState = "closed";
    _this.cancelDisconnectEvent = false;
    _this.logger = options?.logger;
    _this.cache = new lru_cache_1.default({ max: 500, ttl: 1000 * 60 * 10, ...options?.cacheOptions });
    _this.clientPortFile = path_1.default.join(os_1.default.tmpdir(), ...);
    _this.serverPortFile = path_1.default.join(os_1.default.tmpdir(), ...);
    return _this;
}
```

Every line is either a plain field assignment, `new Map()`, a `new LRUCache(...)` (in-memory), or `path.join(os.tmpdir(), ...)` — **string computation only, no `fs` call**. I did not stop at the top-level constructor; I also read the four namespace classes it constructs inline, since a hidden side effect two levels down would be just as real a problem:

- `Song` (`ns/song.js:100-116`): calls the base `Namespace` constructor (stores `ableton`/`ns`/`nsid` references, initializes empty `transformers`/`cachedProps` objects — no I/O), then constructs `this.view = new SongView(this.ableton)` and defines transformer _functions_ (not calls) for later use.
- `SongView` (`ns/song-view.js:62-72`, the one nested inside `Song`, so it also runs during `new Ableton(...)`): same pattern — base constructor + transformer function definitions. No I/O.
- `Application` (`ns/application.js:59-63`), `Internal` (`ns/internal.js:63-65`), `Midi` (`ns/midi.js:92-98`): all call only the base `Namespace` constructor, no additional I/O.
- Base `Namespace` constructor (`ns/index.js`, `function Namespace(ableton, ns, nsid)`): three field assignments. Its `.get()`/`.set()`/`.sendCommand()` methods are where actual RPC happens — but those are methods, not constructor logic, and nothing in `AbletonAdapter.ts`'s module scope or the new test file calls them.

The actual socket work — `this.client = dgram.createSocket({ type: "udp4" })`, binding, port-file reads/writes, the connection-wait race — all lives inside `Ableton.prototype.start` (`index.js:189` onward), gated behind `if (this.clientState !== "closed") return;` and only reachable by explicitly calling `.start()`. Grepped the new test file for `.start(` — zero occurrences. **The claim is correct**, not just plausible: the full chain of objects synchronously constructed by `new Ableton(...)` is I/O-free, confirmed by reading every constructor in that chain, not just the outermost one.

Empirical confirmation, not just static analysis: the full `yarn test` run (75 tests, all files) completed in **1.54s** with the `AbletonAdapter.test.ts` tests passing in the same batch — no hang, no timeout, no network-wait latency anywhere in the run. If `new Ableton(...)` did open a socket or attempt a connection, this would be either much slower (waiting on a `dgram` bind / nonexistent Live instance) or would leave a dangling handle. Neither happened.

## 3. Regex edge-case analysis: pre-release/build-suffixed versions

The task asked specifically whether `/version\s*=\s*["']([\d.]+)["']/` handles a version like `"3.1.5-beta"`, and whether it matters. Checked both empirically and against real project history rather than reasoning about the regex abstractly.

Ran the regex directly (not just read it) against constructed cases:

```
"version = \"3.1.5\""              -> "3.1.5"
"version = \"3.1.5-beta\""         -> null (no match)
"version = \"3.1.5-beta.1\""       -> null (no match)
"version = \"3.1.5+build.123\""    -> null (no match)
"version = \"3.1.5rc1\""           -> null (no match)
```

This is not a partial match (e.g. capturing `"3.1.5"` and silently dropping `-beta`) — it's a **total match failure**. The character class `[\d.]+` greedily consumes `3.1.5`, then the regex requires the very next character to be a closing quote; it's `-` instead, and no backtracking position produces a quote immediately after a shorter digit/dot prefix, so `.match()` returns `null` and `parseRemoteScriptVersion` returns `undefined` — indistinguishable, from the caller's perspective, from a missing or empty file.

Whether this matters: checked against real `ableton-js` history rather than assuming it's purely hypothetical. `backend/node_modules/ableton-js/CHANGELOG.md` shows a real, previously-published version with exactly this shape: **`v2.2.1-0`** (27 March 2022 era, several major versions before the currently-pinned 3.1.5). That's `package.json`'s `version` field history, not a direct read of that historical revision's `midi-script/version.py` (I don't have registry/GitHub access from this sandbox to check the old file's exact content), but the two are maintained together by the same release process and both currently read `3.1.5` — enough precedent that a future `ableton-js` release using a hyphenated pre-release tag in `version.py` is a real possibility, not a manufactured edge case.

Does it matter _in practice_, though? Materiality is low:

- The currently-pinned/shipped version (`3.1.5`, confirmed via `xxd` on the real file: exactly `version = "3.1.5"\n`) has no suffix, so nothing today is affected.
- The failure mode is the same "safe" path already built for missing/unreadable files: `checkRemoteScriptVersionPreflight` treats `undefined` as "could not read version, skip the check" (info-level log, non-fatal) and `logConnectedRemoteScriptVersion` logs `"npm package unknown"` rather than crashing or raising a false mismatch alarm. This satisfies the ticket's explicit "must be warn-and-continue... never fatal" requirement to the letter.
- It is a strict improvement over current `main` behavior either way (zero version diagnostics today), so this isn't a regression risk — only a "diagnostic value is silently lower than it could be, in one specific and currently-hypothetical version-string shape" gap.

No test in the new file exercises this shape (confirmed by reading all 7 test cases above — none use a hyphen, plus, or letter suffix in a version string). **Should-fix, not blocking**: either add a code comment on the regex noting it intentionally only matches strict `X.Y.Z` (so a future maintainer doesn't assume it's semver-complete), or broaden the pattern (e.g. `/version\s*=\s*["']([\d.]+(?:[-+][\w.]+)?)["']/`, capturing the full string but still designed around the same "returns undefined, never throws" contract) with a matching test case. Given this ticket's explicit "upgrading the `ableton-js` npm package... out of scope" boundary and the safe-by-design degradation, I would not block merge on this alone.

## 4. `MusicDatabaseService.ts:16` CWD-path bug — confirmed real, confirmed pre-existing, confirmed untouched by this PR

Read the file directly rather than trusting the handoff's description:

```ts
// backend/service/MusicDatabaseService.ts:16
csv = fs.readFileSync(path.join(process.cwd(), '../src/assets/', 'Music Database.csv'), 'utf-8');
```

Wrapped in a module-level `try { ... } catch (err) { Logger.error(err); }` (lines 14-28) — confirmed the read failure is swallowed, not thrown, leaving `rfidToClipMap`/`clipNameToInfoMap` as their initialized empty objects (`{}`) rather than crashing the module or the test run.

**Reproduced live**, not just read about: my own `yarn test` run (§1 above) printed this exact failure via pino, unprompted:

```json
{"level":50,...,"err":{"type":"Error","message":"ENOENT: no such file or directory, open '/Users/vidar/dev/hexology/src/assets/Music Database.csv'",...,"path":"backend/service/MusicDatabaseService.ts:16:12",...},"msg":"ENOENT: no such file or directory, open '/Users/vidar/dev/hexology/src/assets/Music Database.csv'"}
```

Note the resolved path is one directory above the actual repo root (`.../hexology/src/assets/...` instead of `.../hexology/witches-of-wubb-v2/src/assets/...`) — `process.cwd()` under root-level `yarn test` is the repo root (`witches-of-wubb-v2/`), and `../src/assets/` from there walks one level too high. Confirms the implementer's diagnosis exactly: this resolution logic is only correct when `process.cwd()` is `backend/` itself (the real `yarn start-backend` context via its own `package.json` script `cd`), not the repo root.

Traced the actual import chain that triggers it, rather than assuming the handoff's "first import" claim: `backend/adapter/test/AbletonAdapter.test.ts` imports `AbletonAdapter`, whose own top of file (`AbletonAdapter.ts:23`) directly imports `MusicDatabaseService`, and separately (`:22`) imports `IncomingEvents.ts`, which _also_ imports `MusicDatabaseService` (`IncomingEvents.ts:3`) — either path triggers the same module singleton's top-level side effect once. Confirmed no pre-existing test file imported `AbletonAdapter.ts` or `IncomingEvents.ts` before this PR (this new test file is the first).

Confirmed pre-existing and untouched by _this_ PR's diff:

```
$ git diff feat/wow-014-crash-hardening...feat/wow-032-startup-timeout -- backend/service/MusicDatabaseService.ts
(no output)
```

Went one step further than the task asked and also checked WOW-014's own diff against `main`, to make sure the bug didn't arrive via the branch this PR is stacked on either:

```
$ git diff main...feat/wow-014-crash-hardening -- backend/service/MusicDatabaseService.ts
(no output)
```

`git log --oneline -- backend/service/MusicDatabaseService.ts` shows the file was last touched by the WOW-011 conventions-migration commits (`578843f`, `5448e37`) and a subsequent manual fixup (`0aaa123`) — all ancestors of both `feat/wow-014-crash-hardening` and `feat/wow-032-startup-timeout`, well before either ticket's branch point. The bug predates both PRs in this stack. The implementer's choice to document it as a separate follow-up rather than fix it inline is correct per the ticket's own allowed-files list (`AbletonAdapter.ts`, `index.ts`, `.env`, test dirs, `README.md` — no `service/` file listed) and per `AGENTS.md`'s "work only within the scope of your assigned ticket" guardrail.

## 5. Verification commands (run myself, not relayed from the PR body)

| Command                                     | Result                                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p backend/tsconfig.json` | Clean, exit 0.                                                                                                                                                                     |
| `yarn lint`                                 | Clean, exit 0. Same single pre-existing unrelated warning as the WOW-014 review noted ("React version not specified in eslint-plugin-react settings") — not introduced by this PR. |
| `yarn test`                                 | **75/75 passed**, 14 test files, exit 0, 1.54s. Matches PR body/handoff exactly (68 pre-existing + 7 new).                                                                         |
| `yarn build`                                | Clean, `tsc && vite build`, **160 modules transformed**, exit 0. Matches handoff's claimed module count exactly.                                                                   |

`git diff feat/wow-014-crash-hardening...feat/wow-032-startup-timeout --stat` confirms the changed-file set is exactly `.env`, `README.md`, `backend/adapter/AbletonAdapter.ts`, `backend/adapter/test/AbletonAdapter.test.ts`, plus the implementer's own agent-notes file — all within WOW-032's allowed-files list. No test file other than the one new file was touched. `gh pr checks 17` shows CI green (`ci pass`).

## Findings

### Blocking

None.

### Should-fix

1. **`parseRemoteScriptVersion`'s regex has no test coverage for pre-release/build-suffixed version strings** (e.g. `"3.1.5-beta"`, `"2.2.1-0"` — the latter a real historical `ableton-js` version string per its own `CHANGELOG.md`), and the regex silently fails to match them entirely rather than extracting the numeric prefix. Degrades safely to the existing "could not read version, skip check" path (not fatal, not a false mismatch alarm, strictly better than current `main`'s zero diagnostics) — but the diagnostic value is quietly lower in exactly the scenario (an unusual remote-script build) where a mismatch warning is most useful. Recommend either a code comment documenting the intentional `X.Y.Z`-only scope, or broadening the regex plus one added test case. See §3 for full analysis. Not blocking given current pinned version is plain `X.Y.Z` and the ticket explicitly excludes `ableton-js` upgrades from scope.
2. **Two Copilot review threads on this PR are unresolved** (confirmed via GraphQL, not assumed): `AbletonAdapter.ts:138` (error `cause`/stack dropped on rethrow) and `AbletonAdapter.test.ts:29` (misleading test name — see next item). Per `AGENTS.md`, the Copilot round is expected to resolve before agent reviews proceed and the gate is expected to fail on unresolved threads; both should be dispositioned (fixed or explicitly declined with reasoning) before this PR moves to general review / gate.
3. **`AbletonAdapter.test.ts:29`'s test name is inaccurate** — `'parses a real ableton-js midi-script version.py (double-quoted)'` tests a synthetic in-memory fixture, not the real file (the real-file regression check is the last test in the file). I reached this independently before cross-referencing Copilot's identical finding on the same line. Suggest renaming to something like `'parses a double-quoted version string'` to avoid confusion with the genuine real-file regression test later in the same file, especially when skimming a failure list.

### Nits

None beyond the Should-fix items above — the rest of the test file (isolation via `beforeEach`/`afterEach` tmpdir, no hardcoded real-file version string in the regression test, consistent style with the rest of the codebase's pure-function tests) is solid.

## Required follow-up reviewers

Per the ticket's own safety notes ("startup/shutdown path (hardware-safety-reviewer per AGENTS.md scope)"), hardware-safety-reviewer sign-off is still needed and is listed as pending in the PR's own "Pipeline status" checklist. Nothing in this review's lens (test coverage / testing strategy) found anything that would block that sign-off — every change in the diff is either a file read before any connection attempt, an extra read-only RPC after an already-successful connect, or an error-message improvement on an existing exit path; no Ableton command, event name, payload, or timing changed once connected (confirmed by reading the diff structurally: the pre-existing `await getTracksAndClips(); await getTrackVolumes();` lines in `startAbleton` are unmodified and unmoved).

From my own lens, no outstanding blocker. Final merge-gate sign-off is not this role's call — and per the process finding above, the two open Copilot threads should be closed out first regardless of my own verdict.
