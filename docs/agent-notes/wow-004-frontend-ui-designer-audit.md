# WOW-004 — frontend-ui-designer handoff note: UI audit

Date: 2026-07-11
Ticket: WOW-004 — UI audit report (read-only)
Branch: `docs/wow-004-ui-audit`
Role: frontend-ui-designer subagent (claude-sonnet-5), max reasoning effort

## What I discovered about the repo

- The post-WOW-011 inventory named in the prompt file matches the actual tree exactly — 19 files, no drift, verified with `find src -type f -not -path "*/test/*"`.
- The frontend's socket layer has **no disconnect/reconnect handling anywhere** — not in `useSocketContextProviderState.ts`, not in `useAbletonContextProviderState.ts` (which has a literal `// TODO: Show in UI` on the one line that checks `!socket.connected`, and does nothing else with that information). Confirmed live: killed the simulator process mid-session with the browser tab open and the UI gave zero indication anything had changed. This is the single biggest gap against `docs/UX_UI_PRINCIPLES.md` principle 4 ("Fast recovery").
- The socket's initial state is a fake `{} as Socket` placeholder (`useSocketContextProviderState.ts:10`) — a real (if latent) type-safety/runtime hazard for any consumer that calls a socket method before the first `connect` fires. `DebugModalContainer.tsx`'s `toggleSong` is unguarded against this; the `useAbletonContext` callbacks use `socket?.emit(...)` and are safe.
- Today's single `MainScreen.tsx` combines visitor and operator surfaces more than the ADRs' framing suggests: tempo, per-pillar volume, and key-lock/master-key are all rendered directly on the shared visitor-facing screen today, fully interactive by any visitor. Only clip start/stop (`DebugModalContainer`) is gated at all, and that gate is a single invisible always-present tap target (`MainScreen.tsx:34-36`) — not the ADR-006 long-press-on-themed-element design. Confirmed live: a single click on that button opened the full operator modal instantly.
- The debug modal itself fails the 1024×1280 display target outright — unconstrained width (a `max-w-xxl` Tailwind class that doesn't exist), 133 clips × 4 columns requiring internal scrolling to reach "Exit," small toggle targets. Confirmed live via screenshot at the exact target resolution.
- Corrected an assumption carried in the WOW-003 simulator note: it states live `ingredient_detected` payloads carry no `recommendedClips` and asks this audit to document what the grimoire does with `undefined`. Reading `useGrimoire.ts` shows it never reads `recommendedClips` off the socket payload at all — it looks the clip up in `ClipDatabaseUtil.rfidToClipMap`, which is enriched **entirely client-side** from the local CSV import at module load, independent of the backend/simulator. The recipe suggestions are real and always-populated, confirmed live in both `full-spell` and `idle` runs (never blank/"undefined").
- Traced the recipe-removal blast radius fully: `RecipeBoxContainer.tsx` and `useGrimoire.ts` delete cleanly, but the operator-entry button currently lives _inside_ `RecipeBoxContainer`'s wrapper div in `MainScreen.tsx` with no independent host — deleting the recipe box without relocating that button removes the only way to reach the operator surface at all. Also traced dead code that results: `ClipDatabaseUtil.ts:11`'s enrichment pass, `SpellRecipeType.ts` entirely. Explicitly checked (and found none) the coupling to `CurrentlyPlayingListContainer.tsx` the ticket asked about — that coupling doesn't exist in the current, post-migration code.
- Found that the previously-filed WOW-012 bug (`findIndex` truthiness bug in the `ingredient_removed` handler) does not appear to exist in the current code — `useAbletonContextProviderState.ts:131-138` already uses `.some(...)` correctly on both branches. Flagged this as a question for the human rather than assuming WOW-012 is stale (I didn't chase down which prior commit fixed it, if any — logged as a Decision needed rather than asserted).

## Files created/updated

- `docs/UI_AUDIT.md` (new) — the full audit report: summary table, per-file sections for all 19 inventoried files, socket-event consumption table, display-target assessment, visitor/operator mapping, recipe-removal blast radius, and an open-questions appendix in the standard "Decision needed" format.
- `docs/agent-notes/wow-004-frontend-ui-designer-audit.md` (this file).
- `docs/agent-prompts/wow-004-frontend-ui-designer-prompts.md` — appended the Prompt 1 run record only (date/executor/branch/outcome/note path), per the orchestrator's instruction. No other content in that file changed.

No files under `src/**`, `backend/**`, `Arduino/**`, or `src/assets/Music Database.csv` were changed. `git diff --stat` shows exactly the three files above.

## Assumptions made

- Contrast ratios (UI-16) were assessed **by eye from screenshots**, not measured with a contrast-checking tool — flagged explicitly as unverified/TBD in the report rather than asserted as a confirmed WCAG failure, per the ticket's "no fixes made, no invented decisions" constraint.
- Touch-target pixel measurements came from reading Tailwind class values in source (e.g. `h-6 w-11` = 24×44px) cross-referenced against WCAG 2.5.5/2.5.8 thresholds, not from an on-device measurement tool.
- Where the ticket's guidance anticipated a coupling that I could not find in the code (`CurrentlyPlayingListContainer.tsx` ↔ recipe box), I documented the negative result explicitly rather than silently omitting it, on the assumption the human would want to know the code has moved on from whatever prompted that guidance.
- Assumed "static" vs. "runtime" labeling should be conservative — anything not literally observed in a screenshot or console/network capture during this session is labeled static, even where I'm fairly confident of the outcome (e.g. UI-02's exact failure mode).

## Decisions/questions now waiting for the human

All four are recorded in full "Decision needed" format inside `docs/UI_AUDIT.md`'s appendix; summarized here:

1. **WOW-012 premise check** — re-verify whether the previously-filed `findIndex` bug still exists anywhere before running that ticket; this audit found the current code already correct at the cited location.
2. **Visitor vs. operator control placement** — today tempo/volume/key controls are visitor-visible and fully interactive; no ADR says whether the rework should move them wholly to the operator surface or keep a visitor-visible form. Recommended option 1 (move wholesale) but not decided here.
3. **Contrast measurement follow-up** — informational only, doesn't block sign-off; recommend deferring to WOW-006's new palette rather than measuring the outgoing one, but flagged as a possible quick pre-check.
4. **Debug-modal logging/naming coupling** — low priority; whether opening the future operator surface should still toggle `Logger` debug verbosity as a side effect.

## Safe validation run

```
yarn lint   → PASS
yarn test   → PASS
```

Ran both from repo root after finishing the audit; no `src/**` files were touched so this is confirming the baseline stayed green, not validating new code. Also ran, as part of the audit itself (not as a "required check" but as the audit's evidence-gathering):

- `yarn sim full-spell` + `yarn dev` (port 5174 per `.claude/launch.json`) — happy path screenshot evidence.
- `yarn sim idle` + `yarn dev` — idle-state screenshot evidence, then killed the sim process (`pkill -f "vite-node sim/server.ts"`) to observe disconnect behavior with the browser tab still open.
- `pkill -f vite` afterward to stop the dev server; confirmed no stray `sim/server` or `vite` processes remained (`ps aux | grep -E "sim/server|vite"` → clean).

`yarn start-backend` was never run. No hardware, Ableton, or network beyond `localhost:3335`/`localhost:5174` was touched at any point.

`git diff --stat` at the end of this session:

```
docs/UI_AUDIT.md                                          | (new file)
docs/agent-notes/wow-004-frontend-ui-designer-audit.md     | (new file)
docs/agent-prompts/wow-004-frontend-ui-designer-prompts.md | (run-record append only)
```

## Human-verifiable demo

See `docs/UI_AUDIT.md`'s final "Human-verifiable demo (top 3 findings)" section — exact repro steps for UI-01 (silent disconnect), UI-03 (unguarded operator trigger), and UI-05/UI-06 (debug modal overflow at 1024×1280), all using only `yarn sim <scenario>` + `yarn dev`.

## Suggested next prompt

- Human review of `docs/UI_AUDIT.md`, particularly the 4 open questions in its appendix (especially #1, the WOW-012 premise check, since it may change that ticket's status before it's run).
- Once reviewed, WOW-006 (`docs/agent-prompts/wow-006-frontend-ui-designer-prompts.md`, once generated via `/prep-ticket WOW-006`) is unblocked — it depends on WOW-004 per `docs/TICKETS_001_INITIAL.md`, and should treat this audit's visitor/operator mapping and recipe-removal blast-radius sections as its primary input.
