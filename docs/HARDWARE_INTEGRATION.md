# Hardware integration

Status: observed from `Arduino/` sketches and backend code. **Entirely out of scope for the current frontend-only phase (ADR-004)** — kept as reference. Confirmed 2026-07-09: LEDs light up in the color of the playing clip's category (Vox/Melody/Bass/Drums), driven externally; max volume is limited on the hardware side.

## Rules for agents (strict)

- Do not modify anything in `Arduino/` without explicit human approval — these sketches run on installed hardware.
- Do not run commands that emit OSC, Art-Net/DMX, serial, or network messages to hardware. `yarn start-backend` counts (it opens an OSC client to the lighting server and connects to Ableton).
- Do not change the pillar IP map, ports, WiFi settings, or event names/addresses.
- The Arduino sketches contain committed WiFi credentials (`wubb-net`). Do not copy, log, or reuse them; rotation is an open decision.

## Pillars

- 4 pillars, indexed 0–3 in code, 1–4 in outgoing OSC addresses.
- Identified by static IPs: 192.168.0.101–104 (`backend/event/IncomingEvents.ts`).
- Each has: speaker (audio path TBD — presumably per-track routing from the Ableton machine's interface), LEDs, RFID reader.

## RFID readers

- M5Stack Core + UHF RFID unit (`Arduino/Unit_RFID_M5Core/`).
- Connect over WiFi (`wubb-net`), send OSC over UDP to the backend (port 9000): `/new/tag [rfid]`, `/departed/tag [rfid]`. Sender IP identifies the pillar.
- Tag IDs: 24-hex-char EPCs (see CSV). Polling interval, RF power, multi-tag behavior: TBD.

## Speakers / audio routing

- TBD. Audio comes from Ableton Live; how 4 tracks map to 4 physical speakers (interface, amps, wiring) is not in this repo.

## LED controllers

- ESP + FastLED driving WS2812 strips (144 LEDs per node, data pin 2), receiving Art-Net (`Arduino/ArtnetWifiFastLED/`), example static IP 192.168.0.65.
- Art-Net is produced by an external lighting server (`LIGHTING_SERVER_ADDRESS`, default 127.0.0.1:9001) which receives OSC event mirrors from the backend (`/:pillar/:eventName`). Lighting server software: TBD.

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

- Reader loses WiFi → tags silently missed (TBD: any heartbeat?)
- Ableton not running → backend startup fails (TBD: retry behavior)
- Clip name mismatch CSV↔Ableton set → tag maps but nothing plays (logged warning)
- Lighting server down → OSC sends error-logged, audio unaffected (per `LightingAdapter.ts`/`OutgoingEvents.ts`)
- 3-minute inactivity timeout stops all clips by design — not a failure
