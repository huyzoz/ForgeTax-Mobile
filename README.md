# ForgeTax Mobile — clean-room remake for Windows (P0)
[![Build Windows](https://github.com/huyzoz/ForgeTax-Mobile/actions/workflows/build-windows.yml/badge.svg)](https://github.com/huyzoz/ForgeTax-Mobile/actions/workflows/build-windows.yml)

A clean-room remake of **ForgeTax: Blacksmith Legends** (Soucean, v3.17.0,
mobile) for weak Windows PCs. Built from the reverse-engineered game logic
(balance numbers, ticket formulas, Fever rules), NOT from the original's
source, assets, sounds or text.

**P0 = the playable forge loop.** Strike → ticket draw → grade/value →
break → Fever → 24 contracts + tribute → win/lose + endless. 8 starter
relics only. No merchant, no dragon fight, no codex — those are P1/P2.

## Stack

- **Tauri 2** (Rust backend + 2D HTML/CSS/JS frontend in WebView2).
  No Bevy, no wgpu, no 3D: the earlier Bevy P0 black-screened on the
  Intel HD 4400 (wgpu fell back to the WARP software renderer), so the
  remake is 2D DOM by design. A 2D DOM scene cannot black-screen the way
  a 3D context can; if the frontend fails to load, the window shows a
  plain error text.
- **forgetax-core** — the pure-logic Rust crate (std-only, zero deps):
  FillDeck/Chances ticket math, mobile break curve, sword valuation,
  Fever, 119-relic registry, 24-round contract run.

## FPS — honest expectations

There is no GPU 3D work in this app, so the HD 4400 is not the bottleneck:
the scene is a handful of composited DOM layers in WebView2 (Edge
Chromium), and the game logic is a few microseconds of Rust per strike.

- **HP EliteBook 840 G1 (i5-4300U / HD 4400 / 8 GB, Windows 11):** the
  2D scene should hold **60 FPS**; the in-game FPS counter (settings →
  Hiện FPS) shows the real number on that machine.
- **Any Windows 10/11 PC with WebView2:** same — 60 FPS expected; the
  only work per frame is DOM compositing and the rAF loop.
- **Weak dual-core / 4 GB machines:** still 60 FPS for the scene; the
  app itself uses tens of MB (no 3D assets, no textures).
- The one thing that can drop frames is the browser's own compositor
  under heavy load (many apps open) — the FPS counter will show it
  honestly if it happens.

## Run it (dev / test)

```sh
# Terminal 1 — serve the frontend + the real core over HTTP:
cargo run -p forgetax-dev-server -- 1420
# Then open http://127.0.0.1:1420/ in a browser.
# (The dev server is a test harness only; the shipped app is the Tauri exe.)
```

## Tests

```sh
cargo test -p forgetax-core
# 80 tests: 62 unit + 5 Economy parity + 12 mobile parity + 1 doc-test.
# Proves: FillDeck nail +4 / pin +2, 24 quotas, mobile break-curve
# plateaus (0.71/0.81/0.89), Fever headless gate, 8-starter pool,
# and a scripted full 24-round run that terminates validly.
```

## Build the Windows exe

Via GitHub Actions (the authoritative gate — the Tauri build never
passes on Linux, missing gdk-3.0):

1. Push to `main` on the build fork (huyzoz) — the `Build Windows`
   workflow runs automatically.
2. It produces an NSIS installer + a portable zip + SHA256SUMS.txt.
3. The release is cut on the home repo (duyzoz) from those artifacts.

The installer is UNSIGNED — Windows SmartScreen will warn on first run.
Check the SHA-256 first.

## Layout

| Path | What it is |
|---|---|
| `forgetax-core/` | Pure game logic (std-only Rust). `src/data.rs` is generated from `tests/fixtures/Economy.txt` (the mobile balance file, kept as provenance). |
| `forgetax-core/tests/` | Parity + mobile-parity + scripted-run tests. |
| `app/src-tauri/` | Tauri 2 backend (commands, settings persistence). |
| `app/frontend/` | 2D UI: `index.html`, `styles.css`, `app.js`, `sound.js`, `i18n.js`. |
| `app/package.json` | Tauri CLI only (no frontend build step — plain files). |
| `tools/dev-server/` | HTTP test harness (serves the frontend + the real core). |
| `.github/workflows/build-windows.yml` | CI: core tests on Linux + Tauri build on Windows. |

## Provenance & anti-fabrication rules

Every number in the code cites its RE source in a comment
(`REA-REPORT §…` / `Economy.txt` / a decompiled function RVA). Values
with no source carry a `// TODO-RE` marker and are never presented as
real. In particular:

- FillDeck uses the §15.1 CORRECTED formulas (three swapped terms in
  §14.2 were fixed 2026-11-21). The old 7:1:2 ticket split is deleted.
- Sword value = `320 × 1.5^grade` etc. per §11.1 (baseValue 320.0 and
  gradeMultiplier 1.5 are `.ctor` defaults — marked TODO-RE for the
  asset value).
- 2 dead relics (`patchbag`, `burial`) grant NO effects, ever
  (REA-REPORT §15.3: live descriptions, no working effect).
- The 25 VI keys missing from the original fall back to English
  (listed in `app/frontend/i18n.js`); none is used by the P0 UI.
- All art, sound and wording are recreated. Sound is WebAudio-
  synthesized (see `app/frontend/sound.js`); no original audio files
  are shipped. The ESC settings panel contains ONLY items verified
  from the original's own vi.txt — no invented pause menu.
- The original's save key is never used; the clone uses
  `forgetax_clone_v1_*`. No telemetry, no original endpoints.

## P0 scope (what is and isn't here)

IN: strike / ticket draw / grade & value / break & scrap / Fever
(10 charges, 4s, headless gate) / 24 contracts + tribute / win-lose /
endless / 8 starters / sound (synthesized) / ESC settings from vi.txt /
FPS counter / settings persisted to disk.

OUT (P1/P2): merchant, all 119 relics, codex, 21-day legacy mode,
dragon fight, save slots, sword catalog (510 swords — contents
unrecovered), per-fight dragon HP/deck.
