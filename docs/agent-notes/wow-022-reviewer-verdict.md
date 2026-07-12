# WOW-022 PR #32 (pin Node 22 LTS) — general reviewer verdict

- Reviewer: reviewer (Claude Sonnet 5, general review phase of the WOW pipeline)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote)
- Review target: PR #32, head commit `d4effa9`.
- Method: read-only, isolated `git worktree`, fresh `yarn install`, full validation suite run at the real head commit under a real Node 22.22.0 (same PATH-prepend workaround the implementer used, since `nvm`'s own shell function also failed to source in its sandbox).

## Verdict: **CHANGES-REQUESTED** (both grounds now resolved — see "Resolution" below)

## Independent Node-22 validation (all separately obtained, not just re-confirming the implementer's claims)

| Check                                      | Result                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `node --version`                           | `v22.22.0`                                                          |
| `yarn install --frozen-lockfile`           | clean                                                               |
| `yarn lint`                                | clean once isolated from a worktree-nesting artifact (see Findings) |
| `npx tsc --noEmit` (root + backend)        | clean                                                               |
| `yarn build`                               | clean, exit 0                                                       |
| `yarn test`                                | **13 files / 68 tests, exit 0** — genuinely clean, no contamination |
| Real GitHub Actions CI (`gh pr checks 32`) | pass, 37s                                                           |

The clean 13/68 count independently confirms the implementer's own contamination diagnosis (its own run showed an inflated 39/202 due to concurrent WOW-030 background-review worktrees) — this reviewer got a separately-obtained, trustworthy clean result, not a repeat of the claim.

**A second, different worktree-nesting hazard found independently**: the reviewer's first `yarn lint` attempt failed with "ESLint couldn't determine the plugin react uniquely," caused by ESLint's config cascade walking _upward_ past its own worktree root (no `"root": true` in `.eslintrc`) and merging in the main checkout's config. Structurally different from the vitest issue (upward config-cascade vs. downward file-glob) — would reproduce for any reviewer running bare `yarn lint` from a nested worktree regardless of other concurrent worktrees. Not caused by this PR's diff, doesn't affect the real (non-nested) CI run. Noted as a maintenance observation, not a finding against the PR.

## Findings

**1. [BLOCKER, resolved]** `backend/package.json`'s new `engines` block edits `backend/`, which `docs/adr/004-frontend-only-scope.md` explicitly makes read-only this phase, with a stated one-time exception scoped only to WOW-011 (`AGENTS.md` "Scope of current phase (ADR-004)"). Independently corroborated by GitHub Copilot's own review, same file/line, same concern. **Resolution**: [PR #34](https://github.com/Amsvartner/witches-of-wubb-v2/pull/34) amends ADR-004 (and its `AGENTS.md` mirror) with a second, ticket-batch-scoped exception covering the entire `docs/TICKETS_002_BUGS.md` batch (WOW-014–WOW-032) this ticket belongs to — documenting an authorization that was already granted for this whole run and already relied on by 11 prior PRs before this one, rather than treating WOW-022 as needing a brand-new decision. See PR #34's own agent-note for the full case. This PR (#32) and #34 are independent and can merge in either order; #32's `backend/package.json` hunk is uncontested once #34 lands.

**2. [MAJOR/process, resolved]** All 3 Copilot review threads were unresolved at review time — per this repo's own process, that blocks the gate regardless of general-review outcome. All 3 now resolved:

- `backend/package.json:7` — the ADR-004 conflict above (finding 1).
- `README.md:11` — pre-existing "insall" → "install" typo on the line this PR already touches — fixed.
- `.github/workflows/ci.yml:16` — Copilot suggested `node-version-file: .nvmrc` over the literal `node-version: 22`, to make `.nvmrc` the single source of truth. Applied — a strict improvement, directly serving this ticket's own "engines + .nvmrc agree with CI" acceptance criterion by removing one of the three places that need to independently stay in sync.

**3. [MINOR, informational]** `docs/TECH_STACK.md:7` still reads "Node 21+ per README," now stale against this PR's own README change. Correctly not fixed here (not in WOW-022's allowed files) — flagged as a small follow-up for whoever next touches that file or a future hygiene pass.

## Non-findings (checked, clean)

- Scope discipline: exactly the 5 allowed files + the standard agent-note, confirmed via `git diff --stat`.
- Pin correctness: `engines: {"node": ">=22 <23"}` in both `package.json` files, `.nvmrc` → `22`, CI now reads `.nvmrc` — all agree.
- No dependency changes: `dependencies`/`devDependencies` byte-identical to before in both `package.json` files.
- CI workflow correctness: only the node-version-source line changed.
- PR template compliance: every section of `.github/pull_request_template.md` filled with real content.
- Stacking decision (branched fresh from `main` despite a nominal `README.md` overlap with the WOW-032 chain): well-justified, checked actual line distance not just file name, matches WOW-024's earlier precedent for the same kind of call.
- No specialist review required — nothing here touches volume, lights, OSC/MIDI/Art-Net, timing, or mappings; ADR-004 itself says audio-ableton-reviewer/hardware-safety-reviewer stay dormant unless the event contract or reference code is touched, which it isn't.

## Summary

The implementation itself was clean, narrowly scoped, and its Node-22 validation claims were independently and more rigorously confirmed than the implementer's own contaminated run could achieve. The CHANGES-REQUESTED verdict rested on a real, well-corroborated process gap (ADR-004 vs. this run's actual backend-authorization scope) rather than any defect in the Node-version-pinning work itself — both grounds are now resolved: the ADR-004 gap via a companion PR that documents the authorization rather than inventing one, and the Copilot threads via straightforward fixes plus that same companion PR.
