# Project brief — Witches of Wubb

## What this is

An interactive music art installation. Four physical pillars stand in a space. Each pillar has a speaker, programmable LEDs, and a UHF RFID reader. Hundreds of physical objects ("ingredients" — potions, trinkets, themed props) have RFID stickers underneath. When a visitor places an object on a pillar, that pillar's reader detects the tag and a music clip unique to that object plays through Ableton Live.

Every clip belongs to one category — **Vox, Melody, Bass, Drums** (ADR-002). Clips are key-matched, BPM-matched, and quantized to shared musical phrases, so any combination of objects across pillars produces coherent music. Visitors are effectively casting "spells" — the UI names combinations with playful spell names and suggests recipes ("grimoire").

## Visitor experience

A visitor picks objects, places them on pillars, and hears the music change. LEDs respond to what's playing (lighting is driven by an external lighting server via OSC — details TBD). If nothing happens for 3 minutes, the system stops all clips and returns to an attractor state.

## What the UI is for

The web UI runs on a **single touch screen (1280×1024 in portrait → effective 1024×1280) physically embedded in a very large grimoire prop**. It currently shows: currently playing clips per pillar, a spell name and recipe suggestions, tempo slider, key adjuster/lock, and a hidden debug modal (per-pillar volume, simulated tag placement). Decided (ADR-003/005/006, PRD F1–F6): the rework makes the visitor display category-centric (category icons + names + legend), removes recipes and spell names, redesigns the operator surface (page vs. overlay TBD, opened by long-press on a themed element), overhauls the visuals — witchy/occult theme, background reading as an extension of the physical grimoire — and modernizes non-Ableton dependencies.

## Actors

- **Visitors** — interact with objects, pillars, and the grimoire touch screen.
- **Guide/operator** — one person who knows the project well assists visitors during shows; needs status, volume, tempo, key, and recovery controls on the operator page.
- **Artists/designers** — own the concept, sample curation, visual identity, and object/clip mapping.
- **Technicians/installers** — set up pillars, network (`wubb-net` WiFi), RFID readers, LEDs, Ableton machine.
- **Developers** — maintain this repo.

## Known constraints

- Runs against a live Ableton Live set; clip names in the set must match the CSV (`src/assets/Music Database.csv`).
- Pillars are identified by hardcoded IP addresses (192.168.0.101–104).
- Musical coherence rules (key lock, transposition, phrase leader, trigger order) are core to the artwork.
- Installation/show environment: unattended visitors, variable lighting, likely noisy.

## Unknowns (TBD)

- New features beyond the confirmed rework scope (see PRD)
- Operator-page access model and page navigation (DECISIONS_NEEDED)
- Browser/kiosk setup on the show machine
- Out of scope but undocumented: lighting server internals (LEDs light in the category's color), show startup/shutdown procedures
