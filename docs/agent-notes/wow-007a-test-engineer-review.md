# WOW-007A — Test-engineer review

- Ticket: WOW-007A (play-mode visual-fidelity spike)
- Date: 2026-07-17
- Reviewer role: test-engineer (read-only review)
- Reviewed SHA: 4b32326 (`feat/wow-007a-play-mode-visual-spike`, diff vs `main`;
  initial review at 313e90f, re-reviewed after fixes — see addendum)
- Verdict: **approve**

## Summary

The ticket's required check — "component render/smoke test for the normal-mode
screen with mock data" — is satisfied by `src/screen/test/PlayScreen.test.tsx`
(renders the full composed screen via `PlayModeContainer` + `PlayModeStateMock`;
asserts wordmark h1, four pillars/categories, Help/Settings, settings band,
legend), and the branch goes beyond the minimum with `PillarCard`,
`CategoryTheme`, and updated `ColorUtil` suites. Conventions are met: colocated
`test/` folders, Testing Library role/label/text queries (one exception below),
deterministic (static data, no timers/randomness), mock follows the
`XxxMock.create*` pattern with explicit return types
(`src/mock/PlayModeStateMock.ts`). No test touches socket.io, Ableton,
hardware, or the network; the spike renders outside the Socket/Ableton
providers and jsdom fetches no image/font assets.

Verified by running locally (Node 22): `yarn test` — 29 files / 223 tests
passed; `yarn lint` — clean. Matches the implementation note's claim
(`yarn build` green taken on report; lint + tests re-verified).

Key targeted coverage present:

- MAX_QUEUED_ROWS cap — `src/component/test/PillarCard.test.tsx:43-56`.
- CategoryTheme ↔ ColorUtil single-source fill contract, all four types —
  `src/util/test/CategoryTheme.test.ts:6-12`.
- Empty-pillar state (no category identity, no controls) —
  `src/component/test/PillarCard.test.tsx:58-66`.
- `main.tsx` `#play-spike` dev switch untested — consistent with repo
  convention (no entry-file test exists anywhere; `MainScreen.test.tsx` tests
  the screen, not the entry). Not a finding.

## Required (must fix before gate)

None.

## Recommended (fix or state rationale) — all resolved at 4b32326, see addendum

1. `src/screen/test/PlayScreen.test.tsx:11` uses `getByTestId('cauldron')`
   although the image has an accessible name (`alt='Cauldron'`,
   `src/component/Cauldron.tsx`). Guideline says `data-testid` is a last
   resort — use `getByRole('img', { name: 'Cauldron' })` and drop the
   `data-testid` attribute from the component.
2. Paused/muted display branches are untested: `PillarCard`'s `STATUS_LABEL`
   map (`src/component/PillarCard.tsx:14-19`) and `PillarControls`' Play↔Pause
   / Mute↔Unmute label switching (`src/component/PillarControls.tsx:66-79`)
   are real shipped display logic, but only `playing` and `empty` are asserted.
   Add one `status: 'paused'` case (expects `PAUSED` + a Play button) and one
   `muted: true` case (expects an Unmute button) to `PillarCard.test.tsx` —
   cheap, in-scope for the static spike.
3. `VolumeTube` clamp is untested (`src/component/VolumeTube.tsx:25-34`):
   assert the rendered percentage clamps out-of-range input (e.g. `-5` → `0%`,
   `120` → `100%`) and that an empty pillar (no `assetSlug`) shows no
   percentage and no gem.
4. `src/util/CategoryTheme.ts:16-17` claims the `fillHex`/`fillClass` sync is
   "asserted in the unit test", but `src/util/test/CategoryTheme.test.ts:21-24`
   asserts it only for Melody. Assert the class→hex pair for all four
   categories (table-driven), or soften the module comment.

## Commands run

- `yarn test` (vitest, jsdom, local only) — 29 files / 223 tests passed at
  313e90f; 30 files / 229 tests passed at 4b32326.
- `yarn lint` — clean at both SHAs (pre-existing eslint-plugin-react version
  warning only).
- No hardware/Ableton/network contact at any point; `yarn start-backend` never
  run.

## Re-review addendum (4b32326, 2026-07-17)

All four Recommended findings were addressed in
`4b32326 test(wow-007a): address test-engineer review recommendations`;
verified by reading the diff and re-running the suite locally.

1. **Resolved.** `src/screen/test/PlayScreen.test.tsx:11-13` now queries the
   cauldron via `getByAltText('Cauldron')` — a Testing Library user-facing
   query, equivalent to the suggested role query — and the `data-testid`
   attribute was removed from `src/component/Cauldron.tsx`.
2. **Resolved.** `src/component/test/PillarCard.test.tsx:58-72` adds a paused
   case (asserts the `PAUSED` label, Play control present, Pause absent) and a
   muted case (Unmute present, Mute absent), covering the `STATUS_LABEL` and
   `PillarControls` label-switching branches.
3. **Resolved.** New `src/component/test/VolumeTube.test.tsx` covers the
   in-range percentage render, out-of-range clamping (150 → `100%`,
   -10 → `0%`), and the empty-pillar variant (no percentage text, single
   dimmed tube `img`, no fill or gem). The `container.querySelectorAll('img')`
   count is an acceptable last resort here — the art images are `aria-hidden`
   decoration, unreachable by role/label queries by design.
4. **Resolved.** `src/util/test/CategoryTheme.test.ts:26-38` asserts the
   `fillHex` ↔ resolved-`fillClass` pairing table-driven across all four
   categories, matching the module comment's claim.

No new tests contact hardware, Ableton, or the network; all remain
deterministic. Re-verified at 4b32326: `yarn test` — 30 files / 229 tests
green (matches the expected count); `yarn lint` — clean. Final verdict:
**approve** — no open findings.
