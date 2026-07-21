# Live-set change spec 001 — DJ FX (filter, sends/echo, loop roll)

Status: **ready for human execution in Ableton** (reviewer passes are discretionary under the 2026-07-21 relaxation — recommended here since the batch touches loudness paths; §6 records whatever passes happen)
Date: 2026-07-21
Owner: Vidar (only a human edits the Live set — ADR-007 / AGENTS.md)
Consumers: the DJ FX ticket batch (`docs/TICKETS_003_DJ_FX.md`)

This document is the contract between the Ableton Live set and the backend for the three DJ FX features that need devices in the set: **per-pillar filter**, **FX sends / echo throw**, and **loop roll**. The other two features in the batch (beat-phase display, VU meters) need **no** set changes. The backend never creates or modifies devices; it discovers what this spec names and controls only that. If discovery fails, the feature disables itself with a startup warning — never fatal (same posture as `DRUM_RACK_TRACK_INDEX`, see `docs/ABLETON_INTEGRATION.md`).

## 1. Naming contract (hard rules, like clip naming)

Once executed, these names are load-bearing. Renaming any of them in Live silently disables the corresponding feature (with a backend startup warning).

| Thing                       | Exact name  | Where                                         |
| --------------------------- | ----------- | --------------------------------------------- |
| Audio Effect Rack           | `DJ FX`     | Last device on each pillar track (tracks 0–3) |
| Macro on `DJ FX`            | `Filter LP` | Macro 1                                       |
| Macro on `DJ FX`            | `Filter HP` | Macro 2                                       |
| Macro on `DJ FX`            | `Roll Grid` | Macro 3                                       |
| Beat Repeat inside the rack | `DJ Repeat` | Inside `DJ FX`, after the filters             |
| Return track A              | `Echo`      | First return track                            |
| Return track B              | `Reverb`    | Second return track                           |

Name matching: the backend compares after trimming surrounding whitespace, case-sensitively. Keep names exactly as written; don't decorate them with asterisks or extra spaces (the clip-name normalization rules do **not** apply to device/track names).

## 2. The `DJ FX` rack (one per pillar track, all four identical)

Build once, save as an `.adg` rack preset, drop the same preset on the other three pillar tracks — this guarantees the four racks are identical. Device chain inside the rack, in order:

1. **Auto Filter — low-pass** (Filter Type: Lowpass, 24 dB)
2. **Auto Filter — high-pass** (Filter Type: Highpass, 24 dB)
3. **Beat Repeat**, renamed **`DJ Repeat`**, **device deactivated by default** (its Device On switch off)

Macro mappings:

| Macro       | Maps to                    | Mapping min → max     | Neutral (default) position |
| ----------- | -------------------------- | --------------------- | -------------------------- |
| `Filter LP` | LP Auto Filter → Frequency | 135 Hz → 20 kHz       | **127** (fully open)       |
| `Filter HP` | HP Auto Filter → Frequency | 20 Hz → 2 kHz         | **0** (fully closed)       |
| `Roll Grid` | `DJ Repeat` → Grid         | 1/4 → 1/16 (see §2.1) | any (inaudible while off)  |

Why two filter macros instead of one bipolar knob: each macro has an unambiguous neutral endpoint, which makes "resting = audibly untouched" trivially verifiable and robust. The one-knob DJ-filter _feel_ is implemented UI-side (a single center-detented knob drives `Filter LP` on the left half and `Filter HP` on the right half); the Live set stays simple.

Both Auto Filters: **Resonance ≤ 15%** (resonance boosts level — loudness safety), LFO/envelope off, Drive off. With `Filter LP` at 127 and `Filter HP` at 0 the rack must be audibly transparent — verify by ear A/B'ing the rack's Device On switch before saving the preset.

### 2.1 `DJ Repeat` (Beat Repeat) settings

Loop-roll behavior: while the backend activates the device, the current audio repeats; deactivating returns to the live signal. Settings saved in the preset:

- **Device On: OFF** (the backend toggles `is_active`; off is the failsafe default)
- Interval: 1 bar, Offset: 0, Chance: **100%**, Gate/Mix mode: **Ins** (insert — repeats replace the signal, the classic roll)
- Grid: whatever `Roll Grid` sets (mapped macro); Variation: 0; no Pitch, no Pitch Decay
- Volume/decay defaults untouched — Beat Repeat must not add gain (loudness safety)

Fine-tuning these by ear later (e.g. Interval) is a human call; the _contract_ is only the device name, its default-off state, and the `Roll Grid` macro.

## 3. Return tracks (echo throw)

Create two return tracks (Live: Create → Insert Return Track), in this order so they get sends A and B:

| Return   | Device                | Key settings                                                                     |
| -------- | --------------------- | -------------------------------------------------------------------------------- |
| `Echo`   | Echo (or stock Delay) | Sync'd 1/4 note L+R; **Feedback ≤ 60%**; no Freeze; 100% wet (return-track norm) |
| `Reverb` | Reverb                | Decay ~3 s, 100% wet; no Freeze                                                  |

- **All pillar-track sends (A and B) at 0** (minimum) by default. The cauldron/drum-rack track's sends also stay at 0 — the batch does not add FX to the cauldron.
- **Return-track volumes start at −6 dB** and are subject to the same loudness posture as everything else; hardware-safety-reviewer confirms the ceiling treatment for returns during sign-off (the software `[0, 0.7]` clamp currently applies to pillar + cauldron mixer volumes; whether the backend also clamps return volumes is a batch ticket decision).
- Feedback ≤ 60% is a hard rule: a runaway delay feedback loop is a loudness hazard the DJ can't stop quickly from the UI.
- "Echo out" transition (the feature): the backend briefly raises a pillar's send A while/just before stopping the clip; the tail rings out on the return. Sends are post-fader (Live default) — keep them post-fader.

## 4. What the backend will do with this (informative)

For orientation only — the authoritative behavior lands in the batch tickets:

- Discovery at startup: walk tracks 0–3 → find device named `DJ FX` → read its macro `DeviceParameter`s by name; find `DJ Repeat` inside it; find return tracks `Echo`/`Reverb` via `song.return_tracks`. Missing piece ⇒ log warning, disable that feature's socket events/UI control.
- Control paths: macros and sends are `DeviceParameter` writes (same plumbing as the existing cauldron volume); loop roll toggles `DJ Repeat`'s `is_active`.
- Every new control gets socket events added to the managed contract + `sim/` parity per ADR-007.

## 5. Execution checklist (human, in Ableton, installation offline)

1. **Back up:** File → _Save a Copy_ of the production set with a dated name (or Collect All and Save to a dated folder). Do not proceed without the backup.
2. Build the `DJ FX` rack on pillar track 0 per §2; A/B the rack's Device On switch to confirm audible transparency at neutral macro positions.
3. Save the rack as `DJ FX.adg`; drop it onto pillar tracks 1–3 (last in chain).
4. Create the `Echo` and `Reverb` returns per §3; zero every send; set return volumes to −6 dB.
5. Confirm `DJ Repeat` is deactivated on all four racks; confirm names match §1 exactly.
6. Save the set.
7. Run the discovery verification (first batch ticket delivers `yarn verify-liveset`, a read-only script that connects and reports found/missing items vs this spec). Fix any mismatch it reports, re-run until clean.
8. Play the installation normally for a few minutes: with everything at defaults, the set must sound exactly as before the change.

## 6. Sign-off record

| Role                     | Verdict | Date | Note |
| ------------------------ | ------- | ---- | ---- |
| audio-ableton-reviewer   | —       |      |      |
| hardware-safety-reviewer | —       |      |      |
| Human (set executed)     | —       |      |      |
