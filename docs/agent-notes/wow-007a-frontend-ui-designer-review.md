# WOW-007A — Play-mode visual-fidelity spike — frontend-ui-designer review

- **Ticket:** WOW-007A (play-mode visual-fidelity spike)
- **Date:** 2026-07-17 (round 1 + re-review)
- **Reviewer role:** frontend-ui-designer (structure / accessibility / spec-compliance only — **not** the visual-art-direction gate, which is human-owned and was granted in-session at iteration round 7)
- **Reviewed SHA:** `d375a9f3c70bb40e6f1764939788c9d5a518c901` (`feat/wow-007a-play-mode-visual-spike`; round 1 reviewed `313e90f`, fixes re-verified at `d375a9f` — see the re-review addendum at the end)
- **Final verdict:** **approve** — all four Required findings and the actionable Recommended items from round 1 are fixed and re-verified live; the remaining Recommended items are recorded with rationales in the implementation note / DECISIONS_NEEDED and carry into WOW-007.

---

## Round 1 (SHA `313e90f`) — verdict then: approve-with-nits

The sections below are the round-1 record. Every Required item is now **fixed** (see the addendum).

## How this was verified

- Read the full `main...HEAD` diff (all new components, tokens, types, mock, tests, config).
- `yarn test`: 30 files / 229 tests green.
- Live DOM inspection at exactly **1024×1280** on the running dev server (`#play-spike`): `scrollHeight === 1280`, `scrollWidth === 1024` (no scroll either axis), zero console errors.
- Measured every rendered `<button>` bounding box and the computed font-size of each representative text role.
- Computed WCAG contrast ratios (alpha-blended against effective backgrounds) for every low-opacity text token used.

## Required

1. **Auto-adjust-key toggle is 56×28 px — below the 44 px touch floor** (`src/component/SettingsBand.tsx:88`, `h-7 w-14`). §7.1 sets a hard 44 px floor and _specifically_ cites the old audit UI-05 24 px toggle as the thing it fixes; this re-introduces the same violation on the new screen (measured live: 56×28). Fix: enlarge the control, or keep the 28 px visual pill and extend the hit area to ≥44 px (padding / pseudo-element), plus ≥8 px clearance from neighbours.
2. **Data/status text below the 15 px floor (§7.3)** — measured live at 14 px (`text-sm`) or 12 px (`text-xs`):
   - `src/component/PillarCard.tsx:95` — pillar status text ("PLAYING"/"QUEUED"/…), 14 px. Operator-critical.
   - `src/component/QueuedSampleRow.tsx:47` — queued sample name, 14 px.
   - `src/component/VolumeTube.tsx:38` — volume percentage, 14 px.
   - `src/component/SettingsBand.tsx:100` — toggle ON/OFF state, 14 px.
   - `src/component/SettingsBand.tsx:112–115` — key quality + key difference, 12 px.
     Fix: `text-[15px]`/`text-base` (data) per §7.3. (Category names are exactly 24 px — meets the ≥24 px floor; tempo value 24 px — fine.)
3. **Labels below the 12 px floor (§7.3)** — measured at 11 px:
   - `src/component/SectionLabel.tsx:7` — all section labels ("QUEUED", "TEMPO", "CURRENT KEY", "KEY CONTROLS", …).
   - `src/component/SettingsBand.tsx:17` — Raise/Lower/Reset button labels.
   - `src/component/Legend.tsx:13` — "Sample Types" legend label.
   - `src/component/SettingsBand.tsx:74` — tempo min/max range values (data-adjacent, also 11 px).
     Fix: bump to ≥12 px.
4. **Measured AA contrast failures on non-category text (§7.2)** — the §3.3 category-tint system itself passes handsomely (tints 9.9–13.5:1, verified), but the low-opacity parchment strings fall short on the panel:
   - `text-parchment/40` ≈ **3.24:1** (needs 4.5:1): "Queue empty" (`src/component/PillarCard.tsx:114`), "awaiting ingredient" (`src/component/PillarCard.tsx:83`), tempo min/max (`src/component/SettingsBand.tsx:74`).
   - `text-parchment/50` ≈ **4.41:1** (marginally under 4.5:1 at 11 px): `src/component/SectionLabel.tsx:7`. (The empty-pillar header at 24 px display passes the 3:1 large-text bar at the same opacity — fine.)
     Fix: raise these to ≈`/60`+ (5.9:1 measured) — imperceptible against the approved look. The axe-core pass is already WOW-007 acceptance scope; these concrete values are supplied so that pass starts from known numbers rather than re-discovering them.

## Recommended

1. **Muted state is under-signalled vs the §4 state model** (`src/component/PillarCard.tsx:95` + `src/component/PillarMedallion.tsx:79`): mock pillar 3 is muted yet the status row reads "PLAYING"; mute is conveyed only by the small speaker-x icon and a medallion dim (no §4 slash overlay / greyed name). Not colour-only (icon carries it), so not a §7.2 violation — but "why is pillar 3 silent" (UX principle 4) deserves an explicit "MUTED" text cue in the status row when wired.
2. **Volume value has no label** (`src/component/VolumeTube.tsx:38`): a bare "82%" — percent of what? Add a small "VOL" section label or an `aria-label`/`role="img"` name on the tube group for screen-reader and operator clarity.
3. **Key-control accessible names**: buttons expose "Raise"/"Lower"/"Reset" (`src/component/SettingsBand.tsx:122–124`); the requirements name them exactly "Raise key / Lower key / Reset key" (visual-direction, Required layout corrections). The section label carries it visually; add `aria-label='Raise key'` etc. so the standalone names match the spec.
4. **Bass icon meaning conflicts with the recorded icon decision**: `src/component/CategoryIcon.tsx:11–14` cites "human direction 2026-07-15" for a hexagram (Bass) + beamed notes (Melody), but DESIGN*PROPOSAL_001 §2/§3.3 and DECISIONS_NEEDED record the opposite 2026-07-15 decision — conventional mic / treble-clef / bass-clef / drum-kit, with "no arbitrary occult symbol" for a category. Icons are already flagged interim (no re-flag of that); the ask here is **reconcile the record**: either the human re-decided in-session (then update §3.3 / DECISIONS_NEEDED) or the interim glyphs' \_meanings* should converge on the decided set when the bespoke icon task runs.
5. **Legend dot for Drums** (`src/component/Legend.tsx:22`): blue-700 fill measures ≈2.8:1 non-text against the panel/page — the exact §7.2 Drums-ring caveat. Adjacent text carries the meaning, so no cue is lost; make sure the WOW-007 automated pass checks the legend dots too, not just the medallion rings.
6. **`text-violet-300` for the key difference** (`src/component/SettingsBand.tsx:114`): an off-system hue — violet is neither a category hue nor a §3.9 semantic token. Contrast is fine (10.2:1); consider a named token (or parchment) so the palette stays closed. Also note "+7A" is mock data echoing the reference image's placeholder string (§2 non-literal); the real key-difference format comes from the contract when wired.
7. **Focus indicators**: `src/component/IconButton.tsx:22` and the other buttons define no `focus-visible` treatment; §3.5 specifies a 3 px gilt ring, 2 px offset. Browser defaults currently apply (nothing is suppressed), so this is a wiring-phase task, not a defect.
8. **Tempo slider**: display-only `div`s in the spike (fine); when wired, the thumb needs the §3.6 ≥44 px invisible hit area — carry into WOW-007.

## What passes (verified)

- **Touch targets** (except the toggle above): every rendered button measures ≥44×44 — pillar controls 44×44, queue play/remove 44×44 with 12 px separation and red-tinted remove, Help/Settings 44 high, key controls 56 high. Inter-target spacing ≥8 px everywhere measured (queue rows: 14 px effective button-to-button).
- **Typography roles (§3.4)**: decorative Marcellus confined to wordmark / pillar headers / category names / key glyph (all §3.4-sanctioned); every operator-critical string is in the legible data/number faces. Sizes fail only the floors listed above.
- **Category text = `-300` tints, never raw `-700`** (§3.3/§7.2): verified across medallion, name, legend; fills reserved for dots/glows/LED-match. `ColorUtil` stays the single source of truth (`CategoryTheme` layering is clean and unit-asserted).
- **Motion (§7.4)**: exactly one ambient animation — `pulse-calm`, 2.4 s opacity ease (≈0.42 Hz), `motion-safe`-gated; queued state stays distinguishable without it (dashed ring). Cauldron is a static image. The pre-existing 200 ms `fadein` keyframe is legacy config, untouched by and unused in this screen. Nothing flashes.
- **Colour never the only cue**: status = dot + text; queued = dashed ring + pulse + text; empty = "?" + text; categories = icon + name + colour; legend = dot + name.
- **Semantics**: single `h1` (HEXOLOGY), four `h2` pillars in order, `ul/li` for queues and legend, `aria-label` on every icon-only button, `aria-pressed` on the toggle, decorative images `alt=''`+`aria-hidden`, cauldron `alt='Cauldron'`, zero images missing `alt`.
- **Layout**: exact 1024×1280 fit (scrollHeight/Width 1280/1024, no scroll), four identical `PillarCard` instances (symmetry by construction — one component, category+state props only), empty pillar shows no category identity (no icon/name/colour; grayscale tube; unit-tested).
- **No rejected aesthetics**: no generic dashboard, no broad glossy gradients, no Fondamento in the new surface, placeholder status of interim icons explicitly labelled in code and the implementation note.

## Explicitly out of scope for this review

- **The visual-fidelity gate itself** — human-owned (DESIGN_PROPOSAL_001 §"Visual-fidelity gate"); the human approved this render through 7 in-session rounds. Nothing here grants or withholds visual approval.
- **Human-directed visual choices** — asset selection/processing, amber double-border frame + top-centre flourish, inner ray-burst medallion treatment, header control placement, queued-row design, wordmark gilt gradient, two-row queue cap. Not relitigated.
- **Items already flagged in the implementation note / DECISIONS_NEEDED** — queue-remove confirm-gate, interim icon _art_ (§3.11), unwired Help/Settings, deferred axe-core pass, the PRD F3 queued-names divergence, mode-taxonomy/route follow-ups, Melody-vs-LED re-verification.

---

## Re-review addendum (SHA `d375a9f`, 2026-07-17) — verdict: **approve**

Re-verified the fix commit `d375a9f` ("fix(wow-007a): address frontend-ui-designer review") by reading its diff, re-running the suite (`yarn test`: 30 files / 229 tests green), and re-measuring the live DOM at exactly 1024×1280.

**Required findings — all fixed and measured:**

1. **Toggle touch target**: the auto-adjust pill is now wrapped in a `-my-2 min-h-[44px] min-w-[56px]` button (`src/component/SettingsBand.tsx:85–106`), visual pill unchanged. Measured live: **56×44**. A full-page sweep found **zero buttons under 44×44**. The negative margin extends the hit area over non-interactive space only (no adjacent target within 8 px).
2. **Data/status floor**: pillar status, queued names, volume %, ON/OFF, key quality/difference, "awaiting ingredient", "Queue empty" all raised to `text-[15px]` — every one measured **15 px** live (awaiting-ingredient verified in the diff; no empty pillar in the hero mock).
3. **Label floor**: SectionLabel, Raise/Lower/Reset labels, legend heading, tempo min/max, bpm unit raised to `text-xs` — all measured **12 px** live.
4. **Contrast**: the failing `parchment/40`/`50` strings are now `parchment/60` — **≈5.86:1** on the panel per the round-1 calculation, comfortably over AA 4.5:1.

**Recommended items — resolved or recorded:**

- **MUTED cue**: muted now overrides the playback label with a "MUTED" text cue + §3.9 muted dot colour (`src/component/PillarCard.tsx:34–50`); verified live (pillar 3 shows MUTED, only two PLAYING remain) and unit-tested (`PillarCard.test.tsx` asserts MUTED present / PLAYING absent).
- **Volume label**: `sr-only` "Volume N%" per pillar, visible percent `aria-hidden` (`src/component/VolumeTube.tsx:38–43`); all four present live.
- **Key-control names**: `aria-label="Raise key"` etc. (`src/component/SettingsBand.tsx:17`); verified live.
- **Icon-set record conflict**: reconciled — DECISIONS_NEEDED now records the in-session human revision (2026-07-16: mic / beamed notes / hexagram / drum-head supersedes the 2026-07-15 clef set for the spike; bespoke engraved family still the final-asset task).
- **Recorded with rationale instead of change** (acceptable): Drums legend dot deferred to the WOW-007 axe pass; `violet-300` key difference kept as a deliberate reference-matching accent; focus-ring + slider-thumb hit areas are wiring-phase tasks — all now written into the implementation note's caveats.

**Still standing (carry into WOW-007, no re-flag needed):** the deferred axe-core pass (including legend dots), confirm-gate on wired queue-remove, focus-ring tokens (§3.5), slider-thumb hit area (§3.6), and the MUTED/paused distinction once real state wiring exists.

Layout still fits exactly (scrollWidth/Height 1024/1280, no scroll), no console errors, and none of the fixes materially alters the human-approved look (1 px text bumps, opacity 40→60 on secondary strings, invisible hit-area growth).

**Final verdict: approve.**
