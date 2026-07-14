# WOW-020 — BPM calculation divides by zero on degenerate warp markers

## The bug

`calculateBpmFromWarpMarkers(warp_markers)` computed
`(endBT - startBT) / ((endST - startST) / 60)` using only the first and
last warp markers, with no guards at all:

- **Zero markers**: `warp_markers[0]` is `undefined`; destructuring
  `{ beat_time, sample_time }` from it throws immediately — not even a bad
  BPM, an outright crash.
- **One marker**: first and last are the same marker, so both the
  beat-time and sample-time spans are `0` → `0 / (0/60)` = `NaN`.
- **Two+ markers sharing a sample_time** (the ticket's named case): sample
  span is `0` → division by zero → `Infinity`/`-Infinity`/`NaN` depending
  on the beat-time span's sign.

Whatever came out fed straight into `setTempo(bpm)` — pushed into Ableton
and broadcast to every connected UI — meaning one badly warped clip
anywhere in the Live set could silently break tempo for the whole
installation.

## The fix

`calculateBpmFromWarpMarkers` now returns `number | undefined`: guards, in
order, on fewer than 2 markers, a non-positive sample-time span, and (as a
final catch-all) a non-finite result via `Number.isFinite`. The **healthy-path
arithmetic is byte-for-byte unchanged** — same formula, same two markers
(first/last) used, just wrapped in early-return guards that never fire for
normal input.

Kept the function genuinely pure (no logging inside it) — it's documented
as pure in the ticket's own allowed-files note and is the unit under test.
The warning ("log a warning naming the clip") is logged at the one call
site instead, which already has `clipName` and `pillar` in scope:

```ts
const bpm = calculateBpmFromWarpMarkers(warpMarkers);
if (bpm === undefined) {
  Logger.warn(
    `Could not calculate BPM for clip "${clipName}" on pillar ${
      pillar + 1
    }: degenerate warp markers`,
  );
}
```

Tempo adoption is skipped (not defaulted/guessed) when `bpm` is
`undefined` — `if (bpm !== undefined) { setTempo(bpm); }` — leaving
whatever tempo was already set, matching the ticket's explicit "no
fallback, no surprise" instruction.

**`setTempo` itself also gained a `Number.isFinite` guard**, per the
ticket's explicit acceptance criterion ("`Number.isFinite` guard on
anything passed to `setTempo`"). This is deliberately a _second_,
independent layer: `setTempo` is a shared entry point also reachable from
the UI tempo slider's `set_tempo` socket handler, whose input isn't
otherwise validated — the call-site skip above only protects the
warp-marker-driven path, so `setTempo`'s own guard is what protects every
caller, present and future.

## No type changes needed

`ClipMetadataType.bpm` was already `bpm?: number` before this ticket
(confirmed by reading `backend/type/ClipMetadataType.ts`), so changing
`calculateBpmFromWarpMarkers`'s return type to include `undefined` needed
zero changes anywhere else — `browserInfo = { ...clipInfo, bpm }`'s
inferred type already tolerates it, and a `bpm: undefined` field is
dropped by JSON serialization on the wire (socket.io), achieving "omit
`bpm` from the emitted payload" without an explicit delete.

## Tests (`backend/adapter/test/AbletonAdapter.test.ts`)

Added a new `describe('AbletonAdapter.calculateBpmFromWarpMarkers', ...)`
block to the existing file (same module, same established convention as
WOW-032's `parseRemoteScriptVersion` tests in this file) — 6 new tests:
zero markers, one marker, two-same-time markers, negative span
(out-of-order markers, the "or negative" half of the ticket's guard list),
a healthy 2-marker calculation, and a healthy 3+-marker array confirming
only the first/last markers are used.

**Caught my own arithmetic error before finalizing fixtures**: initially
used sample-rate-looking numbers (44100, 22050) assuming `sample_time` was
raw audio samples, which produced a "240 BPM" comment that was actually
computing ~0.005 BPM against the real formula. Verified with a throwaway
`node -e` calculation first (4 beats over 2 seconds should be 120 BPM, and
`(4-0)/((2-0)/60) === 120`) before writing any fixture — the unmodified
formula's `/60` divisor only produces a sane BPM if the sample-time span is
in seconds, not raw samples, regardless of what the field name suggests.
All fixtures use small second-scale values instead.

## Acceptance criteria checked

- [x] Degenerate marker arrays produce a warning and no tempo change
- [x] Healthy clips byte-for-byte unchanged (same formula, same markers used)
- [x] `Number.isFinite` guard on anything passed to `setTempo`
- [x] Unit tests for 0, 1, 2-same-time, and healthy marker arrays (plus a
      negative-span case and a 3+-marker case, beyond the minimum asked)

## Out of scope / deliberately not done

- Tempo clamping/rounding policy changes — untouched, matching the ticket.
- UI BPM display changes — untouched.
- No fallback/default tempo invented for the degenerate case — explicitly
  forbidden by the ticket ("no-surprise behavior" is skipping adoption).
- `sim/core/simulator.ts` — this ticket's allowed files are backend-only
  (`AbletonAdapter.ts`, `AbletonAdapter test/**`); the sim doesn't model
  warp markers or this calculation at all, so there's no sim-side mirror
  needed (unlike WOW-018's idle-timeout fix).
