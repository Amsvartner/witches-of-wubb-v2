# Coding guidelines

Version: 1.0
Status: Adopted (migration pending — see "Migration" at the end)
Last updated: 2026-07-10

## Purpose

Day-to-day coding guidelines for Witches of Wubb, for both human contributors and AI agents. Adapted from the Filterful coding guidelines, tuned for this project's existing stack (React 18, Vite, Tailwind, socket.io, Node backend, offline simulator).

This document complements:

- `AGENTS.md` — agent guardrails;
- `docs/ARCHITECTURE.md` — system architecture;
- `docs/TECH_STACK.md` — approved stack;
- `docs/ABLETON_INTEGRATION.md` / `docs/HARDWARE_INTEGRATION.md` — event and hardware contracts;
- `docs/UX_UI_PRINCIPLES.md` — UX rules.

If this document conflicts with those files, stop and resolve the conflict before implementing.

> **Note:** The one-time conventions migration (WOW-011) brought the pre-existing codebase in line with this document. All code — new and old — now follows these guidelines.

## Core engineering principles

- Prefer boring, explicit, maintainable code.
- Keep modules small and boundaries clear.
- Minimise dependencies; this runs a live installation — supply-chain and runtime surprises are unacceptable.
- Any code path that emits OSC/MIDI/Art-Net or controls Ableton must be guarded so it cannot fire in tests or simulation mode.
- Prefer readable code over compact code.
- Avoid clever abstractions until repeated pain proves they are needed.

## Naming conventions

### Variables and functions

- Use descriptive names. Functions are values and are named with the same care as variables.
- Local variables, object properties, and **all functions** use `camelCase` — including backend functions. (The legacy `QueueClip` / `StartAbleton` PascalCase style is retired; the migration ticket renames them.)
- Immutable constants use `SCREAMING_SNAKE_CASE` (`MIN_TEMPO`, `SPELL_NAMES`). A `const` holding a computed/runtime value (`const config = loadConfig()`) stays `camelCase`.
- Name booleans/predicates as questions or states: `isPlaying`, `hasActiveClip`, `shouldQueueClip`, `canTranspose`.
- Name async operations with clear verbs: `queueClip`, `fetchClipMetadata`, `startAbleton`.
- Prefix standalone factory/transform functions with `to` when they take input and return a new object of a specific target kind (`toClipMetadata(row)`), unless a namespace already disambiguates (`Scenario.create()` is fine).
- Avoid single-letter names except tiny obvious local contexts.

### Files and folders

- Folder names are singular and use `kebab-case`: `component`, `container`, `screen`, `hook`, `context`, `service`, `adapter`, `event`, `util`, `type`, `mock`, `test`.
- React component files use `PascalCase.tsx` (`TempoSlider.tsx`).
- Type files use `PascalCase.ts`, one exported type per file, named after the type (`ClipMetadata.ts` exports `ClipMetadata`).
- Service files use `PascalCase.ts` ending in `Service` (`AbletonService.ts` exporting `AbletonService`).
- Adapter files use `PascalCase.ts` ending in `Adapter` (`OscAdapter.ts` exporting `OscAdapter`).
- Utility modules exposing a grouped object use `PascalCase.ts` ending in `Util` (`CsvUtil.ts` exporting `CsvUtil`); a single pure function may live in a `camelCase.ts` file named after the function.
- Hook files match the hook name: `useGrimoire.ts`.
- Mock files live in a `mock` folder, use `PascalCase`, end in `Mock`, and export a same-named object (`SocketMock.ts` exporting `SocketMock`).
- Test files live in a `test` folder next to the code they test, named `.test.ts` / `.test.tsx`. (The legacy top-level `spec/` folder was retired by WOW-011.)

## TypeScript conventions

- Strict TypeScript (already enabled); keep it that way.
- Use `type` for all type declarations. Do not use `interface`.
- Avoid `any`; use `unknown` and narrow. Existing `any` is cleaned up by the migration ticket; do not add new ones.
- Prefer explicit return types for exported functions.
- Use discriminated unions for state machines (playback state, pillar state, sim scenarios).
- Use `Maybe<T>` for optional values instead of `T | undefined` in annotations. `Maybe` is defined once in `backend/type/Maybe.ts` and shared everywhere. (Optional properties still use normal `?:` syntax.)
- Use branded primitive types only where mix-ups would be harmful: `RfidTag`, `ClipId`, `PillarId`. Do not over-brand.
- Put every exported type in its own file under a `type/` folder, named after the type. A type used in only one module and never exported may stay inline.
- Name argument-object types with the `In` suffix (`QueueClipIn`), passed as a single `input` parameter. This is for input shapes only, not domain models or return types.

### Shared types

Shared frontend/backend/sim shapes live under `backend/type/` (one type per file) and are imported by `src/` and `sim/` via the existing `backend/` import path. The backend owns the contract. Do not create a parallel copy of a shared type in `src/`.

### Early returns

Use early returns to handle edge cases and failed preconditions first, keeping the main logic unnested:

```ts
const toClipLabel = (clip: Maybe<ClipMetadata>): string => {
  if (!clip) {
    return 'Empty slot';
  }
  if (!clip.isPlaying) {
    return `${clip.name} (queued)`;
  }
  return clip.name;
};
```

Avoid `if/else` pyramids; the happy path reads top-to-bottom at the outermost level.

### Call-site readability

Avoid inline value calculations inside function-call arguments. Compute derived values in a named local constant first, then pass the constant. Applies to production code and tests; declarative DSLs (Zod-style schemas, Tailwind class lists) may stay inline.

```ts
// Good
const clip = getClipFromRfid(tag);
const label = toClipLabel(clip);
socket.emit('clip-queued', label);

// Avoid
socket.emit('clip-queued', toClipLabel(getClipFromRfid(tag)));
```

### Imports

- Combine value and type imports from the same module into one declaration: `import { TempoSlider, type TempoSliderProps } from '~/component/TempoSlider';`
- Side-effect imports stay separate.
- Import only the named React exports you use; do not import the React namespace.
- Path aliases: `~/` → `src/`; `backend/` is importable from frontend and sim.

### Exports

- Named exports only. No default exports (the migration ticket removes existing ones).
- One primary export per file for components, types, services, and hooks.
- Export runtime functions and constants through a single named object export per module, never as standalone named exports:

```ts
const queueClip = (input: QueueClipIn): void => {
  /* ... */
};
const startAbleton = async (): Promise<void> => {
  /* ... */
};

export const AbletonService = {
  queueClip,
  startAbleton,
};
```

- Keep the grouped functions module-private (`const`) so the object is the single public surface.
- Grouped constants keep their `SCREAMING_SNAKE_CASE` names as object keys (shorthand).
- Types are exempt from grouping: export them directly, one per file under `type/`.
- Components and hooks are exported directly (`export const TempoSlider = ...`, `export const useGrimoire = ...`), not wrapped in objects.

## Architecture layers

### Frontend (`src/`)

Three-level component hierarchy:

```text
screen > container > component
```

- **`src/screen/`** — top-level components for a view (`MainScreen.tsx`). Compose containers. Thin.
- **`src/container/`** — coordinate logic and compose components. May use hooks, contexts, loading/error states. Names end in `Container`.
- **`src/component/`** — purely presentational. Props in, markup out. No business logic, no context reads beyond trivial local UI state. Do not compose other feature components.
- **`src/hook/`** — hooks encapsulating state, socket subscriptions, and side effects.
- **`src/context/`** — providers (`AbletonProvider.tsx`, `SocketProvider.tsx`).
- **`src/util/`** — pure functions, no side effects.

Component rules:

- Functional components only, declared as `const`, explicit `JSX.Element` return type.
- One component per file; file name matches the exported component name.
- Props type is named `Props` if private to the file; exported props types use descriptive names (`TempoSliderProps`).
- Components rely on props rather than hidden external state.
- If a component needs logic or composes other components, it belongs in `container/`.

```tsx
import { type JSX } from 'react';

type Props = {
  tempo: number;
  onTempoChange: (tempo: number) => void;
};

export const TempoSlider = ({ tempo, onTempoChange }: Props): JSX.Element => {
  // ...
};
```

### Backend (`backend/`)

Layered as service + adapter, with thin event handlers:

- **`backend/event/`** — incoming/outgoing socket event handlers. Validate input, call services, map errors. No business logic.
- **`backend/service/`** — musical/business rules (clip selection, phrase-leader logic, key transposition, tempo policy). Pure where possible; no direct OSC/MIDI/network I/O.
- **`backend/adapter/`** — all hardware and external I/O: Ableton (AbletonJS/OSC), RFID readers, Art-Net/LED output. Thin, no business rules. Every adapter must be replaceable by the simulator and must be guarded so it cannot fire in tests or sim mode.
- **`backend/type/`** — shared types (see above).
- **`backend/util/`** — pure helpers (CSV parsing, logging setup).

Rules:

- Musical mapping, timing assumptions, and hardware behavior never change without the review gates defined in `AGENTS.md` (audio-ableton-reviewer / hardware-safety-reviewer).
- New outgoing event names must be documented in `ABLETON_INTEGRATION.md` / `HARDWARE_INTEGRATION.md`.

### Simulator (`sim/`)

The simulator implements the same event contract as the real backend. Sim-only code stays in `sim/`; it may import from `backend/type/` and pure `backend/service/` code, never from `backend/adapter/`.

## UI conventions

- Tailwind utility classes inline; `classnames` for conditional classes; Headless UI for modals/controls.
- Put reusable visual decisions (colors, fonts, spacing scale) in `tailwind.config.cjs` theme tokens; do not scatter raw hex values or one-off arbitrary values (`w-[31vw]`) when a theme token exists or the value repeats.
- No CSS files beyond `src/index.css`.
- Preserve the witch/spell theming vocabulary in UI copy.
- Keep destructive/operator controls behind the debug-modal pattern (hidden trigger) until UX decisions say otherwise.
- Accessibility: semantic HTML first, one `h1` per page, visible labels for controls, keyboard-accessible interactions, no colour-only status. This UI runs on an installation touch screen — hit targets stay generous.

## Config conventions

- All ports/addresses via root `.env` (backend: dotenv; frontend: `VITE_*` vars).
- Never hardcode new addresses; the existing pillar-IP map must not grow without approval.

## Error handling and logging

- Backend: pino (`backend/util/LoggerUtil.ts`). Levels: `trace` chatty OSC traffic, `info` lifecycle, `warn` recoverable, `error` failures. Wrap RFID/Ableton lookups in try/catch and log rather than crash — the installation must keep running.
- Frontend: js-logger via the logger provider. No `console.log` in committed code.
- Represent expected failures explicitly with discriminated-union results rather than thrown strings:

```ts
type QueueClipResult =
  | { type: 'QUEUED'; clipId: ClipId }
  | { type: 'UNKNOWN_TAG'; tag: RfidTag }
  | { type: 'ABLETON_OFFLINE' };
```

## Testing

- vitest; `yarn test` (single run), `yarn coverage`. Tests must pass before handing off.
- Tests live in colocated `test/` folders (`src/container/test/RecipeBoxContainer.test.tsx`, `backend/service/test/PhraseLeaderService.test.ts`).
- Tests must never require Ableton, hardware, or network. Mock socket.io.
- Verify behaviour, not implementation. Prefer Testing Library user-facing queries (role, label, visible text); `data-testid` is a last resort.
- Reusable test doubles live in `mock/` folders as `XxxMock.ts` exporting a same-named object with `create*` helpers and explicit return types. One-off inline stubs may stay in the test file until they grow helpers or state.
- Keep tests deterministic — no reliance on wall-clock timing or real randomness (inject/seed instead).
- New components/containers ship with at least a render test; services with behaviour tests.

## Dependency guidelines

Before adding a dependency, document: package name, purpose, why internal code is insufficient, maintenance status, and runtime impact. Do not add dependencies for trivial helpers. UI framework changes (MUI, styled-components, CSS-in-JS, component libraries) require an approved architecture proposal — Tailwind + Headless UI is the settled stack.

## Formatting / linting

- Prettier (`.prettierrc`) + ESLint (`.eslintrc`), enforced by husky + lint-staged on commit. Run `yarn lint` and `yarn test` before handing off.
- The mechanical rules in this document (no default exports, no `interface`, naming conventions, import grouping) are enforced by ESLint rules added in the migration ticket; the doc is the source of truth where lint can't reach.

## Migration

A dedicated ticket performs the one-time sweep, in one reviewed PR (or a small stack):

1. Rename component/hook/context files to `PascalCase`, folders to singular (`components` → `component`, `contexts` → `context`, `hooks` → `hook`, `lib` → `util`).
2. Replace default exports with named exports; convert `function` components to `const` arrow components.
3. Rename backend PascalCase functions to `camelCase`; group module exports behind namespace objects (`AbletonService`, `CsvUtil`).
4. Split `backend/types.ts` into `backend/type/` (one type per file); add `Maybe.ts`.
5. Restructure `backend/` into `event/` / `service/` / `adapter/` / `util/`; isolate all OSC/MIDI/Art-Net/Ableton I/O behind adapters.
6. Introduce `src/screen/` + `src/container/` and move logic-bearing components accordingly.
7. Move `spec/` tests into colocated `test/` folders; update vitest config.
8. Add ESLint rules enforcing the mechanical conventions; remove remaining `any` and commented-out code.

Until that ticket lands, do not partially migrate files in unrelated PRs — it makes diffs noisy and review harder.
