# Self-hosted web fonts

Vendored for the WOW-007A play-mode visual spike (typography direction C,
human-approved 2026-07-15). Self-hosted per `DESIGN_PROPOSAL_001.md` §8.2 —
**never hotlinked**. `@font-face` declarations live in `src/index.css`.

All three families are licensed under the **SIL Open Font License 1.1**
(<https://openfontlicense.org>). Files are the **latin subset** WOFF2 as served
by Google Fonts.

| File                      | Family        | Weight | Version | Copyright / source                                                         |
| ------------------------- | ------------- | ------ | ------- | -------------------------------------------------------------------------- |
| `marcellus-regular.woff2` | Marcellus     | 400    | v14     | © 2011 The Marcellus Project Authors (Astigmatic). OFL 1.1.                |
| `ibm-plex-sans-400.woff2` | IBM Plex Sans | 400    | v23     | © 2017 IBM Corp. OFL 1.1.                                                  |
| `ibm-plex-sans-600.woff2` | IBM Plex Sans | 600    | v23     | © 2017 IBM Corp. OFL 1.1.                                                  |
| `source-sans-3-400.woff2` | Source Sans 3 | 400    | v19     | © 2010–2020 Adobe (<https://github.com/adobe-fonts/source-sans>). OFL 1.1. |
| `source-sans-3-600.woff2` | Source Sans 3 | 600    | v19     | © 2010–2020 Adobe. OFL 1.1.                                                |

Roles (see `src/index.css` / `tailwind.config.cjs`):

- **Marcellus** — `font-display`: wordmark, pillar/category names, key glyph.
- **IBM Plex Sans** — `font-data`: UI, status, labels, log.
- **Source Sans 3** — `font-number`: numbers + units (BPM, volume %).
