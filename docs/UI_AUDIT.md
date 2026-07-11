# UI Audit — pre-rework baseline

Ticket: WOW-004 (read-only audit)
Date: 2026-07-11
Auditor: frontend-ui-designer subagent (claude-sonnet-5)
Branch: `docs/wow-004-ui-audit`
Scope: every non-test file in `src/component/`, `src/container/`, `src/context/` (incl. `hook/`, `type/`, `util/`), `src/hook/`, `src/screen/` (19 files — verified against the tree, matches the inventory in `docs/agent-prompts/wow-004-frontend-ui-designer-prompts.md` exactly, no drift). `src/main.tsx`, `src/util/*`, `src/type/SpellRecipeType.ts` cited as supporting evidence per the prompt's guidance.

**No code was changed to produce this report.** `git diff --stat` at the end of this session shows only the two files listed in "Output" plus this run's record append.

## Method key

- **runtime** — observed by driving `yarn sim <scenario>` + `yarn dev` in a real browser resized to 1024×1280, screenshots taken.
- **static** — read from source only; not exercised live in this session.

Runtime sessions used in this audit:

1. `yarn sim full-spell` + `yarn dev` (port 5174 per `.claude/launch.json`) — happy path, all 4 pillars filled.
2. `yarn sim idle` + `yarn dev` — empty/idle state, manual debug-panel drive.
3. Killed the `idle` sim mid-session (Ctrl-C in the sim terminal, as in the reproduction steps below; `pkill -f "vite-node sim/server.ts"` is an equivalent alternative) while the UI tab stayed open — disconnect behavior.

No `yarn start-backend`, no hardware, no live Ableton at any point.

---

## Summary table (file × issues × severity)

| #   | File                                                                                                                                                                                                     | Issues (see per-file section)                                                                                                                                                                                                                                                                                                                                                           | Severity                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | `src/context/hook/useSocketContextProviderState.ts`                                                                                                                                                      | No disconnect/reconnect handling anywhere in the socket layer (UI-01); fake `{} as Socket` placeholder is a runtime hazard for early consumers (UI-02)                                                                                                                                                                                                                                  | **blocker**, high                                |
| 2   | `src/context/hook/useAbletonContextProviderState.ts`                                                                                                                                                     | Dead-end TODO where disconnect UI should live (UI-01, shared); no `disconnect`/`connect_error` subscription (UI-01, shared); backend's `timeout_warning` emission not subscribed anywhere + idle timeout stales the displayed master key with no corresponding event (UI-17)                                                                                                            | **blocker** (shared), medium                     |
| 3   | `src/screen/MainScreen.tsx`                                                                                                                                                                              | Operator surface reached by an invisible always-present tap target, not gated, not long-press (UI-03); nested inside the recipe-box container it will lose its home on recipe removal (UI-13)                                                                                                                                                                                           | **high**                                         |
| 4   | `src/container/DebugModalContainer.tsx`                                                                                                                                                                  | Full operator control surface (arbitrary clip start/stop per pillar, all 133 clips) reachable by any visitor via UI-03, no confirm/gate (UI-04); layout overflows/uncontained on the 1024×1280 target, sub-AAA touch targets, translucent backdrop lets visitor UI show through (UI-05); modal uses a non-existent Tailwind class so its width constraint silently does nothing (UI-06) | **high**, medium, medium                         |
| 5   | `src/component/ClipButton.tsx`                                                                                                                                                                           | Static `sr-only` label ("Play clip") doesn't reflect actual action (start vs. stop vs. queued) (UI-07)                                                                                                                                                                                                                                                                                  | medium (a11y)                                    |
| 6   | `src/container/CurrentlyPlayingListContainer.tsx`                                                                                                                                                        | Dynamic Tailwind class `col-start-${...}` only works because the literal classes happen to be used elsewhere in the same file (UI-08, fragile); decorative frame image has non-empty `alt` (UI-09)                                                                                                                                                                                      | medium, low                                      |
| 7   | `src/container/RecipeBoxContainer.tsx`                                                                                                                                                                   | Shows a "Suggested Recipe" even with zero clips playing, using a fully random clip from the whole database (UI-10, confirmed at runtime in idle state)                                                                                                                                                                                                                                  | medium (misleading state; moot after F5 removal) |
| 8   | `src/hook/useGrimoire.ts`                                                                                                                                                                                | Same root cause as UI-10; recommendation data is sourced entirely client-side from the local CSV import, not from the socket payload — corrects an assumption in the WOW-003 note (UI-11, informational)                                                                                                                                                                                | informational                                    |
| 9   | `src/container/TempoSliderContainer.tsx`                                                                                                                                                                 | Typo class `absolute2` is dead CSS (no-op) (UI-12)                                                                                                                                                                                                                                                                                                                                      | low                                              |
| 10  | `src/container/KeyAdjusterContainer.tsx`                                                                                                                                                                 | `<` / `>` rotate buttons have no `aria-label`; screen readers announce ambiguous glyphs (UI-14)                                                                                                                                                                                                                                                                                         | low-medium (a11y)                                |
| 11  | `src/container/VolumeSliderContainer.tsx`                                                                                                                                                                | No issues beyond the shared motion/contrast items below                                                                                                                                                                                                                                                                                                                                 | —                                                |
| 12  | All `animate-pulse` usages (`ClipButton.tsx`, `CurrentlyPlayingListContainer.tsx`)                                                                                                                       | No `prefers-reduced-motion` accommodation anywhere in the inventory (UI-15)                                                                                                                                                                                                                                                                                                             | low-medium (a11y)                                |
| 13  | Tempo slider min/max labels, general dark-on-dark text                                                                                                                                                   | Several `text-gray-400`/`text-gray-500` labels on near-black backgrounds look contrast-marginal at a glance; not measured precisely (UI-16, static, unverified ratio)                                                                                                                                                                                                                   | medium (unverified — TBD)                        |
| 14  | `src/context/AbletonContext.ts`, `AbletonProvider.tsx`, `SocketContext.ts`, `SocketProvider.tsx`, `useAbletonContext.ts`, `useSocketContext.ts`, `AbletonContextState.ts`, `ContextUtils.ts`, `main.tsx` | No issues found beyond what's noted against the state hooks above                                                                                                                                                                                                                                                                                                                       | —                                                |

Total distinct findings: 16 (UI-01…UI-16). Two (UI-01) are one shared blocker spanning two files.

---

## Per-file sections

### `src/component/ClipButton.tsx`

- **Rendered states**: idle/off, `playing`, `queued` (pulsing green), `stopping` (pulsing red). Purely presentational — receives all state via props, no context/socket access.
- **Context dependencies**: none.
- **Socket events**: none directly; `onClick` is supplied by callers (`DebugModalContainer`).
- **Failure/disconnect behavior**: none applicable (dumb component).
- **UI-07 (medium, a11y, static)**: line 40, `<span className='sr-only'>Play clip</span>` is a fixed string regardless of `playing`/`queued`/`stopping`. In `DebugModalContainer.tsx` the same component is reused for a "stop this clip" button (`onClick={() => toggleSong(playingClip.rfid, index, false)}`, line 91) — a screen-reader user hears "Play clip" for a control that actually stops playback. WCAG 4.1.2 (name reflects role/state). No fix proposed here.
- **UI-09 (low, a11y, static)**: not in this file but in its caller `CurrentlyPlayingListContainer.tsx:68` — see below.

### `src/container/CurrentlyPlayingListContainer.tsx`

- **Rendered states**: 4 pillar slots (indices 0–3), each independently shows nothing / queued (pulsing, opacity 40%) / playing / stopping (pulsing frame), driven by `queuedClips`, `playingClips`, `stoppingClips` from `useAbletonContext()`. Clip name only rendered when both `artist` and `songTitle` are present (line 19–23); otherwise blank — confirmed at runtime: the sim's CSV rows in this build all resolve to `"Paramore – Misery Business"` in every visible slot during `full-spell` (screenshot), i.e. today's UI does show artist/song text, which F3 removes in favor of category name.
- **Context dependencies**: `useAbletonContext()` — `queuedClips`, `playingClips`, `stoppingClips`, `clipTempo`.
- **Socket events consumed**: indirect only, via the Ableton context (see consumption table below).
- **Failure/disconnect behavior**: none — renders whatever stale state the context holds; no loading/error state.
- **UI-08 (medium, static)**: line 33, `` className={`col-start-${index % 2 === 0 ? 2 : 1} col-span-3 ...`} `` — Tailwind's JIT scanner statically greps source for complete class-name tokens; a template-literal-interpolated class like `col-start-${var}` is not, by itself, detected. This file only renders correctly today because the _literal_ strings `col-start-2` and `col-start-1` also appear elsewhere in this same file (lines 82 and 92, in the clip-name row). If those literal occurrences are ever refactored away independently (plausible during the rework, since F3 changes this exact layout), the dynamic class on line 33 would silently stop generating and the BPM label would lose its column offset. Flagging as a fragile pattern for the rework to not carry forward, not a currently-observed break (runtime screenshots show correct alternating layout with the literals still present).
- **UI-09 (low, a11y, static)**: line 68, `<img src='/images/frame_576_v2.png' alt='Frame'>` — purely decorative overlay image; WCAG 1.1.1 guidance is `alt=""` for decorative images so screen readers skip it, not a literal description.
- **Runtime note**: `data-testid='cauldron'` centerpiece (line 103) renders correctly at 1024×1280; it overlaps the 2×2 pillar grid by design (confirmed in screenshots) — this is an existing decorative choice, not flagged as a bug.

### `src/container/DebugModalContainer.tsx`

- **Rendered states**: closed (nothing rendered but the `Transition` wrapper), open — per pillar: currently-playing/stopping `ClipButton`, currently-queued `ClipButton`, then a scrollable list of all non-active clips from the full CSV-derived `clips` array (133 rows in this build), each as a clickable `ClipButton` that emits a tag event.
- **Context dependencies**: `useSocketContext()` (direct `.emit`), `useAbletonContext()` (`playingClips`, `queuedClips`, `stoppingClips`).
- **Socket events emitted**: `/new/tag` (line 27, `{rfid, pillar}`), `/departed/tag` (line 29, `{rfid, pillar}`).
- **Failure/disconnect behavior**: `toggleSong` calls `socket.emit(...)` with no connected-state check; if the socket is still the initial placeholder object (see UI-02) or has disconnected, this throws or silently no-ops depending on socket.io-client's internal behavior — not exercised at that exact moment in this session (would require timing the click to the ~100ms connection window), so this half of UI-02 is **static**, not runtime-confirmed.
- **UI-04 (high, static+product-principle)**: this container is the entire "operator surface" today (FR3 territory) — arbitrary clip start/stop per pillar with **zero confirmation** before firing a real Ableton trigger against production hardware. UX_UI_PRINCIPLES.md principle 2 ("No control should be able to cause a sudden loud change... with a single accidental tap") is not honored: every `ClipButton` in this list is a single unconfirmed tap. Combined with UI-03 (below), any visitor who finds the invisible corner button gets this whole surface with no additional gate.
- **UI-05 (medium, runtime-confirmed)**: at 1024×1280, opening the modal (screenshot, idle-state session) shows: the `Dialog.Panel` renders far wider/taller than the viewport (grid-flow-col with 4 unconstrained columns of ~130 rows each), content requires scrolling to reach the "Exit" button, the backdrop (`bg-black bg-opacity-25`, line 57) is translucent enough that the visitor-facing pillar/cauldron art is still legible underneath the modal (see screenshot — "Auto adjust tracks to key" header text visibly bleeds through and overlaps the sticky "Pillar 2" label). Toggle switches reused from `ClipButton` are `h-6 w-11` (24×44px) — the 24px height is at the WCAG 2.5.8 AA floor but well under the 44×44px AAA target (2.5.5) recommended for installation touch UI per UX_UI_PRINCIPLES.md principle 8's "generous hit areas" language; with 133 rows rendered at default text size in a 4-column grid the effective tap target per row is far denser than 24×44 in practice.
- **UI-06 (medium, static)**: line 71, `className='w-screen max-w-xxl ...'` — Tailwind's default `max-w-*` scale stops at `max-w-7xl`/`max-w-full`; `max-w-xxl` is not a generated utility (verified against `tailwind.config.cjs`: no `maxWidth`/`xxl` extension), so no max-width is applied: the panel fills `w-screen` unconstrained, exactly what's observed in the runtime screenshot.
- **Operator/visitor note**: `DebugModalContainer` is explicitly the operator-only surface referenced in ADR-006. See "Visitor vs. operator mapping" below for how it's currently reached vs. the ADR-006 target gesture.

### `src/container/KeyAdjusterContainer.tsx`

- **Rendered states**: checkbox (`keylock`) always visible; the `<` / master-key label / `>` cluster only renders when `masterKey` is truthy (lines 48–58) — confirmed at runtime: idle-state screenshot shows only the checkbox and "N/A" text, no rotate buttons, because `masterKey` starts as `''`.
- **Context dependencies**: `useAbletonContext()` — `masterKey`, `changeMasterKey`, `keylock`, `changeKeylock`.
- **Socket events**: indirect, via context (`set_master-key`, `set_keylock_state`, see consumption table).
- **Failure/disconnect behavior**: none; static render of last-known state.
- **UI-14 (low-medium, a11y, static)**: lines 49–57, the rotate buttons render literal `&lt;`/`&gt;` as their only accessible content and have no `aria-label`. A screen reader announces "less than, button" / "greater than, button" with no indication these rotate the master key. WCAG 4.1.2 / 2.4.6 (accessible name should describe purpose).
- **UI-16 (medium, static, unverified)**: `text-gray-500`-class siblings elsewhere in the codebase (tempo slider) suggest a general low-contrast label pattern may recur here too if the rework reuses these primitives; not directly present in this file's current markup (this file uses default text color).

### `src/container/RecipeBoxContainer.tsx`

_(F5 — slated for wholesale removal; audited only to document current behavior and the removal blast radius, not to propose fixes.)_

- **Rendered states**: always renders the "Suggested Recipe: {spellName}" header plus up to 4 ingredient tiles (one per `ClipTypes` key present in `spellRecipe`), regardless of whether any pillar is active.
- **Context dependencies**: `useGrimoire()` (which itself depends on `useAbletonContext().playingClips`).
- **Socket events**: none directly.
- **UI-10 (medium, runtime-confirmed)**: in the `idle` scenario (zero clips playing, screenshot), the box still shows "Suggested Recipe: Aurora Aura" with four named ingredient tiles. This is `useGrimoire.ts`'s fallback branch (`actuallyPlayingClips.length` is 0, so `generateNewSpell` picks a fully random clip from the entire 133-row database and recommends around it) — a visitor sees a fully-formed "suggestion" that has no relationship to anything actually happening on the pillars. Confirmed in both the `idle` and `full-spell` sessions (spell/recipe rotates independently of what's actually playing whenever `actuallyPlayingClips.length <= 1`).
- Moot for the rework (F5 removes this file outright) but documented per the ticket's blast-radius requirement below.

### `src/container/TempoSliderContainer.tsx`

- **Rendered states**: single state, always-visible slider bound to `tempo` (75–155 BPM clamped by `MIN_VALUE`/`MAX_VALUE`).
- **Context dependencies**: `useAbletonContext()` — `tempo`, `changeTempo`.
- **Socket events**: indirect (`set_tempo`).
- **Failure/disconnect behavior**: none; slider keeps last-known tempo, remains interactive and will silently no-op (see UI-01/UI-02) if the socket is down.
- **UI-12 (low, static)**: line 18, `className='absolute2 block ...'` — `absolute2` is not a Tailwind utility (typo for `absolute`); currently a harmless no-op given the surrounding flex layout (confirmed visually — the "N BPM" label renders in-flow, centered, in both runtime screenshots — no visible breakage), but it's dead/confusing code that a rework should not copy forward assuming the positioning was intentional.
- **UI-16 (medium, static, unverified)**: lines 23 and 35, `text-gray-500 dark:text-gray-400` for the "75"/"155" range-end labels against the app's near-black background. Visually (screenshots) these read as a dim gray, plausibly under WCAG AA's 4.5:1 for normal-size text, but not measured with a contrast tool in this session — logged as **TBD**, not asserted as a confirmed failure.
- Touch target: the native `<input type=range>` thumb has no explicit min-size styling beyond `h-2` track height; default browser thumb size is used, not verified against 24×24 in this pass.

### `src/container/VolumeSliderContainer.tsx`

- **Rendered states**: one instance per pillar (called twice per row from `CurrentlyPlayingListContainer`), slider 0–0.7, plus a "Reset" button that snaps to 0.6.
- **Context dependencies**: `useAbletonContext()` — `trackVolume`, `changeTrackVolume`.
- **Socket events**: `set_track_volume` (no ack — see consumption table; UI trusts its own last `onChange` value rather than confirming the round trip, matching the WOW-003 fidelity note that this event has no ack in the real backend either).
- **Failure/disconnect behavior**: none; same pattern as tempo — silently no-ops if disconnected.
- No new issues beyond the shared UI-15 (motion) / UI-16 (contrast, label text uses default color here so likely not affected) items.
- Non-goal reminder (PRD): volume ceiling enforcement is intentionally hardware-side; `MAX_VALUE = 0.7` here is a soft UI clamp, not a safety control — no finding, just confirming current behavior matches the documented non-goal.

### `src/context/AbletonContext.ts`

- Plain `createContext<AbletonContextState | null>(null)`. No logic, no issues.

### `src/context/AbletonProvider.tsx`

- Thin wrapper: calls `useAbletonContextProviderState()` and provides it. No logic, no issues. (Post-WOW-011, this file is _not_ where the WOW-012-reported `findIndex` bug lives anymore — see note under the state-hook section below.)

### `src/context/SocketContext.ts`

- Plain `createContext<Socket | null>(null)`. No logic, no issues.

### `src/context/SocketProvider.tsx`

- Thin wrapper around `useSocketContextProviderState()`. No logic, no issues beyond what's attributed to the state hook.

### `src/context/hook/useAbletonContext.ts`

- Consumer hook; throws a clear error if used outside `AbletonProvider` (line 9). Reasonable fail-fast for a programmer error; not a runtime/user-facing failure mode. No issues.

### `src/context/hook/useAbletonContextProviderState.ts`

- **Rendered states**: n/a (hook, no render) — owns `tempo`, `masterKey`, `keylock`, `trackVolume`, `queuedClips`, `playingClips`, `stoppingClips`, `clipTempo`.
- **Socket events consumed**: `ingredient_detected`, `clip_queued`, `clip_unqueued`, `clip_started`, `clip_playing`, `ingredient_removed`, `clip_stopping`, `clip_stopped`, `tempo_changed`, `volume_changed`, `master-key_changed` (lines 116–159). **Emitted**: `get_track_volumes`, `get_playing_clips`, `get_queued_clips`, `get_tempo`, `get_master-key`, `get_keylock_state` (all in `getTracksAndClips`, lines 47–68), `set_tempo`, `set_track_volume`, `set_master-key`, `set_keylock_state` (lines 71–103).
- **UI-01 (blocker, runtime-confirmed)**: lines 105–112 —
  ```
  if (!socket.connected) {
    // TODO: Show in UI
    return;
  }
  ```
  This is the _only_ place in the entire inventory that acknowledges a disconnected state, and it explicitly does nothing about it (`TODO: Show in UI`, never implemented). There is no `socket.on('disconnect', ...)`, no `connect_error` handling, anywhere in this file or `useSocketContextProviderState.ts`. **Runtime-confirmed**: killed the `idle` sim process mid-session (`pkill -f "vite-node sim/server.ts"`) with the browser tab still open on the last-rendered idle screen; screenshot taken 3s later shows **zero visual change** — same idle screen, no error banner, no dimming, no "reconnecting" indicator, console shows no new log lines after the kill. This directly contradicts UX*UI_PRINCIPLES.md principle 4 ("Fast recovery... the UI should show it plainly") and PRD's non-functional requirement "recovers from WS disconnect" (recovery isn't even \_displayed*, let alone acted on). Reproduction: `yarn sim idle` in one terminal, `yarn dev` in another, open the app, then `Ctrl-C` the sim terminal — the UI gives no indication anything is wrong.
- **WOW-012 status note**: the previously-reported `findIndex` truthiness bug (ticket WOW-012, filed against the pre-migration `src/context/AbletonProvider.tsx`) is **not present** in this file's current `ingredient_removed` handler (lines 131–138): both branches already use `.some(...)` correctly (`playingClipsRef.current.some(...)`, `queuedClipsRef.current.some(...)`), not `findIndex` truthiness-checked. Either the WOW-011 migration's "Manual code fixes" commit (`0aaa123`) incidentally corrected this while restructuring, or the bug was already gone before WOW-012 was filed against the old path. Documenting this so WOW-012 isn't chased against code that no longer has the described defect — **recommend the human re-verify WOW-012's premise against this file before continuing that ticket** (logged in the open-questions appendix).
- **UI-17 (medium, static)**: the backend emits `timeout_warning` 30s before its 3-minute idle timeout (WOW-003 fidelity table, `docs/agent-notes/wow-003-creative-tech-integrator-simulator.md:44`) and nothing in `src/` subscribes to it (`grep -rn timeout_warning src/` → no matches). Unused contract surface: the UI neither warns visitors at T-30s nor reflects the timeout when it fires. Related stale-state case: the backend's `handleTimeout` clears the master key **without** emitting `master-key_changed` (same WOW-003 note), so after an idle timeout the UI keeps displaying a stale master key with no event it listens for to correct it. Both reinforce UI-01's silent-state blindness and are rework-relevant inputs for the disconnect/idle-visibility work (descriptive of current backend behavior only — no contract change proposed).
- Everything else (`getTracksAndClips`, the `change*` callbacks) matches the WOW-003 fidelity table; the one contract delta found is UI-17 above.

### `src/context/hook/useSocketContext.ts`

- Consumer hook; throws if used outside `SocketProvider`. Same fail-fast pattern as `useAbletonContext`. No issues.

### `src/context/hook/useSocketContextProviderState.ts`

- **UI-02 (high, static)**: line 10, `const [socket, setSocket] = useState<Socket>({} as Socket);` — the initial state is a plain empty object _cast_ to `Socket`, not a real (even disconnected) socket.io client instance. Any consumer that calls a `Socket` method (`.emit`, `.on`, `.off`) before the `connect` handler fires and swaps in the real client (lines 18–19) will hit `TypeError: socket.emit is not a function` (or similar) at runtime. `DebugModalContainer.tsx`'s `toggleSong` (calls `socket.emit` directly, no guard) and every `useAbletonContext()` consumer's `change*` callbacks (which do `socket?.emit(...)`, guarded with optional chaining — safe) are the exposure points; `DebugModalContainer` is unguarded. In practice the connect window is short (tens of ms on localhost) so this is hard to hit interactively, which is why it's **static**, not runtime-reproduced in this session — but it is a real hole for a slow/flaky network in the actual installation, where the connect handshake could take longer. Existing test coverage (`useSocketContextProviderState.test.tsx`) only asserts the connected path; there is no test exercising a consumer calling `.emit` on the placeholder.
- **UI-01 (blocker, shared with the Ableton state hook)**: no `socket.on('disconnect', ...)` registered anywhere in this file. `onAny` (line 22) logs every _received_ event for debug purposes but a `disconnect` is a client-side lifecycle event, not a server-emitted one, and isn't covered by `onAny` semantics in socket.io-client — even if it were, nothing downstream would render anything about it (see UI-01 above).
- Everything else (the `connect` handler swapping in the real socket, `onAny` debug logging) matches expectations and is unit-tested (`useSocketContextProviderState.test.tsx`).

### `src/context/type/AbletonContextState.ts`

- Pure type definition, one type per file per `docs/CODING_GUIDELINES.md`. No issues. Notable for the rework: `masterKey: string` and `trackVolume: number[]` etc. are all primitives with no "connected"/"stale"/"loading" flag anywhere in this shape — corroborates UI-01 (there's no state slot to even carry a disconnect flag today; the rework will need to add one).

### `src/context/util/ContextUtils.ts`

- `updateIndex<T>` — small, pure, generic array-splice-by-index helper used throughout the Ableton state hook. No issues; has direct test coverage (`context/util/test/ContextUtils.test.ts`).

### `src/hook/useGrimoire.ts`

_(F5 — slated for removal; audited for current behavior + blast radius only.)_

- **UI-11 (informational, runtime-confirmed)**: corrects an assumption carried from the WOW-003 simulator note. That note states live `ingredient_detected` payloads carry no `recommendedClips` (`backend`'s `EnrichRecommendations` is disabled) and asks this audit to "document what the grimoire actually does with `undefined` today." Reading `useGrimoire.ts` line 61 (`ClipDatabaseUtil.rfidToClipMap[clip.rfid]`) and line 86 (`randomClip?.recommendedClips?.[type]`) shows the grimoire **never reads `recommendedClips` off the socket payload at all** — it looks the clip's `rfid` back up in `ClipDatabaseUtil.rfidToClipMap`, a map built and enriched _entirely client-side_ at module load (`src/util/ClipDatabaseUtil.ts:9-11`, calling `CsvUtil.enrichRecommendations` — imported from `backend/util/CsvUtil.ts`, reference-only — against the full local CSV import, independent of anything the backend or simulator sends over the wire). So `recommendedClips` is **not** `undefined` in practice; it's a real, purely-frontend-computed recommendation set — populated for every clip in the current CSV (a data-dependent outcome of `enrichRecommendations` over the shipped database, not a structural guarantee; a clip with no same-key/tempo neighbours could yield an empty set, so the rework should not treat "always populated" as a contract). Runtime-confirmed: both the `full-spell` and `idle` sessions show fully-populated, named "Suggested Recipe" tiles (e.g. "Immorality" / Magic Mushrooms, Unicorn Icon, Witches Butter, Page Of Charisma in the full-spell screenshot; "Aurora Aura" / Fairy Dust, Mandrake, Venomous Calendula, Three Of Wisdom in the idle screenshot) — never blank or "undefined" text. This doesn't change the F5 removal decision, but it means the removal blast radius includes a working piece of client-side enrichment logic, not dead code reacting to an always-`undefined` field.
- Also drives the 38-entry `SPELL_NAMES` array (lines 7–47) — pure flavor text, dead weight in the bundle once removed.
- `useEffect` at lines 96–101 re-generates a spell whenever `actuallyPlayingClips.length` crosses the `<= 1` threshold — this is what produces the always-on "Suggested Recipe" even at zero active clips (UI-10's root cause).

### `src/screen/MainScreen.tsx`

- **Rendered states**: single composed screen — `KeyAdjusterContainer`, `CurrentlyPlayingListContainer`, `TempoSliderContainer`, `RecipeBoxContainer` (with the hidden debug-open button nested inside its wrapper), `DebugModalContainer` (open/closed via local `isModalOpen` state).
- **Context dependencies**: none directly; composes containers that each reach into context.
- **UI-03 (high, runtime-confirmed)**: lines 33–36:
  ```
  <div id='container_recipe_box' className='fixed bottom-0'>
    <button onClick={() => setIsModalOpen(true)} className='absolute start-0 p-4 z-10'>
      &nbsp;&nbsp;&nbsp;
    </button>
    <RecipeBoxContainer />
  </div>
  ```
  A real, always-rendered, always-clickable `<button>` sits at the bottom-left of the visitor-facing screen with only three non-breaking spaces as its content — invisible, but present in the accessibility tree and hittable by any tap in that corner. **Runtime-confirmed**: `read_page` found it as `ref_11` alongside the visible controls, and a single `left_click` on it opened the full `DebugModalContainer` operator surface immediately, no hold duration, no confirmation. This is _exactly_ the pattern UX_UI_PRINCIPLES.md principle 6 calls out ("The current hidden debug-modal trigger is acceptable for a debug tool but must not become the pattern for real operator controls") and is the concrete "before" state ADR-006 (long-press ~3s on a themed element) is designed to replace. Per PRD FR1/ADR-006, the rework's operator entry point must not carry this single-tap, no-affordance, no-hold pattern forward.
  - **UI-13 (part of the removal blast radius, high)**: this trigger button is nested _inside_ the `container_recipe_box` div that also renders `RecipeBoxContainer`. If `RecipeBoxContainer` is deleted per F5 without also relocating this button/wrapper, the operator-entry affordance disappears along with it (today it has no independent host element). See "Recipe-removal blast radius" below.
- `handleContextMenu` (lines 12–14, 16–21): suppresses the browser right-click context menu globally — reasonable for a touch kiosk, no issue.
- `overflow-hidden max-h-screen` on the root container (line 25) — combined with `DebugModalContainer`'s uncontained width (UI-06), opening the modal can produce clipped/scroll-locked content; observed indirectly in the DebugModalContainer runtime screenshot (page needed internal scroll to reach "Exit").

### `src/main.tsx`

_(reference only, not in the 19-file inventory, cited for context)_

- Composition root: `SocketProvider` → `AbletonProvider` → `MainScreen`. `StrictMode` is on, which double-invokes effects in dev — worth noting only because `useSocketContextProviderState`'s connect effect (guarded by `if (!socket.connected)`) is written defensively enough to tolerate this (confirmed no duplicate-connection console spam in any of this session's runtime captures). No issue.

### `src/util/ClipDatabaseUtil.ts`, `src/util/ColorUtil.ts`, `src/util/Logger.ts`, `src/type/SpellRecipeType.ts`

_(reference only, cited above where directly relevant to UI-10/UI-11 and the recipe blast radius; no new findings beyond what's already attributed)_

- `ColorUtil.getBackgroundColorFromType` (lines 3–20) is confirmed as the single source of truth for category colors (Vox red-700, Bass green-700, Drums blue-700, Melody yellow-700) matching PRD F4 exactly — no drift found.
- `Logger.ts` — `enableDebug`/`disableDebug` toggle used by `DebugModalContainer`'s `useEffect` (lines 37–43 of that file) to flip global log verbosity while the modal is open; a side effect of opening the _debug_ modal that would need reconsidering if/when the operator surface stops being a "debug" tool per se (naming/behavior question, not a bug — logged as an open question).

---

## Socket-event consumption table

Cross-referenced against the WOW-003 fidelity table (`docs/agent-notes/wow-003-creative-tech-integrator-simulator.md`). One delta found: the backend emits `timeout_warning` (listed in that table) and the frontend never subscribes to it — see the row below and UI-17. In the other direction there are no dead listeners: every event the UI subscribes to has a backend emitter (verified against `backend/adapter/AbletonAdapter.ts` and `backend/event/IncomingEvents.ts`).

| Event                                              | Direction                   | Consumed/emitted where                                                                                    | Payload fields actually used                                                                                                                     |
| -------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_track_volumes`                                | emit (ack)                  | `useAbletonContextProviderState.ts:47`                                                                    | `number[]`                                                                                                                                       |
| `get_playing_clips`                                | emit (ack)                  | `useAbletonContextProviderState.ts:51`                                                                    | `BrowserClipInfoList` (7-field subset, see WOW-003 note)                                                                                         |
| `get_queued_clips`                                 | emit (ack)                  | `useAbletonContextProviderState.ts:55`                                                                    | same shape                                                                                                                                       |
| `get_tempo`                                        | emit (ack)                  | `useAbletonContextProviderState.ts:59`                                                                    | `number`                                                                                                                                         |
| `get_master-key`                                   | emit (ack)                  | `useAbletonContextProviderState.ts:63`                                                                    | `string`                                                                                                                                         |
| `get_keylock_state`                                | emit (ack)                  | `useAbletonContextProviderState.ts:66`                                                                    | `boolean`                                                                                                                                        |
| `set_tempo`                                        | emit (ack)                  | `useAbletonContextProviderState.ts:73` (`changeTempo`)                                                    | `number` in, `number` ack                                                                                                                        |
| `set_track_volume`                                 | emit (no ack)               | `useAbletonContextProviderState.ts:83` (`changeTrackVolume`), also `VolumeSliderContainer.tsx` indirectly | `{pillar, volume}`                                                                                                                               |
| `set_master-key`                                   | emit (no ack)               | `useAbletonContextProviderState.ts:91` (`changeMasterKey`)                                                | `string`                                                                                                                                         |
| `set_keylock_state`                                | emit (ack)                  | `useAbletonContextProviderState.ts:98` (`changeKeylock`)                                                  | `boolean` in, `boolean` ack                                                                                                                      |
| `/new/tag`                                         | emit                        | `DebugModalContainer.tsx:27`                                                                              | `{rfid, pillar}`                                                                                                                                 |
| `/departed/tag`                                    | emit                        | `DebugModalContainer.tsx:29`                                                                              | `{rfid, pillar}`                                                                                                                                 |
| `ingredient_detected`                              | on                          | `useAbletonContextProviderState.ts:116`                                                                   | full `BrowserClipInfo` → written into `queuedClips[pillar]`                                                                                      |
| `clip_queued`                                      | on                          | `useAbletonContextProviderState.ts:120`                                                                   | full `BrowserClipInfo` → `queuedClips[pillar]`                                                                                                   |
| `clip_unqueued`                                    | on                          | `useAbletonContextProviderState.ts:123`                                                                   | `data.pillar` only → clears `queuedClips[pillar]`                                                                                                |
| `clip_started`                                     | on                          | `useAbletonContextProviderState.ts:127` (`onUpdatePlayState`)                                             | `pillar`, `bpm`, full clip info → `clipTempo`, `playingClips`, clears `queuedClips`/`stoppingClips` at that index                                |
| `clip_playing`                                     | on                          | `useAbletonContextProviderState.ts:129` (`onUpdatePlayState`)                                             | same as `clip_started`                                                                                                                           |
| `ingredient_removed`                               | on                          | `useAbletonContextProviderState.ts:131`                                                                   | `data.clipName`, `data.pillar` — branches on whether the clip is in `playingClips` or `queuedClips` (via `.some`, see WOW-012 status note above) |
| `clip_stopping`                                    | on                          | `useAbletonContextProviderState.ts:140`                                                                   | full `BrowserClipInfo` → moves `playingClips[pillar]` → `stoppingClips[pillar]`                                                                  |
| `clip_stopped`                                     | on                          | `useAbletonContextProviderState.ts:145`                                                                   | `pillar` only → clears `clipTempo`/`playingClips`/`stoppingClips` at that index                                                                  |
| `tempo_changed`                                    | on                          | `useAbletonContextProviderState.ts:150`                                                                   | `tempo` → `setTempo`                                                                                                                             |
| `volume_changed`                                   | on                          | `useAbletonContextProviderState.ts:153`                                                                   | `{pillar, volume}` → `trackVolume[pillar]`                                                                                                       |
| `master-key_changed`                               | on                          | `useAbletonContextProviderState.ts:156`                                                                   | `key` → `setMasterKey`                                                                                                                           |
| `connect` (socket.io lifecycle)                    | on                          | `useSocketContextProviderState.ts:18`                                                                     | swaps placeholder `{}` for real socket                                                                                                           |
| `disconnect`/`connect_error` (socket.io lifecycle) | **not subscribed anywhere** | —                                                                                                         | UI-01                                                                                                                                            |
| `timeout_warning`                                  | **not subscribed anywhere** | — (backend emits 30s before the 3-min idle timeout, only while clips play — WOW-003 fidelity table)       | UI-17 — unused contract surface; the UI has no idle-timeout affordance at all                                                                    |
| any event (debug)                                  | `onAny`                     | `useSocketContextProviderState.ts:22`                                                                     | logs `event, ...args` via `Logger.debug` only                                                                                                    |

---

## Display-target assessment (1024×1280 portrait touch)

Runtime, resized Browser pane to exactly 1024×1280 for both sessions.

- **Main screen (idle + full-spell)**: fits the viewport cleanly with no horizontal overflow; the 2×2 pillar grid, cauldron centerpiece, tempo slider, and recipe box all render within bounds at both states (screenshots). `overflow-hidden max-h-screen` on the root (`MainScreen.tsx:25`) is doing real work to prevent scroll — but that same clipping is what makes `DebugModalContainer`'s overflow (UI-05) require internal scrolling to reach "Exit" rather than the whole page scrolling.
- **Debug modal**: fails the display target outright — see UI-05/UI-06. Confirmed by direct observation, not inference: the rendered panel exceeds 1024px width design intent (no `max-w` actually applied) and the 133-row-per-column clip list requires scrolling well past one screen height to review all pillars.
- **Touch targets (WCAG 2.5.5/2.5.8)**: native range inputs (tempo, volume ×4) have no explicit thumb-size styling — relies on browser default, not measured pixel-exact in this pass (TBD). The `ClipButton` toggle switch is a fixed 24×44px (`h-6 w-11`), at the WCAG 2.5.8 AA floor for the _height_ dimension but not meeting the 44×44 AAA target recommended for a public-facing kiosk. `KeyAdjusterContainer`'s `<` / `>` buttons (`p-3`, no explicit size) and the `RecipeBoxContainer`'s "new spell" button (fixed 120×120px, comfortably large) are the two extremes present in the inventory — no consistent touch-target sizing convention exists yet.
- **Mouse-only / hover-dependent affordances**: none found that are _load-bearing_ for interaction — no `:hover`-only reveal of critical controls. `ClipButton.tsx`'s button does have a `hover:` class in `DebugModalContainer.tsx`'s "Exit" button (line 145, `hover:bg-blue-200`) but that's a visual-only enhancement on a button that's also directly tappable; not a hover-gated affordance. No drag-precision concerns beyond standard `<input type=range>` thumbs, which are touch-compatible by default in evergreen mobile/embedded WebKit-class browsers (not verified against the actual show-machine browser/kiosk setup — that's an open DECISIONS_NEEDED item already, "Browser/kiosk setup on the show machine").
- **Simulated-state labeling (UX_UI_PRINCIPLES.md principle 10)**: nothing in the inventory labels the UI as running against the simulator vs. the real backend — no "SIMULATED" badge or equivalent exists anywhere. Confirmed by reading every file; no such string/conditional found. This is a **static, confirmed-absent** finding — flagged medium since principle 10 is an explicit, already-confirmed design requirement, not a TBD.

---

## Visitor vs. operator mapping (ADR-003)

| File / surface                                                                                                                                 | Belongs on                                                                                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CurrentlyPlayingListContainer.tsx`                                                                                                            | **visitor**                                                                                                                              | Core pillar display; F3 changes its content (category icon+name replacing song/artist) but not its audience.                                                                                                                                                                                                                                                                                                |
| `ClipButton.tsx`                                                                                                                               | **both** (context-dependent)                                                                                                             | Presentational; used read-only-ish in the visitor-facing debug list styling reuse is N/A today (only used inside `DebugModalContainer`, i.e. currently **operator-only** in practice) — but the component itself is audience-agnostic.                                                                                                                                                                      |
| `TempoSliderContainer.tsx`                                                                                                                     | **operator** (per FR3) — currently rendered directly on the **visitor** screen (`MainScreen.tsx:30-32`)                                  | PRD FR2 says "artist/song metadata may move to operator surface (designer's call)" but doesn't explicitly say tempo must move; FR3 lists tempo as an operator-surface requirement without saying it must be removed from the visitor screen. **Currently it's visitor-visible and freely draggable by any visitor** — flagged for the design proposal (WOW-006) to make an explicit call, not decided here. |
| `VolumeSliderContainer.tsx`                                                                                                                    | **operator** (per FR3) — currently rendered directly on the **visitor** screen (nested inside `CurrentlyPlayingListContainer.tsx:39,74`) | Same situation as tempo: any visitor can currently drag the per-pillar volume slider with no gate. Live performance safety (principle 2) concern carried into the current build, not just a future one — worth flagging clearly since it's a **present-day** unlocked control over real speaker output, not just a rework consideration.                                                                    |
| `KeyAdjusterContainer.tsx`                                                                                                                     | **operator** (per FR3, "key lock/master key") — currently rendered directly on the **visitor** screen (`MainScreen.tsx:26-28`)           | Same pattern: keylock checkbox and master-key rotation are visitor-tappable today.                                                                                                                                                                                                                                                                                                                          |
| `DebugModalContainer.tsx`                                                                                                                      | **operator-only**                                                                                                                        | Correctly scoped in intent (it _is_ the debug/operator tool) but reached via UI-03's invisible always-on tap target, not ADR-006's long-press-on-themed-element gesture. This is the single biggest visitor/operator boundary gap: **the intended operator-only surface is one accidental tap away from any visitor**, today.                                                                               |
| `RecipeBoxContainer.tsx`, `useGrimoire.ts`                                                                                                     | **neither** (removal candidate, F5)                                                                                                      | See blast radius below.                                                                                                                                                                                                                                                                                                                                                                                     |
| `AbletonContext.ts` / `AbletonProvider.tsx` / `SocketContext.ts` / `SocketProvider.tsx` / hooks / `ContextUtils.ts` / `AbletonContextState.ts` | **infrastructure**, feeds both                                                                                                           | No audience; used by both visitor and operator-facing containers alike.                                                                                                                                                                                                                                                                                                                                     |
| `MainScreen.tsx`                                                                                                                               | **both, currently combined into one page**                                                                                               | This is the concrete embodiment of "the current single page hides a cramped operator/debug panel behind an invisible button" cited in ADR-003's context section — confirmed still true post-migration. Nothing in this file distinguishes a visitor-view region from an operator-view region beyond the modal boundary; tempo/volume/key controls sit in the visitor-facing flow (see rows above).          |

**Summary finding**: today's `MainScreen.tsx` is a single combined page where three of the four "operator" controls named in FR3 (tempo, per-pillar volume, key lock/master key) are actually rendered on the shared visitor-facing surface, fully interactive by any visitor, with no distinction. Only the clip start/stop debug list is behind any gate at all, and that gate (UI-03) doesn't match the ADR-006 design. WOW-006/WOW-007 will need to explicitly decide whether tempo/volume/key move to the operator surface wholesale (per FR3's framing) or stay visitor-visible-but-operator-controlled by design — this repo's ADRs don't currently say which, so it's logged as an open question below rather than assumed.

---

## Recipe-removal blast radius (F5)

Everything touched by removing "Recipe suggestions AND the random spell-name display" (`RecipeBoxContainer`, `useGrimoire`), traced by reading every file that imports either:

1. **`src/container/RecipeBoxContainer.tsx`** — deleted outright. Only importer: `src/screen/MainScreen.tsx:5,37`.
2. **`src/hook/useGrimoire.ts`** — deleted outright. Only importer: `RecipeBoxContainer.tsx:1`. No other container/hook in the 19-file inventory imports it (confirmed by reading all 19 files — `useAbletonContext` is the only context `useGrimoire` itself consumes, one-directional).
3. **`src/screen/MainScreen.tsx`** — must be edited, not deleted:
   - Removes the `<RecipeBoxContainer />` line (37) and its wrapping `<div id='container_recipe_box' className='fixed bottom-0'>` (33).
   - **UI-13**: the invisible operator-entry button (lines 34–36) is currently nested _inside_ that same wrapper div — it has no independent host. The rework must give it a new home (presumably the ADR-006 themed element) in the same change that removes the recipe box, or the operator surface becomes completely unreachable. This is the single most load-bearing piece of the blast radius — easy to miss if the recipe box is deleted as an isolated, mechanical change.
   - Frees `23vh` of vertical space (`RecipeBoxContainer.tsx:9`, `h-[23vh] w-full`) at the bottom of the 1280px-tall viewport — real, measurable space available for the category legend (F4) or the new operator-entry element.
   - The `bg-recipe-bg` Tailwind class (`RecipeBoxContainer.tsx:9`) and `/images/new-spell.gif` background asset (line 18) become unused once this file is deleted — not verified against `tailwind.config`/asset references elsewhere in this pass (out of the 19-file inventory) — logged as a static, unverified cleanup note for whoever implements the removal.
4. **`src/util/ClipDatabaseUtil.ts`** — not deleted, but one line becomes dead: line 11, `csv.forEach(CsvUtil.enrichRecommendations.bind(this, rfidToClipMap, clipNameToInfoMap, csv));`. This second full-CSV pass exists _only_ to populate `recommendedClips`, which (per UI-11 above) is consumed _only_ by `useGrimoire.ts`. Once that hook is gone, this line and everything it populates become dead weight — still a real O(n²)-ish computation (each row filtered against the whole CSV, `backend/util/CsvUtil.ts:55-79`) running on every page load for no consumer. This file itself is not in the 19-file inventory's containers/contexts/hooks scope but is directly implicated by the removal — flagged per the ticket's explicit callout ("`recommendedClips` plumbing in `src/util/ClipDatabaseUtil.ts`").
5. **`src/type/SpellRecipeType.ts`** — becomes fully dead (its only consumer is `useGrimoire.ts`'s `SpellRecipeType` return-shape and `RecipeBoxContainer.tsx`'s destructure of `spellRecipe`). Flagged per the ticket's explicit callout.
6. **`RFIDToClipMapType`/`ClipMetadataType`'s `recommendedClips` field** (defined in `backend/type/`, read-only reference) — the _frontend_ stops needing this field once `useGrimoire` is gone, but the type itself lives in `backend/type/` and is shared with the real backend's (disabled) `EnrichRecommendations` code path; removing/narrowing it is a **backend-touching decision outside this ticket's and this rework's frontend-only scope** (ADR-004) — logged as an open question, not something to change.
7. **No coupling found to `CurrentlyPlayingListContainer.tsx`** despite the ticket's guidance flagging this as a thing to check — read the file fully; it does not import `useGrimoire`, `RecipeBoxContainer`, or `SpellRecipeType`, and shares no state with the recipe box beyond both ultimately reading from the same `AbletonContext` (`playingClips`). The coupling the ticket anticipated does not exist in the current (post-WOW-011) code; it may have existed pre-migration. Documenting the negative result explicitly since the ticket called it out by name.
8. **`DebugModalContainer.tsx`, `ClipButton.tsx`** — no coupling to the recipe box found; unaffected by removal.

---

## Appendix: open questions (TBD / Decision needed)

```text
Decision needed:
- WOW-012 (findIndex truthiness bug) was filed against src/context/AbletonProvider.tsx's
  ingredient_removed handler. That file no longer contains handler logic post-WOW-011 (it's
  a 9-line wrapper); the logic now lives in useAbletonContextProviderState.ts, and its
  ingredient_removed handler (lines 131-138) already uses `.some(...)` correctly on both
  branches, not findIndex-as-boolean. Please re-verify WOW-012's premise against the current
  file before running that ticket's prompt — it may already be resolved (e.g. folded into the
  WOW-011 "Manual code fixes" commit 0aaa123) or may need re-filing against different lines.

Why this matters:
- Running WOW-012's prompt as written risks either a no-op or, worse, an agent "fixing" code
  that isn't broken and mis-describing the diff.

Options:
1. Close WOW-012 as already-resolved, citing this audit's UI-01 section as evidence.
2. Re-open/re-file WOW-012 only if a human finds a still-live instance of the bug elsewhere.

Recommendation:
- Option 1, pending a human's own look at useAbletonContextProviderState.ts:131-138.

Blocked until human confirms:
yes (blocks only WOW-012, not WOW-004/006/007)
```

```text
Decision needed:
- Today's build renders tempo, per-pillar volume, and key-lock/master-key controls directly on
  the shared visitor-facing screen (MainScreen.tsx), fully interactive by any visitor, with no
  gate. FR3 lists these as operator-surface features but no ADR states whether they must be
  removed from the visitor view once an operator surface exists, or intentionally kept visible
  there (visitor-facing but design-limited) while operator-only controls (clip start/stop) move
  behind the gate.

Why this matters:
- Directly shapes what WOW-006/WOW-007 need to build: three of four operator-surface controls
  already exist and work today, just in the wrong (unguarded) place, if the answer is "move them."
- Also a live performance-safety question today, not just a future one (principle 2).

Options:
1. Move tempo/volume/key controls fully to the operator surface; visitor screen shows only
   category display + legend (matches FR2/FR3's clean split).
2. Keep a read-only/simplified version visible to visitors (e.g. tempo display without the
   slider) with the interactive versions duplicated on the operator surface.

Recommendation:
- Option 1, for consistency with FR2's "artist/song metadata may move to operator surface"
  precedent and principle 2's live-safety framing — but this is a product call, not asserted
  here as decided.

Blocked until human confirms:
yes (blocks WOW-006/WOW-007 scoping of which controls move)
```

```text
Decision needed:
- No contrast ratios were measured with a tooling in this session (UI-16) — several gray-on-
  near-black label instances (TempoSliderContainer.tsx:23,35; possibly recurring elsewhere if
  the rework reuses this styling) look marginal by eye but weren't checked against WCAG AA
  4.5:1 with an actual contrast checker.

Why this matters:
- UX_UI_PRINCIPLES.md principle 7 requires WCAG AA contrast for operator-critical text;
  can't confirm compliance without measurement.

Options:
1. Run an automated contrast audit (e.g. axe-core / Lighthouse) against the running dev build
   as a follow-up, non-hardware, safe check.
2. Defer to the WOW-006 visual-design pass, where new palette values will replace these anyway.

Recommendation:
- Option 2 is likely more efficient (current palette is being replaced per F2) but option 1
  costs little if done before WOW-006 starts, to know the current baseline.

Blocked until human confirms:
no (informational; doesn't block audit sign-off, but should inform WOW-006)
```

```text
Decision needed:
- Should the "debug modal" naming/behavior (Logger.enableDebug()/disableDebug() tied to modal
  open/close, DebugModalContainer.tsx:37-43) carry forward once this becomes the real operator
  surface, or should verbose logging be decoupled from the operator-surface open/close event?

Why this matters:
- Conflates "developer debug logging" with "operator control panel visibility" — fine for a
  debug tool, questionably scoped once it's promoted to a real, always-available operator UI.

Options:
1. Decouple: operator surface open/close no longer touches Logger verbosity.
2. Keep as-is: opening the operator surface still enables verbose console logging (harmless
   but a debugging-only side effect that may confuse a non-technical operator's browser console
   if they ever look, though far-fetched for the target audience).

Recommendation:
- Option 1, but low priority — no strong opinion, flagging so it isn't silently carried forward
  by accident during the rework.

Blocked until human confirms:
no (low priority; can be decided during WOW-007 implementation)
```

**Not logged as Decisions needed (out of scope per stop conditions)**: anything requiring live-backend verification (e.g. exact reconnect timing/behavior against real Ableton, exact touch-target rendering on the actual show-machine browser) — these are TBDs by nature of the "no live-backend testing from this repo" rule (ADR-004), not answerable here.

---

## Human-verifiable demo (top 3 findings)

1. **UI-01 — silent disconnect (blocker)**: Terminal 1: `yarn sim idle`. Terminal 2: `yarn dev`. Open the printed URL, resize to 1024×1280. Observe the idle screen. In Terminal 1, press `Ctrl-C` to kill the simulator. Watch the browser tab for 10+ seconds — nothing changes: no banner, no dimming, no console error, no "reconnecting" state. Compare against UX_UI_PRINCIPLES.md principle 4 ("an operator can diagnose 'why is pillar 3 silent' in seconds") — today they can't tell anything is wrong from the UI at all.
2. **UI-03 — unguarded operator-surface trigger (high)**: Terminal 1: `yarn sim full-spell`. Terminal 2: `yarn dev`. Open the app. Tap/click the bottom-left corner of the screen (invisible ~24px button under the recipe box, `MainScreen.tsx:34-36`) — the full clip-trigger operator modal (`DebugModalContainer`) opens instantly, no hold, no confirmation, no visible affordance beforehand.
3. **UI-05/UI-06 — debug modal overflow at the real display target (medium)**: with the modal open from step 2, resize/confirm the browser viewport is 1024×1280 — the modal content requires internal scrolling to reach the "Exit" button, and the panel is not width-constrained (fills the full 1024px with no margin, `max-w-xxl` on `DebugModalContainer.tsx:71` does not exist as a Tailwind class).

No hardware, Ableton, or network beyond `localhost:3335`/`localhost:5174` was used to produce any of the above.
