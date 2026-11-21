# Textures — ForgeTax Mobile 3.17.0 (original, extracted from the real APK)

Source: `unity/assets/bin/Data/data.unity3d` (Unity 6000.0.83f1, package `com.soucean.cantkeepfire`, version 3.17.0).
Extracted with UnityPy 1.25.4 + Pillow 10.2.0 (static extraction only — the APK was never executed).
Full inventory: `unity/textures-3.17.0/INVENTORY.md` + `manifest.json` (1,914 decoded PNGs, 56 MB).

Only the P0 forge-room subset is copied here (29 files). The full set stays in the workspace —
copying all 1,914 files into the app is infeasible for the browser-push flow.

Textures are applied through the materials table in `scene-data.json` (built by
`tools/convert-scene.py` from `scene-layout/layout.json` — every material's
`_BaseMap` / `_BumpMap` path_id is cited there). The "used for" column below
is a short human note, not the binding record.

| path_id | texture | size | format | bytes | used for |
|---|---|---|---|---|---|
| 166 | `SoftFlame` | 64x128 | ETC2_RGBA8 | 4085 | Forge fire flame sprites (real alpha) |
| 1697 | `SwordV2DetailAtlas` | 512x512 | ASTC_RGB_5x5 | 630431 | Sword blade detail layer (blue/teal cracked veins) |
| 177 | `T_CharredWood_Albedo` | 1024x1024 | ETC2_RGBA8 | 982637 | Hammer handle + anvil base — charred wood |
| 185 | `T_ForgeGrimeSoft` | 128x128 | ETC2_RGBA8 | 7684 | Anvil grime overlay (transparent) |
| 168 | `T_ForgeIron_Albedo` | 1024x1024 | ETC2_RGBA8 | 916985 | Anvil — dark riveted iron plates |
| 165 | `T_ForgeJambSoot` | 64x128 | ETC2_RGBA8 | 2592 | Forge mouth soot frame (transparent) |
| 161 | `T_ForgeMouthHeat` | 256x128 | ETC2_RGBA8 | 12534 | Forge mouth heat glow (additive) |
| 182 | `T_Room_BrassPatina` | 128x128 | ETC2_RGB | 10899 | Sword guard / brass accents |
| 170 | `T_Room_BrickWear_0` | 128x128 | ETC2_RGB | 15955 | Back wall — brick wear variant 0 |
| 184 | `T_Room_BrickWear_1` | 128x128 | ETC2_RGB | 15291 | Side wall — brick wear variant 1 |
| 176 | `T_Room_BrickWear_2` | 128x128 | ETC2_RGB | 15511 | Side wall — brick wear variant 2 |
| 174 | `T_Room_Cobweb` | 256x256 | ETC2_RGBA8 | 14049 | Cobweb decals in corners (transparent) |
| 179 | `T_Room_Flagstone` | 256x256 | ETC2_RGB | 64124 | Floor — dark brick flagstone plane |
| 178 | `T_Room_FloorScuff` | 128x128 | ETC2_RGBA8 | 7261 | Floor scuff decals (transparent) |
| 181 | `T_Room_FloorWear` | 128x128 | ETC2_RGB | 11219 | Floor variation overlay plane |
| 180 | `T_Room_GrimeGradient` | 128x64 | ETC2_RGBA8 | 3780 | Grime gradient overlay (transparent) |
| 183 | `T_Room_Mortar` | 128x128 | ETC2_RGB | 15552 | Wall base trim — mortar |
| 163 | `T_Room_RustIron` | 256x256 | ETC2_RGB | 77235 | Hammer head — rusted iron |
| 1430 | `cfxr electric spark` | 128x128 | EAC_R | 4344 | Strike spark particles (R-channel mask, additive) |
| 1274 | `cfxr ember blur` | 64x32 | EAC_R | 1178 | Ambient ember particles (R-channel mask, additive) |
| 1138 | `cfxr fire circle plain` | 128x128 | EAC_R | 2749 | Ember glow particles (R-channel mask, additive) |
| 1284 | `cfxr stretch flamme crisp` | 128x64 | EAC_R | 2766 | Flame streak particles (R-channel mask, additive) |
| 160 | `Keratin striations` | 256x256 | ETC2_RGBA8 | 105155 | Material _BaseMap (see scene-data.json materials) |
| 162 | `Paper grain` | 512x512 | ETC2_RGB | 196091 | Paper materials — ledger / torn paper / calendar (323 uses) |
| 164 | `Exposed aggregate grain` | 256x256 | ETC2_RGB | 58461 | Stone aggregate _BaseMap — walls / jambs |
| 175 | `Soot-dark hammered iron` | 256x256 | ETC2_RGB | 73733 | Soot-dark hammered iron _BaseMap |
| 186 | `Broken stone pits` | 256x256 | ETC_RGB4 | 116563 | _BumpMap for "Rough exposed stone core" (walls / jambs / arch) |
| 187 | `Hide pores` | 256x256 | ETC2_RGB | 58461 | Material _BaseMap (see scene-data.json materials) |
| 189 | `Worn shelf timber` | 256x256 | ETC2_RGB | 60557 | Shelf timber _BaseMap |

Total: 29 files, 3375716 bytes.

## Excluded (deliberately NOT copied)

- **Blade-shape textures** (`Large01`, `Large02`, `Medium01`–`Medium06`, `Thin01`, `Thin02`,
  path_ids 4, 13, 17, 27, 32, 34, 35, 37, 49, 51): they decode to **black RGB + noise
  alpha** (verified pixel-by-pixel 2026-11-21) — they are NOT blade silhouettes, despite the
  names. Proven in LAYOUT.md §7: URP film-grain lookup textures (`PostProcessData`
  `filmGrainTex`), loaded at runtime by the render pipeline; no material references
  them. The 3D blade is the real `Blade.obj` + `RefitBevelUnit.obj` parts from the APK
  (see `scene-data.json` sword assembly), not a drawn shape.
- **`flame.png` / `spark.png`** (path_ids 2101 / 1398): misnamed — both decode to the same
  dark faceted rock/horseshoe render, not a flame or spark sprite. Particle sprites use
  the `cfxr_*` masks + `SoftFlame` instead.
- Everything else (relic atlas, merchant, dragon, themes): P1/P2 scope, not the P0 forge loop.
