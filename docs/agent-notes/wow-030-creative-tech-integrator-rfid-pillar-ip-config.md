# WOW-030 — RFID reader pillar identity: move per-device IP to secrets.h + document

- Role: creative-tech-integrator (implementer)
- Date: 2026-07-12
- Branch: `feat/wow-030-rfid-ip-config`, stacked on `feat/wow-029-wifi-reconnect` (itself stacked on `feat/wow-028-wifi-secrets`) — both still-unmerged branches touch this ticket's allowed files (`feat/wow-028-wifi-secrets` touches `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino`, `Arduino/Unit_RFID_M5Core/secrets.h.example`, `docs/HARDWARE_INTEGRATION.md`, `docs/DECISIONS_NEEDED.md` directly — all four of this ticket's allowed files; `feat/wow-029-wifi-reconnect` additionally touches the latter two docs files), so branching from the tip of that chain avoids conflicts with either.

## Ticket

WOW-030 — see `docs/TICKETS_002_BUGS.md`. No stop condition triggered during implementation: the one stop condition this ticket defines ("Bench reveals the `WiFi.config` gateway/subnet gap actually breaks broadcast on the venue AP → stop and report before widening scope") can only fire during a human's bench test, which hasn't happened yet — flagged prominently below and in the docs so it isn't missed when it does.

## What was done

1. **Per-device IP moved into `secrets.h`**: `Arduino/Unit_RFID_M5Core/Unit_RFID_M5Core.ino`'s `IPAddress ip(192, 168, 0, 52); // UPDATE ME!!!` (a hardcoded default that matched no pillar, silently dropped by the backend) replaced with `IPAddress ip = PILLAR_IP;`, reading from a new `PILLAR_IP` macro in `secrets.h` (gitignored, per-device, established by WOW-028's `secrets.h` pattern). `Arduino/Unit_RFID_M5Core/secrets.h.example` documents all four pillar/IP pairs in a comment and ships a valid (Pillar 0) default that must be deliberately confirmed or changed per device.
2. **Documented in `docs/HARDWARE_INTEGRATION.md`**: "Pillars" section now has an explicit pillar↔IP table (both the 0-indexed code convention and the 1-indexed OSC/UI convention — see "Design decisions" below for why both) next to a pointer at the backend's actual frozen map; "RFID readers" section explains the new `PILLAR_IP` config and the boot-time diagnostic; "Flashing checklist" section (renamed to cover WOW-028 + WOW-030) gained an RFID-specific step for setting `PILLAR_IP` correctly and a first-flash step to watch the serial monitor.
3. **Boot-time serial diagnostic**: new `printPillarIdentity()`, called at the very top of `setup()` (right after `Serial.begin()`, before the Wi-Fi connect attempt that can block forever) prints the configured IP and a derived pillar index — or `UNKNOWN` with an explanatory message if the configured IP doesn't match any of the four frozen addresses. The derivation (`pillarNumberForIp()`) is a small local mirror of the backend's `IP_ADDRESS_TO_PILLAR_INDEX_MAP` logic, for diagnostics only — it does not replace or reference the backend's map (which stays the single source of truth for actual tag routing), and getting `PILLAR_IP` wrong doesn't change any runtime behavior beyond what the backend already does today: an unmapped IP's tags currently go nowhere (no unknown-IP warning exists yet on this branch's ancestry — that's WOW-017's still-unmerged addition, not yet real here; today it's a silent no-op inside a generic catch-and-log with no IP or unknown-pillar framing).
4. **Decision-needed entry recorded**: `docs/DECISIONS_NEEDED.md`'s existing "Hardware / firmware" section (created by WOW-029) gained a second sub-decision — whether to eventually carry pillar id explicitly in the OSC payload instead of deriving it from source IP. Recorded with options and a recommendation (no action needed now; a middle-ground reconciliation-check option is the more attractive path if ever revisited), explicitly marked as not blocking this ticket's landing.

## Design decisions

- **`PILLAR_IP` is a single, independently-set value — not derived from a separate `PILLAR_NUMBER` define.** Considered defining `PILLAR_NUMBER` (0-3) and computing `PILLAR_IP` from it via `101 + PILLAR_NUMBER` arithmetic, but rejected: that creates two hand-editable-looking values that could disagree (e.g. someone edits one and not the other), and the arithmetic itself is a place to introduce an off-by-one that I cannot compile-check. A single `PILLAR_IP` value, cross-checked against the documented table by eye at flash time and again by the boot-time diagnostic's derived pillar index, has one fewer failure mode.
- **The boot diagnostic derives the pillar index rather than requiring a second hand-set value**, specifically so there's no way for a "declared pillar number" and "configured IP" to silently disagree — the printed pillar index is always a pure function of the IP that's actually in effect at runtime, matching exactly what the backend will independently derive from the same IP when a packet arrives.
- **The diagnostic prints the 0-indexed "code convention" pillar index, explicitly labeled as such, not the 1-indexed OSC/UI-facing number.** `docs/HARDWARE_INTEGRATION.md` already documents both conventions ("indexed 0–3 in code, 1–4 in outgoing OSC addresses") and I confirmed the 1-indexed one is real by reading `backend/event/OutgoingEvents.ts:11-13` (`const pillar = (data?.pillar as number) + 1; ... /${pillar}/${eventName}`) — human-facing OSC addresses and `AbletonAdapter.ts` log lines add 1 for display, but the backend's actual routing table (`IP_ADDRESS_TO_PILLAR_INDEX_MAP` in `backend/event/IncomingEvents.ts`, which this ticket documents but never edits) is 0-indexed, and that's the ground truth this diagnostic exists to mirror. Labeled explicitly in both the serial output text and the doc table so a human at a bench with two valid-looking pillar numbers in front of them (a serial monitor and, say, a physical sign) isn't left guessing which convention is which.
- **The diagnostic prints before the Wi-Fi connect attempt, not after.** `setup()`'s existing `while (WiFi.status() != WL_CONNECTED) { delay(1000); }` loop has no timeout — per the ticket's own "note in passing," this can block forever if Wi-Fi is unavailable. Printing the configured IP/pillar first means a device that hangs there still tells a human at the serial monitor which pillar it thinks it is, before potentially going silent. This is an ordering choice only — no existing behavior changed, nothing added to the blocking loop itself.

## What was deliberately NOT done (flagged for the human bench test, not fixed)

Per the ticket's own "note in passing for the implementer" and its stop condition, two pre-existing behaviors were noticed but not touched, since fixing either would be scope beyond what this ticket asked for and neither can be verified without hardware:

- `WiFi.config(ip)` (`Unit_RFID_M5Core.ino`, now line ~150) is called with only the IP argument — no gateway/subnet mask. Whether this matters depends on the venue AP's configuration, which no agent can inspect.
- `setup()`'s Wi-Fi connect loop has no timeout or fallback — a device that never reaches the AP hangs in `setup()` indefinitely (never reaches the RFID init below it, never sends its bootup OSC message).

Both are now called out explicitly in `docs/HARDWARE_INTEGRATION.md`'s flashing checklist as first-flash bench-check items, with a pointer back to this ticket's stop condition: if either causes a real problem against the venue AP, the instruction is to stop and report, not silently work around it in a follow-up.

## Validation

- [x] `yarn lint` clean
- [x] `npx tsc --noEmit` (root) clean
- [x] `npx tsc --noEmit -p backend/tsconfig.json` clean
- [x] `yarn test` — 68/68 (this branch's ancestry is main → WOW-028 → WOW-029 → this ticket; it does not include the sibling WOW-015/WOW-025/WOW-031 branches' new backend tests, since those are separate unmerged branches not in this chain — expected, not a regression)
- [x] `yarn build` clean
- [ ] Compile/flash/bench-verify one RFID reader against the real backend — **human-only, cannot be done by an agent** (ticket's own "Required tests/checks: human compile/flash + bench verification; agents review only")

## Safety checklist

- [x] No changes under `src/assets/Music Database.csv`, `.env` — N/A
- [x] `Arduino/` changes made **with** explicit authorization — this run's standing constraints grant backend/firmware file access, and this exact file is this ticket's named allowed file
- [x] Pillar-IP map in the backend (`backend/event/IncomingEvents.ts`) — **untouched**, confirmed via `git diff` scoped to this ticket's 4 allowed files only
- [x] No new/renamed OSC addresses or payload shape changes — `/new/tag [rfid]` / `/departed/tag [rfid]` unchanged
- [x] hardware-safety-reviewer sign-off — **mandatory per this ticket's own safety notes** — requested in PR
- [x] Never compiled or flashed — code-review-only, matching this ticket's own "agents review only" constraint and this run's standing never-touch-real-hardware rule

## Status

Implementation complete, not yet gated. This ticket's acceptance criteria require a human bench-verification step regardless of review outcome ("human bench-verifies one reader end-to-end against the real backend on a hardware day") — matching WOW-028/WOW-029's pattern, this PR can reach a clean review state but not a fully "gated" one in this run.
