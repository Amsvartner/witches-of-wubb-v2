# Coding guidelines

Derived from the existing code. Items marked **(proposal)** go beyond current practice and need human sign-off before enforcement.

## Naming and files

- Files: kebab-case (`currently-playing-list.tsx`, `get-clip-from-rfid.ts`).
- React components: PascalCase; hooks `useXxx` in `src/hooks/`; contexts in `src/contexts/` as `*-provider.tsx`.
- Backend exported functions use PascalCase (`QueueClip`, `StartAbleton`) — follow it there for consistency; frontend uses camelCase for non-components.
- Types/enums: PascalCase in `backend/types.ts` (shared with frontend via direct import — don't break this path without approval).

## Folder conventions

- `src/components/` UI components, `src/contexts/` providers, `src/hooks/` hooks, `src/lib/` utilities, `src/assets/` data/assets.
- `backend/events/` incoming/outgoing event handling, `backend/utils/` helpers.
- Tests in `spec/` as `*.spec.tsx` (vitest + testing-library, jsdom, setup in `spec/setup-tests.ts`).

## TypeScript

- Strict-ish TS; keep types in `backend/types.ts` for shared shapes.
- Avoid `any` in new code **(proposal — existing code has some)**.
- Path aliases: `~/` → `src/` (vite-tsconfig-paths); `backend/` importable from frontend.

## UI conventions

- Tailwind utility classes inline; `classnames` for conditionals; Headless UI for modals/controls.
- No CSS files beyond `src/index.css`.
- Preserve the witch/spell theming vocabulary in UI copy.
- Keep destructive/operator controls behind the debug modal pattern (hidden trigger) until UX decisions say otherwise.

## Config conventions

- All ports/addresses via root `.env` (loaded by backend with dotenv; frontend via `VITE_*` vars). Never hardcode new addresses; the existing hardcoded pillar-IP map must not grow without approval.

## Hardware / simulator conventions

- Any code path that emits OSC/MIDI/Art-Net or controls Ableton must be guarded so it cannot fire in tests or a future simulation mode.
- New outgoing event names must be documented in `ABLETON_INTEGRATION.md` / `HARDWARE_INTEGRATION.md`.

## Error handling and logging

- Backend: pino logger (`backend/utils/logger.ts`) — use levels (`trace` for chatty OSC, `info` lifecycle, `warn` recoverable, `error` failures). Wrap RFID/Ableton lookups in try/catch and log rather than crash (existing pattern).
- Frontend: js-logger via `logger-provider`. No `console.log` in committed code **(proposal)**.

## Testing

- vitest, `yarn test` (single run) / `yarn coverage`.
- Tests must never require Ableton, hardware, or network. Mock socket.io.
- New UI components should ship with at least a render test **(proposal — current coverage is one smoke test)**.

## Formatting / linting

- Prettier config in `.prettierrc`; ESLint in `.eslintrc`; enforced by husky + lint-staged on commit. Run `yarn lint` and `yarn test` before handing off.
