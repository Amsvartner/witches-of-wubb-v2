# AGENTS.md — Instructions for AI agents in this repository

Version: 0.7
Status: Active
Owner: Vidar
Last updated: 2026-07-21

This file is the root operating contract for any AI agent (Claude Code or otherwise) working in this repo. Read it fully before making changes.

## Scope of current phase (ADR-007 — full product)

Work spans the **full product** (human decision 2026-07-21, ADR-007, superseding ADR-004's frontend-only phase): `src/` (incl. colocated `test/` folders), `backend/`, `sim/`, and docs. No per-batch scope exceptions are needed anymore; each ticket's own "Allowed files" list is the per-ticket boundary.

**Gates relaxed (human decision 2026-07-21, ADR-007 amended):** the per-change approval gates are lifted along with the scope gate.

- Specialist reviewer passes (audio-ableton-reviewer, hardware-safety-reviewer) are **discretionary** — recommended on risky diffs, not required for gate.
- Musical/timing assumptions (routing, clip-naming assumptions, transposition, quantization, phrase-leader/trigger order) may be changed inside a ticket; the same PR documents the change in `docs/ABLETON_INTEGRATION.md`.
- The socket.io event contract is **fully ticket-managed**: additions, renames, and removals ship with contract-doc updates and `sim/` parity (ADR-001) in the same change.
- `src/assets/Music Database.csv` is editable in-ticket — it remains production data: keep it parseable, call edits out in the PR.
- `Arduino/` firmware is editable in-ticket; compiling, flashing, and bench-testing remain physically human tasks.
- Agents may run `yarn start-backend` and other live-connection scripts (e.g. `yarn verify-liveset`) when a ticket calls for it — with care while a real installation is live (they drive Ableton and the lighting server; the backend hangs if Live isn't running).
- The Ableton **Live set** is still edited in Ableton by a human, per a written spec (`docs/LIVE_SET_CHANGE_SPEC_*.md`) — agents cannot meaningfully edit `.als` files.

Standing engineering constraints (protect visitors and hardware; not process gates — see "Physical-installation engineering constraints" below): keep existing volume clamps/ceilings, no sudden full-scale level jumps, no strobe/flicker, keep LED brightness ceilings.

Definition of done for backend-touching tickets: local, hardware-free tests plus simulator parity; live-Ableton verification may be agent-run when a ticket calls for it, otherwise human.

## Project context

Witches of Wubb is an interactive music art installation. Four physical pillars each have a speaker, programmable LEDs, and a UHF RFID reader. Hundreds of physical objects carry RFID stickers. Placing an object on a pillar triggers a music clip in Ableton Live that is unique to that RFID. Clips are key-matched, BPM-matched, and quantized so visitors compose music by combining objects across pillars.

Observed clip categories in code: `Vox`, `Melody`, `Bass`, `Drums` (`backend/type/ClipTypes.ts`). See `docs/DECISIONS_NEEDED.md` for the naming discrepancy with the brief.

Current mandate: full-product feature work (ADR-007) — UI, backend, and simulator together. This repo currently runs live installations — treat everything as production.

Key docs (read before working):

- `docs/PROJECT_BRIEF.md` — what this is and who it's for
- `docs/ARCHITECTURE.md` — how the system fits together
- `docs/TECH_STACK.md` — approved stack; what not to change
- `docs/CODING_GUIDELINES.md` — conventions
- `docs/PRD.md` — UI rework requirements (largely TBD)
- `docs/DECISIONS_NEEDED.md` — open human decisions
- `docs/TICKETS_001_INITIAL.md` — current tickets
- `docs/TICKETS_002_BUGS.md` — bug tickets, WOW-014 onwards (2026-07-10 repo review + follow-ups)
- `docs/TICKETS_003_DJ_FX.md` — DJ FX feature batch, WOW-039 onwards (first full-product batch, ADR-007)
- `docs/LIVE_SET_CHANGE_SPEC_001_DJ_FX.md` — human-performed Ableton Live-set changes for the DJ FX batch

## Universal guardrails

1. Work only within the scope of your assigned ticket/task. No drive-by refactors.
2. Never invent product, hardware, musical, or UX decisions. Record them in `docs/DECISIONS_NEEDED.md` using the "Decision needed" format below.
3. Prefer small, reviewable, PR-sized changes.
4. Do not install or upgrade dependencies without human approval.
5. Do not delete or rewrite files you don't understand; ask.
6. Update docs in the same change when behavior changes.
7. If `git status` shows uncommitted human changes, do not overwrite them.

## Physical-installation engineering constraints (relaxed 2026-07-21 — constraints, not approval gates)

These used to be approval gates ("non-negotiable safety rules"); since the 2026-07-21 relaxation (ADR-007 amendment) they are standing engineering constraints. Work on these areas freely inside a ticket, but the constraints themselves hold because they protect visitors and hardware:

- **Volume:** keep the existing software clamps/ceilings (`[0, 0.7]`, `clampVolume`) unless a ticket explicitly raises them; no sudden full-scale level jumps or un-ramped volume behavior. Uncontrolled volume can damage speakers and hearing.
- **Lights:** no strobe/flicker patterns (photosensitivity risk); keep LED brightness ceilings.
- **Live hardware:** `yarn start-backend` and live-connection scripts may be run when the work calls for it — be deliberate while a real installation is live (they send OSC/MIDI/Art-Net/socket traffic to Ableton and the lighting server).
- **Mappings:** `src/assets/Music Database.csv` and the pillar IP map are editable in-ticket; both are production data — keep them valid and call edits out in the PR.
- **Ableton:** routing, clip-naming assumptions, transposition, quantization, and phrase-leader/trigger-order logic are changeable in-ticket; document every such change in `docs/ABLETON_INTEGRATION.md` in the same PR.
- **Arduino:** sketches are editable in-ticket; a human compiles, flashes, and bench-tests. The committed WiFi credentials stay where they are — do not copy them anywhere else.
- **Show operation:** never assume how the gallery/show is operated (startup order, network, staffing). Ask.

## Creative-intent rules

- Do not "improve" the installation concept. The object-on-pillar → music interaction model is the artwork; preserve it unless the human explicitly approves a change.
- Separate design proposals from implementation: proposals go in docs/tickets first, code second.
- Playful naming (spells, grimoire, ingredients, witches) is intentional. Keep it.

## Allowed / disallowed work

Allowed without extra approval:

- Docs, tickets, ADR drafts, agent-profile updates
- Backend, frontend, and simulator changes inside a ticket, following `docs/CODING_GUIDELINES.md`
- Tests that run purely locally without contacting Ableton/hardware/network (the CI/default posture)
- Socket-contract changes shipped with doc + `sim/` parity updates in the same PR
- Reading any file
- Running `yarn dev`, `yarn test`, and — when the work calls for it — `yarn start-backend` / live-connection scripts (see the engineering constraints above)

Requires explicit human approval:

- New dependencies, stack changes, build-tool changes
- Raising volume/brightness ceilings or introducing strobe-like light behavior
- Deleting files

## Custom agents

Profiles live in `.claude/agents/`. See `.claude/agents/README.md`.

| Agent                    | Use for                                             |
| ------------------------ | --------------------------------------------------- |
| project-manager          | Ticket breakdown, scope control, PRD/plan upkeep    |
| architecture-reviewer    | Boundary/drift review across UI, Ableton, RFID, LED |
| frontend-ui-designer     | Design direction, interaction model, a11y           |
| frontend-implementer     | Implementing approved UI tickets                    |
| creative-tech-integrator | Code touching Ableton/RFID/LED/real-time state      |
| audio-ableton-reviewer   | Review of triggering/timing/musical constraints     |
| hardware-safety-reviewer | Review of speaker/LED/RFID/pillar/live-op changes   |
| test-engineer            | Test and simulation strategy                        |
| documentation-maintainer | Keeping docs/tickets/ADRs aligned                   |
| reviewer                 | Strict general diff review                          |

## Standard task format

```
Goal:

Context files:

Allowed files:

Disallowed files:

Acceptance criteria:

Required tests/checks:

Hardware/audio/LED/RFID safety notes:

Stop conditions:
```

## Standard handoff format

```
Validation:

* Run only safe, local, non-hardware commands.
* Prefer docs-only validation such as checking file existence, markdown formatting if already configured, and git diff --check.
* If package scripts are clearly safe and do not trigger hardware/Ableton/network behavior, you may list suggested validation commands instead of running them.
* Do not install dependencies.

Before editing:

* If git status --short shows existing human changes, do not overwrite them.
* If a target doc already exists, update carefully rather than replacing it wholesale.
* If you are unsure whether a file is generated, binary, hardware config, Ableton project data, or production mapping, do not edit it.

Final response: Report:

* What you discovered about the repo.
* What files you created/updated.
* What assumptions you made.
* What decisions/questions are now waiting for the human.
* What safe validation you ran.
* Suggested next prompt after decisions are answered.
```

## Human-verifiable demo requirement

Adapted from Filterful: every implementation ticket must leave the human able to _see_ the result without reading code. Each handoff includes either a runnable local demo (e.g. "start simulator scenario X, run `yarn dev`, observe Y") using synthetic/simulator data only, or exact manual verification steps. Never require live hardware/Ableton for verification.

## Agent workflow files

- `docs/agent-prompts/RUN_NEXT_AGENT.md` — reusable runner protocol (paste one line, agent finds its ticket prompt).
- `docs/agent-notes/` — per-ticket agent outputs: `wow-XXX-<role>-<topic>.md` (implementation notes, review verdicts, audit reports).

## Skills (slash commands)

Project skills in `.claude/skills/` drive the ticket pipeline (pattern ported from Filterful):

| Skill                   | Purpose                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/preflight WOW-XXX`    | Verify all prerequisites before starting a ticket                                                             |
| `/prep-ticket WOW-XXX`  | Generate per-role prompt files from the ticket definition                                                     |
| `/run-ticket [WOW-XXX]` | Run exactly one pipeline phase (implement + PR → Copilot round → test review → fixes → review → fixes → gate) |
| `/ship-feature WOW-XXX` | Full pipeline autopilot; `checkpoint` arg pauses between phases                                               |
| `/address-reviews`      | Collect and resolve all open review findings on a branch/PR                                                   |
| `/review-board`         | Parallel multi-lens review with one consolidated verdict                                                      |
| `/sync-docs`            | Documentation-maintainer consistency pass                                                                     |

**Commit authorisation nuance:** invoking a pipeline skill is the human's explicit authorisation for the commits _and ticket-branch pushes_ that phase requires, on ticket/docs branches only. Everything else in the git rules stands: never `main`, never merge.

**Copilot reviews (human policy 2026-07-09):** every PR gets a GitHub Copilot review. Phase A ends by opening the PR and requesting it; the Copilot round resolves all its threads before agent reviews run; the gate fails on unresolved Copilot threads. If the repo has Copilot auto-review enabled in settings, verify it triggered instead of requesting manually.

## Standard "Decision needed" format

```text
Decision needed:
- ...

Why this matters:
- ...

Options:
1. ...
2. ...

Recommendation:
- ...

Blocked until human confirms:
yes/no
```

## Git / commit rules

- Never work directly on `main`. Never push to `main`. **Never merge PRs.** Never push at all without explicit approval.
- **This repo is a fork.** PRs target the fork (`origin`, `Amsvartner/witches-of-wubb-v2`) — **never the upstream/parent repo** (`gh pr create` defaults to the parent on forks; always pass `--repo Amsvartner/witches-of-wubb-v2`, and verify `gh repo set-default` points at the fork). Never open PRs, issues, or comments against `upstream`.
- Do not commit, rebase, squash, amend, tag, or force-push unless the human explicitly says to commit.
- Branch naming: `docs/…`, `feat/…`, `fix/…`, `chore/…`.
- One ticket per branch/PR where practical.
- Every PR fills `.github/pull_request_template.md` completely — real demo steps, ticked validation/safety checklists. A sparse PR body fails the gate.
- Commit messages (when approved): short imperative subject, matching existing history style (e.g. "Adjust UI to make sure key adjuster is always visible").

## Stop-and-ask rules

Stop and ask the human when:

- A task requires anything in the "requires approval" list.
- Product scope, feature priority, or visual identity is ambiguous.
- You find data loss risk, security issues (e.g. committed credentials), or conflicting instructions.
- Two docs contradict each other.
