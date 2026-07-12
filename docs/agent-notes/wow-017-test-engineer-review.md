# WOW-017 PR #19 (RFID/OSC error handling) — test-engineer review

- Reviewer: test-engineer (Claude Sonnet 5, phase C / test-review of the WOW pipeline)
- Date: 2026-07-12
- Review target: `git diff feat/wow-014-crash-hardening...feat/wow-017-rfid-error-handling` (PR #19, `fix(wow-017): RFID/OSC handlers log errors properly, guard unknown pillar IPs`), equivalently `gh pr diff 19` (already scoped correctly).
- **Stacked PR**: PR #19's base is `feat/wow-014-crash-hardening` (PR #16, not yet merged), _not_ `main`. Confirmed via `gh pr view 19 --json baseRefName` (`"baseRefName":"feat/wow-014-crash-hardening"`) and independently via `git merge-base --is-ancestor feat/wow-014-crash-hardening feat/wow-017-rfid-error-handling` (true). This review diffs against that actual base throughout.
- Base: `feat/wow-014-crash-hardening` @ `c235678` · Head: `feat/wow-017-rfid-error-handling` @ `e0eb2b4` (single commit beyond base, matches `origin/feat/wow-017-rfid-error-handling`, working tree clean).
- Precedent used for format/rigor: `docs/agent-notes/wow-014-test-engineer-review.md` — **confirmed reachable from this branch** (`git show HEAD:docs/agent-notes/wow-014-test-engineer-review.md` succeeds), as expected since this branch stacks on WOW-014's.
- Ground truth: WOW-017 ticket text (`docs/TICKETS_002_BUGS.md`, search "ID: WOW-017"), implementer handoff (`docs/agent-notes/wow-017-creative-tech-integrator-rfid-error-handling.md`), WOW-015 ticket text (same file, "ID: WOW-015" — needed to fact-check a scope claim, see Should-fix #1), `docs/CODING_GUIDELINES.md` testing section, `backend/tsconfig.json` + `@tsconfig/recommended` (needed to check what TypeScript strictness actually catches here).
- Method: read-only, no hardware, no `yarn start-backend`. Did not take the PR body's or implementer's crash-mechanism trace on faith — read `backend/adapter/AbletonAdapter.ts` myself and hand-traced the call chain line by line. Ran `npx tsc --noEmit -p backend/tsconfig.json`, `yarn lint`, `yarn test` myself.

## Verdict: **approve-with-nits**

The diff is small, correct, and I was able to independently verify its correctness end-to-end by reading — the pillar-0/unknown-IP distinction is right, the crash it prevents is real, and `tsc`/`lint`/`test` are all green (68/68, identical count to the WOW-014 baseline, confirming no backend tests were added or removed). Nothing here is blocking. But the diff's own justification for skipping a test rests partly on a claim I checked and found to be **incorrect** (see Should-fix #1) — this doesn't change my verdict on the current diff, but it means the coverage gap will silently persist past this PR unless someone corrects the record now. I'm also recording two hand-traced precision corrections to the crash-mechanism story that neither the implementer's handoff nor the parallel hardware-safety-reviewer note caught (Nits #1–2) — the conclusion both reached is right, the specific mechanism they cited is not quite.

---

## 1. Does a backend test harness exist? Independently verified — no.

Task instruction was explicit: don't trust the implementer's claim, check myself.

```
$ ls backend/event/test/
ls: backend/event/test/: No such file or directory

$ find backend -type d -iname "test*"
<only backend/node_modules/**/test, backend/node_modules/**/tests — dependency test dirs, not ours>

$ find backend -type f -iname "*.test.ts" -o -iname "*.spec.ts"
<only backend/node_modules/simple-update-notifier/src/*.spec.ts, backend/node_modules/pino/test/**, backend/node_modules/thread-stream/test/** — all dependency-internal, not project code>
```

Confirmed: **zero** `backend/**/test/**` directories or `*.test.ts`/`*.spec.ts` files exist anywhere under our own `backend/` code, at this branch's HEAD (`e0eb2b4`). The implementer's claim is accurate. WOW-015 (which would establish this convention) has not landed in this run's order — consistent with the suggested-order note at the top of `docs/TICKETS_002_BUGS.md` (WOW-017 is explicitly sequenced before WOW-015).

## 2. `pillar === undefined` vs `!pillar` — hand-traced, correct

`IP_ADDRESS_TO_PILLAR_INDEX_MAP` (`backend/event/IncomingEvents.ts:13-18`):

```ts
const IP_ADDRESS_TO_PILLAR_INDEX_MAP: Record<string, number> = {
  '192.168.0.101': 0,
  '192.168.0.102': 1,
  '192.168.0.103': 2,
  '192.168.0.104': 3,
};
```

Confirmed by reading the literal source (not the PR body's assertion): `'192.168.0.101'` maps to `0`. Pillar indices are `{0,1,2,3}` — a `Record<string, number>` lookup on a _known_ key always yields one of those four numbers; a lookup on an _unknown_ key yields `undefined` (plain JS object index semantics — TypeScript doesn't change the runtime behavior here, see Should-fix #2 on why it doesn't even change the compile-time behavior).

- `pillar === undefined`: `true` only when `requestAddress` is not a key in the map. For `pillar = 0` (the `192.168.0.101` case), `0 === undefined` is `false` — guard does not fire, execution proceeds exactly as before this PR.
- A hypothetical `!pillar` guard: `!0` is `true` in JS — this would have silently dropped every legitimate tag event from pillar index 0 (physical pillar 1), misclassifying it as an unknown IP. This would have been a real, silent, hardware-facing regression.

The implementer got this right, and their handoff's own reasoning about it is correct. I verified it independently rather than accepting the claim: read the map literal, read the guard's exact operator, and confirmed JS's `===` performs no numeric coercion (unlike `==`), so `0 === undefined` cannot spuriously match.

## 3. Crash mechanism — real, but the implementer's (and the hardware-safety-reviewer's) cited call site is one frame off

Task instruction was to trace `AbletonAdapter.queueClip({...}, undefined)` → `FindAllClipsInLoop(clipName, undefined)` → `allAbletonClips[undefined]` myself and confirm it throws. I read `backend/adapter/AbletonAdapter.ts` in full for the relevant section (lines 96-133) rather than accepting the PR body's/handoff's description.

The PR body and the implementer's handoff both describe the throw as happening in `FindAllClipsInLoop`'s own `.slice()` call:

> "`queueClip` calls `FindAllClipsInLoop`, which does `allAbletonClips[pillar].slice(...)` — `allAbletonClips[undefined]` is `undefined`, `.slice` on it throws a `TypeError`."

Tracing the actual code:

```ts
const MemoizedClipIndex = memoize(
  (clipName, pillar) =>
    allAbletonClips[pillar].findIndex((clip) => { ... }),   // AbletonAdapter.ts:98
  (clipName, pillar) => `${clipName}-${pillar}`,
);

const FindAllClipsInLoop = memoize(
  (clipName, pillar) => {
    Logger.info(`Trying to find all clips in loop on pillar ${pillar + 1} > ${clipName}`);  // pillar+1 → NaN, logs but doesn't throw
    const firstClipIndex = MemoizedClipIndex(clipName, pillar);   // AbletonAdapter.ts:117 — CALLED FIRST
    if (firstClipIndex < 0) return [];
    const lastClipIndex = allAbletonClips[pillar].slice(...)....  // AbletonAdapter.ts:120 — never reached
    ...
    return allAbletonClips[pillar].slice(...);                    // AbletonAdapter.ts:130 — never reached
  },
  ...
);
```

`FindAllClipsInLoop`'s very first executable statement (line 117) calls `MemoizedClipIndex(clipName, pillar)`, whose entire body is `allAbletonClips[pillar].findIndex(...)` (line 98). With `pillar = undefined`, `allAbletonClips[undefined]` evaluates to `undefined` (confirmed `allAbletonClips: ClipBoard`, and `ClipBoard = Array<Clip | null>[]` in `backend/type/ClipBoard.ts` — a plain array, so bracket access with a non-numeric key returns `undefined`, not a throw by itself), and then `.findIndex` is accessed on that `undefined` — **this** is what throws (`TypeError: Cannot read properties of undefined (reading 'findIndex')`), inside `MemoizedClipIndex`, called from `FindAllClipsInLoop`'s line 117. Both of `FindAllClipsInLoop`'s own `.slice()` calls (lines 120, 130) are never reached — the function has already thrown one call earlier.

**Net effect on the conclusion: unchanged.** A `TypeError` is thrown, synchronously, and (pre-fix) propagates up through `MemoizedClipIndex` → `FindAllClipsInLoop` → `queueClip` (a plain, non-async function) → into `handleNewTag`'s own synchronous `try { ... } catch (err) { ... }`, where — pre-this-PR — it was caught by `Logger.error('Errored trying find track from RFID tag')`, a fixed string with `err` dropped. So the throw is real, and it really was invisible in the logs (no stack trace, no indication a `TypeError` even occurred). The implementer's and hardware-safety-reviewer's shared conclusion ("throws, was silently swallowed, guard now prevents it") is correct. Only the specific method/line they named as the throw site is imprecise — worth a correction since I was specifically asked to trace this by hand, not to just confirm the top-line claim. See Nit #1.

One more precision point worth recording: since `queueClip` is **not** `async` (`function queueClip(clipMetadata: ClipMetadataType, pillar: number) {`), this was always a _synchronous_ throw caught by a _synchronous_ try/catch — it was never actually capable of becoming an unhandled-promise-rejection / process-killing crash (which is WOW-014's distinct concern, a different file-region of the same file). The ticket text's own phrasing — "crashes inside `queueClip` (where the crash is then swallowed by the same catch)" — already reflects this correctly (an internal exception, caught, not a process crash); I'm noting it explicitly here because "crash" is used loosely enough elsewhere in the pipeline's documents that it's worth being precise about what kind of failure this is: a real, correctness-relevant exception that was completely undiagnosable in logs, not a process-uptime issue.

## 4. `handleDepartedTag`'s parallel path — a asymmetry the PR body glosses over (not a bug, a documentation precision nit)

The PR body and handoff describe "both tag handlers" as hitting the same failure shape. I traced `handleDepartedTag`'s analogous path (`AbletonAdapter.stopOrRemoveClipFromQueue`, `AbletonAdapter.ts:197-258`) to check this symmetry claim, since the task asked me to verify the crash mechanism rather than assume it generalizes.

With `pillar = undefined`: `playingClips[undefined]` and `queuedClips[undefined]` both evaluate to `undefined` (no throw — plain array bracket access), so `isClipPlaying` and `isClipQueued` (lines 202-203, 234) both evaluate to `false` via the optional-chaining short-circuit (`undefined?.clipName` → `undefined`, compared against a string → `false`). Execution falls to the `if (!isClipPlaying && !isClipQueued)` branch at line 251: `await tracks[pillar].sendCommand('stop_all_clips')` — `tracks[undefined]` is `undefined`, `.sendCommand` on it throws.

The difference from `handleNewTag`'s path: `stopOrRemoveClipFromQueue` **is** `async`, so this throw becomes a _rejected promise_, not a synchronous exception. The call site in `handleDepartedTag` (`AbletonAdapter.stopOrRemoveClipFromQueue(...).catch((err) => Logger.error(err, ...))`) already has a `.catch()` with proper `err` logging — and that `.catch()` is **pre-existing on the base branch, from WOW-014**, unchanged by this diff. So, strictly: for `handleDepartedTag`, an unknown-IP event was _already_ logging `err` with a stack trace before WOW-017 (just with a confusing "pillar NaN" message, since `pillar + 1` where `pillar` is `undefined` is `NaN`), and was _already_ non-fatal to the process. WOW-017's actual contribution on this specific path is (a) preventing the earlier bogus `ingredient_removed` emission with `pillar: undefined` reaching the UI, and (b) replacing a wasted, throwing, confusingly-logged call with a single clear diagnostic — not un-silencing a dropped `err` (that part of the `handleDepartedTag` path was already fixed by WOW-014).

This doesn't change the verdict — the guard is still correct and valuable for both handlers, for the same underlying reason (stop a garbage `pillar: undefined` value at the ingress boundary before it reaches anything downstream) — but the PR body's "both tag handlers... crashes inside `queueClip`" framing is only literally true of `handleNewTag`. See Nit #2.

## 5. Verification commands — re-run myself, all green

| Command                                     | Result                                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p backend/tsconfig.json` | Clean, exit 0.                                                                                                                                              |
| `yarn lint`                                 | Clean, exit 0 (same pre-existing "React version not specified in eslint-plugin-react settings" warning noted in the WOW-014 review — unrelated, unchanged). |
| `yarn test`                                 | **68/68 passed**, 13 test files, exit 0. Identical count to the WOW-014 baseline — confirms zero backend test files exist or ran, consistent with §1.       |

## 6. Is reading-based verification sufficient rigor here, or does this need executable coverage before gating?

This is the core question the task asked me to answer, and I want to separate two things that the diff's own paper trail conflates: **(a)** whether _this specific diff_ is safe to merge on the strength of code review alone, and **(b)** whether the _reasoning given_ for skipping a test is sound. My answer to (a) is yes; my answer to (b) is no, and I think (b) matters enough to record as a Should-fix even though it doesn't block (a).

**(a) This diff, on its own merits: reading is sufficient.** The change is two mechanical additions (a logging-argument fix, and an early-return guard) with exactly one piece of genuine conditional logic (`pillar === undefined`). I was able to hand-verify that logic's correctness completely: the map's literal values are known and small (4 fixed entries), the operator is unambiguous (`===`, no coercion), and I traced every downstream consequence (§2-4). `tsc`/`lint`/`test` are green. There's no timing, ordering, or musical-mapping logic here for a test to protect that code review can't already see in full. I don't think this diff should be blocked pending a test.

**(b) The "no test" justification given in the PR/handoff: partly incorrect, and worth correcting now.** Two independent problems with it:

1. **Type-system check I ran that isn't in either existing note**: `backend/tsconfig.json` extends `@tsconfig/recommended`, which sets `strict: true` — but `noUncheckedIndexedAccess` is **not** part of `strict` (confirmed by reading `@tsconfig/recommended`'s actual `tsconfig.json` contents) and is not separately enabled anywhere in this repo. That means `IP_ADDRESS_TO_PILLAR_INDEX_MAP[requestAddress]` types as plain `number`, not `number | undefined`, even though it can genuinely be `undefined` at runtime. Practically: TypeScript will not flag a future `if (!pillar)` rewrite as wrong — `!` is valid on `number` regardless. **The type system provides zero protection against the exact regression class this line is most at risk from.** The only thing that would catch a future "someone simplifies this guard and silently reintroduces the pillar-0 bug" regression is a runtime test asserting pillar-0 does _not_ trigger the guard. That test does not exist anywhere in the repo today.

2. **The handoff's stated reason for not filing a follow-up is factually wrong.** It says: _"Not filed as a separate follow-up — WOW-015 is next in this run's order and its own scope note already covers this class of gap."_ I checked WOW-015's actual ticket text rather than accepting this. WOW-015's **Allowed files** are `backend/service/test/**`, `backend/util/test/**`, `vite.config.ts` (test includes only), `docs/CODING_GUIDELINES.md` — **`backend/event/test/**`is not in that list**, and WOW-015's own **Out of scope** line only mentions`AbletonAdapter`needing "an abstraction seam — future ticket if wanted," saying nothing about`IncomingEvents.ts`. Landing WOW-015 will not produce a test for these handlers. This is the same gap the WOW-014 test-engineer review already named explicitly (its Should-fix #1: *"No ticket currently owns automated coverage for `IncomingEvents.ts`'s... handlers... Recommend a short, explicitly-scoped follow-up ticket... naming `backend/event/test/IncomingEvents.test.ts`"*) — and that review additionally established, independently, that this exact file is testable **today**, with no new dependency and no WOW-015 harness: `IncomingEvents.ts`imports`AbletonAdapter` as a plain named object (`import { AbletonAdapter } from '../adapter/AbletonAdapter'`), so `vi.mock('../adapter/AbletonAdapter')`(hoisted by Vitest) keeps the real adapter — and therefore`ableton-js`and`new Ableton(...)`— from ever loading, at which point a fake socket + a fake/partial`MusicDatabaseService.rfidToClipMap`entry is enough to drive`handleNewTag`/`handleDepartedTag`directly. WOW-017's own ticket text asks for exactly this ("handler unit test with a fake rinfo address"), gated on "if the backend harness exists" — but the WOW-014 review already showed the "harness" isn't actually a blocker here;`vi.mock` alone suffices. The implementer's citation of "WOW-014's precedent for the same situation" is citing a review that, read in full, argued for testing this file, not against it.

**My conclusion on (b):** approve this diff, but don't let its merge be read as validating "no test needed" as a general matter for this file. The right fix is small and cheap: either amend WOW-015's allowed-files to include `backend/event/test/IncomingEvents.test.ts`, or file the dedicated follow-up the WOW-014 review already recommended and this PR didn't file. Either way, that test's single highest-value assertion is the pillar-0 case specifically — because that's the one line in this diff whose correctness the type system cannot enforce, and the one place a future well-intentioned refactor is most likely to silently reintroduce a hardware-facing bug.

## Relationship to the other review on this PR

`docs/agent-notes/wow-017-hardware-safety-reviewer-signoff.md` exists in the working tree (uncommitted/untracked as of this review — not yet part of PR #19's own history) with verdict **APPROVE**. I read it for corroboration after completing my own independent trace, not before. It reaches the same conclusions I did on the pillar-0/`=== undefined` question and the byte-identical-known-IP-path question, using an independent method (diff-context-line analysis + MD5 of the map literal, rather than my direct hand-trace of the map source). It also cites the same `.slice()`-as-throw-site description from the PR body for the crash mechanism (§8 of that note) without independently re-deriving it against `AbletonAdapter.ts`'s actual line order — which is what turned up the correction in my §3 above. Its scope is safety/hardware-boundary (volume, lighting, live commands, sim-guard bypass), not test-coverage adequacy, so it doesn't address the question in my §6; the two reviews are complementary, not overlapping, on that point.

## Findings

### Blocking

None.

### Should-fix

1. **The "no test needed, WOW-015 covers it" reasoning in the PR body/handoff is factually incorrect and should not be relied on going forward.** WOW-015's allowed-files list does not include `backend/event/test/**`; landing WOW-015 will not close this gap. Recommend one of: (a) amend WOW-015's ticket text to add `backend/event/test/**` to its allowed-files and explicitly name `IncomingEvents.test.ts` in its description, or (b) file a small dedicated follow-up ticket now (as the WOW-014 test-engineer review already recommended once and saw fall through). This does not block merging PR #19; it blocks the _next_ piece of work from silently assuming this is already someone else's job when nothing in the ticket tree currently owns it.
2. **When that test lands, its single required assertion is the pillar-0 case**: a tag event from `192.168.0.101` (or any IP mapping to pillar `0`) must _not_ trigger the `pillar === undefined` guard and must proceed to `emitEvent`/`queueClip`(or `stopOrRemoveClipFromQueue`) exactly as for any other known pillar. This is the one line in the diff the type system (confirmed: `noUncheckedIndexedAccess` is off, `strict: true` doesn't imply it) cannot protect — only a runtime assertion can. Secondary assertions worth including: unknown-IP event → exactly one `Logger.warn`, zero `emitEvent` calls, zero `AbletonAdapter` calls, for both handlers; forced error inside the try block → `Logger.error` called with the error object as first arg (not a bare string).

### Nits

1. **Crash-mechanism trace, precision correction.** The PR body, the implementer's handoff, and the (separately landed) hardware-safety-reviewer note all describe the pre-fix throw as happening in `FindAllClipsInLoop`'s own `.slice()` call (`AbletonAdapter.ts:120`/`:130`). Tracing the actual code: `FindAllClipsInLoop`'s first statement calls `MemoizedClipIndex(clipName, pillar)` (`:117`), whose entire body is `allAbletonClips[pillar].findIndex(...)` (`:98`) — this is where the `TypeError` actually originates (`allAbletonClips[undefined]` is `undefined`; `.findIndex` access on it throws). `FindAllClipsInLoop`'s own `.slice()` calls are never reached — the function has already thrown one call-frame earlier. Same ultimate conclusion (a `TypeError` is thrown and was being silently swallowed pre-fix); different specific line/method. Doesn't affect correctness of the shipped fix, just the accuracy of the documented rationale — worth a one-line correction in the handoff if anyone revisits it, otherwise no action needed.
2. **"Both tag handlers... crashes inside `queueClip`" overstates the symmetry between the two handlers.** Only `handleNewTag`'s unknown-IP path reaches `queueClip`. `handleDepartedTag`'s analogous path throws inside `stopOrRemoveClipFromQueue` (via `tracks[undefined].sendCommand`, `AbletonAdapter.ts:255`), which is `async`, and whose call site already had a `.catch((err) => Logger.error(err, ...))` from WOW-014 (pre-existing on the base branch, not part of this diff) — meaning that specific path was not actually silently dropping `err` before WOW-017, just logging a confusing "pillar NaN" message after a wasted call. WOW-017's real contribution to the `handleDepartedTag` path is preventing the bogus `ingredient_removed` emission and the wasted/throwing call, not un-silencing a dropped error (see full trace in §4 above). No action needed; recording for anyone who later needs the precise failure-mode-per-handler picture.

## Required follow-up reviewers

Per the ticket's safety notes ("hardware-safety-reviewer sign-off" required for Ableton/hardware-path tickets): `docs/agent-notes/wow-017-hardware-safety-reviewer-signoff.md` exists in the working tree with verdict **APPROVE** (uncommitted as of this review — a human or the pipeline orchestrator should confirm it gets committed alongside this note before the PR is considered fully reviewed). No audio-ableton-reviewer sign-off was found for this ticket; the ticket text lists hardware-safety-reviewer as the required specialist for WOW-017 (audio-ableton-reviewer is listed for WOW-014/018/020/021/025/027/031, not WOW-017), so this is consistent with the ticket's own requirements, not a gap.

From my own lens (test-engineering / coverage adequacy): no blocker. The diff is correct, verified by independent hand-trace rather than accepted on the implementer's description, and `tsc`/`lint`/`test` are all green. The one thing I'd insist on before treating "no test" as a closed question for this class of file is fixing the record on Should-fix #1 — right now nothing in the ticket tree actually owns writing `backend/event/test/IncomingEvents.test.ts`, despite two separate reviews (WOW-014's and this one) independently concluding it's both valuable and cheap to write today.
