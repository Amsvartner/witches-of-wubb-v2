# Hardware integration

Status: observed from `Arduino/` sketches and backend code. **Entirely out of scope for the current frontend-only phase (ADR-004)** — kept as reference. Confirmed 2026-07-09: LEDs light up in the color of the playing clip's category (Vox/Melody/Bass/Drums), driven externally; max volume is limited on the hardware side.

## Rules for agents (strict)

- Do not modify anything in `Arduino/` without explicit human approval — these sketches run on installed hardware.
- Do not run commands that emit OSC, Art-Net/DMX, serial, or network messages to hardware. `yarn start-backend` counts (it opens an OSC client to the lighting server and connects to Ableton).
- Do not change the pillar IP map, ports, WiFi settings, or event names/addresses.
- The Arduino sketches contain committed WiFi credentials (`wubb-net`). Do not copy, log, or reuse them; rotation is an open decision.

## Pillars

- 4 pillars, indexed 0–3 in code, 1–4 in outgoing OSC addresses.
- Identified by static IPs, matched against the frozen map in `backend/event/IncomingEvents.ts` (never edited without approval — see `docs/CODING_GUIDELINES.md`'s "Config conventions"):

  | Pillar (code index) | Pillar (OSC/UI, +1) | IP            |
  | ------------------- | ------------------- | ------------- |
  | 0                   | 1                   | 192.168.0.101 |
  | 1                   | 2                   | 192.168.0.102 |
  | 2                   | 3                   | 192.168.0.103 |
  | 3                   | 4                   | 192.168.0.104 |

  Each RFID reader is told which pillar it is via `PILLAR_IP` in its own gitignored `secrets.h` (WOW-030) — see "RFID readers" and the flashing checklist below. This doesn't change how the backend identifies the pillar (still the sender IP, matched against this same table); it's what makes the sender IP correct for wherever a given device is physically placed. Getting it wrong doesn't crash anything — the backend just can't place that device's tags on any pillar (logged as an unknown-IP warning, WOW-017).

- Each has: speaker (audio path TBD — presumably per-track routing from the Ableton machine's interface), LEDs, RFID reader.

## RFID readers

- M5Stack Core + UHF RFID unit (`Arduino/Unit_RFID_M5Core/`).
- Connect over WiFi (`wubb-net`), send OSC over UDP to the backend (port 9000): `/new/tag [rfid]`, `/departed/tag [rfid]`. Sender IP identifies the pillar.
- Each device's pillar identity is set via `PILLAR_IP` in its own `secrets.h` (WOW-030, see the table above). The sketch prints the configured IP and its derived pillar index (or `UNKNOWN`) over serial at boot, before attempting to connect to Wi-Fi, so a mis-flashed device is diagnosable over serial even if it then hangs waiting for a connection.
- Tag IDs: 24-hex-char EPCs (see CSV). Polling interval, RF power, multi-tag behavior: TBD.

## Flashing checklist (WOW-030)

Before flashing the RFID reader sketch onto a device (Wi-Fi credentials are not covered by this checklist — they stay hardcoded in the sketches until WOW-028 lands and moves them into `secrets.h`):

1. Copy `Unit_RFID_M5Core/secrets.h.example` to `secrets.h` in the same directory.
2. Set `PILLAR_IP` in `secrets.h` to the address matching wherever this physical device is being placed (see the pillar table above). Double-check against the physical installation, not just the box the device came out of — a device that travels between pillars between shows is exactly the failure mode this exists to catch.
3. Confirm `secrets.h` is untracked (`git status` should not list it — `.gitignore` covers `Arduino/**/secrets.h`).
4. Compile and flash as before; no other setup changed.
5. **First flash after WOW-030**: watch the serial monitor at boot and confirm "Derived pillar index" matches the intended pillar before walking away from the device. While there, this is also the moment to bench-check two pre-existing behaviors WOW-030 noticed but deliberately did not change (out of that ticket's scope): `WiFi.config(ip)` is called without gateway/subnet arguments, and `setup()` loops forever if Wi-Fi never connects (no timeout, no fallback). If either causes a real problem against the venue AP, stop and report rather than silently working around it — see `docs/DECISIONS_NEEDED.md`.

## Speakers / audio routing

- TBD. Audio comes from Ableton Live; how 4 tracks map to 4 physical speakers (interface, amps, wiring) is not in this repo.

## LED controllers

- ESP + FastLED driving WS2812 strips (144 LEDs per node, data pin 2), receiving Art-Net (`Arduino/ArtnetWifiFastLED/`), example static IP 192.168.0.65.
- Art-Net is produced by an external lighting server (`LIGHTING_SERVER_ADDRESS`, default 127.0.0.1:9001) which receives OSC event mirrors from the backend (`/:pillar/:eventName`). Lighting server software: TBD.
- Wi-Fi reconnect (WOW-029): `loop()` monitors `WiFi.status()` and retries `WiFi.begin()` with exponential backoff (1s → 30s cap) on disconnect, intended to resume normal Art-Net reception automatically once the AP returns — no power-cycle needed. **Not yet bench-confirmed**: `artnet.begin()` (the UDP listener setup) only runs once at boot, never re-armed on reconnect — whether the underlying socket survives a Wi-Fi bounce without rebinding is genuinely unverified (code-review-only, no compiler/hardware access); this is the #1 thing the human bench test needs to check before relying on this. **What the LEDs visibly show while disconnected is a separate, still-open decision** (`docs/DECISIONS_NEEDED.md`, "Hardware / firmware") — today they simply hold whatever frame Art-Net last set, unchanged, pending that decision.

## Computers

- One machine runs Ableton Live + backend + (presumably) the UI and lighting server. OS: TBD (README covers macOS and Windows). Process supervision: TBD (nodemon observed — dev-grade).

## Communication protocols summary

| Link                        | Protocol                | Port       | Direction |
| --------------------------- | ----------------------- | ---------- | --------- |
| RFID reader → backend       | OSC/UDP                 | 9000       | in        |
| Backend → lighting server   | OSC/UDP                 | 9001       | out       |
| Lighting server → LED nodes | Art-Net/UDP             | 6454 (std) | out       |
| Backend ↔ UI                | socket.io/WS            | 3335       | both      |
| Backend ↔ Ableton           | ableton-js local socket | n/a        | both      |

## Startup / shutdown

- TBD. Known constraint: backend `StartAbleton()` must connect to a running Ableton set before servers are useful. Order, scripts, and recovery procedures unknown.

## Failure modes (known/suspected)

- LED node loses WiFi → reconnects automatically with backoff (WOW-029, not yet bench-confirmed whether Art-Net reception resumes without a rebind — see "LED controllers" above); LEDs hold their last frame during the outage pending a fallback-state design decision (`docs/DECISIONS_NEEDED.md`)
- Reader loses WiFi → tags silently missed (TBD: any heartbeat?)
- Ableton not running → backend startup fails (TBD: retry behavior)
- Clip name mismatch CSV↔Ableton set → tag maps but nothing plays (logged warning)
- Lighting server down → OSC sends error-logged, audio unaffected (per `LightingAdapter.ts`/`OutgoingEvents.ts`)
- 3-minute inactivity timeout stops all clips by design — not a failure
