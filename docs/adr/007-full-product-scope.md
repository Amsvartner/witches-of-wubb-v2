# 007. Full-product scope (supersedes ADR-004)

Date: 2026-07-21
Status: accepted (human decision 2026-07-21; **amended same day — approval gates relaxed, see Amendment below**)

## Context

ADR-004 (2026-07-09) limited the phase to frontend-only work, with `backend/` and `Arduino/` as read-only reference and two ticket-scoped exceptions (WOW-011 conventions migration; the `docs/TICKETS_002_BUGS.md` WOW-014–WOW-032 batch). Since then, most of that bug batch has landed, the DJ-mode feature line (WOW-007B/C/D) has repeatedly and productively touched the backend under its own exceptions, and the next feature batch (DJ FX: beat-phase display, VU meters, per-pillar filter, FX sends/echo throw, loop roll — see `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md`) is inherently full-stack: new backend Ableton control paths, new socket events, UI, and coordinated Live-set changes.

The human decided 2026-07-21: **"We're working with the full product from now on."**

## Decision

- The frontend-only phase is over. Work may span `src/`, `backend/`, `sim/`, `docs/`, and (review-only, see below) `Arduino/`, without per-batch scope exceptions. ADR-004 and its exception mechanism are superseded.
- **Everything that made backend work safe under the exceptions is retained as the normal operating rules, not dropped with the scope gate:**
  - The physical-installation safety rules in `AGENTS.md` apply unchanged (volume/gain staging, strobe/flicker, live-hardware commands, `yarn start-backend` remains a live-hardware command agents never run unapproved).
  - Musical/timing assumptions (routing, clip naming, transposition, quantization, phrase-leader/trigger order) still require explicit human approval to change, and backend-touching diffs on the Ableton/hardware path still require audio-ableton-reviewer and/or hardware-safety-reviewer sign-off.
  - `src/assets/Music Database.csv` stays agent-read-only unless a ticket explicitly says otherwise.
  - `Arduino/` firmware: agents may propose diffs in tickets, but a human compiles, flashes, and bench-tests; agents never touch real hardware.
  - The Ableton Live set itself is changed only by a human, per written spec documents (`docs/LIVE_SET_CHANGE_SPEC_*.md`) with reviewer sign-off.
- **The socket.io event contract remains a managed contract, not a frozen one:** additions ship with a ticket that updates `docs/ABLETON_INTEGRATION.md` (or the relevant doc) and `sim/` parity in the same change (ADR-001 sim-parity contract stands). Renaming or removing existing events still requires explicit human approval.
- Definition of done widens accordingly: backend-touching tickets are done when covered by local, hardware-free tests plus simulator parity — end-to-end verification against live Ableton remains a human action outside the agent loop.

## Amendment (2026-07-21, human): approval gates relaxed

Later the same day the human relaxed the retained per-change approval gates as well ("let's make it all relaxed"). This supersedes the "Decision" section's second and third bullets as follows:

- **Specialist reviewer sign-off (audio-ableton-reviewer / hardware-safety-reviewer) is discretionary**, recommended on risky diffs — no longer a gate requirement.
- **Musical/timing assumptions** (routing, clip-naming assumptions, transposition, quantization, phrase-leader/trigger order) may be changed inside a ticket without per-change human approval; the same PR documents the change in `docs/ABLETON_INTEGRATION.md`.
- **The socket.io event contract is fully ticket-managed**: additions, renames, and removals all ship with doc + `sim/` parity updates in the same change; no separate human approval step.
- **`src/assets/Music Database.csv` is editable in-ticket.** It remains production data: keep it parseable, call edits out in the PR.
- **`Arduino/` firmware is editable in-ticket.** Compiling, flashing, and bench-testing remain physically human tasks (not a gate — a fact).
- **Agents may run `yarn start-backend` and other live-connection scripts** when a ticket calls for it, with care while a real installation is live (it drives Ableton and the lighting server).
- **The Live set** is still edited in Ableton by a human per `docs/LIVE_SET_CHANGE_SPEC_*.md` (agents cannot edit `.als` files meaningfully); reviewer passes on specs are recommended, not required.

Standing engineering constraints survive the relaxation because they protect visitors and hardware rather than process: keep existing volume clamps/ceilings (`[0, 0.7]`) unless a ticket explicitly raises them, no sudden full-scale level jumps, no strobe/flicker LED patterns, keep LED brightness ceilings.

## Consequences

- audio-ableton-reviewer and hardware-safety-reviewer are no longer "dormant by default" — they are available, discretionary reviewers for diffs on the Ableton/hardware path (per the Amendment: recommended, not required).
- Tickets no longer need an ADR-level exception to name backend files; each ticket's "Allowed files" list remains the per-ticket boundary.
- ADR-001's simulator remains the primary agent-side verification target; "revisit env-flag stubbing in the real backend if backend work reopens" (ADR-001) is now a live option a future ticket may take up.
- Docs whose scope notes referenced ADR-004 are updated in the same change that lands this ADR.
