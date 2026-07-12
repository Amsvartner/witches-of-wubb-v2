# AGENTS.md — Instructions for AI agents in this repository

Version: 0.5
Status: Active
Owner: Vidar
Last updated: 2026-07-12

This file is the root operating contract for any AI agent (Claude Code or otherwise) working in this repo. Read it fully before making changes.

## Scope of current phase (ADR-004)

Work is **frontend-only**: `src/` (incl. colocated `test/` folders), docs, and the offline simulator (ADR-001). `backend/` and `Arduino/` are read-only reference. The socket.io event contract is the boundary; do not add/rename events without approval. End-to-end testing happens outside this repo; definition of done is "UI works frontend-side and sends the correct API calls."

**Exception — conventions migration (2026-07-10):** the dedicated migration ticket **WOW-011** (defined in `docs/TICKETS_001_INITIAL.md`, from the `docs/CODING_GUIDELINES.md` "Migration" section) may edit `backend/` to apply the new conventions: camelCase function renames, splitting `backend/types.ts` into `backend/type/`, grouping exports behind namespace objects, and the `event/` / `service/` / `adapter/` / `util/` restructure. Constraints:

- Structure and naming only — **zero behavioral change**. Musical logic, timing, quantization, transposition tables, volume handling, the pillar IP map, and all emitted OSC/MIDI/Art-Net/socket payloads stay byte-for-byte equivalent; socket.io event names are frozen.
- The physical-installation safety rules below apply in full; the diff requires audio-ableton-reviewer and hardware-safety-reviewer sign-off before merge.
- This exception covers only that ticket. Outside it, `backend/` remains read-only.

**Exception — `docs/TICKETS_002_BUGS.md` batch (2026-07-12, ADR-004 amended):** the 19-ticket batch in `docs/TICKETS_002_BUGS.md` (WOW-014 through WOW-032, from the 2026-07-10 full-repo review) may edit `backend/` and `Arduino/`, scoped to each ticket's own "Allowed files" and safety-notes lines — not a blanket reopen. Constraints:

- Each ticket's own allowed-files list is the actual boundary; do not touch files a ticket doesn't name.
- Tickets whose safety notes name audio-ableton-reviewer and/or hardware-safety-reviewer sign-off still require it before gate, same as WOW-011's exception.
- `Music Database.csv` stays agent-read-only unless a specific ticket explicitly says otherwise.
- Firmware tickets (`Arduino/`) still require a human to compile, flash, and bench-test — agents review only, never touch real hardware.
- This exception covers only the `docs/TICKETS_002_BUGS.md` batch. Outside it, `backend/`/`Arduino/` remain read-only per the base rule above.

## Project context

Witches of Wubb is an interactive music art installation. Four physical pillars each have a speaker, programmable LEDs, and a UHF RFID reader. Hundreds of physical objects carry RFID stickers. Placing an object on a pillar triggers a music clip in Ableton Live that is unique to that RFID. Clips are key-matched, BPM-matched, and quantized so visitors compose music by combining objects across pillars.

Observed clip categories in code: `Vox`, `Melody`, `Bass`, `Drums` (`backend/type/ClipTypes.ts`). See `docs/DECISIONS_NEEDED.md` for the naming discrepancy with the brief.

Current mandate: rework the UI design and add new features. This repo currently runs live installations — treat everything as production.

Key docs (read before working):

- `docs/PROJECT_BRIEF.md` — what this is and who it's for
- `docs/ARCHITECTURE.md` — how the system fits together
- `docs/TECH_STACK.md` — approved stack; what not to change
- `docs/CODING_GUIDELINES.md` — conventions
- `docs/PRD.md` — UI rework requirements (largely TBD)
- `docs/DECISIONS_NEEDED.md` — open human decisions
- `docs/TICKETS_001_INITIAL.md` — current tickets
- `docs/TICKETS_002_BUGS.md` — bug tickets, WOW-014 onwards (2026-07-10 repo review + follow-ups)

## Universal guardrails

1. Work only within the scope of your assigned ticket/task. No drive-by refactors.
2. Never invent product, hardware, musical, or UX decisions. Record them in `docs/DECISIONS_NEEDED.md` using the "Decision needed" format below.
3. Prefer small, reviewable, PR-sized changes.
4. Do not install or upgrade dependencies without human approval.
5. Do not delete or rewrite files you don't understand; ask.
6. Update docs in the same change when behavior changes.
7. If `git status` shows uncommitted human changes, do not overwrite them.

## Physical-installation safety rules (non-negotiable)

- **Volume:** never change default volumes, gain staging, or volume-ramp behavior without explicit approval. Uncontrolled volume can damage speakers and hearing.
- **Lights:** never introduce or modify strobe/flicker behavior without approval (photosensitivity risk). Do not change LED brightness ceilings.
- **Live hardware:** never run commands that send MIDI, OSC, serial, Art-Net/DMX, or network messages to hardware or Ableton unless explicitly approved or a documented simulation mode is used. Starting `yarn start-backend` connects to Ableton and the lighting server — treat it as a live-hardware command.
- **Mappings:** agents may not edit `src/assets/Music Database.csv` at all unless a human explicitly allows it in the ticket. Same for the pillar IP map in `backend/event/IncomingEvents.ts`.
- **Ableton:** never change Ableton routing, clip naming assumptions, transposition logic (`backend/service/KeyTranspositionService.ts`), quantization, or the phrase-leader/trigger-order logic without approval.
- **Arduino:** never modify `Arduino/` sketches (they run on installed hardware) without approval. They contain committed WiFi credentials — do not copy these anywhere else.
- **Show operation:** never assume how the gallery/show is operated (startup order, network, staffing). Ask.

## Creative-intent rules

- Do not "improve" the installation concept. The object-on-pillar → music interaction model is the artwork; preserve it unless the human explicitly approves a change.
- Separate design proposals from implementation: proposals go in docs/tickets first, code second.
- Playful naming (spells, grimoire, ingredients, witches) is intentional. Keep it.

## Allowed / disallowed work

Allowed without extra approval:

- Docs, tickets, ADR drafts, agent-profile updates
- Tests that run purely locally without contacting Ableton/hardware/network
- UI changes inside an approved ticket, following `docs/CODING_GUIDELINES.md`
- Reading any file
- Running `yarn dev` (UI only) and `yarn test` — explicitly human-approved 2026-07-09. `yarn start-backend` remains forbidden (live Ableton/OSC).

Requires explicit human approval:

- Anything under "Physical-installation safety rules"
- New dependencies, stack changes, build-tool changes
- Data-model or CSV-schema changes
- New network protocols, ports, or event names
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
- You'd need to change musical/timing/mapping assumptions.
- Tests would require contacting Ableton, hardware, or the network.
- You find data loss risk, security issues (e.g. committed credentials), or conflicting instructions.
- Two docs contradict each other.
