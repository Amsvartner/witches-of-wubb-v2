# 004. Frontend-only scope for this project phase

Date: 2026-07-09
Status: accepted

## Context

The rework mandate covers UI design and new frontend functionality. The `backend/` folder in this repo **is** the backend code (clarified 2026-07-09), but backend work, hardware, LEDs (category-colored, externally driven), Ableton, and RFID are all out of scope this phase. End-to-end testing is not done from this repo.

## Decision

- All work in this phase is **frontend-only** (`src/`, `spec/`, plus the simulator from ADR-001 in `sim/`).
- `backend/` and `Arduino/` stay in the repo but are **read-only** this phase; the frontend keeps importing `backend/types`.
- Definition of done: the UI works frontend-side and **sends the correct API calls** (existing socket.io contract). Verification via simulator and mocked-socket tests only.
- Volume ceiling is enforced on hardware, not in software; the UI keeps a plain volume slider.

## Consequences

- audio-ableton-reviewer and hardware-safety-reviewer become largely dormant; they activate only if a ticket unexpectedly touches the event contract or reference code.
- The socket.io event contract is the hard boundary — reviewer checks every diff against it.
