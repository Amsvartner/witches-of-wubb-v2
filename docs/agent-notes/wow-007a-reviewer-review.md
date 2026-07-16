# WOW-007A — General reviewer verdict

- Ticket: WOW-007A (play-mode visual-fidelity spike)
- Date: 2026-07-17
- Reviewer role: reviewer (strict general diff review, read-only)
- Reviewed SHA: `d375a9f` (`feat/wow-007a-play-mode-visual-spike`, `git diff main...HEAD` + full commit series, PR #53)
- Verdict: **approve-with-nits**

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
