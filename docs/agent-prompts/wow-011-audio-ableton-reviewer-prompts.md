# WOW-011 — audio-ableton-reviewer prompts

Ticket: WOW-011 — Coding-guidelines conventions migration
Role profile: `.claude/agents/audio-ableton-reviewer.md` (read first, plus `AGENTS.md` in full). Read-only — no code edits.
Delivery: **mandatory sign-off on PR 2 of the stack** (backend sweep). PR 2 cannot merge without your explicit verdict (AGENTS.md v0.4 exception terms).

## Prompt 1 — musical-equivalence sign-off on PR 2

Goal:

Verify the backend restructure changes nothing musical: Ableton triggering, timing, quantization, transposition, tempo/key behavior, sample/clip mapping, and MIDI/OSC semantics are byte-for-byte equivalent before and after the moves.

Context files:

- `AGENTS.md` — the "Exception — conventions migration (2026-07-10)" block defines exactly what this PR was allowed to do (structure/naming only) and names your sign-off as a merge requirement
- `docs/TICKETS_001_INITIAL.md` — WOW-011; `docs/CODING_GUIDELINES.md` — target layering (`event/`/`service/`/`adapter/`)
- `docs/ABLETON_INTEGRATION.md` — the musical contract of record
- Old tree (`main`) vs. PR branch: `backend/ableton-api.ts`, `backend/key-transpositions.ts`, `backend/events/*` and wherever their contents landed (`backend/adapter/`, `backend/service/`, `backend/event/`)
- `docs/agent-notes/wow-011-creative-tech-integrator-backend.md` — the implementer's equivalence table (verify it, don't trust it)

Allowed files:

- `docs/agent-notes/wow-011-audio-ableton-reviewer-signoff.md` — verdict note (only file you may write)

Disallowed files: everything else.

What to verify (blocking unless proven equivalent):

1. **Transposition:** the key-transposition tables/logic survive character-for-character wherever they moved; no reordering, no "equivalent" rewrites.
2. **Triggering/quantization:** clip queue/stop/replace logic, phrase-leader/trigger-order logic, and any quantization or launch settings are moved, not modified.
3. **Timing:** timeout values, debounce/delay constants, and event ordering unchanged.
4. **Tempo/key/volume paths:** `set_tempo`/`set_track_volume`/keylock/master-key handling identical in values and semantics (incl. ack-vs-no-ack behavior).
5. **OSC/MIDI surface:** rebuild the OSC-address and emitted-event inventory yourself (grep both trees); identical sets, identical payload shapes.
6. **Mapping:** RFID→clip resolution unchanged; `Music Database.csv` and the pillar IP map untouched (diff-stat empty on the CSV; map contents identical even if its file moved).
7. **No behavior smuggled into renames:** spot-check the highest-risk moved functions line-by-line (`QueueClip`→`queueClip` and friends).

Required checks (safe): `yarn lint`, `yarn test`, `git diff main -M --stat`, targeted `git diff` per moved file, grep inventories. **Never run `yarn start-backend`** — equivalence is proven statically, never against live Ableton.

Stop conditions:

- Any musical/timing/mapping delta, however small → verdict **block**, cite file:line. Per your profile, musical assumptions never change without explicit human approval — a migration ticket is not that approval.
- Something is unverifiable statically (e.g. behavior depends on ableton-js internals) → say so explicitly in the note and escalate to the human rather than approving on faith.

Output:

- `docs/agent-notes/wow-011-audio-ableton-reviewer-signoff.md`: per-item verification results (incl. your independent grep inventory), findings with file:line, explicit verdict — **approve / approve-with-nits / block**.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, verdict, note path._
