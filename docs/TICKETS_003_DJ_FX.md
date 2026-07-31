# Tickets 003 — DJ FX feature batch (WOW-039…WOW-044)

Created 2026-07-21 by project-manager from the human-approved DJ FX batch (decision 2026-07-21). First full-product batch under ADR-007 (`docs/adr/007-full-product-scope.md`): backend, sim, and UI move together. The batch is exactly five DJ-mode-facing features — (1) beat-phase / clip-position display per pillar, (2) channel VU meters per pillar, (3) per-pillar filter, (4) FX sends / echo throw, (5) loop roll — plus a Live-set discovery/verification ticket that fronts them all. Nothing else rides along.

Three of the five features (filter, sends/echo, loop roll) depend on devices that only exist after **a human executes `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` in Ableton** (agents never touch the Live set). Features 1–2 (beat phase, VU meters) need no set changes and are code-only. The naming contract in that spec (rack `DJ FX`, macros `Filter LP`/`Filter HP`/`Roll Grid`, device `DJ Repeat`, returns `Echo`/`Reverb`; trim-then-case-sensitive matching) is treated as given here — tickets must not reinterpret it.

**Batch-wide posture (applies to every ticket below, in addition to AGENTS.md):**

- Discovery-based, never assumed: the backend only controls what WOW-039's discovery actually found. A missing/renamed item disables that feature with a startup warning — never fatal, same posture as `DRUM_RACK_TRACK_INDEX`.
- Every new socket event is a **managed-contract addition** (ADR-007): the same PR updates `docs/ABLETON_INTEGRATION.md` (event table + behavior notes) and implements `sim/` parity (`sim/core/simulator.ts`, `sim/server.ts` as needed, `sim/test/simulator.test.ts`). Event names listed per ticket are _suggested_; the ticket's docs update fixes the final names. Renaming/removing existing events is also ticket-managed (relaxation 2026-07-21) — ship the doc + sim updates in the same PR.
- High-frequency backend→UI streams (clip positions, meters) are throttled/batched and emitted via `OutgoingEvents.emitEventWithoutResettingTimeout` — a telemetry stream must never count as visitor activity, or the idle timeout can never fire. DJ _control_ events (`set_*`) reset the timeout like the existing sliders do.
- All FX apply to pillar tracks 0–3 only. The cauldron/drum-rack track and return tracks get no FX control from this batch (spec §3).
- DJ-mode-only UI: all new controls and displays are gated on the existing frontend `djMode` state (`PlayModeContainer` → `PillarCardContainer`), matching `DjPillarControls`. Whether beat-phase/VU also show in play mode is an open product decision — see the Decision-needed blocks at the end; **default is DJ-mode-only until the human says otherwise.**
- The DJ-mode line WOW-007B/C is merged; WOW-007D (`feat/wow-007d-dj-batch`, PR #57 line) is in flight. Coordinate branch bases so this batch doesn't conflict with WOW-007D's `set_dj_mode`/`dj_mode_changed` work; when in doubt, land after it.

**Suggested order of attack:** WOW-039 first (it is the tool the human needs for the Live-set execution checklist §5 step 7, and its availability contract is a dependency of 042–044) → hand the human the Live-set spec execution (outside the agent loop) → meanwhile WOW-040 and WOW-041 in either order or parallel (code-only, no set dependency) → once `yarn verify-liveset` reports clean: WOW-042 (pure parameter writes, simplest control path) → WOW-043 (adds the stop-path echo throw — most timing-sensitive, benefits from 042's established patterns) → WOW-044 (loop roll). Decision blocks 2–4 below were answered by the human on 2026-07-21 — nothing in the batch is decision-blocked.

**Reviewer recommendations (relaxed 2026-07-21, ADR-007 amendment — recommended, not gate requirements):** every ticket in this batch touches the backend Ableton path, so an **audio-ableton-reviewer pass is recommended** throughout (WOW-039…WOW-044). For the loudness-relevant tickets — WOW-042 (filter), WOW-043 (sends/returns), WOW-044 (beat repeat) — a **hardware-safety-reviewer pass is recommended too**. WOW-040/WOW-041 (read-only telemetry) are low-risk. `yarn start-backend` and `yarn verify-liveset` are live-connection commands agents may run when the ticket calls for it, with care while a real installation is live. Definition of done everywhere: hardware-free vitest tests + simulator parity; live-Ableton verification is human or agent-run per ticket.

---

- ID: WOW-039
- Title: Live-set DJ FX discovery + read-only `yarn verify-liveset` verification script + availability contract
- Goal: Give the backend (and the human executing the Live-set spec) a single source of truth for what DJ FX hardware the Live set actually provides. Two deliverables sharing one discovery core: (a) a backend startup discovery pass that walks pillar tracks 0–3 for the `DJ FX` rack and its `Filter LP`/`Filter HP`/`Roll Grid` macros, finds `DJ Repeat` inside the rack, and finds return tracks `Echo`/`Reverb` via `song.return_tracks` — caching the resolved `DeviceParameter`/device handles for tickets 042–044 and computing a per-feature availability map (`filter`, `sends`, `loopRoll`), where any missing piece logs one clear warning naming exactly what was not found and disables only that feature (never fatal, `DRUM_RACK_TRACK_INDEX` posture); (b) `yarn verify-liveset`, a standalone read-only script (suggested: `backend/script/verify-liveset.ts`, root `package.json` script entry) that connects to Ableton, runs the same discovery, additionally reports the informational spec §3/§5 checks (all pillar sends at 0, `DJ Repeat` deactivated on all four racks, return volumes at/below −6 dB — reported, not corrected), and prints a found/missing report against `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` §1, exiting non-zero when anything the spec names is missing. The script performs **zero writes** of any kind. New managed-contract events (suggested names): `get_dj_fx_availability` (UI → backend, ack `{ filter: boolean; sends: boolean; loopRoll: boolean }`) and `dj_fx_availability_changed` (backend → UI, same payload, broadcast after every discovery run — startup and any `getTracksAndClips` re-run) so the UI in 042–044 can grey out unavailable controls.
- Context files: `AGENTS.md`, `docs/adr/007-full-product-scope.md`, `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` (the contract being verified), `docs/ABLETON_INTEGRATION.md`, `backend/adapter/AbletonAdapter.ts` (the `DRUM_RACK_TRACK_INDEX` degradation posture and the cauldron `DeviceParameter` plumbing, `getCauldronVolumeParam`), `sim/core/simulator.ts`, `docs/CODING_GUIDELINES.md`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/service/` (new discovery service + colocated `test/`), `backend/script/` (new, the verify script), `backend/type/` (availability/discovery types), `backend/event/IncomingEvents.ts`, `backend/event/OutgoingEvents.ts`, `backend/adapter/test/**`, `package.json` + `backend/package.json` (script entries only), `sim/core/simulator.ts`, `sim/core/scenario.ts`/`sim/core/scenarios.ts` (scenario-configurable availability so the UI's degraded state is testable), `sim/server.ts`, `sim/test/**`, `docs/ABLETON_INTEGRATION.md`, `README.md` (one short verify-liveset usage note).
- Disallowed files: `src/assets/Music Database.csv`; `Arduino/**`; `backend/service/KeyTranspositionService.ts`; `backend/util/ClipNameUtil.ts`; `.env` (no new env vars without human approval); everything under `src/` (no UI in this ticket — the availability events are consumed by later tickets).
- Acceptance criteria: name matching implemented exactly per spec §1 (trim surrounding whitespace, then case-sensitive compare; no clip-name normalization applied) as a pure, unit-tested function; startup with all items present resolves and caches all handles, logs availability at info, broadcasts full availability; any single missing item (rack, macro, `DJ Repeat`, either return) yields exactly that feature disabled, one actionable warning naming the missing thing and the track it was expected on, no crash, no effect on any existing startup behavior; discovery re-runs (and re-broadcasts) when `getTracksAndClips` re-runs, clearing stale handles (WOW-021 lesson); `verify-liveset` is read-only (reviewer-verified: no `set`, `fire`, or state-mutating command anywhere in its path), reports every §1 item found/missing plus the §3 informational checks, and exits non-zero on missing contract items; the two new events are documented in `docs/ABLETON_INTEGRATION.md` in the same PR; sim answers `get_dj_fx_availability` and emits `dj_fx_availability_changed` with scenario-configurable availability; existing startup behavior (clip loading, volumes, cauldron, rebuild) byte-for-byte unchanged when discovery finds nothing.
- Required tests/checks: vitest unit tests for the pure matching/report logic (found/missing permutations, decorated-name rejection e.g. `DJ FX ` with trailing space passes trim but `dj fx` fails case) with zero `ableton-js` connections; sim parity tests; `yarn test`, `yarn lint`, `yarn build`, `tsc --noEmit -p backend/tsconfig.json`. Live verification of the script is a **human** action (it is the Live-set spec §5 step 7).
- Hardware/audio/LED/RFID safety notes: strictly read-only against Ableton — no parameter writes, no fires, no volume/send/device-state changes anywhere in this ticket. `yarn verify-liveset` opens a live Ableton connection: treat like `yarn start-backend` — agents never run it; the README note must say it is safe only in the sense of read-only, and should be run with the installation offline per spec §5. Degradation must never block the installation from starting. audio-ableton-reviewer + hardware-safety-reviewer sign-off.
- Dependencies: `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` reviewer sign-off (the contract must be final before code encodes it). Not blocked by the human's Live-set execution — the script's job is to report missing items before/after execution. Blocks WOW-042, WOW-043, WOW-044.
- Out of scope: any control/write path (042–044); UI consumption of availability (042–044); auto-fixing set mismatches; new env vars; master-track discovery.
- Suggested agent(s): creative-tech-integrator (build), test-engineer, reviewer, audio-ableton-reviewer + hardware-safety-reviewer (sign-off)
- Risk: low-medium (additive startup phase and a new live-connect tool; zero writes)
- Stop conditions: The spec's naming contract changes during its sign-off → re-sync this ticket before coding. Discovery turns out to require ableton-js calls not available in 3.1.5 (e.g. rack chain traversal to find `DJ Repeat`) → stop and report the exact API gap; do not work around it by guessing device indices. Any need to write anything → stop; this ticket is read-only by definition.

---

- ID: WOW-040
- Title: Beat-phase / clip-position display per pillar (DJ mode)
- Goal: Show the DJ where each pillar's playing clip is in its loop. Backend: for each pillar with a playing clip, attach a `playing_position` listener to that clip (the same observable the phrase-leader logic already uses at `backend/adapter/AbletonAdapter.ts:598-616` — this ticket adds **separate, per-pillar listeners** and must not touch the phrase-leader's), throttle, and broadcast a suggested `clip_position_changed` (backend → UI, `{ pillar: number; position: number; loopStart: number; loopEnd: number }`) via `emitEventWithoutResettingTimeout`; attach on clip start, detach on stop/unqueue/timeout so listeners never leak or outlive their clip. Frontend: a per-pillar phase indicator in the pillar card, visible in DJ mode only, driven by the event stream (the UI may interpolate between throttled updates locally for smoothness); presentation stays within the existing pillar-card visual language — a simple progress indicator, not a new visual concept.
- Context files: `AGENTS.md`, `docs/ABLETON_INTEGRATION.md`, `backend/adapter/AbletonAdapter.ts` (phrase-leader listener + `stoppingClips`/listener-cleanup patterns), `backend/event/OutgoingEvents.ts`, `sim/core/simulator.ts`, `src/container/PillarCardContainer.tsx`, `src/component/PillarCard.tsx`, `src/component/DjPillarControls.tsx`, `docs/CODING_GUIDELINES.md`, `docs/UX_UI_PRINCIPLES.md`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/event/OutgoingEvents.ts`, `backend/type/` (payload type), `backend/adapter/test/**`, `sim/core/simulator.ts`, `sim/server.ts`, `sim/test/**`, `docs/ABLETON_INTEGRATION.md`, `src/context/hook/useAbletonContextProviderState.ts`, `src/container/PillarCardContainer.tsx`, `src/component/PillarCard.tsx` (+ `src/component/PillarMedallion.tsx` if the indicator lives there), `src/component/test/**`, `src/container/test/**`, `src/context/hook/test/**`.
- Disallowed files: the phrase-leader listener block and `PhraseLeaderService` (read, don't modify); `backend/service/KeyTranspositionService.ts`; `src/assets/Music Database.csv`; `Arduino/**`; `sim/core/music-database.ts`.
- Acceptance criteria: emission rate is bounded by an explicit throttle (implementer picks a rate and documents it in `ABLETON_INTEGRATION.md`; trailing edge included so the last position before a stop lands) and uses the without-reset emit variant — reviewer explicitly verifies the stream cannot reset the idle timeout; listeners are attached per playing pillar and cleaned up on every stop path (manual stop, replacement, idle timeout, `getTracksAndClips` re-run) with no accumulation across clip changes (test-asserted where a seam exists, reviewer-traced otherwise); phrase-leader behavior, trigger timing, and all existing events byte-for-byte unchanged; UI shows the indicator only in DJ mode and only on pillars with a playing clip, degrades silently (no indicator, no errors) when no position events arrive; event documented in `docs/ABLETON_INTEGRATION.md` in the same PR; sim synthesizes deterministic position streams for playing clips so the UI is demoable via `yarn sim` + `yarn dev`.
- Required tests/checks: hardware-free vitest: sim position-stream tests, hook test consuming the event, component test for DJ-only visibility; `yarn test`, `yarn lint`, `yarn build`, `tsc --noEmit -p backend/tsconfig.json`. Human demo: `yarn sim` + `yarn dev`, enter DJ mode, observe the phase indicator advance on a playing pillar.
- Hardware/audio/LED/RFID safety notes: read-only telemetry — no writes to Ableton. The two hazards are listener leakage (each leaked `playing_position` listener is ongoing UDP-bridge load) and idle-timeout suppression (must use without-reset emits). No loudness surface. audio-ableton-reviewer sign-off.
- Dependencies: none (code-only; no Live-set change; no WOW-039 dependency). Play-mode visibility is Decision-needed block 1 — default DJ-only until answered.
- Out of scope: VU meters (WOW-041); any play-mode display (pending decision); bar/beat quantization display or musical-time formatting beyond loop position (would be new musical UI behavior — not specced); backend changes to when clips start/stop.
- Suggested agent(s): creative-tech-integrator (backend), frontend-implementer (UI), test-engineer, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low-medium (listener lifecycle on the hot path next to phrase-leader timing)
- Stop conditions: Any implementation route that would share or restructure the phrase-leader's listener → stop and ask. Throttled streaming turns out to visibly load the ableton-js bridge in review analysis → stop and propose a lower rate/design before merging.

---

- ID: WOW-041
- Title: Per-pillar channel VU meters (DJ mode)
- Goal: Live output metering per pillar for the DJ. Backend: observe `track.output_meter_left`/`output_meter_right` (or `output_meter_level` — implementer picks the pair that renders honestly and documents the choice) on pillar tracks 0–3; these listeners fire at high frequency, so per-track samples are coalesced and broadcast **batched** — one suggested `output_levels_changed` event (backend → UI, `{ pillars: Array<{ left: number; right: number } | null> }`, index = pillar, `null` for silent/unknown) at a bounded rate via `emitEventWithoutResettingTimeout`. Meter listeners attach at startup (they are track-level, not clip-level, so lifecycle is simpler than WOW-040) and re-attach cleanly on `getTracksAndClips` re-runs. Frontend: per-pillar meter in the pillar card, DJ mode only, styled within the existing pillar visual language (the `VolumeTube` component is the closest existing vocabulary — reuse/extend rather than invent); silent decay to zero when events stop. Master-bus metering is **not** in this ticket — it is Decision-needed block 5.
- Context files: `AGENTS.md`, `docs/ABLETON_INTEGRATION.md`, `backend/adapter/AbletonAdapter.ts` (track loading, `getTrackVolumes` pattern, WOW-021 re-fetch lesson), `backend/event/OutgoingEvents.ts`, `sim/core/simulator.ts`, `src/component/VolumeTube.tsx`, `src/container/PillarCardContainer.tsx`, `docs/CODING_GUIDELINES.md`, `docs/UX_UI_PRINCIPLES.md`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/event/OutgoingEvents.ts`, `backend/type/`, `backend/adapter/test/**`, `sim/core/simulator.ts`, `sim/server.ts`, `sim/test/**`, `docs/ABLETON_INTEGRATION.md`, `src/context/hook/useAbletonContextProviderState.ts`, `src/container/PillarCardContainer.tsx`, `src/component/PillarCard.tsx`, `src/component/VolumeTube.tsx` (extension only), new `src/component/` meter component if cleaner, `src/component/test/**`, `src/container/test/**`, `src/context/hook/test/**`.
- Disallowed files: `src/assets/Music Database.csv`; `Arduino/**`; `backend/service/**` (no service-layer changes needed); the cauldron/drum-rack track (no metering on track 4 in this batch); anything touching volume _writes_ — this ticket reads levels, it never sets them.
- Acceptance criteria: broadcast rate is explicitly bounded regardless of how fast Ableton fires the observers (batching window documented in `ABLETON_INTEGRATION.md`); without-reset emit verified (a meter stream over a playing set must not suppress the idle timeout); zero writes to any Ableton parameter; listener re-attachment on re-fetch leaves no duplicates (WOW-021 class); UI meters render only in DJ mode, decay/clear when a pillar goes silent or events cease, and never NaN/negative-render on malformed payloads; event documented in the same PR; sim emits synthetic level envelopes for playing clips (deterministic under fake timers) so meters are demoable offline.
- Required tests/checks: hardware-free vitest: sim level-stream tests, hook + component tests (DJ-only visibility, decay, malformed-payload guard); `yarn test`, `yarn lint`, `yarn build`, `tsc --noEmit -p backend/tsconfig.json`. Human demo: `yarn sim` + `yarn dev`, DJ mode, meters move on playing pillars.
- Hardware/audio/LED/RFID safety notes: read-only; meters are explicitly **not** loudness-relevant (no gain path is touched). Main risk is bridge/socket flooding — the batching bound is the safety property. audio-ableton-reviewer sign-off.
- Dependencies: none (code-only). Independent of WOW-040 but shares the "bounded telemetry stream" pattern — whichever lands first sets the pattern, the second follows it. Play-mode visibility: Decision-needed block 1. Master meter: Decision-needed block 5.
- Out of scope: master/cauldron/return metering; peak-hold/clip-warning indicators (new UX behavior — propose separately if wanted); any volume control changes.
- Suggested agent(s): creative-tech-integrator (backend), frontend-implementer (UI), test-engineer, reviewer, audio-ableton-reviewer (sign-off)
- Risk: low-medium (highest-frequency observable in the codebase; flooding is the failure mode)
- Stop conditions: Observed listener behavior in ableton-js 3.1.5 makes per-track meter observation unreliable or bridge-saturating even when throttled → stop, document findings, and propose polling or dropping to `output_meter_level` only before building around it.

---

- ID: WOW-042
- Title: Per-pillar DJ filter — bipolar UI knob driving the `Filter LP` / `Filter HP` macros
- Goal: The classic one-knob DJ filter per pillar. Backend: using WOW-039's cached macro `DeviceParameter`s, expose suggested events `get_pillar_filters` (UI → backend, ack: per-pillar `{ lp: number; hp: number }`, normalized 0..1), `set_pillar_filter` (UI → backend, `{ pillar, lp, hp }`), and `pillar_filter_changed` (backend → UI, `{ pillar, lp, hp }`) — same `DeviceParameter` write plumbing as the cauldron volume, values clamped to the parameter's own min/max, writes refused (warned, not queued) for pillars where discovery reported `filter` unavailable. Neutral is `lp = 1` (127, fully open) / `hp = 0` (fully closed) per spec §2 — at neutral the audio path must be untouched. Frontend: one center-detented bipolar knob (or slider) per pillar in the DJ controls (`DjPillarControls`): center = neutral (both macros at neutral); left half sweeps `Filter LP` from open toward closed with `Filter HP` held neutral; right half sweeps `Filter HP` from closed toward open with `Filter LP` held neutral; a snap/reset-to-center affordance returns to neutral. Emissions throttled with trailing edge exactly like the WOW-027 slider pattern (`src/util/` throttle util). Control disabled (greyed, with the availability reason) when `dj_fx_availability` says `filter: false`.
- Context files: `AGENTS.md`, `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` (§1, §2 — the macro contract and neutral positions), `docs/ABLETON_INTEGRATION.md`, `backend/adapter/AbletonAdapter.ts` (cauldron `DeviceParameter` pattern, `clampVolume` precedent), WOW-039's discovery service, `sim/core/simulator.ts`, `src/component/DjPillarControls.tsx`, `src/container/PillarCardContainer.tsx` (the WOW-007C draft/Apply pattern — decide with the reviewer whether filter joins the Apply diff or is live-immediate like a performance control; a DJ filter is a performance gesture, so live-immediate is the expected reading, but confirm against the existing DJ-controls interaction grammar), `src/container/VolumeSliderContainer.tsx` + `src/util/` (WOW-027 throttle), `docs/UX_UI_PRINCIPLES.md`, `docs/CODING_GUIDELINES.md`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/service/` (discovery service consumption), `backend/event/IncomingEvents.ts`, `backend/event/OutgoingEvents.ts`, `backend/type/`, `backend/adapter/test/**`, `backend/service/test/**`, `sim/core/simulator.ts`, `sim/server.ts`, `sim/test/**`, `docs/ABLETON_INTEGRATION.md`, `src/component/DjPillarControls.tsx`, `src/container/PillarCardContainer.tsx`, `src/context/hook/useAbletonContextProviderState.ts`, `src/util/**`, `src/component/test/**`, `src/container/test/**`, `src/context/hook/test/**`.
- Disallowed files: the Live set (human-only, already executed by now); `src/assets/Music Database.csv`; `Arduino/**`; `backend/service/KeyTranspositionService.ts`; filter _resonance_, LFO, drive, or any macro **mapping** — the backend writes the two named macros' values and nothing else about the devices.
- Acceptance criteria: backend writes only `Filter LP`/`Filter HP` `DeviceParameter` values on pillar tracks 0–3, clamped to parameter min/max, only when discovery found them; unavailable pillars produce a warning and no write; UI knob at center ⇒ both macros at exact neutral (the "resting = audibly untouched" contract, spec §2 — test-asserted); left/right half-sweeps drive only their own macro, other held at neutral; set events throttled per WOW-027 with the released position always landing; UI control DJ-mode-only, disabled with availability `filter: false`; `pillar_filter_changed` keeps multiple clients in sync; events + behavior documented in `ABLETON_INTEGRATION.md` in the same PR; sim implements get/set/changed with the same clamp + availability semantics, tests cover neutral, both sweep directions, unavailable-pillar refusal; no change to volume, tempo, transposition, or clip-trigger behavior.
- Required tests/checks: hardware-free vitest (backend pure mapping logic — normalized knob value → macro pair — as an exported pure function; sim event tests; UI component tests incl. center-detent neutrality and disabled state); `yarn test`, `yarn lint`, `yarn build`, `tsc --noEmit -p backend/tsconfig.json`. Human demo: `yarn sim` + `yarn dev`, DJ mode, sweep the knob, watch macro values in the sim log; live-set verification is the human's, after merge.
- Hardware/audio/LED/RFID safety notes: **loudness-relevant** (filter resonance can boost level — the ≤15% resonance cap lives in the Live set per spec §2 and is verified by WOW-039's script, not by this code, but the reviewer must confirm the backend cannot push anything except the two frequency macros). Neutral-position transparency is the safety contract for visitors. Requires audio-ableton-reviewer **and** hardware-safety-reviewer sign-off. Never run `yarn start-backend` or `yarn verify-liveset`.
- Dependencies: WOW-039 (availability + cached parameters) and the human's Live-set execution verified clean by `yarn verify-liveset`. Decision-needed block 2 (FX state on idle timeout / DJ-mode exit) must be answered before merge — the ticket implements whatever the human decides there. Coordinate with WOW-007D's DJ-controls surface if still unmerged.
- Out of scope: sends (WOW-043), roll (WOW-044); changing macro mappings or filter device settings; per-pillar FX on the cauldron; persisting filter positions across backend restarts.
- Suggested agent(s): creative-tech-integrator (backend), frontend-implementer (UI), test-engineer, reviewer, audio-ableton-reviewer + hardware-safety-reviewer (sign-off)
- Risk: medium (first write-path of the batch; audible on the live rig by design)
- Stop conditions: Decision block 2 unanswered at implementation time → build the control path, stop before wiring timeout/mode-exit behavior, ask. Macro `DeviceParameter`s turn out not to be name-addressable in ableton-js 3.1.5 as the spec assumes → stop, report the API reality, re-open the spec rather than matching by parameter index. The knob-feel mapping (curve/taper of the half-sweeps) provokes any musical disagreement → ship linear, log the taper as a follow-up decision, don't tune by guesswork.

---

- ID: WOW-043
- Title: FX sends per pillar + echo-throw stop transition
- Goal: Give the DJ the two return sends and the classic "echo out". Backend: (a) manual send control — suggested events `get_pillar_sends` (ack: per-pillar `{ a: number; b: number }`, normalized 0..1), `set_pillar_send` (`{ pillar, send: 'a' | 'b', value }`), `pillar_send_changed` — writing the pillar track's `mixer_device.sends` `DeviceParameter`s (send A → `Echo`, send B → `Reverb`, resolved via WOW-039 discovery, never by hard-coded index alone — discovery confirms which send index corresponds to which named return); (b) echo-throw — a suggested `stop_clip_with_echo` (UI → backend, `{ pillar }`) that performs the **existing** stop sequence for that pillar's playing clip with one addition: briefly raising that pillar's send A around the stop so the tail rings out on the `Echo` return (spec §3), then restoring the send to its pre-throw value. The throw envelope (target level, timing relative to the stop, restore delay) is **not invented here**: implemented as named constants with the values set per Decision-needed block 4's answer, and the whole sequence traced by the audio reviewer. Frontend: send A/B controls per pillar in `DjPillarControls` (DJ-mode-only, availability-gated, throttled per WOW-027), and an "echo out" option surfaced alongside the existing confirm-gated stop action — echo-out stops the music, so it sits behind the same confirm gate as the plain stop (UX_UI_PRINCIPLES: destructive actions are confirm-gated).
- Context files: `AGENTS.md`, `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` (§1, §3 — returns, send posture, post-fader, feedback cap), `docs/ABLETON_INTEGRATION.md`, `backend/adapter/AbletonAdapter.ts` (`stopOrRemoveClipFromQueue` — the stop sequence being decorated, `stoppingClips` bookkeeping, WOW-033's timeout pitch-reset pattern), WOW-039's discovery service, `sim/core/simulator.ts`, `src/component/DjPillarControls.tsx` (existing confirm-gated stop), `src/container/PillarCardContainer.tsx`, `docs/UX_UI_PRINCIPLES.md`, `docs/CODING_GUIDELINES.md`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/service/`, `backend/event/IncomingEvents.ts`, `backend/event/OutgoingEvents.ts`, `backend/type/`, `backend/adapter/test/**`, `backend/service/test/**`, `sim/core/simulator.ts`, `sim/server.ts`, `sim/test/**`, `docs/ABLETON_INTEGRATION.md`, `src/component/DjPillarControls.tsx`, `src/container/PillarCardContainer.tsx`, `src/context/hook/useAbletonContextProviderState.ts`, `src/component/test/**`, `src/container/test/**`, `src/context/hook/test/**`.
- Disallowed files: return-track **volume** — the backend never reads-to-write or writes return-track volume or any return-track device parameter in this batch (control of returns beyond the pillar-side sends is out of batch scope; consequence: the `[0, 0.7]` clamp question the spec §3 deferred is moot until a future ticket adds return control, and that ticket must revisit it); cauldron sends (stay 0, spec §3); `src/assets/Music Database.csv`; `Arduino/**`; `backend/service/KeyTranspositionService.ts`; the stop sequence's command **order/timing** for the non-echo path (byte-for-byte unchanged).
- Acceptance criteria: send writes clamped to the send parameter's min/max, refused with a warning when discovery reported `sends` unavailable; plain stop path (existing events, ordering, timing, `stoppingClips`/pitch-reset behavior) byte-for-byte unchanged; echo-throw raises only send A of the target pillar, restores the pre-throw value even when the stop path errors mid-sequence (restore in a `finally`-equivalent — a stuck-high send is the failure mode the reviewer must be able to rule out), and never fires on a pillar with nothing playing (no-op + warning); idle timeout and DJ-mode-exit behavior for sends per Decision-needed block 2's answer; UI: sends DJ-mode-only + availability-gated + throttled; echo-out behind the same confirm gate as plain stop, clearly a stop variant, not a new destructive surface; all events + throw behavior documented in `ABLETON_INTEGRATION.md` in the same PR; sim parity incl. a deterministic throw sequence test (send raised → stop events → send restored, under fake timers).
- Required tests/checks: hardware-free vitest (sim throw-sequence and send clamp/availability tests; UI confirm-gate + disabled-state tests; pure envelope/restore logic unit-tested via an exported seam); `yarn test`, `yarn lint`, `yarn build`, `tsc --noEmit -p backend/tsconfig.json`. Human demo: `yarn sim` + `yarn dev`, DJ mode, set sends, echo-out a playing pillar, watch the sim log sequence.
- Hardware/audio/LED/RFID safety notes: **loudness-relevant — the most safety-sensitive ticket of the batch.** Sends feed a delay return whose feedback cap (≤60%) lives in the Live set (spec §3, verified read-only by WOW-039's script); the backend-side safety properties are: sends clamped, throw always restored, no return-volume writes, non-echo stop path untouched. Requires audio-ableton-reviewer **and** hardware-safety-reviewer sign-off; the throw's interaction with `stoppingClips`/pitch-reset (WOW-033 territory) needs an explicit reviewer trace. Never run `yarn start-backend` or `yarn verify-liveset`.
- Dependencies: WOW-039 + human Live-set execution (verified clean). Decision-needed block 4 (throw envelope values) and block 2 (FX state on timeout/mode exit) must be answered before merge. Recommended after WOW-042 (reuses its parameter-write + availability-gating patterns). Interacts with the same stop-path code WOW-033 touched — land after WOW-033 or coordinate explicitly.
- Out of scope: return-track control of any kind; send B ("reverb throw") transitions — manual send B only, no throw variant (not specced); cauldron FX; changing what "stop" means.
- Suggested agent(s): creative-tech-integrator (backend), frontend-implementer (UI), test-engineer, reviewer, audio-ableton-reviewer + hardware-safety-reviewer (sign-off)
- Risk: medium-high (write path into a feedback-bearing return, decorating the stop sequence)
- Stop conditions: Decision block 4 unanswered when the throw is reached → build manual sends, stop before the throw, ask. Discovery cannot reliably map send index ↔ named return in ableton-js 3.1.5 → stop; do not fall back to "send 0 is probably Echo" without the human confirming. Any implementation pressure to touch return-track parameters → stop (explicitly out of scope). The throw requires reordering existing stop commands → stop and ask (musical/timing change).

---

- ID: WOW-044
- Title: Loop roll per pillar — `DJ Repeat` `is_active` toggle + `Roll Grid` macro
- Goal: Momentary beat-repeat rolls for the DJ. Backend: suggested events `set_loop_roll` (UI → backend, `{ pillar, active: boolean, grid?: number }` — `grid` normalized 0..1 onto the `Roll Grid` macro, settable with or without an active roll) and `loop_roll_changed` (backend → UI, `{ pillar, active: boolean, grid: number }`); activating sets the pillar's `DJ Repeat` device `is_active` to true, deactivating returns it to false — nothing else about the device is ever written (its musical settings are the Live set's, spec §2.1). Off is the failsafe state (spec: "off is the failsafe default"): the backend forces `is_active` false for all four pillars on startup-discovery completion, on idle timeout, and on backend shutdown paths that already silence audio (WOW-034's bounded best-effort pattern) — a roll left stuck on is the failure mode this ticket must make impossible. Frontend: per-pillar roll control + grid selector in `DjPillarControls`, DJ-mode-only, availability-gated; the engage gesture (hold-momentary vs tap-toggle) is Decision-needed block 3 — implement the human's choice, don't pick.
- Context files: `AGENTS.md`, `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` (§1, §2.1 — device contract, failsafe-off, grid macro), `docs/ABLETON_INTEGRATION.md`, `backend/adapter/AbletonAdapter.ts` (`handleTimeout`, WOW-034 crash-silencing pattern), WOW-039's discovery service, `sim/core/simulator.ts`, `src/component/DjPillarControls.tsx`, `docs/UX_UI_PRINCIPLES.md`, `docs/CODING_GUIDELINES.md`.
- Allowed files: `backend/adapter/AbletonAdapter.ts`, `backend/service/`, `backend/event/IncomingEvents.ts`, `backend/event/OutgoingEvents.ts`, `backend/type/`, `backend/adapter/test/**`, `backend/service/test/**`, `sim/core/simulator.ts`, `sim/server.ts`, `sim/test/**`, `docs/ABLETON_INTEGRATION.md`, `src/component/DjPillarControls.tsx`, `src/container/PillarCardContainer.tsx`, `src/context/hook/useAbletonContextProviderState.ts`, `src/component/test/**`, `src/container/test/**`, `src/context/hook/test/**`.
- Disallowed files: every `DJ Repeat` parameter except `is_active`, and every `DJ FX` macro except `Roll Grid` (Interval/Chance/Gate/Mix/Variation/Pitch are Live-set-owned, spec §2.1); `src/assets/Music Database.csv`; `Arduino/**`; `backend/service/KeyTranspositionService.ts`; clip triggering/quantization (a roll must not change when clips fire).
- Acceptance criteria: activate/deactivate writes only `is_active`; grid writes only the `Roll Grid` macro, clamped; both refused with a warning when discovery reported `loopRoll` unavailable; failsafe-off enforced at startup-discovery, idle timeout, and the WOW-034 crash-silencing path, without changing any of those paths' existing ordering/timing (additive, reviewer-traced); a roll active at idle timeout cannot survive into the attractor/idle state; UI reflects `loop_roll_changed` (multi-client sync), DJ-mode-only, availability-gated, gesture per decision block 3; events + failsafe semantics documented in `ABLETON_INTEGRATION.md` in the same PR; sim parity with tests for activate/deactivate, grid set, unavailable refusal, and timeout-forces-off.
- Required tests/checks: hardware-free vitest (sim tests above; UI gesture + disabled-state component tests); `yarn test`, `yarn lint`, `yarn build`, `tsc --noEmit -p backend/tsconfig.json`. Human demo: `yarn sim` + `yarn dev`, DJ mode, engage/release roll, change grid, watch sim log; audible tuning of the roll itself is a human, by-ear activity per spec §2.1.
- Hardware/audio/LED/RFID safety notes: **loudness-relevant** (Beat Repeat in insert mode replaces the signal; the no-added-gain guarantee lives in the Live-set preset, spec §2.1 — the backend's contribution to safety is exactly the failsafe-off discipline and touching nothing else on the device). Requires audio-ableton-reviewer **and** hardware-safety-reviewer sign-off. Never run `yarn start-backend` or `yarn verify-liveset`.
- Dependencies: WOW-039 + human Live-set execution (verified clean). Decision-needed block 3 (gesture) and block 2 (mode-exit behavior — timeout behavior is already failsafe-off per spec) before merge. Recommended last in the batch; if WOW-034 is unmerged when this starts, coordinate the shutdown-path addition.
- Out of scope: any other Beat Repeat parameter; roll on the cauldron; automatic/quantized roll patterns (new musical behavior — not specced); persisting grid across restarts.
- Suggested agent(s): creative-tech-integrator (backend), frontend-implementer (UI), test-engineer, reviewer, audio-ableton-reviewer + hardware-safety-reviewer (sign-off)
- Risk: medium (device-state toggling on the live path; failsafe discipline is the whole game)
- Stop conditions: Decision block 3 unanswered when the UI is reached → build the backend contract, stop before the gesture, ask. `is_active` toggling in ableton-js 3.1.5 behaves unexpectedly (e.g. latency or state drift that a reviewer flags as audibly unusable) → stop and report; do not compensate with retry/timing hacks on the live path. Wiring failsafe-off into timeout/shutdown would require reordering existing commands → stop and ask.

---

## Decision blocks (1–4 **resolved by the human 2026-07-21** — resolutions noted per block and mirrored in `docs/DECISIONS_NEEDED.md`; 5 remains open with its default standing)

### 1. Beat-phase + VU visibility in play mode

**Resolved (human, 2026-07-21): option 1 — DJ-mode-only.** Revisit after a real DJ session; visitor-visible would go through a design proposal (option 3), not a straight port.

```text
Decision needed:
- Should the beat-phase indicator (WOW-040) and/or per-pillar VU meters (WOW-041) also be visible in play mode (visitor-facing), or stay DJ-mode-only?

Why this matters:
- Both are built DJ-mode-only by default in this batch. Making them visitor-visible is a visual-identity/UX call on the artwork's main screen (UX_UI_PRINCIPLES: visitor-facing surface changes are design decisions, not implementation details), and would also mean the telemetry streams run whenever the installation runs, not just during DJ sessions.

Options:
1. DJ-mode-only (the batch default — no further work).
2. Also show in play mode, as-is.
3. Also show in play mode, but restyled for visitors (needs frontend-ui-designer proposal first).

Recommendation:
- Ship DJ-mode-only (option 1); revisit after the DJ has used them at a real session. If visitor-visible is wanted, take option 3 via a design proposal, not a straight port.

Blocked until human confirms:
no (tickets proceed with the DJ-only default; a later "yes" is a small follow-up ticket)
```

### 2. DJ FX state on idle timeout and on leaving DJ mode

**Resolved (human, 2026-07-21): option 2 + a reset control — reset filters/sends/grid to neutral on BOTH idle timeout and DJ-mode exit, and additionally provide a visible "reset FX" button in DJ mode** (options 2 and 3 combined). WOW-042/043/044 implement the resets on both paths; the reset button rides with WOW-042 (first FX control surface) and covers all FX values discovered so far.

```text
Decision needed:
- When the idle timeout fires, and separately when the DJ leaves DJ mode, what happens to the DJ FX state: filter positions (WOW-042), send levels (WOW-043), and roll grid (WOW-044)? (Roll active-state is already failsafe-off on timeout per the Live-set spec; this question is about the continuous values.)

Why this matters:
- A closed filter or raised echo send left behind after a DJ session changes how the installation sounds for the next visitor — the spec's "with everything at defaults the set must sound exactly as before" posture only holds if something returns these to neutral. But auto-resetting on mode exit could also yank the sound mid-handover in ways the DJ didn't intend.

Options:
1. Reset filters + sends to neutral on idle timeout only; persist across DJ-mode enter/exit (mirrors the WOW-007C desired-volume precedent).
2. Reset on both idle timeout and DJ-mode exit.
3. Never auto-reset; add a visible "reset FX" control in DJ mode instead.

Recommendation:
- Option 1: the idle timeout already means "the session is over, return the installation to its resting state" (it stops all clips and clears the key), so neutralizing FX there is consistent; mode exit is often momentary and shouldn't be audibly destructive.

Blocked until human confirms:
yes (WOW-042/043/044 implement whichever option is chosen; they can start on the control paths meanwhile)
```

### 3. Loop-roll engage gesture

**Resolved (human, 2026-07-21): option 1 — momentary hold** (roll while held, off on release), with the backend-side safety net: roll auto-off if the holding client disconnects or the touch-up is lost.

```text
Decision needed:
- How does the DJ engage a roll on the touchscreen (WOW-044): press-and-hold momentary (roll while held, off on release) or tap-toggle (tap on, tap off)?

Why this matters:
- This is a performance-feel decision on the live instrument. Momentary is the classic DJ gesture and is fail-safer (lifting the finger always ends the roll; a toggle can be forgotten on). But long-press on a touchscreen mounted in a grimoire may be awkward, and touch-up events can be missed by the browser — a momentary design needs a defensive "roll stuck on" guard anyway.

Options:
1. Momentary hold (release = off), with a backend-side safety net (e.g. roll auto-off if the holding client disconnects).
2. Tap-toggle with a prominent active-state indicator.
3. Both: momentary by default, latchable via a secondary affordance (most complex; probably over-design for v1).

Recommendation:
- Option 1 — matches the spec's failsafe-off posture end to end; the disconnect guard is cheap.

Blocked until human confirms:
yes (blocks WOW-044's UI; the backend event contract is gesture-agnostic and can proceed)
```

### 4. Echo-throw envelope values

**Resolved (human, 2026-07-21): option 2 — agent proposes conservative defaults as named constants in the WOW-043 PR, human approves before merge** (audio-ableton pass at discretion); by-ear tuning on a hardware day adjusts them in a trivial follow-up.

```text
Decision needed:
- The echo-throw (WOW-043) needs three musical values: the send-A level the throw raises to, when it raises relative to the clip stop ("while/just before stopping" — spec §3), and how long after the stop it holds before restoring the send.

Why this matters:
- These values shape how the transition sounds on the actual rig and interact with the Echo return's feedback — they cannot be tuned honestly against the simulator, and inventing them in code would be exactly the musical-assumption class AGENTS.md forbids.

Options:
1. Human names starting values now (they land as named constants; by-ear tuning on a hardware day adjusts them in a trivial follow-up).
2. Agent proposes conservative defaults in the PR, audio-ableton-reviewer + human approve before merge, hardware-day tuning follows.
3. Make them runtime-configurable from the Settings modal (more scope; probably premature before the feature has ever been heard).

Recommendation:
- Option 2 — keeps the batch moving, keeps humans in the loop on the musical values, and defers knob-ification until the feature has been used in anger.

Blocked until human confirms:
yes (blocks WOW-043's throw; manual send control can proceed)
```

### 5. Master VU meter — include and where

```text
Decision needed:
- The approved feature list says per-pillar VU meters with "master optional". Include a master-bus meter in this batch, and if so, where does it live on screen?

Why this matters:
- Per-pillar meters have an obvious home (the pillar card). A master meter has no existing home — placing it means deciding something about the DJ-mode screen layout (TopControls? SettingsBand? a new strip?), which is a design call. It also means observing the master track, which WOW-039's discovery does not currently cover.

Options:
1. Defer: ship WOW-041 per-pillar only (the batch default), ticket the master meter separately once placement is designed.
2. Include in WOW-041 with a placement the human names now.

Recommendation:
- Option 1 — "optional" plus "no obvious placement" reads as defer; a follow-up ticket is small once the human points at a spot.

Blocked until human confirms:
no (WOW-041 proceeds per-pillar-only either way; a "yes, include" answer spawns a follow-up ticket)
```
