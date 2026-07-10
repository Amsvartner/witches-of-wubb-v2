## Ticket

<!-- WOW-XXX — title, or "no ticket" with justification. Link relevant docs/ADRs. -->

## Summary

<!-- What this PR does and why, 2–5 sentences. What changes for the visitor/operator/developer? -->

## Changes

<!-- Bulleted, grouped if large. Call out anything a reviewer might not expect from the ticket. -->

## Out of scope / deliberately not done

<!-- Follow-ups, known gaps, rationale for anything skipped. -->

## How to verify (human demo steps)

<!-- Exact steps: simulator scenario, `yarn dev`, what to click/observe on the 1024×1280 portrait viewport. Required for implementation PRs (AGENTS.md demo requirement). -->

## Validation

- [ ] `yarn lint` green
- [ ] `yarn test` green
- [ ] Verified against simulator (or N/A — docs-only)

## Safety checklist

- [ ] No changes under `backend/`, `Arduino/`, `src/assets/Music Database.csv`, or `.env`
- [ ] No new/renamed socket.io event names
- [ ] No new dependencies (or: listed below with approval reference)
- [ ] No volume/flicker-affecting behavior (or: flagged for hardware-safety review)
- [ ] Docs updated where behavior changed

## Pipeline status

<!-- Maintained by /run-ticket. Delete this section for manual PRs. -->

- [ ] Copilot round: clean @ `<sha>`
- [ ] Test review: pass @ `<sha>`
- [ ] General review: pass @ `<sha>`
- [ ] Specialist reviews (if required by ticket): pass @ `<sha>`
- [ ] Gate: ready for human review

## Decisions / questions for the human

<!-- Anything needing an answer before or after merge; reference DECISIONS_NEEDED.md entries. -->
