# WOW-007A — General reviewer verdict

- Ticket: WOW-007A (play-mode visual-fidelity spike)
- Date: 2026-07-17
- Reviewer role: reviewer (strict general diff review, read-only)
- Reviewed SHA: `1f1134a` (`feat/wow-007a-play-mode-visual-spike`, `git diff main...HEAD` + full commit series, PR #53; initial review @ `d375a9f` — verdict then approve-with-nits, re-reviewed after fixes, see addendum)
- Verdict: **approve**

## Verdict basis

Verified independently at `d375a9f` (Node 22): `yarn lint` clean, `yarn test`
30 files / 229 tests green, `yarn build` green. Working tree clean at HEAD.

### Scope — pass

Every changed line traces to the ticket or a documented human in-session
direction: the Melody `ColorUtil` restyle (pre-decided 2026-07-15, recorded in
DECISIONS_NEEDED "Resolved"), the play-mode naming (mode-taxonomy rename,
recorded with propagation flagged as follow-up), human-supplied art assets
(provenance + processing documented in the implementation note), and the
queued-sample-names rows (PRD F3 divergence recorded as an open decision).
Existing files touched are only additive/config (`tailwind.config.cjs`,
`src/index.css`) plus the scoped `ColorUtil` change and the `main.tsx` demo
switch. No drive-by refactors, no dead code, no commented-out leftovers found.
Per-mode routing correctly **not** built (deferred per DECISIONS_NEEDED).

### Disallowed files / contract — pass

Nothing under `backend/`, `Arduino/`, `src/assets/Music Database.csv`, or
`.env`. `package.json`/`yarn.lock` untouched — no new npm dependencies; fonts
and images are static assets with licences documented
(`public/fonts/README.md`, all OFL 1.1). No socket.io usage anywhere in the new
code — grep of the diff finds no `emit(`/`socket.` in shipped source; no event
names added or renamed. No credentials, tokens, or `console.log` in the diff.

### Correctness / hardcoding — pass

- Mock data clearly mock: `src/mock/PlayModeStateMock.ts` follows the
  `XxxMock.create*` convention, values documented as illustrative.
- `#play-spike` gate (`src/main.tsx`) is correct: `import.meta.env.DEV &&`
  short-circuits first, so the spike entry is dead in production builds; the
  default provider tree is byte-identical in behaviour; StrictMode retained.
- `VolumeTube` clamps display volume to 0–100 and clamps the gem inside the
  tube at the extremes; unit-tested (150→100 %, −10→0 %, empty variant).
- Category hexes are centralised in `src/util/CategoryTheme.ts` with the
  class→hex sync unit-asserted for all four categories; `ColorUtil` remains
  the single source of truth for the fill (unit-asserted).
- `PillarView` type is coherent (optional `category` = empty pillar,
  independent `muted`, `MAX_QUEUED_ROWS` cap enforced and tested).

### Safety triage — no specialist review required

No code path in this diff emits OSC/MIDI/Art-Net/socket messages or touches
timing, quantization, mappings, or the CSV. The volume UI is display-only
(numbers + images, no handlers). The single animation (`pulse-calm`) is a
2.4 s opacity ease (~0.42 Hz), `motion-safe`-gated — no strobe/flicker risk;
the cauldron is a static image. The `ColorUtil` Melody change alters a
frontend Tailwind class only — it does not drive the physical LEDs; the
LED-match re-verification is correctly flagged as a pending human task
(DECISIONS_NEEDED + code TODO). audio-ableton-reviewer /
hardware-safety-reviewer sign-off is therefore **not** required for this diff.

### Tests / conventions / docs — pass

Tests colocated in `test/` folders, hardware-free, deterministic; behaviour
changes (status labels, mute override, queue cap, clamp, theme sync) carry
tests. Named exports only, one primary export per file, screen > container >
component hierarchy respected (`PlayScreen` → `PlayModeContainer` →
components), `Props` naming and explicit `JSX.Element` return types match the
guidelines and existing repo style. Implementation note, DECISIONS_NEEDED, and
the PR #53 body are consistent with the diff (one stale count — Recommended 1);
the ui-designer's icon-set discrepancy (Recommended 4 of that review) was
reconciled in DECISIONS_NEEDED in `d375a9f`.

## Findings

### Required

None.

### Recommended (minor/nit — fix in this PR's gate round or carry into WOW-007)

1. **[minor] PR #53 body — stale validation count.** Body claims "`yarn test`
   green (29 files / 223 tests)"; at `d375a9f` it is 30 files / 229 tests.
   Update the Validation section (and tick the test-review pipeline line,
   approve @ `4b32326`) before the gate.
2. **[minor] `src/type/PillarView.ts:5,8,15` — three exports in one type
   file.** `PillarStatus` (type), `MAX_QUEUED_ROWS` (standalone const), and
   `PillarView` deviate from "one exported type per file" and the
   grouped-constant export rule (CODING_GUIDELINES Files-and-folders /
   Exports). Suggest: `PillarStatus` into its own `src/type/PillarStatus.ts`;
   move `MAX_QUEUED_ROWS` next to its render logic or behind a grouped object.
3. **[minor] Duplicated token hex `#c9a24b`.** Defined as the `gold.line`
   token (`tailwind.config.cjs:27`) but hardcoded as SVG stroke/fill literals
   in `src/component/SettingsBand.tsx:24` and
   `src/component/TopControls.tsx:16,22,34`. Use `stroke='currentColor'` with a
   `text-gold-line` class (or a Tailwind stroke utility) so the token has one
   definition.
4. **[nit] Repeated literal `#3a3540`** (empty-state grey) in
   `src/component/PillarCard.tsx:30` and `src/component/PillarMedallion.tsx:57`
   (plus one-off status hexes `#22c55e`/`#9a9080` in `PillarCard.tsx:24,28`) —
   candidates for §3.9 semantic tokens once the page palette (§8.3) settles.
5. **[nit] `src/component/PillarCard.tsx` composes feature components while
   living in `component/`.** CODING_GUIDELINES says composition belongs in
   `container/`, but `PillarCard` is purely presentational (props-in,
   markup-out, no hooks/contexts), so a mechanical move is also wrong-shaped.
   Resolve in WOW-007: move it, or amend the guideline to allow composite
   presentational components.
6. **[nit] `src/component/VolumeTube.tsx:27`** — `gemSrc` is computed
   unconditionally, producing `/images/slider-handle-undefined.png` for empty
   pillars (never rendered thanks to the `assetSlug &&` guard, but fragile).
   Compute it inside the guarded branch.
7. **[nit] `src/component/Legend.tsx:14`** — the decorative `◈ … ◈` glyphs sit
   in the accessible text of the legend label (screen readers announce them).
   Wrap the glyphs in `aria-hidden` spans.

## Required follow-up reviewers / gates

- **frontend-ui-designer re-verification at `d375a9f`** (its Required findings
  were addressed in this commit; the prior verdict is approve-with-nits @
  `313e90f`). Do not gate until that confirmation lands.
- **Human/artist visual sign-off on PR #53** — the WOW-007A visual-fidelity
  gate is non-delegable; in-session round-7 approval must be confirmed as the
  PR approval.
- No audio-ableton-reviewer / hardware-safety-reviewer sign-off required (see
  safety triage above).

## Commands run (all local, no hardware/Ableton/network)

- `git diff main...HEAD` (full read), `git log main..HEAD`, `git status`
- `yarn lint` — clean (Node 22; pre-existing eslint-plugin-react
  version warning only)
- `yarn test` — 30 files / 229 tests green
- `yarn build` — green
- `gh pr view 53` (read-only)
- `yarn start-backend` never run

## Re-review addendum (`1f1134a`, 2026-07-17) — final verdict: **approve**

Re-reviewed the fix commit
`1f1134a fix(wow-007a): address general review recommendations` by reading its
full diff and re-running the validations locally (Node 22): `yarn lint` clean,
`yarn test` 30 files / 229 tests green, `yarn build` green. Working tree clean
at `1f1134a`; the fix touches only `src/component/`, `src/type/`, and this
note — still zero backend/Arduino/CSV/`.env`/dependency/socket-contract
surface.

Recommended findings — disposition verified:

1. **PR body counts/ticks** — deliberately deferred to the gate step
   (immediately after this re-review); acceptable, verify at gate.
2. **Resolved.** `PillarStatus` now lives in its own `src/type/PillarStatus.ts`
   (one type per file); `MAX_QUEUED_ROWS` moved into
   `src/component/PillarCard.tsx` as a module-private const next to its render
   logic; `PillarView.ts` exports exactly one type. All importers updated.
3. **Resolved.** `SettingsBand.tsx` and `TopControls.tsx` SVGs now use
   `stroke='currentColor'`/`fill='currentColor'` with the `text-gold-line`
   token class — `#c9a24b` no longer appears anywhere in `src/`
   (grep-verified); the token is defined once in `tailwind.config.cjs`.
4. **Deferred with rationale (accepted).** Status-hex tokenisation awaits the
   §8.3 page-palette decision — consistent with this note's own suggestion.
5. **Deferred with rationale (accepted).** The `PillarCard`
   placement-vs-guideline question goes to WOW-007. Record note: both
   deferrals are written in the `1f1134a` commit message and this note; the
   implementation note itself was not amended — fine, no re-flag.
6. **Resolved.** `VolumeTube.tsx` builds `gemSrc` only when `assetSlug` is
   present (no `undefined` URL string).
7. **Resolved.** `Legend.tsx` wraps the decorative `◈` glyphs in
   `aria-hidden='true'` spans; the accessible name is now "Sample Types".

Follow-up reviewers — status:

- **frontend-ui-designer re-verification: complete** — final verdict
  **approve @ `d375a9f`**, committed in `76f9787`
  (`docs/agent-notes/wow-007a-frontend-ui-designer-review.md` addendum); the
  `1f1134a` changes are outside its Required scope (type-file split, token
  refactor with identical resolved colour, guarded URL, `aria-hidden` glyphs —
  no geometry/size/contrast change).
- **test-engineer: approve @ `4b32326`** stands; suite independently re-run
  green at `d375a9f` and `1f1134a` by this reviewer.
- **Human/artist visual sign-off on PR #53 remains the terminal,
  non-delegable gate** (visual-fidelity gate, DESIGN_PROPOSAL_001).
- No audio-ableton-reviewer / hardware-safety-reviewer sign-off required
  (unchanged — no hardware/emission path).

Final verdict: **approve** — no open findings for this reviewer; gate may
proceed once the PR body is refreshed and the human grants visual sign-off.

## Round 2 addendum (`7a131df`, 2026-07-17) — verdict: **approve**

Post-gate, human-directed visual iteration round 2. Reviewed the delta only
(`git diff 1f1134a...HEAD`, commits `af20efb`, `9dfcdc6`, `1552391`, `80fe298`,
`7a131df`), read in full. Working tree clean at `7a131df`. Validations re-run
independently (Node 22): `yarn lint` clean (pre-existing plugin warning only),
`yarn test` 30 files / 230 tests green, `yarn build` green — matching the
implementation note's round-2 claim.

### Scope — pass

Every change traces to recorded human direction: fixed slider re-export +
`slider-background-empty.png` (asset-provenance update in the implementation
note), black-bg cauldron art, `melody-yellow` (`#dfa50a`) / `drums-blue`
(`#3559c0`) token refinements (DECISIONS_NEEDED 2026-07-17 entries),
category-coloured frames / pillar-name removal / layout reshape / queue-row
reorder / medallion +50% / wordmark shrink (all itemised in the "Post-gate
visual iteration round 2" note section), equalizer bars, cauldron ambience +
click ring, and the Settings modal with the animations kill-switch. No
drive-bys, no dead code found.

### Disallowed files / deps / contract — pass

Nothing under `backend/`, `Arduino/`, CSV, or `.env`; `package.json`/
`yarn.lock` untouched (`@headlessui/react` ^1.7.14 is a pre-existing
dependency, already used by `DebugModalContainer`). Grep of the delta finds no
`emit(`/`socket.`/`console.log`; no event names touched. No credentials.

### Correctness of the new interactive code — pass

- `SettingsModal`: controlled Headless UI `Dialog` (open/onClose), state owned
  by `PlayModeContainer` (`useState` ×2) — correct component/container split;
  toggle exposes `aria-pressed`, ≥44 px targets.
- Kill-switch chain verified end-to-end: `PlayModeContainer.animationsEnabled`
  → `PillarCard` → `PillarMedallion.animated` (pulse class dropped),
  `StatusBars.animated` (`dancing = active && animated` gates both class and
  per-bar delay/duration styles), `Cauldron.animated` (float class, blob layer
  unmounted, `spawnRing` early-return). Covered by the PlayScreen modal test
  (open → toggle `aria-pressed` flip → close).
- Click-ring lifecycle: `key={ringKey}` remount + `onAnimationEnd` →
  `setRingVisible(false)`; centering translate baked into the
  `cauldron-ring` keyframes so the animated transform cannot drop a utility
  translate — correct.
- `VolumeTube` now uses the real `slider-background-empty.png` (no more CSS
  desaturation fallback); clamp behaviour retested.
- `CategoryTheme`/`ColorUtil` single-source-of-truth preserved; the
  class→hex sync test updated for both new tokens.

### Safety / §7.4 — pass, no specialist review required

All new keyframes are transform/opacity-only (`eq` scaleY; `cauldron-blob`
translate/scale/opacity; `cauldron-float` translateY; `cauldron-ring`
translate/scale/opacity) — no animated layout/paint properties (blur filter
and `mix-blend-screen` on the blob layer are static). Loop periods: eq
1050–1500 ms (≈0.67–0.95 Hz), blobs 4.2–5.4 s, float 6 s, pulse-calm 2.4 s;
ring is a 0.9 s one-shot (`forwards`, non-repeating). All far below any
strobe/photosensitivity threshold, all `motion-safe`-gated, all behind the
kill-switch. Screen-only UI — no OSC/MIDI/Art-Net/socket/LED emission path;
the token changes alter frontend Tailwind classes only, with the physical-LED
re-verification correctly re-flagged (DECISIONS_NEEDED + `ColorUtil` TODO).
No audio-ableton-reviewer / hardware-safety-reviewer sign-off required.

### Conventions / tests / docs — pass

`StatusBars`/`SettingsModal` correctly placed in `src/component/` (stateless,
props-in); named exports, unexported `Props`, explicit `JSX.Element`; one
export per new file. Tests colocated, hardware-free, updated to the new
structure (heading-role queries, modal round-trip, empty-tube asset); the
`ResizeObserver` stub mirrors the existing `DebugModalContainer.test.tsx`
pattern. Implementation-note round-2 section and DECISIONS_NEEDED entries
match the actual diff (blob count, 405 px cauldron, 180 px spacer, 0.9 s ring,
token hexes all verified against code).

### Findings

Required: none.

Recommended (nit — carry into WOW-007):

1. **[nit] `src/component/Cauldron.tsx:38-44,79-83`** — under
   `prefers-reduced-motion` the ring animation never runs, so `onAnimationEnd`
   never fires and the invisible (`opacity-0`) ring span persists after a
   click; the kill-switch also doesn't cancel an in-flight ring (class not
   conditioned on `animated`; it self-completes in ≤0.9 s). Harmless either
   way — consider gating `spawnRing` on `matchMedia('(prefers-reduced-motion:
reduce)')` and adding `animated` to the ring-class condition.
2. **[nit] New off-token literals** — plume magenta `#e879f9`/`#c026d3`
   (`Cauldron.tsx`), overlay `#0b0910` (`SettingsModal.tsx:27`), empty-frame
   `#7a6230`/`#9a7b42` (`PillarFrame.tsx:17-18`) join the already-deferred
   §8.3 tokenisation list (round-1 Recommended 4) — same disposition.
3. **[nit] `src/component/StatusBars.tsx` has no colocated unit test** — the
   kill-switch is covered at the toggle level only; a cheap render test
   asserting `animate-eq` presence/absence across `active`/`animated`
   combinations would pin the gating chain.

### Required follow-up gates

- **frontend-ui-designer re-verification at `7a131df`** (requested in the
  run record; its prior approve @ `d375a9f` pre-dates this visual round).
- **Human/artist visual sign-off on PR #53** — unchanged, non-delegable.
- No audio-ableton-reviewer / hardware-safety-reviewer sign-off required.

Commands run: `git diff 1f1134a...HEAD` (full read), `git log`, `git status`,
`yarn lint`, `yarn test`, `yarn build` (all local, Node 22); `yarn
start-backend` never run.
