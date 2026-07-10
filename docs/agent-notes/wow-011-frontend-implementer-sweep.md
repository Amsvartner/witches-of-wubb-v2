# WOW-011 — frontend-implementer handoff (PR 1: frontend sweep)

Executor: Claude Fable 5 (frontend-implementer role, /ship-feature pipeline)
Branch: `feat/wow-011-frontend-sweep`
Scope: migration steps 1, 2, 6 + `spec/App.spec.tsx` move + stale-path docs updates. Zero behavioral change.

## Rename map (all via `git mv`, history preserved)

| Old path                                    | New path                                          | Export change                                                                     |
| ------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/App.tsx`                               | `src/page/InstallationPage.tsx`                   | `export default function App` → `export const InstallationPage`                   |
| `src/components/currently-playing-list.tsx` | `src/container/CurrentlyPlayingListContainer.tsx` | default → named `CurrentlyPlayingListContainer`                                   |
| `src/components/debug.tsx`                  | `src/container/DebugModalContainer.tsx`           | default → named `DebugModalContainer`; private `ClipButton` extracted             |
| `src/components/key-adjuster.tsx`           | `src/container/KeyAdjusterContainer.tsx`          | named `KeyAdjuster` → `KeyAdjusterContainer`                                      |
| `src/components/recipe-box.tsx`             | `src/container/RecipeBoxContainer.tsx`            | default → named `RecipeBoxContainer`                                              |
| `src/components/tempo-slider.tsx`           | `src/container/TempoSliderContainer.tsx`          | default → named `TempoSliderContainer`                                            |
| `src/components/volume-slider.tsx`          | `src/container/VolumeSliderContainer.tsx`         | default → named `VolumeSliderContainer`                                           |
| (extracted from `debug.tsx`)                | `src/component/ClipButton.tsx`                    | named `ClipButton` (purely presentational)                                        |
| `src/contexts/ableton-provider.tsx`         | `src/context/AbletonProvider.tsx`                 | default → named `AbletonProvider` (+ existing named `AbletonContext`)             |
| `src/contexts/socketio-provider.tsx`        | `src/context/SocketioProvider.tsx`                | default → named `SocketioProvider` (+ `SocketioContext`)                          |
| `src/contexts/logger-provider.tsx`          | `src/context/LoggerProvider.tsx`                  | default → named `LoggerProvider` (+ `LoggerContext`)                              |
| `src/hooks/use-grimoire.ts`                 | `src/hook/useGrimoire.ts`                         | default → named `useGrimoire`; `SpellRecipeType` moved out                        |
| (from `use-grimoire.ts`)                    | `src/type/SpellRecipeType.ts`                     | exported type in its own `type/` file                                             |
| `src/lib/utils.ts`                          | `src/util/ColorUtil.ts`                           | standalone fn → `ColorUtil = { getBackgroundColorFromType }`                      |
| `src/lib/database-output.ts`                | `src/util/ClipDatabaseUtil.ts`                    | two standalone consts → `ClipDatabaseUtil = { rfidToClipMap, clipNameToInfoMap }` |
| `spec/App.spec.tsx`                         | `src/page/test/InstallationPage.test.tsx`         | updated import + describe name only                                               |

Also: `src/main.tsx` — React namespace import → named `StrictMode`; all provider/page imports updated. Internal helpers renamed to camelCase (`UpdateIndex` → `updateIndex`, `ChooseRandomElementFrom` → `chooseRandomElementFrom`). All components converted to `const` arrow with `JSX.Element` return and `Props` types.

## Classification rationale

Every existing component reads context or composes other feature components, so all six land in `container/` with the `Container` suffix per guidelines. `ClipButton` (private, props-only) is the sole `component/`. `App` → `page/InstallationPage.tsx` (keeps its modal open/close state + contextmenu suppression — page-level coordination).

## Deliberate deviations (rationalized, not missed)

- **`src/assets/` not renamed to singular `asset/`** — it contains only `Music Database.csv`, a disallowed read-only file per AGENTS.md safety rules; the folder-naming rule yields. Left for a human-supervised rename if ever desired.
- **Commented-out code and `any` left in place** — removal is explicitly PR 3 scope (step 8); this PR is moves/renames only. `updateIndex`/`chooseRandomElementFrom` keep their `any[]` params for now.
- **Historical ticket text (WOW-004 acceptance criteria referencing `src/components|contexts|hooks`) left unchanged** — completed-ticket records are history, not living docs. Living docs (ARCHITECTURE, PRD, UX_UI_PRINCIPLES, DATA_MODEL, DECISIONS_NEEDED, WOW-006 ticket text) updated.

## Docs updated (same-PR stale paths)

- `docs/ARCHITECTURE.md` — src/ structure line
- `docs/PRD.md` — F4 ColorUtil path, F5/FR5 names
- `docs/DECISIONS_NEEDED.md` — category-colors path, spell-names note
- `docs/UX_UI_PRINCIPLES.md` — ColorUtil path, useGrimoire
- `docs/DATA_MODEL.md` — useGrimoire
- `docs/TICKETS_001_INITIAL.md` — WOW-006 ColorUtil path reference

## Validation

- `yarn build` ✓, `yarn lint` ✓, `yarn test` ✓ 48/48 (test-count parity: 48 before, 48 after)
- `git diff main --stat -M` — all moves detected as renames (see PR)
- Simulator demo: see below

## Human-verifiable demo

1. `yarn sim` (default scenario) in one terminal
2. `yarn dev` in another; open the served URL (1024×1280 portrait)
3. Observe: identical UI as before the sweep — key adjuster on top, four pillar frames with cauldron, tempo slider (75–155 BPM), volume sliders with Reset, recipe box at bottom; scenario ingredient events light up pillars exactly as before
4. Hidden debug trigger (invisible button, bottom-left of recipe box) still opens the debug modal; toggling a clip emits `/new/tag` / `/departed/tag` as before

## Assumptions / open questions

- None blocking. `SpellRecipeType` had no importers outside the hook; moved to `src/type/` because it is exported.
