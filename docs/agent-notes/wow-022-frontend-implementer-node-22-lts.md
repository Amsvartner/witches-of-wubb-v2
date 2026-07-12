# WOW-022 — Pin Node 22 LTS across engines/.nvmrc/CI

- Role: frontend-implementer (implementer; ticket's suggested agents are "frontend-implementer or test-engineer, reviewer" — picked frontend-implementer since this is config/tooling, not test authoring)
- Date: 2026-07-12
- Branch: `feat/wow-022-node-22-lts`, branched fresh from `origin/main` (no stacking)

## Ticket

WOW-022 — see `docs/TICKETS_002_BUGS.md`. CI pinned Node 21 (never LTS, now EOL, excluded by Vite ≥6's engine range); no `engines` field or `.nvmrc` existed anywhere.

## Stacking decision

`README.md` is nominally one of this ticket's allowed files and is also touched by the still-unmerged `feat/wow-032-startup-timeout` branch (and everything stacked on top of it: WOW-018, WOW-020, WOW-021, WOW-031) — but checked the actual content, not just the file name, before deciding whether to stack (matching WOW-024's earlier precedent of the same distinction). WOW-032's README change is a new "Troubleshooting: backend hangs or exits at startup" subsection inserted after line ~55 (under "Starting the backend"); this ticket's one-line edit is at line 11, under "## Setup," in the pre-existing Node-version sentence — different sections, both purely additive, no realistic line-level conflict. No other unmerged branch touches any of this ticket's other three allowed files (`.github/workflows/ci.yml`, `package.json`/`backend/package.json` engines fields, `.nvmrc` — confirmed via `git diff --stat main <branch> -- <these 5 files>` against every unmerged branch from this run; all empty except the README case just discussed). Branched fresh from `main`.

## What was done

1. Root `package.json`: added `"engines": { "node": ">=22 <23" }`.
2. `backend/package.json`: added the same `"engines": { "node": ">=22 <23" }`.
3. `.nvmrc` (new): `22`.
4. `.github/workflows/ci.yml`: `node-version: 21` → `node-version: 22`.
5. `README.md`: "You should have `node` (version 21+) installed..." → "You should have `node` 22 (LTS — see `.nvmrc`/`engines` in `package.json`) installed...".

No dependency changes — matches the ticket's explicit "Out of scope: dependency upgrades (WOW-009); coverage-provider swap" and acceptance criterion "no dependency changes." `@vitest/coverage-c8` (deprecated upstream) was deliberately left alone per the ticket's own note that the swap belongs to WOW-009.

## Verification under actual Node 22 (not just CI)

The ticket asks to "verify `yarn build`, `yarn test`, `yarn lint` under Node 22 before landing." This machine has `nvm` with several Node 22.x versions already installed (`v22.15.1`, `v22.18.0`, `v22.19.0`, `v22.22.0`). `source ~/.nvm/nvm.sh` itself failed in this sandboxed shell (exit code 3, no output — some part of nvm's shell-function setup doesn't play well with the non-interactive sandboxed bash here); worked around it by prepending the Node 22.22.0 install's `bin/` directly onto `PATH` for the validation commands, which is equivalent for running `node`/`npx`/yarn-invoked scripts without needing nvm's shell function at all.

- [x] `node --version` under this PATH — confirmed `v22.22.0`.
- [x] `yarn lint` — clean under Node 22.
- [x] `npx tsc --noEmit` (root) — clean under Node 22.
- [x] `npx tsc --noEmit -p backend/tsconfig.json` — clean under Node 22.
- [x] `yarn build` — **confirmed exit code 0** under Node 22, run in isolation to get an unambiguous result (see the contamination note below for why the first combined run looked alarming).
- [~] `yarn test` — genuinely ran and passed every real assertion under Node 22, but the file/test _count_ was inflated and 2 files hard-failed at the transform stage — see below. This is an environmental artifact of this exact moment, not a Node-22 regression; re-verify with a clean count once possible (see "Open item" below).

### Environmental finding: concurrent isolated-worktree background agents contaminate `yarn test`/`yarn build`'s file discovery

While this ticket's validation ran, two background reviewer subagents for WOW-030 were active in isolated git worktrees nested _inside_ this repo's own working tree, at `.claude/worktrees/agent-<id>/` (confirmed via `git worktree list` — both worktrees are subdirectories of this same checkout, not sibling directories elsewhere on disk). Vite's tooling (`vite-tsconfig-paths` for build, vitest's own per-file tsconfig auto-discovery for test) does its own filesystem walk to locate `tsconfig.json` files and doesn't stop at git-worktree boundaries — it found `.claude/worktrees/agent-*/backend/tsconfig.json` (each nested worktree being a _full_ copy of the repo at some pinned SHA) and, for `yarn build`, non-fatally logged (didn't throw) a `TSConfckParseError` because that nested worktree's `@tsconfig/recommended` package wasn't resolvable from its path — build still completed and exited 0. For `yarn test`, vitest's default include glob picked up the _duplicate_ test files living inside both nested worktrees in addition to this checkout's own — file count went from a real 13 to an inflated 39 (~3x, consistent with 1 real + 2 nested copies) and test count from 68 to 202 passed, with exactly 2 of the 39 files hard-failing at the exact same tsconfig-resolution error build only warned about.

This is not a bug in this ticket's change, not a Node-22 regression, and not something in scope to fix here (`vite.config.ts` isn't in this ticket's allowed files, and the actual root cause — `isolation: "worktree"` background agents nesting their checkout under `.claude/worktrees/` inside the main tree — is an orchestration-level detail of this run, unrelated to Node version pinning). Both reviewer worktrees are read-only agents and should auto-clean-up on completion per the Agent tool's own documented behavior, at which point a `yarn test` re-run should return to the real, uncontaminated 13-file/68-test baseline. Flagging this as a second distinct concurrent-background-agent hazard this run has now surfaced (the first being the shared-checkout race discovered during WOW-031's reviews, which led to adopting worktree isolation in the first place) — worth a follow-up note for whoever maintains this run's process going forward: broad-glob tools (vite, vitest, and potentially others) should probably have `vite.config.ts`'s test/build config exclude `.claude/worktrees/` explicitly, independent of any single ticket.

**Open item**: re-run `yarn test` under Node 22 once no background-agent worktrees are active, to get a clean, uncontaminated count. Not blocking — lint, both tsc checks, and build are all independently and unambiguously clean under Node 22, and the contamination's own failure signature (tsconfig-resolution against a _nested worktree path_, not against this repo's own real tsconfig) makes it clearly identifiable as environmental rather than a real regression even in the noisy run.

## Human-only remaining action (per ticket's own safety note)

"The backend process runs under this Node in production — flag the bump to the human for a hardware-day smoke before it's used at the venue." Recorded here and in the PR body; not a blocker for this PR itself (which is a dev/CI-tooling change), but the actual production Node runtime switch should get a real smoke test on the show machine before relying on it live.

## Safety checklist

- [x] No dependency changes (confirmed via diff — only `engines`/`.nvmrc`/CI/README touched)
- [x] `engines` + `.nvmrc` + CI all agree on `22`
- [x] No hardware/Ableton/LED/RFID code touched
- [x] Human hardware-day smoke test flagged (see above) — not required for this PR's own gate, ticket doesn't ask for hardware-safety-reviewer sign-off (not in its "Suggested agent(s)" line, "Risk: low")

## Status

Implementation complete. Lint/tsc(x2)/build independently verified clean under real Node 22.22.0. `yarn test` needs one clean re-run once concurrent background-worktree contamination clears (see above) — tracking as a follow-up verification step, not a code change.
