# BÁO CÁO BÀN GIAO — CIPHER v2 (Nhân viên 1, REA)

Gói trích xuất P0 v2 đã đóng gói xong. Người quản lý đã tự kiểm chứng
`.zip` độc lập (MD5, số file, `unzip -t` sạch, F-04 đã sửa). Báo cáo này
chỉ tổng hợp nội dung + đối chiếu nhóm B cho SENSOR — không trích xuất lại,
không viết code game.

## 1. Gói bàn giao

- **File:** `~/workspace/forgetax-mobile/ForgeTax-Mobile-CIPHER-P0v2.zip`
- **Dung lượng:** 140.043.484 B (~134 MB); **MD5:**
  `56d3bbaddfcab859db832e888accc918`
- **Tổng:** 2.948 file (`unzip -t`: No errors)

| Thư mục | Số file | Nội dung |
|---|---|---|
| `/01_TEXTUAL_GOC/` | 22 | 21 TextAsset + `missing-vi-keys.json` (MỚI) |
| `/02_ASSETS_GOC/textures/` | 1.916 | 1.914 PNG + manifest.json + INVENTORY.md |
| `/02_ASSETS_GOC/meshes/` | 238 | 232 OBJ phòng lò + README + builtin/ 5 OBJ |
| `/02_ASSETS_GOC/meshes-swords/` | 510 | 510 OBJ kiếm, 510/510 OK (MỚI) |
| `/02_ASSETS_GOC/meshes-prefabs/` | 143 | 143 OBJ prefab khác, 143/143 OK (MỚI) |
| `/02_ASSETS_GOC/am-thanh-tham-chieu/` | 102 | 101 WAV + README_THAM_CHIEU.md |
| `/03_LOGIC_VA_THONG_SO/` | 16 | LAYOUT.md, layout.json, REA-REPORT.md, Economy.txt, materials-full.json, mesh-export-report.json, PUSH-MANIFEST.md + 9 file MỚI (xem §2) |
| `/04_BANG_CHUNG_NGUON_GOC.md` | 1 | Bảng chứng minh nguồn gốc v2 (đã cập nhật C.A/C.B/C.C + F-04) |

## 2. Nội dung mới trong v2

### UI layout / styling (`UI_LAYOUT.md`, `ui_layout.json`)
- 514 RectTransform, 2 Canvas, 323 CanvasRenderer, 113 TextMesh
  (85/113 đọc được nội dung), 9 Font, 91 Sprite, 149 uGUI Text,
  174 uGUI Image, 22 Button, 66 Toggle.
- **Phát hiện lớn: game gốc KHÔNG CÓ HUD.** Level0 (phòng lò, 3.672 GO)
  có **0 Canvas / 0 RectTransform**. 2 Canvas duy nhất là prefab Debug UI
  của Unity Render Pipeline (`DebugUICanvas`, `DebugUIPersistentCanvas`),
  KHÔNG phải HUD game. UI thật là **113 label TextMesh 3D trong phòng**.
- Font 3D: `ForgeKorean` (Malgun Gothic) + `LegacyRuntime`
  (Liberation Sans/Arial); font asset: Fredoka-SemiBold, PerfectDOSVGA437,
  NotoSansCJKsc/tc/jp, LilitaOne, NotoSans-Black, NotoSans-SemiBold.
- Mỗi TextMesh có font/size/color/character_size/anchor/bold trong
  `ui_layout.json` (vd: outcome label 파괴/손상/성공 ForgeKorean 64,
  유지 128 Bold; `Enhancement level` 128 Bold; `FORGE LEDGER`
  LegacyRuntime 80; `Live run account` ForgeKorean 64, color
  [1.0, 0.031, 0.067, 0.11], anchor UpperLeft, line_spacing 1.12).

### Behavior (`BEHAVIOR.md`, `behavior.json`) — 9 hệ, 2 full + 7 partial
`forge_first_person` (partial), `forge_interactables` (full),
`fever` (partial), `hammer_strike` (partial), `tribute_end_day` (partial),
`dragon_anger` (partial), `settings_defaults` (**full**),
`sword_form_selection` (partial), `auto_helpers` (partial).
Kèm 16 mục thiếu M1–M16 (mỗi mục kèm bằng chứng thử vài lần).

### Effects (`EFFECTS.md`, `effects.json`)
- 118 ParticleSystem (10 level0 + 108 CFXR prefab) với đầy đủ tham số
  (maxParticles, lifetime, speed, size, color, emission, shape, material).
- 7 AnimationClip — tất cả là clip rồng: Hit 0.667s, Death 2.75s,
  Breath 2.29s, Roar 4.58s, Idle 6.67s (loop), RedDragonClaw 3.75s,
  Fly 6.67s (loop); 342 bindings/clip; dense keyframe đã trích cho 6/7 clip.
- 126 material phòng (124 đầy đủ; 2 Font Material thiếu shader).
  Shader phòng: URP/Lit 51, ForgeTax/Worn workshop surface 49, URP/Unlit 18,
  ForgeTax/Polish/Relic surface 3, Crayon warning mark 1, CitadelSurface 1,
  World Text 1, [THIẾU] 2.
- Audio trigger map 34 mục (24 proven / 9 partial / 1 missing), kèm RVA.
  **Phát hiện: tiếng impact khi đập là TỔNG HỢP lúc runtime**
  (ProceduralClips.ImpactSamples, ImpactFrameCount=52920) — không có file
  WAV tương ứng. Great→GreatStrike, vỡ→SwordBreak, chuông→TributeBell,
  lửa lò = Hearth crackle loop vol 0.55.

### Khác (MỚI v2)
- `ROOM_COMPLETENESS.md`: layout.json bao trọn toàn bộ scene level0
  (3.672/3.672 vật); 11.039 GO còn lại là prefab ngoài phòng (không đặt
  tĩnh trong phòng).
- `prefab-mesh-export-report.json`: 510 kiếm + 143 prefab, 100% OK.
  Mỗi prefab kiếm: `Visual/Body/Model/Solid` + `GripSocket` +
  `HammerContact` + `LiveHammerContact` + `Collision/Box_01–05`.
  Đặc biệt: 0510 là kiếm nhạc (White key 0–14 + Record + Floating note);
  4035 có `Tesseract tilt / Inner cube spin`.
- `attempt-log-v2.md`: bằng chứng thử vài lần cho các mục thiếu cũ.
- `missing-vi-keys.json`: đúng 25 key thiếu — **TẤT CẢ đều là `dev.*`**
  (menu dev/debug, không hiện trong gameplay thường).

### F-04 — ĐÃ SỬA (AEGIS [REJECT_TO_CIPHER])
`LAYOUT.md` §7 dòng 413: "Grip winding **×8**"
(439, 440, 441, 442, 444, 445, 452, 457) — bỏ pid 447.
pid 447 = "Lantern glow", không phải winding. `/04` đã cập nhật tương ứng.

## 3. [THIẾU TỪ NGUỒN GỐC] — cập nhật (kèm bằng chứng thử vài lần)

### ĐÃ ĐÓNG LẠI trong v2
- **25 key VI thiếu:** tất cả là `dev.*` (xem `missing-vi-keys.json`).
  Fallback English là đúng; text người chơi không thiếu key nào.
- **Settings defaults:** `ForgeSettingsData..ctor` 0x24FB25C +
  `ForgeUserSettings.Defaults()` 0x2503FA0 — master/effects/music/
  sensitivity = 1.0; 1920×1080; frameRate 60; brightness 0.7;
  haptics true; floorSwordLimit 30; dragonAutoFocus true;
  invertY/hubControls false; còn lại = default C# (false/0/null).
- **FeverCameraPower/Age đã định vị:** property của ForgeFirstPerson
  (RVA 0x24106F4, field 0xE4/0xE8), set ở
  `ForgeFeverPresentation.Update` 0x240F1E0:
  `Power = amount × (impact × 0.6 + 0.7)`, `Age = presentation.age`;
  reset về 0 ở `EndWork`/`AdoptViewPose`.

### Vẫn thiếu (mỗi mục đã thử nhiều lần — chi tiết trong `attempt-log-v2.md`,
### `behavior.json` / `effects.json` mục `missing_with_attempts`, `/04` §C)
- Quy tắc chọn prefab kiếm theo grade (6 id 8/13/18/23/28/33):
  đã thử 5 cách incl. brute-force 12.000 tổ hợp → 111 id, không trúng 6 id.
  SwordV2Catalog asset vắng mặt (đã thử 4 cách). Đường Evolution
  (117 entry + 28 special line) đã trích được — xem §5.
- Chuỗi key SwordV2Catalog + mapping đầy đủ trong asset V2 (4 lần thử).
- Dragon per-fight HP/deck (2 lần thử — `Create` chỉ nhận cave + prefab).
- FilmGrain settings — VolumeProfile asset absent (3 lần thử).
- Mapping Fever/dragon-anger → hình ảnh (EFFECTS M13, 4 lần thử).
- Mapping anger liên tục → Eye/Breath intensity (BEHAVIOR M6 —
  **caller-trace CHƯA THỬ**, chưa phải đường cùng).
- Pitch clamp (M1, 3 lần), SightLayers mask (M2, 3 lần),
  FinishFever payout chính xác (M3, 3 lần), Chances tail (M4, kế thừa),
  helper FeverAge/RecordPaidTribute (M9, 2 lần — công thức dạng suy luận),
  timeline coroutine rồng (M10, 3 lần — thiếu một phần),
  tên relic trong Rank() (M12, 2 lần — PairIP), lò nung (M14, 2 lần),
  điều kiện auto-helpers (M15, 3 lần — thiếu một phần).
- AnimationClip: nhãn bone của 342 bindings/clip (M1, 5 lần thử incl.
  CRC32/Adler32/FNV-1/FNV-1a trên 10.496 path — 0 khớp); keyframe
  streamed + RedDragonClaw không có dense data (M2, 4 lần); layout
  DenseClip (M3, 4 lần — min/max per-curve là giả định frame-major);
  clip Rise không tồn tại (M4, 4 lần); clip field ForgeAudio (M5, 6 lần);
  chuỗi id Consumable/MerchantCue (M6, 4 lần); link FeverOverdrive
  (M7, 5 lần — chỉ bằng chứng hoàn cảnh); link audio rồng (M8, 5 lần);
  caller Reward()/HitOutcome() = 0 trong toàn bộ disasm (M9, 4 lần —
  có thể là dead code); trigger Discovery (M10, 5 lần);
  shader 2 Font Material (M12, 5 lần).
- UI: field `PaymentOptionProviderModal` (M1); chuỗi lúc chạy của 28
  TextMesh rỗng (M2 — vị trí/cỡ/màu/font đã đủ); delegate DebugUIHandler
  (M3); field private runtime-only (M4); khởi tạo 2 Canvas debug (M5).
- 11 relic PARTIAL, 2 relic dead (patchbag, burial), §15.4 unresolved,
  14 TODO-RE trong core, 9 texture 0×0 (placeholder engine),
  C# source gốc 0% mãi mãi.

### CHƯA THỬ — chưa phải đường cùng (ghi rõ để phân biệt)
- **BEHAVIOR M13:** body 5 tap action (RerollShop, DepositHeldSword,
  OfferHeldToArmoryDoor, InstallHeldSoulBell, RingSoulBell) — **CHƯA ĐỌC**,
  vẫn lấy được từ decompile, không phải không lấy được.
- **EFFECTS M11:** trigger spawn từng CFXR prefab (108 PS) — **CHƯA THỬ**
  map prefab→event trong task này.
- **BEHAVIOR M6:** grep caller của SetDanger/Express — **CHƯA THỬ**.

## 4. Đối chiếu 14 món nhóm B (REMAKE-PROPOSALS.md) với dữ liệu v2

**Ký hiệu:** ✅ ĐÃ LẤY ĐƯỢC (sửa code theo số thật, rời danh sách remake) ·
◐ LẤY ĐƯỢC MỘT PHẦN (sửa phần có số thật; phần còn lại vẫn đề nghị remake) ·
❌ VẪN THIẾU (giữ đề nghị remake, đã có bằng chứng thử nhiều lần).

| Món | Kết luận | Số liệu thật trong v2 (file + giá trị) / Phần còn thiếu |
|---|---|---|
| **R-01** Toàn bộ CSS (settings panel / overlay / toast / fps) | ❌ VẪN THIẾU | **Không có nguồn CSS nào trong gốc:** level0 có 0 Canvas / 0 RectTransform; 2 Canvas duy nhất là prefab Debug UI của Unity Render Pipeline (`UI_LAYOUT.md` §0). 149 uGUI Text + 174 Image + Button/Toggle đều nằm trong prefab Debug UI, không phải UI chơi game. → Giữ đề nghị remake, nay đã có bằng chứng. |
| **R-02** Kiểu chữ 3D trên board (font/cỡ/màu/shadow) | ✅ ĐÃ LẤY ĐƯỢC | `ui_layout.json` → `textmesh_elements` (113 TextMesh, 85 có nội dung): mỗi label có font/size/color/character_size/anchor/bold. Vd: outcome label 파괴/손상/성공 ForgeKorean 64, 유지 128 Bold; `Enhancement level` 128 Bold; `Final probability` 128 Bold; `FORGE LEDGER` LegacyRuntime 80; `Live run account` ForgeKorean 64, color [1.0, 0.031, 0.067, 0.11], anchor UpperLeft, line_spacing 1.12. Font 3D: ForgeKorean (Malgun Gothic) + LegacyRuntime (Liberation Sans/Arial). → Thay toàn bộ default `boardText()` (sans-serif 44px #f0e6d6) bằng số thật. |
| **R-03** Nội dung nhãn trên board (chữ Việt hardcode) | ✅ ĐÃ LẤY ĐƯỢC | 85 TextMesh có chuỗi gốc thật (tiếng Hàn + tiếng Anh) trong `ui_layout.json`: `요구액\n1,800 G\n\n올려놓은 몫\n0 G`, `FORGE LEDGER`, `TRIBUTE HATCH`, `WEAPON RACK`, `THE DRAGON TAKES HIS DUE`, `NOTICE\n\nTHE FORGE\nTAKES ITS CUT.\n\nNO REFUNDS.`, `THE FORGE NEVER SLEEPS`, `E 구매 / 상납 후 개점 / 구매한 칸은 비워둠`, `유물 8종 / 중복 구매 = 레벨 상승`, `강화 위험은 모루 확률에 반영`, `총 30장`, `추 첨 표`, `4월`, outcome label 파괴/손상/성공/유지, `Final probability` / `Enhancement level` = `—`. → Dùng chuỗi gốc (master Hàn) + bản dịch VI từ `vi.txt` cho key đã map. Lưu ý: nhãn Việt tự dịch (R-05, nhóm A) vẫn cần OWNER duyệt riêng. |
| **R-06** Động học vung búa | ◐ MỘT PHẦN | ✅ Timing đã có — `behavior.json` → `hammer_strike`: raiseSec 0.16/speed, downSec 0.095/speed, returnOffsetSec 0.10/speed, returnRestSec 0.21/speed, impactState 2, impactDelayAtSpeed1Sec 0.255; cooldown `nextStrikeTime = now + 0.64/speed`; noSwordLockoutSec 3.2; anvilMaxDistance 0.16; anvilPulse `sin(clamp01(t)·π)·(1−t)²`, factors [0.15, 0.05, 0.12, 0.18]; brokenKindFactor 1.8. Code hiện (giơ 0.85 rad/130ms, đập 90ms) sai số: thật là giơ 160ms, đập 95ms ở speed 1. ❌ Góc giơ búa (0.85 rad trong code) KHÔNG có nguồn — không có angle nào trong `hammer_strike`. |
| **R-07** Rung camera khi Fever | ✅ ĐÃ LẤY ĐƯỢC | `behavior.json` → `forge_first_person.feverShake`: {x: 0.013, z: 1.15, rot: 0.38, fovAmp: 1.4, freqs: [93, 117, 32, 81, 67, 23]}; `fever`: cameraPower = `amount × (impact × 0.6 + 0.7)`, cameraAge = `presentation.age`; set ở `ForgeFeverPresentation.Update` 0x240F1E0, reset 0 ở `EndWork`/`AdoptViewPose`. Kèm rewardShake {x: 0.006, y: 0.009, rot: 0.32, rot2: 0.4, fov: −1.1, freqs: [103, 89, 83, 97]} và quakeShake {phase: 1.3, x: 0.016, z: 0.022, rot: 0.6, rot2: 1.1, freqs: [61, 47, 53, 37, 71]}. Code hiện (0.004/0.003 rad, tần số 37/43) sai hoàn toàn → thay bằng số thật. |
| **R-09** Áp dụng detail atlas lên lưỡi kiếm (teal emissive) | ◐ MỘT PHẦN | ✅ Shader + atlas + palette đã có: `ForgeTax/SwordV2/Surface` (+ `Surface Packed`, `Energy`) và `ForgeTax/Sword metamorphosis` (pid 3361/3355/3369/3350), áp lúc runtime qua SwordV2Rig; param names `_ForgeHeat`, `_LoopSeconds`, `_TimeScale`, `_DetailScale`, `_Metallic`, `_Smoothness`, `_Coat`, `_FinishWear` (`EFFECTS.md`:613). 581 material trong `materials-full.json` dùng shader pid 3355, mỗi cái có `_DetailAtlas` → SwordV2DetailAtlas pid 1697 + `_SwordPalette` → `<id>_palette` riêng, `_BaseColor` [1,1,1,1], `_EmissionColor` [0,0,0,1]. ❌ Giá trị các scalar param (`_DetailScale`, `_Metallic`, `_Smoothness`, `_Coat`, `_FinishWear`, `_ForgeHeat` runtime) KHÔNG serialize trong material — set lúc runtime. Teal emissive (0.04, 0.20, 0.24)/0.55 trong code KHÔNG có trong dữ liệu (emission material = 0) → vẫn là đề nghị remake. |
| **R-10** Ngọn lửa lò (3 sprite SoftFlame) | ✅ ĐÃ LẤY ĐƯỢC | Lửa lò thật là ParticleSystem, không phải sprite: `effects.json` → `Low flame / licking above the coals` (level0, pos [2.1324, 1.2, 1.8185]): maxParticles 40, lifetime 0.3–0.75s, speed 0.3, size 0.08–0.18, emission 30/s, duration 5, looping. Thêm `Room engulfed in fire` (1800 max, life 1.2–2.0, speed 0.91–1.4, size 0.4–0.85, emission 100/s — lúc tribute) và `Vfx_FireColumn` (120 max). → Bỏ 3-sprite SoftFlame, dùng PS với số thật. (Màu hạt startColor trắng — tint từ material/texture CFXR.) |
| **R-11** Tham số tàn lửa (embers) | ✅ ĐÃ LẤY ĐƯỢC | `effects.json` → `Draft embers` (level0, pos [2.0013, 1.25, 1.681]): maxParticles 90, lifetime 1.9s, speed 0.45, size 0.021, emission 8/s, duration 5, looping. Code hiện (12/30/60 theo quality, size 0.09, opacity 0.8, vận tốc 0.25–0.6, life 1.5–4s) sai hết → thay bằng số thật. |
| **R-12** Tham số bụi bay (dust) | ✅ ĐÃ LẤY ĐƯỢC | 4 hệ bụi level0 đầy đủ trong `effects.json`: Warm dust/work lamp + Cold dust/iron bars + Shelf dust (mỗi hệ max 32, life 8–12s, speed 0.012–0.035, size 0.004–0.01, emission 2/s, duration 12, loop, prewarm; màu Warm [0.9, 0.65, 0.32, 0.3], Cold [0.46, 0.63, 0.52, 0.19], Shelf [0.9, 0.74, 0.43, 0.2]) + Lazy soot draft (max 24, life 2.5s, speed 0.2, size 0.18–0.35, emission 4/s). Code hiện (24 hạt/system, size 0.03, opacity 0.22, life 5–10s) sai → thay số thật. (`Dust and stone` là one-shot riêng: 1800 max, burst 45 lúc t=0, life 0.9–1.5 — không phải bụi ambient.) |
| **R-13** Tham số tia lửa khi đập (spark burst) | ◐ MỘT PHẦN | ✅ PS params đã có — `effects.json` → `Hammer sparks` (level0, pos [−1.1897, 1.24, 2.2]): maxParticles 90, lifetime 0.44s, speed 2.3, size 0.018, emission rate 0/s (= event-driven, không phải continuous), duration 5, looping. ❌ Số hạt burst mỗi lần đập KHÔNG có trong PS params (nằm trong code gọi spawn, chưa trace). Code hiện (10/24/48 theo quality, ×2 khi gãy, size 0.11, life 0.35–0.7s, gravity 4.5) sai lifetime/speed/size vs nguồn (0.44s / 2.3 / 0.018) → sửa phần có số thật; burst count vẫn cần trace thêm hoặc đề nghị remake. |
| **R-14** Đèn outcome nháy khi có kết quả mới | ❌ VẪN THIẾU | Không có nguồn cho hành vi "kết quả mới nhất phát sáng": 0 lần từ `outcome` trong `behavior.json`; `EFFECTS.md` chỉ có bảng material 5 đèn (vd BREAK `_BaseColor` (0.57, 0.174, 0.144), `_EmissionColor` (0,0,0,1) — đèn KHÔNG phát sáng mặc định). Base 0.35 / flash +2.2 / decay 1.2/s trong code không có nguồn. → Giữ đề nghị remake. (CFXR Flash PS là prefab khác, không phải đèn outcome.) |
| **R-15** Hệ số sáng đèn theo giận / đủ cống phẩm / Fever | ◐ MỘT PHẦN | ✅ Phần Fever đã có — `behavior.json` → `fever`: radianceIntensity = `amount × (sin(age×35) + impact×3.5 + 2.2)`, radianceOffset 0.06, emitPerSec = `age×150×amount`, emitBurstMax 35, emitBegin 90; `dragon_anger`: eyePressureByMood {Low 0.35, Question 0.35, Dry 0.12, Threat 0.65, Sneer 0.35, Roar rage=1.0}, setDanger = clamp01(share), warningCount = min(missedTributes, markCount), markAnimRate dt/0.65. FireLight 20 KHỚP dữ liệu gốc (Fire light I=20.0); 26 khi Fever → thay bằng công thức radiance. ❌ Mapping liên tục anger value → Eye/Breath light intensity (BEHAVIOR M6 — caller-trace CHƯA THỬ) và hệ số quota light 2.0 khi đủ (không có nguồn). |
| **R-24** Góc nhìn work: pitch ~−14° vs field 10° | ✅ ĐÃ LẤY ĐƯỢC | **Mâu thuẫn đã giải quyết** — `BEHAVIOR.md` §1 `LateUpdate` 0x2411160: khi working, pitch = `workLookPitch` = **10.0** (field `[Range(0,35)]`, dump.cs); `workBlend` tiến tới đích với tốc độ `1 − exp(−10·dt)`; FOV lerp originalFov→workFieldOfView (69→61) theo clamp01(workBlend) + kick×0.35 (DAT 0.35); Punch kick cap 1.4. Camera forward spawn [0.4019, −0.309, −0.8619] (cúi ~18°) là view lúc spawn, KHÔNG phải work view. → SENSOR dùng pitch 10° + blend rates thật, BỎ cách lookAt −14° tự tính. (Pitch clamp limits vẫn thiếu — BEHAVIOR M1, đã thử 3 cách.) |
| **R-26** Kích thước giấy calendar | ◐ MỘT PHẦN | ❌ Giấy KHÔNG có mesh (`layout.json`: `Calendar paper and ink` mesh None) → không đo trực tiếp được. ✅ Đã có biên từ vị trí 31 TextMesh ngày trong `ui_layout.json`: x [−2.6028, −1.9633] (rộng 0.64m), y [1.5878, 2.2851] (cao 0.70m); nhãn `4월` ở y 2.2851 (trên cùng); batten 0.76m. Kích thước giấy thật ≥ 0.64 × 0.70 (cộng lề). Code hiện 0.85×0.55 sai cả hai chiều lẫn tỉ lệ (giấy thật cao hơn rộng, code thì rộng hơn cao) → SENSOR sửa theo biên đo được, ghi rõ approximation, chờ OWNER duyệt. |

**Tổng kết nhóm B (14 món):** ✅ ĐÃ LẤY ĐƯỢC 7 món (R-02, R-03, R-07,
R-10, R-11, R-12, R-24) — SENSOR sửa code theo số thật, rời danh sách
remake. ◐ MỘT PHẦN 5 món (R-06, R-09, R-13, R-15, R-26) — sửa phần có
số thật; phần còn lại vẫn đề nghị remake. ❌ VẪN THIẾU 2 món (R-01, R-14)
— giữ đề nghị remake, đã có bằng chứng thử nhiều lần.

## 5. Nhóm A — v2 đóng / nâng cấp thêm (để SENSOR + OWNER biết)

- **R-20 (settings defaults) — ĐÃ ĐÓNG LẠI:** xem §3. Code hiện sai nhiều
  so với nguồn: master 80 / music 60 / sfx 90 (thật: 1.0 = 100% cả ba);
  brightness 100 (thật: 0.7 = 70%); controls mặc định `hub` (thật:
  `hubControls` false = **free move**); floor_swords 3 (thật:
  `floorSwordLimit` 30); `sound.js` masterVol 0.8 / musicVol 0.6 /
  sfxVol 0.9 (thật: 1.0). Quality + language default không nằm trong
  danh sách trích được (quality = C# default 0, chưa map nghĩa).
- **R-17 (dạng kiếm theo grade) — NÂNG CẤP LỚN:** không còn "dạng cơ bản
  cho mọi grade". `BEHAVIOR.md` §8.3: `EvolutionCatalogue` pid 29374
  (raw-parse, offset khớp chính xác) có **117 entry** {id, grade, family,
  displayName (tiếng Hàn, vd id 1 `낡은 검` = Worn Sword), prefab} —
  entry id == tên GO prefab trong cả 117 trường hợp, 0 chưa resolve;
  grade 0–999 (grade 999: 4024–4035; grade ≥25: 4000–4023). Thêm
  `ForgeSwordEvolutionSet`: **28 special line**, mỗi line 13 stage prefab
  + ultimate (idBase+99), valueMultiplier 2.0 (worldtree 100, seafood 200,
  funerary 3000, kitchen 400, music 500, cosmic 600, rubber 700,
  secretdoor 800, ifun 900, bamboo 1000, gpu 1100, lighthouse 1200,
  cactus 1300, origami 1400, chess 1500, chandelier 1600, firework 1700,
  amber 1800, beehive 1900, stainedglass 2000, volcano 2100, hourglass 2200,
  windmill 2300, pencil 2400, umbrella 2500, mushroom 2600, joust 2700,
  thunderbamboo 2800). Bảng đầy đủ trong `behavior.json`
  (`sword_form_selection.evolution_catalogue` + `special_lines`).
  Chỉ còn thiếu: đường chọn 6 id 8/13/18/23/28/33 (M7, đã thử 5 cách).
  Kiếm base Blade chỉ còn là fallback cho trường hợp chưa rõ.
- **25 key VI thiếu:** tất cả là `dev.*` — text người chơi không thiếu key nào.

## 6. Ghi chú cho SENSOR (đọc kỹ trước khi sửa code)

- Sửa ngay theo số thật: R-02, R-03, R-07, R-10, R-11, R-12, R-24, R-20,
  R-17 (dùng EvolutionCatalogue + 510 mesh thật), R-06/R-09/R-13/R-15/R-26
  (phần đã có số thật).
- KHÔNG tự sửa: R-01, R-14 (vẫn thiếu — chờ OWNER duyệt đề nghị remake);
  phần còn thiếu của R-06 (góc búa), R-09 (scalar params + emissive),
  R-13 (burst count), R-15 (anger→light scale, quota 2.0), R-26
  (kích thước giấy chính xác).
- KHÔNG đặt prefab ngoài phòng tĩnh trong room: 11.039 GO còn lại là
  prefab/resources (xem `ROOM_COMPLETENESS.md`).
- KHÔNG bịa mapping grade→prefab: chỉ dùng EvolutionCatalogue +
  special lines đã trích; 6 id chưa rõ đường chọn thì fallback base Blade,
  ghi TODO-RE.
- F-04 đã sửa trong gói v2 — SENSOR không cần làm gì thêm về F-04.
- Ba mục CHƯA THỬ (BEHAVIOR M13, EFFECTS M11, BEHAVIOR M6 caller-trace)
  chưa phải đường cùng — có thể trích tiếp trong task CIPHER sau, không
  tự kết luận là không lấy được.
