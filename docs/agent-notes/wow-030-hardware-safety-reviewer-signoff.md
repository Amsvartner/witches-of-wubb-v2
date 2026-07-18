# WOW-030 PR #31 (RFID reader pillar IP config) — hardware-safety-reviewer sign-off

- Reviewer: hardware-safety-reviewer (Claude Sonnet 5, required specialist review per ticket)
- Date: 2026-07-12
- Fork/repo reviewed: `Amsvartner/witches-of-wubb-v2` (`origin` remote)
- Review target: PR #31, head commit `8d89e89`, diffed against its immediate base `feat/wow-029-wifi-reconnect`.
- Method: read-only, isolated `git worktree` pinned to the review SHA (adopted per both WOW-031 reviewers' recommendation after the shared-checkout race incident discovered earlier in this run).

## Verdict: **APPROVE**

## Process note from the reviewer

This worktree's on-disk `main` predated WOW-028/029, so files like `docs/HARDWARE_INTEGRATION.md`/`.gitignore` read directly off disk were stale relative to the PR's actual base. The reviewer caught this itself and re-verified every such file against the real `feat/wow-029-wifi-reconnect` ref via `git show`/`git diff` instead of trusting the on-disk copy — `AGENTS.md`, `docs/ARCHITECTURE.md`, `backend/event/IncomingEvents.ts`, and `backend/event/OutgoingEvents.ts` were independently confirmed byte-identical between the worktree's HEAD and the PR base, so those specific reads were trustworthy as-is. Its first pass at `.gitignore` (checked against the stale on-disk copy) wrongly suggested no `Arduino/**/secrets.h` coverage; corrected itself by re-reading against the real base ref and confirmed coverage is actually present.

## Findings

**1. (minor)** `Serial.println(pillar)` — a bare `int` — has no exact in-repo precedent (existing calls print string literals, `String` concatenations, or `WiFi.localIP()`, an `IPAddress`). `Print::println(int)` is nonetheless one of the most foundational Arduino/ESP32 core overloads, not novel or exotic. This is diagnostic-only code, gated behind a human compile step before any flash (agents never compile/flash), so a hypothetical signature problem would surface at compile time, never on live hardware. No action required.

**2. (minor, pre-existing, out of scope)** `AGENTS.md:56` still states the Arduino sketches "contain committed WiFi credentials — do not copy these anywhere else," which became false once WOW-028 (already an ancestor of this PR) moved credentials into gitignored `secrets.h`. Not introduced by or in scope for WOW-030, but worth a documentation-maintainer follow-up since the stale premise could mislead a future agent about what's actually sensitive now (`secrets.h`, including the new `PILLAR_IP`, deserves the same don't-copy/don't-log discipline the stale line only assigns to the sketch body).

**3. (informational, non-issue)** The new `docs/agent-notes/wow-030-*.md` file isn't literally one of WOW-030's four named allowed files, but matches this run's standard per-ticket documentation location. No code/behavior impact.

**4. (informational, non-issue)** Checked whether `docs/DECISIONS_NEEDED.md`'s new sub-decision ending "Blocked until human confirms: yes" contradicts the PR's framing of that decision as non-blocking. Checked two existing entries in the same file (lines 25, 61) — every entry uses "yes" regardless of urgency; the field tracks whether the decision itself is still open, not whether it gates this specific PR. No actual inconsistency.

## Verified / confirmed correct

- **Core safety question**: `loop()` is byte-identical between base and head (diffed directly). All OSC send sites (`/new/tag`, `/departed/tag`, the boot `/bootup/device` message) are untouched. The only substantive change is `IPAddress ip(192, 168, 0, 52);` → `IPAddress ip = PILLAR_IP;` (same type, same single assignment, value now sourced from `secrets.h`) plus two new pure-diagnostic functions and one new call site in `setup()`.
- **Frozen backend map untouched**: `backend/event/IncomingEvents.ts` does not appear anywhere in `git diff feat/wow-029-wifi-reconnect..8d89e89 --name-only`. Independently read the file directly to get the ground-truth map for cross-checking the new diagnostic logic (below).
- **No OSC contract change**: addresses/payloads byte-identical; no new event names.
- **`pillarNumberForIp()`/`printPillarIdentity()` correctness**: brace-balanced (base 33/33, head 39/39, exactly the three new pairs in each function). `IPAddress::operator[]` usage is standard and consistent with this file's existing `IPAddress ip(a,b,c,d)` construction convention. The `lastOctet - 101` arithmetic cross-checked exactly against the real backend map (101→0, 102→1, 103→2, 104→3 — exact match), and the range guard exactly covers the map's four entries with no gap or over-inclusion.
- **Ordering safety**: `uhf.begin(...)` (RFID hardware init) stays at the same relative position; `printPillarIdentity()` itself does only two `Serial.print` calls and integer comparisons — no loops, no delays, no network calls, introduces no new blocking behavior.
- **The two deliberately-untouched issues** (`WiFi.config(ip)` missing gateway/subnet; the unbounded Wi-Fi connect loop): confirmed genuinely unchanged, line-content-identical in base and head. Confirmed explicitly flagged in `docs/HARDWARE_INTEGRATION.md`'s updated flashing checklist as first-flash bench-check items with a pointer back to this ticket's own stop condition — not silently dropped, not silently fixed.
- **Docs accuracy**: the new pillar↔IP table matches the real backend map exactly; the 0-indexed ("code convention") vs. 1-indexed ("OSC/UI, +1") distinction is used consistently everywhere it appears, and the +1 OSC claim was independently verified against `backend/event/OutgoingEvents.ts:11-13`.
- **`secrets.h.example` diff**: no real credentials introduced; `WIFI_SSID`/`WIFI_PASSWORD` placeholders unchanged from WOW-028's existing pattern. The new `PILLAR_IP` default (`192.168.0.101`) is one of the four pillar addresses already committed and public inside `backend/event/IncomingEvents.ts` — not a new secret.
- **Other hardware-safety concerns**: `LightingAdapter.ts` and all volume-related backend files are untouched by this diff — no strobe or volume path affected. Scanned the full diff text for prompt-injection-style content directed at reviewing agents; found none.

## Summary

This PR does exactly what the ticket describes: relocates a hardcoded IP literal into gitignored per-device config, adds purely additive/non-blocking read-only serial diagnostics, and documents — without editing — the frozen pillar-IP map, while explicitly and correctly declining to touch the two adjacent pre-existing issues it noticed. Four minor/informational findings, none requiring changes before merge. The mandatory human compile/flash/bench-verify gate remains intact and undisturbed.
