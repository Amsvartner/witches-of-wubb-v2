# 004. Frontend-only scope for this project phase

Date: 2026-07-09
Status: superseded by 007 (2026-07-21 — full-product scope; previously: accepted, amended 2026-07-12 — second backend-touching exception for the docs/TICKETS_002_BUGS.md batch)

## Context

The rework mandate covers UI design and new frontend functionality. The `backend/` folder in this repo **is** the backend code (clarified 2026-07-09), but backend work, hardware, LEDs (category-colored, externally driven), Ableton, and RFID are all out of scope this phase. End-to-end testing is not done from this repo.

## Decision

- All work in this phase is **frontend-only** (`src/` incl. colocated `test/` folders, plus the simulator from ADR-001 in `sim/`).
- `backend/` and `Arduino/` stay in the repo but are **read-only** this phase, outside the two exceptions below; the frontend keeps importing from `backend/type/`.
- **Exception 1 (2026-07-10): the WOW-011 conventions migration** may edit `backend/` to apply the new coding conventions (camelCase renames, the `event/`/`service/`/`adapter/`/`util/` restructure) — structure and naming only, zero behavioral change, audio-ableton-reviewer + hardware-safety-reviewer sign-off required. Covers only that ticket; full detail in `AGENTS.md`.
- Definition of done: the UI works frontend-side and **sends the correct API calls** (existing socket.io contract). Verification via simulator and mocked-socket tests only.
- Volume ceiling is enforced on hardware, not in software; the UI keeps a plain volume slider.
- **Exception 2 (amendment 2026-07-12): backend/Arduino authorization for docs/TICKETS_002_BUGS.md** — a second, broader exception than Exception 1's narrow conventions-migration one, covering the entire ticket batch in `docs/TICKETS_002_BUGS.md` (WOW-014 through WOW-032, 19 tickets from the 2026-07-10 repo-review pass). That batch's own text already scopes backend, `Arduino/`, and hardware-adjacent work explicitly and extensively — 13 of its 19 tickets (68%) name `backend/` and/or `Arduino/` files in their own "Allowed files" line, 12 require audio-ableton-reviewer/hardware-safety-reviewer sign-off, and its intro paragraph frames itself as bug fixes found by "a full-repo review," not frontend-only work. This amendment makes ADR-004 consistent with what that already-committed ticket document itself authorizes, rather than leaving WOW-011 as the only documented exception while a much larger batch of already-approved backend work exists with no ADR basis. Constraints, mirroring WOW-011's own: each ticket's own "Allowed files" and safety-notes lines are the actual scope boundary (not a blanket backend reopen); tickets touching the Ableton/hardware path still require the specialist sign-offs their own text names; `Music Database.csv` stays agent-read-only unless a specific ticket says otherwise; firmware (`Arduino/`) tickets still require a human to compile, flash, and bench-test — agents review only, never touch real hardware; this exception covers only the docs/TICKETS_002_BUGS.md batch — outside it, `backend/`/`Arduino/` remain read-only per the original decision above.

## Consequences

- audio-ableton-reviewer and hardware-safety-reviewer become largely dormant; they activate only if a ticket unexpectedly touches the event contract or reference code.
- The socket.io event contract is the hard boundary — reviewer checks every diff against it.
