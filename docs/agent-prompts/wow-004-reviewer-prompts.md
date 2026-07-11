# WOW-004 — reviewer prompts

Ticket: WOW-004 — UI audit report (read-only)
Role profile: `.claude/agents/reviewer.md` (read first, plus `AGENTS.md` in full). Read-only — no edits to anything except your verdict note.

Regenerated 2026-07-11 against the post-WOW-011 tree (see the frontend-ui-designer prompt file header for the mapping). Supersedes the 2026-07-10 version.

## Prompt 1 — review the audit diff

Goal:

Strict review of the WOW-004 branch/PR: the diff must be exactly the audit deliverables (docs only), the report must meet every acceptance criterion, and scope discipline must hold (no fixes, no design proposals). End with an explicit verdict.

Context files:

- `AGENTS.md` — guardrails, PR-template requirement, fork rules
- `docs/TICKETS_001_INITIAL.md` — WOW-004 acceptance criteria and out-of-scope list
- The full branch diff vs. `main`
- `docs/UI_AUDIT.md` and the handoff notes: `docs/agent-notes/wow-004-frontend-ui-designer-audit.md`, `docs/agent-notes/wow-004-architecture-reviewer-audit-review.md` (specialist verdict — must exist and pass before you approve)

Allowed files:

- `docs/agent-notes/wow-004-reviewer-verdict.md` — verdict note (only file you may write)

Disallowed files:

- Everything else.

Acceptance criteria to verify (verbatim from ticket):

- Every file in `src/components|contexts|hooks` covered; recipe-removal blast radius listed; issues tagged severity; no fixes made.

> Migration note (annotation, not a change of criteria): post-WOW-011 these directories correspond to `src/component|container|context|hook|screen`; "every file" = the 19-file non-test inventory listed in the frontend-ui-designer prompt file.

Review checklist (ticket-specific):

1. **Diff purity (blocking)**: `git diff main...HEAD --stat` shows only `docs/UI_AUDIT.md`, `docs/agent-notes/wow-004-*.md`, and run-record appends to `docs/agent-prompts/wow-004-*.md`. Any `src/**`, `backend/**`, `Arduino/**`, CSV, or `.env` change is an automatic block ("no fixes made" is an acceptance criterion).
2. **Coverage**: all 19 inventory files (1 component, 6 containers, 10 context files incl. `context/hook|type|util`, 1 hook, 1 screen — list in the frontend-ui-designer prompt file) have substantive sections (spot-check at least three against the actual source for accuracy, not just presence).
3. **Severity tags** on every issue, with file:line evidence; display-target (1024×1280 portrait touch) assessment present; a11y findings present.
4. **Recipe-removal blast radius** section present and consistent with the architecture-reviewer's independent trace.
5. **Visitor/operator inventory** present and complete per ADR-003.
6. **Scope**: no design proposals (WOW-006's job), no backend-change suggestions stated as plans, no invented product decisions — open questions are logged as TBDs/decision-needed entries instead.
7. **Specialist verdict**: architecture-reviewer note exists with approve/approve-with-nits at the current audit content; unresolved blocking items there block here too.
8. **PR hygiene**: PR body fills the template completely (demo section may point at the report + repro steps), targets the fork (`Amsvartner/witches-of-wubb-v2`), Copilot review requested/resolved per repo policy.

Required tests/checks (safe to run):

- `yarn lint`, `yarn test`, `git diff --check`. Optionally reproduce a sampled finding via `yarn sim <scenario>` + `yarn dev`. Never `yarn start-backend`.

Stop conditions:

- Any blocking finding → verdict **block**, cite report section / file:line.
- Contradiction between the two audit notes that you cannot resolve by reading the source → flag for the human rather than adjudicating product intent.

Output:

- `docs/agent-notes/wow-004-reviewer-verdict.md`: findings grouped blocking / should-fix / nit with rationale; explicit final verdict — **approve / approve-with-nits / block**.

### Prompt 1 — run record

_Append after execution: date, executor (model/agent), branch + head SHA, verdict, note path._

- Date: 2026-07-11
- Executor: reviewer subagent / claude-opus-4-8 (high reasoning effort)
- Branch: `docs/wow-004-ui-audit` @ `732c094`
- Verdict: **approve.** All 8 checklist points pass — diff is docs-only (6 files: `UI_AUDIT.md` + 3 agent notes + 2 prompt-file run-record appends; no `src/**`/`backend/**`/`Arduino/**`/CSV/`.env`), 19-file coverage complete (4 spot-checks verbatim-accurate vs source), findings severity-tagged with file:line, recipe blast radius + visitor/operator mapping consistent with the architecture-reviewer trace, scope clean (open items logged as Decision-needed, not acted on), specialist review (architecture-reviewer approve-with-nits, AR-01…AR-06 all resolved) present, PR #13 body complete + targets fork + Copilot 2 rounds/6 threads all resolved. 2 non-blocking nits (RV-01 specialist SHA lags head by 3 cosmetic commits; RV-02 PR pipeline-status placeholder).
- Safe checks: `yarn lint` PASS, `yarn test` 13 files/68 tests PASS, `git diff --check` clean. No `yarn start-backend`/`yarn dev`/`yarn sim`.
- Note: `docs/agent-notes/wow-004-reviewer-verdict.md`
