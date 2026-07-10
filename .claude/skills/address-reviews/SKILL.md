---
name: address-reviews
description: Pull open review feedback on a WOW PR or branch (agent review notes, PR comments, human comments), group by severity, address every finding, rerun validations, summarize fixes, then commit. Use when asked to address, resolve, or respond to review findings or PR comments.
argument-hint: [PR number or WOW-XXX — defaults to the current branch's ticket]
---

# Address Reviews

Run the review-response loop on one branch/PR. All rules in `AGENTS.md` apply. Target: $ARGUMENTS

Invoking this skill is explicit authorisation for commits **on the feature branch only** — never `main`, never a push to `main`.

## 0. Preflight

1. Resolve the target: PR number → `gh pr view` (if `gh` is available); else the current branch's WOW ticket. Nothing resolvable → stop and ask.
2. If the branch is `main`, stop. Working tree not clean → stop and report what's uncommitted.

## 1. Collect feedback from every source

- Agent review notes: unresolved findings in `docs/agent-notes/wow-<nnn>-*-review.md`
- **Copilot and human inline threads**: unresolved threads via the GraphQL reviewThreads query (`isResolved: false` only), review bodies via `gh api repos/{owner}/{repo}/pulls/<n>/reviews`, conversation via `gh pr view --comments`
- Anything the human pasted into chat

## 2. Group by severity, then fix

Present one consolidated list before changing anything:

- **Blocker** — touches disallowed files (`backend/`, `Arduino/`, CSV, `.env`), breaks the socket event contract, unsafe volume/flicker behavior, scope violations.
- **High** — correctness bugs, missing required tests, broken acceptance criteria.
- **Medium** — error handling, validation gaps, test hardening, a11y misses (contrast, touch targets).
- **Low/nit** — style, naming, docs polish.

Address every Blocker/High/Medium; Low items get a fix or one-line rationale. Stay inside the ticket's allowed files — a finding that requires leaving them is a stop-and-ask.

## 3. Validate and close out

`yarn lint`, `yarn test`, simulator demo re-check where UI behavior changed. Update the review note(s) with a "Fixes" section mapping finding → commit. Commit with a message referencing the ticket. Summarize: findings by severity, what changed, what was rationalized instead of fixed, fresh validation results.

## 4. Resolve the PR threads

After the fix commit is pushed, close every addressed inline thread on the PR — a fixed finding left "unresolved" fails the gate and misleads the next reviewer:

1. **Reply first, then resolve** — each thread gets a reply stating what happened before it is resolved, so the resolution is auditable in place:
   - Fixed → `Fixed in <short-sha> — <one line on the change>.` (`gh api "repos/{owner}/{repo}/pulls/<n>/comments/<comment-id>/replies" -f body=...` — note: `gh pr edit --add-reviewer Copilot` and thread APIs vary; comment ids come from the reviewThreads GraphQL query)
   - Rationalized, not fixed → reply with the reasoning (reference the repo rule or ADR that justifies it), then resolve.
2. Resolve via GraphQL: `gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<PRRT_...>"}) { thread { isResolved } } }'` for each thread id from the same reviewThreads query used in step 1.
3. Verify zero unresolved threads remain (`reviewThreads` filtered on `isResolved: false` must be empty) and confirm in the summary.
4. Never resolve a thread that was neither fixed nor given a written rationale — leave it open and list it in the summary as outstanding.
