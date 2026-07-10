# WOW-011 — hardware-safety-reviewer prompts

Ticket: WOW-011 — Coding-guidelines conventions migration
Role profile: `.claude/agents/hardware-safety-reviewer.md` (read first, plus `AGENTS.md` in full). Read-only — no code edits.
Delivery: **mandatory sign-off on PR 2 of the stack** (backend sweep). PR 2 cannot merge without your explicit verdict (AGENTS.md v0.4 exception terms).

## Prompt 1 — hardware-safety sign-off on PR 2

Goal:

Verify the backend restructure cannot change what reaches speakers, LEDs, RFID readers, or pillar hardware: volume paths, lighting output, network targets, and startup/live-operation behavior are byte-for-byte equivalent, and the new `adapter/` layering has not widened any code path's ability to emit to hardware.

Context files:

- `AGENTS.md` — the "Exception — conventions migration (2026-07-10)" block (structure/naming only; your sign-off is a merge requirement) and the physical-installation safety rules
- `docs/TICKETS_001_INITIAL.md` — WOW-011; `docs/HARDWARE_INTEGRATION.md` — hardware contract of record
- Old tree (`main`) vs. PR branch: `backend/events/incoming-events.ts` (pillar IP map), `backend/ableton-api.ts`, LED/Art-Net emission code, and wherever their contents landed (`backend/adapter/` etc.)
- `docs/agent-notes/wow-011-creative-tech-integrator-backend.md` — implementer's equivalence table (verify independently)

Allowed files:

- `docs/agent-notes/wow-011-hardware-safety-reviewer-signoff.md` — verdict note (only file you may write)

Disallowed files: everything else.

What to verify (blocking unless proven equivalent):

1. **Volume:** default volumes, gain values, volume-ramp behavior, and every constant feeding `set_track_volume`-adjacent code identical. Uncontrolled volume damages speakers and hearing — this is the top check.
2. **Lights:** LED/Art-Net emission logic moved untouched; no brightness-ceiling, timing, or flicker-relevant change; no new code path that could strobe.
3. **Pillar IP map:** contents character-for-character identical even if its file moved; no new hardcoded addresses anywhere in the diff; `.env`-based config untouched.
4. **Network/emission surface:** inventory every module that imports OSC/Art-Net/serial/network capability in old vs. new tree — the set of files able to emit to hardware must not grow; the `adapter/` consolidation should shrink or preserve it. Guards preventing emission in tests/sim mode survive the move.
5. **Startup/shutdown:** `backend/index.ts` boot order and connection sequence semantically identical; `yarn start-backend` behavior unchanged.
6. **Untouchables:** `Arduino/**`, `src/assets/Music Database.csv`, `.env`, `backend/package.json`/lockfiles — diff-stat empty. No WiFi credentials copied anywhere.
7. **Docs:** the AGENTS.md safety-rule path references (`key-transpositions`, `incoming-events`) updated to the new paths in this same PR, so the safety rules keep pointing at real files.

Required checks (safe): `yarn lint`, `yarn test`, `git diff main -M --stat`, targeted diffs per moved file, import-graph greps (`ableton-js`, `node-osc`, Art-Net, `dgram`/`net`/serial). **Never run `yarn start-backend`** — verification is static only; never send anything to hardware.

Stop conditions:

- Any delta in volume, lighting, emission targets, guards, or startup behavior → verdict **block**, cite file:line. Your profile blocks anything that could harm visitors, hearing, or hardware — renames included.
- An emission guard's behavior after the move is unverifiable statically → block or escalate to the human; never approve on faith.

Output:

- `docs/agent-notes/wow-011-hardware-safety-reviewer-signoff.md`: per-item verification results (incl. your independent emission-surface inventory), findings with file:line, explicit verdict — **approve / approve-with-nits / block**.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, verdict, note path._

- 2026-07-10 — executor: Claude Fable 5 (hardware-safety-reviewer subagent) — branch `feat/wow-011-backend-sweep` @ `5b4ef0d`, PR https://github.com/Amsvartner/witches-of-wubb-v2/pull/8 — **approve** (volume/lighting/IP-map/emission-surface/startup all verified identical; no safety findings). Note: `docs/agent-notes/wow-011-hardware-safety-reviewer-signoff.md`.
