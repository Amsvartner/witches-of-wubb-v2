# WOW-020 — audio-ableton-reviewer sign-off

Recorded on the human's/implementer's behalf: the audio-ableton-reviewer
agent's own profile is strictly read-only ("Never edit files; findings
only... No edits, no commits, ever.") and correctly declined to check this
file out or commit it itself, per the same pattern already established on
WOW-018. This file transcribes its reported findings verbatim/faithfully.

## Verdict: APPROVE

## Basis

`gh pr diff 25 --repo Amsvartner/witches-of-wubb-v2` (diff touches only
`backend/adapter/AbletonAdapter.ts:453-588`, its test file, and one new
docs note — nothing else), a local `yarn vitest` run (14/14 pass),
`npx tsc --noEmit -p backend/tsconfig.json` (clean).

## Findings

1. **Healthy-path formula** (`AbletonAdapter.ts:580-588`, severity: none) —
   same two markers (first/last), same operation order (`endST-startST` →
   `/60` → divide) → bit-identical floats for finite input; only new
   early-return guards wrap it.
2. **No fallback tempo** (`:477-479`, severity: none) — `setTempo` called
   only `if (bpm !== undefined)`; no default or re-sent previous value
   anywhere. `bpm: undefined` drops on JSON serialize; the frontend
   (`src/context/hook/useAbletonContextProviderState.ts:37-38`,
   pre-existing, untouched by this PR) already tolerates undefined `bpm`.
3. **Plausibility** (severity: nit) — 0/1 markers and duplicate
   `sample_time` (the ticket's named case) are plausible real Ableton
   failure modes (unwarped/misrouted clip, glitchy sample, overlapping
   markers). The negative-span/out-of-order-markers guard's real-world
   trigger is **TBD** — couldn't confirm from the repo alone whether
   Ableton/ableton-js can actually return out-of-order markers. Harmless
   either way, and required by the ticket's own acceptance text regardless.
4. **Cross-pillar/timeout risk** — severity: none. Tempo is global, not
   per-pillar, so skipping adoption is strictly safer than the pre-fix
   Infinity/NaN corruption. Timeout-timer reset is independent of the
   tempo branch — `clip_started`'s `emitEvent` (which calls
   `restartTimeoutTimer`) always fires first whenever the tempo-adoption
   branch is reached.
5. **Tests** (`backend/adapter/test/AbletonAdapter.test.ts:82-125`,
   severity: none) — fixtures verified correct (4 beats/2s = 120 BPM checks
   out); each degenerate fixture hits its intended guard; ran locally,
   14/14 pass.

No change to `TRIGGER_ORDER`, `KEY_LEADER_ORDER`, key-lock/transposition,
phrase-leader logic, CSV mapping, or category enums — confirmed absent
from the diff.
