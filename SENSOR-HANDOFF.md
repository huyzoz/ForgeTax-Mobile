# BÁO CÁO BÀN GIAO — SENSOR (Nhân viên 2, Coder chính) — PHIÊN SỬA 2026-11-21

**Người bàn giao:** SENSOR (phiên sửa sau lệnh duyệt của OWNER 2026-11-21 19:47).
**Ngày:** 2026-11-21 (tối). **Nguồn gốc duy nhất:**
`~/workspace/forgetax-mobile/ForgeTax-Mobile-CIPHER-P0v2.zip` (134 MB,
MD5 `56d3bbaddfcab859db832e888accc918`, 2,948 file — đã tự kiểm chứng MD5 khớp)
+ file đã giải trên đĩa `~/workspace/forgetax-mobile/scene-layout/`
(`UI_LAYOUT.md`, `ui_layout.json`, `BEHAVIOR.md`, `behavior.json`,
`EFFECTS.md`, `effects.json`, `LAYOUT.md` đã sửa F-04) + bản đối chiếu chính
thức `remake/CIPHER-V2-HANDOFF.md`.

**Lệnh duyệt (OWNER 2026-11-21 19:47):** DUYỆT HẾT nhóm A (12 món remake) +
sửa nhóm C (5 món) + sửa nhóm B theo số thật của CIPHER v2. Bản này là kết quả
thực hiện lệnh đó. (Bàn giao trước của SENSOR thay thế — dựa trên .zip v1 —
vẫn giữ nguyên giá trị lịch sử; các số liệu v1 đã được thay bằng v2 ở đây.)

**Phạm vi bàn giao:** P0 3D forge room tại `~/workspace/forgetax-mobile/remake/`
(Tauri 2 + forgetax-core Rust + Three.js/WebGL). Chưa push, chưa release —
chờ AEGIS kiểm lại rồi OWNER duyệt ảnh chụp.

---

## 1. Bản đồ ánh xạ 1:1 (file code → file nguồn v2)

| File code | Nguồn trong .zip v2 / trên đĩa |
|---|---|
| `app/frontend/scene3d.js` (~2,300 dòng) | `scene-layout/layout.json` + `LAYOUT.md` (phòng, camera, 20 lights, boards, sword) + `scene-layout/ui_layout.json` (113 TextMesh, 85 có text, 9 font) + `scene-layout/behavior.json` + `BEHAVIOR.md` (ForgeFirstPerson, Fever, hammer, settings, EvolutionCatalogue) + `scene-layout/effects.json` (118 PS) + `EFFECTS.md` |
| `app/frontend/swords/*.json` (111 file, 23.0 MB) + `swords-manifest.json` (117 id) + `sword-catalogue.json` | `02_ASSETS_GOC/meshes-swords/` (510 mesh kiếm thật) — convert bằng `remake/tools/convert-swords.py` (ResolveId 16/16 mẫu OK; 111 reachable; 6 id 8/13/18/23/28/33 unreachable) |
| `app/frontend/textures/SoftParticle.png` (mới thêm, MD5 `42782e08d8045c2660f7ea822943ac1c`) | `02_ASSETS_GOC/textures/SoftParticle.png` (đã copy + kiểm MD5 khớp) |
| `app/frontend/scene-data.json` + `meshes.json` | Chuyển đổi từ layout.json + meshes OBJ bằng `tools/convert-scene.py` (không phải dữ liệu mới) |
| `app/frontend/textures/` (23 PNG P0 + MANIFEST.md) | `/02_ASSETS_GOC/textures/` — PNG gốc |
| `app/frontend/index.html` | LAYOUT.md §9 (xóa HUD → đồ trong phòng); title đổi thành "ForgeTax: Blacksmith Legends" (R-27) |
| `app/frontend/styles.css` | **KHÔNG có nguồn trong v2** — xem R-01 (VẪN THIẾU, không đụng đến) |
| `app/frontend/app.js` | Logic gọi backend Rust; `OUTCOME_COLORS` sRGB đúng (F-01); `defaultSettings` = số thật R-20; cooldown đập 0.64s; `swordHighestGrade` + `swordIndex` cho R-17 |
| `app/frontend/i18n.js` | `/01_TEXTUAL_GOC/vi.txt` (1,569 entries) + `ForgeTax.txt` (EN) |
| `app/frontend/sword-names.json` | `/01_TEXTUAL_GOC/vi.txt` — tên kiếm Việt (dùng làm fallback; tên hiển thị chính nay lấy từ `swords-manifest.json` viName theo appearance id) |
| `app/frontend/sound.js` | Trigger + độ dài clip gốc theo REA-REPORT.md §10 (101 WAV — tham chiếu only, không ship); vols 1.0/1.0/1.0 (R-20); timbre tổng hợp là recreated (R-25) |
| `forgetax-core/` (Rust) | `run.rs` thêm `current_index()`; `FeverSnapshot` thêm `bonus`/`max`; `StateSnapshot` thêm `sword_index`; `default_settings()` = số thật R-20 |
| `tools/dev-server/browser-test.js` | Tap pacing 700 ms (cooldown thật 0.64s) |

---

## 2. Đã sửa theo lệnh duyệt (chi tiết + nguồn từng giá trị)

### 2.1 Nhóm A — 12 món ĐÃ DUYỆT — REMADE (ghi `REMADE — approved by OWNER 2026-11-21` trong code)

| Món | Vị trí | Ghi chú |
|---|---|---|
| R-04 tên di vật Việt | `app.js` RELIC_NAMES + `scene3d.js` drawRelicSlots | Giữ nguyên tên, đã ghi REMADE (làm từ trước) |
| R-05 nhãn 5 kênh Việt | `i18n.js` ui.outcome_* + drawInstrument | Giữ nguyên nhãn, đã ghi REMADE (làm từ trước) |
| R-08 đèn fill thay baked lightmap | `scene3d.js` buildLights() (hemi 4.0, amb 2.5, workGlow, fireGlow) | Ghi REMADE; fireLight KHÔNG còn boost 26 khi Fever (bỏ, xem R-15) |
| R-16 hướng đặt kiếm | `scene3d.js` swordBasisQuat() | Ghi REMADE (prefab +Y → world +X, fuller up) |
| R-17 dạng kiếm theo grade | `scene3d.js` resolveAppearanceId + buildCatalogueSword + updateAnvilSword | **NÂNG CẤP BẰNG SỐ THẬT V2** (xem §2.3) — không còn "dạng cơ bản mọi grade" |
| R-18 vị trí kiếm gãy | `scene3d.js` addBrokenSword() | Ghi REMADE; nay dùng catalogue prefab theo appearance lúc gãy (R-17) |
| R-19 khung+slate Ledger INACTIVE | `scene3d.js` drawLedger() + makeBoardPlane('ledger') | Ghi REMADE |
| R-20 mặc định settings/âm thanh | `app.js` defaultSettings + `sound.js` + `index.html` slider | **DÙNG SỐ THẬT V2** (xem §2.3) — không còn remake |
| R-21 overlay kết thúc ván | `app.js` render()/showOverlay() | Ghi REMADE |
| R-22 phím/tương tác PC | `app.js` keydown (ESC/Space) + drag-look | Ghi REMADE |
| R-25 âm WebAudio tái tạo | `sound.js` (vols 1.0/1.0/1.0) | Ghi REMADE (làm từ trước) |
| R-27 title tab | `index.html:6` | Đổi thành "ForgeTax: Blacksmith Legends" |

### 2.2 Nhóm C — ĐÃ SỬA (sửa theo nguồn gốc)

- **F-01:** `app.js` OUTCOME_COLORS = `#C7746A/#C59E6A/#ADB1B0/#82BEAF/#CBB779`
  (chuyển đổi sRGB đúng, công thức IEC, từ _BaseColor LAYOUT.md §5a).
- **F-01b:** `scene3d.js` thêm `linearToSrgbHex()` / `textMeshColorToHex()`
  (công thức IEC); `drawInstrument` dùng hex sRGB đúng; màu TextMesh
  [A,B,G,R] → sRGB (đã xác minh: ABGR khớp 5/5 màu ngữ nghĩa, RGBA khớp 0/5).
- **F-02:** `makeBoardPlane('ledger', 1.09, 1.39, 512, 652)` (slate gốc).
- **F-04:** đã sửa trong gói v2 (CIPHER sửa LAYOUT.md §7 + /04) — SENSOR chỉ
  xác nhận lại, không sửa gì thêm.
- **F-05:** `buildDust()` nay có đúng 4 hệ ambient (Warm/Cold/Shelf/Lazy soot);
  'Dust and stone' là one-shot dragon-visit, loại khỏi ambient.

### 2.3 Nhóm B — ĐÃ SỬA THEO SỐ THẬT V2 (mỗi món ghi rõ file + key nguồn)

- **R-02 kiểu chữ board** (`ui_layout.json` textmesh_elements, 113 TextMesh):
  font stack ForgeKorean → Malgun Gothic (`BOARD_FONT`); glyph em ≈ size ×
  characterSize / 10 (hiệu chuẩn từ row gap, KHÔNG phải công thức Unity —
  ghi rõ); màu text từ TextMesh [A,B,G,R] linear → sRGB; `textMeshPx()`
  dùng cho `boardText()` + 5 hàm draw*. Shadow dưới chữ là REMADE readability aid
  (TextMesh gốc không có shadow) — ghi rõ.
  **SỬA SAU AEGIS D2 (2026-11-21, xem §7):** các (size, cs) trước đó
  (64, 0.012)/(48, 0.0095) lấy nhầm từ các TextMesh [−2.7953, …] (thuộc
  object khác, không phải board). Giá trị đúng (board's own entries):
  instrument — tên (128, 0.0058) #FDF8EA, +grade (128, 0.0062) #FDF1CE,
  tribute value (128, 0.007) #FFEBAA, value caption '상납 가치' (128,
  0.00225) #D3D1C5, latest strike (128, 0.00305), consecutive (128,
  0.0025) #D3D1C5, outcome labels (128, 0.002617), final prob (128,
  0.003407) #9E9E97; meter — required number (64, 0.0085) #DDD7C7,
  required caption (64, 0.0062) #EEE6CD, placed number (64, 0.012)
  #FDF1D0, placed caption (64, 0.0062) #D3CBB8; ledger Live-run block
  (64, 0.009) #5D4932. Màu outcome labels 5/5 đã đúng từ trước.
- **R-03 nội dung nhãn board** (`ui_layout.json` 85 TextMesh có text, đối
  chiếu vi.txt): tên kiếm [−1.654,1.821] #FDF8EA; +grade [−0.4474,1.821]
  #FDF1CE; **value caption '상납 가치' [−1.6555,1.7088] #D3D1C5 — ACTIVE,
  đã thêm (vẽ 'GIÁ TRỊ CỐNG PHẨM', dịch mới, ghi rõ) — trước đó bỏ sót
  do tưởng không có anchor (AEGIS D2)**; tribute value (= giá trị kiếm)
  [−0.4589,1.7088] #FFEBAA; '강화' caption INACTIVE — không vẽ; outcome
  labels y 1.49 #F99386/#F7C786/#DADEDD/#A3EEDB/#FFE69A (z riêng từng cột:
  2.3689/2.3499/2.3309/2.312/2.293 — board hơi nghiêng); final prob y
  1.435 #9E9E97 (z 2.3592/2.3402/2.3212/2.3023/2.2833); meter: required
  [0.5,0.9196] #DDD7C7, placed [0.5,0.7843] #FDF1D0, captions VI mới dịch
  từ '검 요구가치'/'올려놓은 가치' (ghi rõ là dịch mới); instruction meter
  INACTIVE — bỏ 'ĐỦ CỐNG PHẨM' (quotaMet chỉ hiện bằng bell glint);
  ledger: bỏ title 'SỔ HỢP ĐỒNG' + day line + 'Cần:/Đã dâng:' (INACTIVE),
  chỉ vẽ block Live-run 5 dòng tại [−2.252,2.185,2.605] — nguồn là MỘT
  TextMesh nhiều dòng '요구액\n1,800 G\n\n올려놓은 몫\n0 G' (64, 0.009),
  vi.txt "CỐNG PHẨM YÊU CẦU" / value / blank / "ĐÃ DÂNG" / value, #5D4932,
  spacing 1.12; calendar: tháng 'Tháng 4' (vi.txt calendar.month.4) + 31
  ngày lưới 7×5 (pitch 0.1047×0.1324, đã kiểm chứng từng vị trí); relic
  slots: family name 27px #EEE0BB + slot number 20px #BBB7AF cạnh nhau.
  **O1 (AEGIS vòng 2, 2026-11-21) — 'Odds context' CỐ TÌNH KHÔNG VẼ:**
  TextMesh 'Odds context' (ui_layout.json: size 128, cs 0.00235, tại
  [−1.6574, 1.5689, 2.3825], go_path `.../Enhancement instrument /
  강화 계기판/Odds context`, ACTIVE, sortingOrder null) có nội dung
  RỖNG ("") — nội dung runtime của nó chưa rõ (chuỗi được gán lúc chạy,
  không có trong dữ liệu trích xuất), nên không vẽ được một cách trung
  thực. Không vẽ thêm gì; ghi chú này để lần sau không bị coi là bỏ
  sót. (Nếu CIPHER sau này trích được nội dung runtime của nó thì vẽ
  theo đúng chuỗi đó.)
- **R-06 vung búa — MỘT PHẦN** (`behavior.json` hammer_strike): raise
  0.16/speed, down 0.095/speed, returnOffset 0.10/speed, returnRest
  0.21/speed, impact 0.255s, cooldown 0.64/speed (đã áp; app.js doStrike
  cooldown 0.64s). **SỬA SAU AEGIS D1 (2026-11-21, xem §7):** neo cooldown
  đặt ngay lúc strike bắt đầu (trước Backend.invoke + 255 ms impact wait),
  không phải trong `finally` sau khi chờ — trước đó gate thật ~895 ms nên
  12 tap chỉ được 6 strike. GÓC giơ búa 0.85 rad KHÔNG có nguồn — giữ
  marker TODO-RE. noSwordLockoutSec 3.2 là rule core/issuance-flow, KHÔNG
  implement ở frontend (remake dâng kiếm mới ngay khi tribute) — ghi rõ.
- **R-07 rung camera Fever — ĐÃ SỬA** (`behavior.json` forge_first_person.
  feverShake + rewardShake + quakeShake): fever {x 0.013, z 1.15 (ROTATION
  deg, không phải position), rot 0.38, fovAmp 1.4, freqs [93,117,32,81,67,23]};
  power = envelope(age)×1.3 (impact 1.0); age từ bonus+time_left (nội suy
  theo frame vì update() chỉ chạy 0.2s/lần khi Fever); FOV offset TRỪ
  (−power×(sin(32·age)×1.4+2.5)); rewardShake (Great, decay 7/s); quakeShake
  ghi constants, chưa có trigger ở P0. Hệ số 81 Hz giả định 0.38° (TODO-RE);
  mapping trục yaw/pitch/roll là suy ra, ghi rõ. **Thêm sau AEGIS D5:**
  biên độ Y của Fever shake (0.009) MƯỢN từ rewardShake.y — feverShake
  KHÔNG có Y trong data — đã ghi rõ TODO-RE tại dòng code.
- **R-09 atlas — MỘT PHẦN** (ForgeTax/SwordV2/Surface, `_DetailAtlas` →
  SwordV2DetailAtlas, `_SwordPalette` từng id): áp phần có (màu base =
  palette primary row 0 col 0, emissiveMap = atlas). Scalar params + teal
  emissive (0.04,0.20,0.24)/0.55 KHÔNG có trong dữ liệu (emission material
  = 0) → vẫn là đề nghị remake, giữ marker. ModelScale formula chưa trích —
  dùng scale base [0.59,0.62,0.72] (TODO-RE).
- **R-10 lửa lò — ĐÃ SỬA** (`effects.json` level0 'Low flame'): [2.1324,1.2,
  1.8185], maxP 40, life 0.3–0.75s, speed 0.3, size 0.08–0.18, emit 30/s,
  Box [1.13,0.33,0.025], SoftParticle, baseColor [1.0,0.39,0.045,1.0].
  Thay 3 sprite bằng Points system rate-based + shader size/alpha.
- **R-11 tàn lửa — ĐÃ SỬA** (`effects.json` 'Draft embers'): [2.0013,1.25,
  1.681], maxP 90, life 1.9s, speed 0.45, size 0.021, emit 8/s, Box
  [1.1,0.05,0.45], cùng màu/texture với lửa. BỎ quality tiers.
- **R-12 bụi bay — ĐÃ SỬA** (`effects.json` 4 hệ): Warm [−1.1932,2.023,
  2.1662] / Cold [0.95,1.855,−1.289] / Shelf [−2.468,1.746,1.174] (maxP 32,
  life 8–12s, speed 0.012–0.035, size 0.004–0.01, emit 2/s, drift
  (0.008,0.013,0.004); màu startColor thật: Warm [0.9,0.65,0.32,0.3],
  Cold [0.46,0.63,0.52,0.19], Shelf [0.9,0.74,0.43,0.2]) + Lazy soot
  [2.2429,1.67,1.9342] (maxP 24, life 2.5s, speed 0.2, size 0.18–0.35,
  emit 4/s, [0.25,0.29,0.3,0.13]). Warm dùng SoftFlame; Cold/Shelf KHÔNG
  có texture (procedural soft dot); Lazy soot dùng SoftParticle. **SỬA
  SAU AEGIS D4 (2026-11-21, xem §7):** spawn volume là Box thật trong
  data (effects.json shape.typeName = Box + shape.scale): Warm
  [0.85,0.8,0.65], Cold [1.2,0.95,0.4], Shelf [0.3,0.7,1.3], Lazy
  [0.7,0.3,0.03] — đã thay sphere r=1.0 (comment cũ ghi sai là shape
  chưa rõ).
- **R-13 tia lửa — MỘT PHẦN** (`effects.json` 'Hammer sparks'): [−1.1897,
  1.24,2.2], maxP 90, life 0.44s, speed 2.3, size 0.018, gravity 1.4,
  emit 0/s event-driven, Hemisphere r=0.05 angle 16°. SỐ HẠT BURST mỗi lần
  đập KHÔNG có trong dữ liệu — giữ quality counts + marker TODO-RE.
  **Thêm sau AEGIS D6:** 3 màu tint burst (strike/great/break) cũng KHÔNG
  có nguồn (PS startColor là [1.0,0.39,0.045,1.0]) — đã ghi marker TODO-RE
  riêng.
- **R-15 đèn — MỘT PHẦN** (`behavior.json` fever + dragon_anger): công thức
  radiance Fever thật (intensity = amount×(sin(age×35)+impact×3.5+2.2),
  offset 0.06, FeverColor HSV(frac(age×0.72+hueBase),0.88,1.0), hueBase=0
  TODO-RE) + đèn radiance riêng; fireLight giữ 20 (bỏ boost 26 tự đặt);
  eyePressureByMood + setDanger/warningCount ghi constants (mood source
  là BEHAVIOR M6, chưa thử). Anger→Eye/Breath (0.8/0.5) + quota 2.0 KHÔNG
  có nguồn — giữ marker. **Vị trí đèn radiance:** offset 0.06 ghi trong
  data nhưng ANCHOR chưa rõ — đặt 0.06m từ spawn làm kiếm cháy trắng
  (1/d² × ~280 lần, thấy ở ảnh 04-fever lần 1); đã dời lên 0.4m trên kiếm
  (ghi TODO-RE), kiếm nay đọc được, chỉ nhuộm màu Fever.
- **R-17 dạng kiếm — NÂNG CẤP LỚN** (`behavior.json`
  sword_form_selection.evolution_catalogue + special_lines;
  `sword-catalogue.json` 117 entry + `swords/*.json` 111 prefab):
  dùng EvolutionCatalogue + thuật toán ResolveId (BEHAVIOR.md §8.4) +
  28 special line (hàm `specialLineIdAt`/`specialLineStageOf` đã viết,
  P0 chưa dùng — special line qua merchant, P1); appearance dùng grade
  CAO NHẤT (SyncAppearance); parent = (serial−1)%3, serial =
  (round−1)×3+sword_index+1; branch = splitmix32(serial)%4 (gốc là
  System.Random — ghi rõ là xấp xỉ ổn định, TODO-RE); tên hiển thị =
  manifest viName theo appearance id; lazy-load `swords/<id>.json`;
  fallback base Blade nếu load lỗi. Chỉ 6 id (8/13/18/23/28/33) chưa rõ
  đường chọn → fallback base Blade, TODO-RE. Kiếm gãy giữ appearance lúc
  gãy; kiếm nghỉ trên counter = id 1.
- **R-20 defaults — DÙNG SỐ THẬT** (`behavior.json` settings_defaults):
  master/music/sfx 1.0 (100%), brightness 0.7 (70%), haptics true (row
  disabled trên PC), floorSwordLimit 30, hubControls false = DI CHUYỂN
  TỰ DO. Áp vào `app.js` defaultSettings + `sound.js` 1.0/1.0/1.0 +
  `index.html` slider max 30 + `app/src-tauri/src/main.rs` `Settings::default`
  + `tools/dev-server/src/main.rs` `default_settings()` (KHÔNG có
  `default_settings()` trong forgetax-core — câu chữ cũ trong handoff ghi
  sai, đã sửa — AEGIS D7). Quality + language default chưa
  map được — giữ marker "auto"/"vi".
- **R-24 pitch work view — ĐÃ SỬA** (`behavior.json` forge_first_person):
  pitch = workLookPitch = 10.0° (Range(0,35)); workBlend → đích với tốc
  độ 1−exp(−10·dt); FOV lerp 69→61 theo clamp01(workBlend) + kick×0.35;
  Punch kick cap 1.4. BỎ lookAt −14°. Kick decay rate KHÔNG có trong
  data — dùng 7/s mượn từ rewardImpulse decay (ghi rõ là xấp xỉ).
- **R-26 giấy calendar — MỘT PHẦN:** biên đo từ 31 TextMesh ngày
  (x [−2.6028,−1.9633] rộng 0.64m, y [1.5878,2.2851] cao 0.70m; giấy CAO
  hơn RỘNG) → đổi thành 0.70×0.76 (canvas 512×556), ghi rõ approximation,
  chờ OWNER duyệt kích thước chính xác.

### 2.4 Nhóm B — KHÔNG ĐỤNG ĐẾN (vẫn thiếu, đã chứng minh)

- **R-01 CSS** và **R-14 đèn outcome nháy:** không có trong v2 — giữ nguyên
  giá trị tạm thời + marker, không tự chế thêm. **Thêm sau AEGIS D3
  (2026-11-21):** marker R-14 đã ghi trong code (`scene3d.js`
  buildOutcomeLights/outcomeLightsTick — base 0.35, decay 1.2/s, flash
  +2.2) và marker R-01 đã ghi ở đầu `styles.css` (trước đó 2 món này chỉ
  có trong handoff/proposals, không có marker trong code).
- Ba mục CHƯA THỬ (BEHAVIOR M13 — body 5 tap action, EFFECTS M11 — trigger
  CFXR, BEHAVIOR M6 caller-trace) chưa phải đường cùng — ghi chú để task
  CIPHER sau, không tự kết luận là không lấy được.

### 2.5 Sửa thêm phát hiện khi test (không nằm trong brief, ghi rõ)

- **Nhãn outcome chồng nhau:** nhãn VI dài hơn nhãn Hàn gốc ("ĐẠI THÀNH
  CÔNG" ~240px > cột 0.253m = 189px) → thêm `maxWidth` vào `boardText()`
  (co font tới khi vừa cột 0.22m); tên di vật dài cũng co theo canvas 256px.
  Đây là adaptation cho nhãn VI dài, không phải số gốc.
- **Đèn radiance Fever cháy kiếm trắng:** xem R-15 §2.3 (dời đèn lên 0.4m).
- **Lưỡi kiếm màu teal nhạt:** pixel đo được (157,184,178) — thép xám nhạt
  nhuộm teal (emissive R-09), không phải phát sáng xanh; để nguyên, AEGIS
  đánh giá.
- **Settings panel hiện mặc định cũ (80/60/90):** do `settings.dev.json`
  cũ (file thật ở `tools/dev-server/settings.dev.json`, KHÔNG phải
  `remake/settings.dev.json` như handoff cũ ghi sai) + dev-server binary
  cũ (chạy từ 11:08) — KHÔNG phải lỗi code. Đã xóa file + restart
  dev-server đúng cwd (`tools/dev-server/`); `load_settings` nay trả đúng
  100/100/100/70%/30/free (đã kiểm bằng curl).

---

## 3. Giá trị nào VẪN TẠM THỜI (marker TODO-RE / REMADE trong code)

- R-01 CSS toàn bộ; R-14 outcome nháy (base 0.35, flash +2.2, decay 1.2/s)
  — cả hai nay ĐÃ CÓ marker TODO-RE trong code (AEGIS D3, xem §7).
- R-06 góc giơ búa 0.85 rad; R-13 số hạt burst mỗi đập (quality 10/24/48 ×2
  khi gãy) + 3 màu tint burst (AEGIS D6); R-09 teal emissive
  (0.04,0.20,0.24)/0.55 + ModelScale formula; R-15 anger→Eye/Breath 0.8/0.5
  + quota 2.0 + hueBase 0 + vị trí đèn radiance (0.4m trên kiếm) +
  emitPerSec/emitBurstMax/emitBegin (chưa reproduce — PS phát chưa xác
  định); R-26 kích thước giấy calendar 0.70×0.76 (approximation); R-07 hệ
  số 81 Hz (giả định 0.38°) + mapping trục shake + biên độ Y Fever 0.009
  (mượn từ rewardShake.y — AEGIS D5); R-24 kick decay 7/s (mượn); R-17
  branch = splitmix32 (xấp xỉ System.Random) + 6 id fallback; R-20
  quality/language default ("auto"/"vi"); R-02 glyph em ≈ size ×
  characterSize / 10 (hiệu chuẩn, không phải công thức Unity) + shadow chữ
  (readability aid); R-03 một số chuỗi động (latest-strike/consecutive,
  Fever line) là dịch Việt, không phải chuỗi nguồn + màu latest-strike
  theo outcome (TextMesh default #D1D0C7, runtime colour chưa rõ); R-08
  đèn fill; R-16 hướng kiếm; R-18 vị trí kiếm gãy; R-19 khung+slate Ledger;
  R-21 overlay; R-22 phím PC; R-25 timbre WebAudio; noSwordLockoutSec 3.2
  (chưa implement ở frontend).
- **R-12 spawn volume bụi KHÔNG còn tạm thời** — Box scale thật đã áp
  (AEGIS D4, xem §2.3).
- **CIPHER-continuation (e7db0349) có thể gửi xác nhận v2 chính thức sau; nếu
  mâu thuẫn với mapping trên ở món nào, bằng chứng CIPHER thắng và SENSOR
  phải sửa lại theo CIPHER.**

---

## 4. Kết quả kiểm chứng (chạy lại từ đầu, không dùng lại kết quả cũ)

### 4.1 Rust core — `cargo test -p forgetax-core`: **80/80 PASS**
62 unit + 5 economy parity + 12 mobile parity + 1 doc-test, 0 failed.

### 4.2 Headless browser test — `node tools/dev-server/browser-test.js`: **PASS** (5 lần chạy: 3 lần trước AEGIS + 2 lần sau khi sửa theo AEGIS)
Dev-server port 1420 (đã restart đúng cwd + rebuild), Playwright Chromium +
SwiftShader WebGL2, 1280×720. Lần chạy cuối (sau mọi sửa, đã lưu JSON
`/tmp/sensor2-browser.json`):
- App hiện, canvas + ForgeScene ready + WebGL2: OK. **0 console errors,
  0 failed requests.**
- DOM HUD đã hết (`hudGone: true`).
- **Đập 12 lần qua ANVIL TAP (pacing 700 ms): 12/12 strike (ĐÃ SỬA — xem
  §7 D1; 3 lần trước chỉ được 6/12)** — grade 0 → 3, value 320 → 1,470 G.
- ESC mở settings (`settingsVisible: flex`); bật FPS → counter hiện
  ("0 FPS" — SwiftShader software, không phải FPS thật).
- BELL TAP dâng cống phẩm: OK (round_tributed 0 → 1, sword 2 → 3).
- LEDGER TAP qua ngày: OK (round 1 → 2).
- Fever: đạt được (`feverSeen: true`, active, bonus 4, max 8, time_left 4s).
- 4 ảnh chụp mới trong `remake/.browser-test/` (lần chạy cuối, không dùng ảnh cũ).
- **Giải thích "ĐÃ DÂNG 4,686 G" ở ảnh 02 trước khi dâng (AEGIS thắc mắc):**
  core cộng scrap của kiếm GÃY vào round_tribute theo thiết kế
  (`forgetax-core/src/run.rs:268`, `self.round_tribute += scrap`) — frontend
  chỉ hiển thị `view.roundTribute`. Không phải bug.

### 4.3 Ảnh chụp — tôi đã xem cả 4 ảnh mới (lần chạy cuối, sau sửa AEGIS)
- `01-forge.png`: work view — instrument (+0, "Kiếm cũ mòn", 320 G,
  "GIÁ TRỊ CỐNG PHẨM" (caption mới, nhỏ, đúng vị trí), CHUỖI 0, 5 kênh +
  % vừa cột, không chồng), ledger "CỐNG PHẨM YÊU CẦU / 1,800 G / ĐÃ DÂNG /
  0 G" (chữ ledger nay lớn hơn, đúng (64, 0.009)). Phòng vẫn tối (nửa trái
  gần đen) — đe/kiếm đọc được nhờ emissive + đèn fill.
- `02-after-strikes.png`: +3, "Kiếm đã tôi luyện" (tên appearance theo
  catalogue — R-17 chạy), 1,470 G, "THÀNH CÔNG", CHUỖI 3, nhãn outcome vừa
  cột (nhỏ hơn trước — đúng (128, 0.002617)).
- `03-settings.png`: panel Cài đặt hiện đúng mặc định thật R-20 (Âm lượng
  tổng 100%, Nhạc 100%, Hiệu ứng 100%, Độ sáng 70%, Số kiếm 30 thanh,
  "Di chuyển tự do" được chọn, Hiện FPS bật — do test bật rồi save).
- `04-fever.png`: Fever active ("NHẬP THẦN — 4.0s"), +13, "Kiếm vảy rồng",
  158,946 G; kiếm nhuộm xanh lá (Fever hue) nhưng đọc được hình dạng
  (không còn cháy trắng); nhãn outcome vừa cột.

---

## 7. AEGIS vòng 1 — `[REJECT_TO_SENSOR]` (2026-11-21) + SENSOR đã sửa

**Verdict AEGIS (agent 747b63ba):** `[REJECT_TO_SENSOR]` — 2 lỗi MAJOR + 5
MINOR/OBSERVATION. Không phải Law-0 (không phát hiện giá trị không nguồn nào
bị trình bày như thật mà SENSOR giấu). AEGIS tự chạy cargo 80/80 + browser
test 2 lần + đối chiếu MD5 .zip v2 khớp + kiểm 4 ảnh trong
`remake/.aegis-test/` (01-forge/02-after-strikes/03-settings/04-fever).

| # | Phát hiện AEGIS | SENSOR sửa (2026-11-21) | Kiểm chứng |
|---|---|---|---|
| D1 MAJOR | Cooldown neo trong `finally` sau Backend.invoke + 255 ms impact wait → gate thật ~895 ms, 12 tap chỉ 6 strike (tái hiện tất định 3/3 lần). Nguồn: `behavior.json` hammer_strike.cooldownFormula "nextStrikeTime = now + 0.64/speed", now = lúc đập. | `app.js` doStrike: `strikeReadyAt = now + 640` đặt ngay lúc strike bắt đầu (trước Backend.invoke); `finally` chỉ còn `striking = false`. | Browser test sau sửa: **12 tap → 12 strike** (grade 0→3, 320→1,470 G). |
| D2 MAJOR | Cỡ chữ board sai (size, cs) so với `ui_layout.json` ở 3/6 vị trí: outcome +36% ((48,0.0095) thay vì (128,0.002617)), meter required +41% / captions +93% ((64,0.012) thay vì (64,0.0085)/(64,0.0062)), ledger −21% ((48,0.0095) thay vì (64,0.009)). Comment ghi sai số nguồn. | `scene3d.js` drawInstrument/drawMeter/drawLedger: dùng đúng (size, cs) từng TextMesh (xem §2.3 R-02/R-03) + sửa comment + sửa màu meter captions (#EEE6CD/#D3CBB8) + màu consecutive #D3D1C5 + z riêng từng cột outcome/prob. **Thêm caption '상납 가치' (ACTIVE, đã bỏ sót) → 'GIÁ TRỊ CỐNG PHẨM'.** | Ảnh mới 01/02/04: nhãn vừa cột, không chồng; caption mới hiện đúng vị trí; chữ ledger lớn hơn. |
| D3 MINOR | R-14 và R-01 không có marker trong code (grep = 0) dù handoff/proposals ghi "giữ nguyên + marker". | Marker TODO-RE/R-14 tại `scene3d.js` buildOutcomeLights + outcomeLightsTick; marker R-01 ở đầu `styles.css`. | grep R-14 / R-01 nay có kết quả. |
| D4 MINOR | Comment bụi ghi sai: shape type đã có trong v2 (Box + scale). | `scene3d.js` buildDust: dùng Box scale thật (Warm [0.85,0.8,0.65], Cold [1.2,0.95,0.4], Shelf [0.3,0.7,1.3], Lazy [0.7,0.3,0.03]) thay sphere r=1.0; sửa comment. | `effects.json` shape.typeName = Box, scale khớp. |
| D5 OBS | Fever shake thiếu biên độ Y nguồn: 0.009 là y của rewardShake, mượn không ghi tên. | Ghi rõ TODO-RE tại dòng `py += ... 0.009` (feverShake không có Y). | `behavior.json` feverShake = {x 0.013, z 1.15, rot 0.38, fovAmp 1.4} — không có Y. |
| D6 OBS | Màu burst tia lửa (3 tint) chưa có marker riêng. | Marker TODO-RE tại `scene3d.js` spawnBurst (PS startColor [1.0,0.39,0.045,1.0]). | — |
| D7 OBS | Handoff ghi sai: "forgetax-core default_settings" (grep = 0) + đường dẫn `remake/settings.dev.json` không tồn tại. | Sửa handoff: defaults thật ở `app/src-tauri/src/main.rs:63` `Settings::default` + `tools/dev-server/src/main.rs:235` + `app.js:357`; file settings ở `tools/dev-server/settings.dev.json`. | grep xác nhận. |

**Kết quả sau sửa (chạy lại từ đầu):** cargo 80/80 PASS; browser test 2 lần
exit 0 (lần 2 JSON đầy đủ, `/tmp/sensor2-browser.json`): 12/12 strike, tribute
OK, end-day OK, Fever OK, 0 console errors, 0 failed requests; 4 ảnh mới
trong `remake/.browser-test/` (đã xem cả 4, xem §4.3).

**Trả lời 4 điểm AEGIS nhờ (cập nhật):** (a) 12 tap → 6 strike là **lỗi game
(D1)** — đã sửa, nay 12/12; (b) nhãn outcome sau co font **đã đúng cỡ
TextMesh** sau khi sửa D2; (c) đèn radiance 0.4m **chấp nhận được** tạm thời
(AEGIS xác nhận ảnh 04); (d) mọi số handoff §2 đã đối chiếu lại — nay khớp
hết (D1/D2/D4 đã sửa, D3/D5/D6/D7 đã ghi marker/sửa chữ).

**Còn chờ:** AEGIS vòng 2 kiểm lại (đặc biệt 12 tap → 12 strike + cỡ chữ
board + marker R-14/R-01). Sau đó mới tới OWNER duyệt ảnh chụp — vẫn chưa
push, chưa release.

---

## 8. AEGIS vòng 2 — 1 lỗi MINOR + 2 ghi chú (2026-11-21) + SENSOR đã sửa

**Verdict AEGIS (agent 942c6fae):** 1 lỗi MINOR (E1) + 2 ghi chú (O1, O2).
Không phải Law-0. SENSOR sửa toàn bộ trong phiên này (chỉ `scene3d.js` +
handoff, không đổi logic core).

| # | Phát hiện AEGIS | SENSOR sửa (2026-11-21) | Kiểm chứng |
|---|---|---|---|
| E1 MINOR | Tiêu đề ledger "CỐNG PHẨM YÊU CẦU" bị cắt thành "CÔNG PH...": chuỗi VI ~328px (font textMeshPx(64, 0.009) = 27.1px), anchor nguồn [−2.252, 2.185, 2.605] qua boardXY → canvas x ≈ 384px; 384 + 328 = 712 > canvas ledger 512px → đuôi bị cắt. Chuỗi gốc "요구액" chỉ ~49px nên vừa — lỗi chỉ vì bản dịch VI dài gấp ~6.7 lần. `drawLedger` dùng `fillText` trần, không có `maxWidth` như `drawInstrument` đã sửa ở vòng 1. | `scene3d.js` drawLedger: 5 dòng block Live-run nay đi qua `boardText()` với `maxWidth = floor(bx)` (bx = canvas x của anchor ≈ 384 — bề rộng từ mép trái canvas tới anchor). Title giữ nguyên cỡ ghi (64, 0.009) = 27.1px và lật sang phải (boardText flip có sẵn) thay vì co tới ~10px hay bị cắt. Anchor/size nguồn KHÔNG đổi — đây là adaptation cho chuỗi VI dài, ghi rõ trong comment. Vị trí từng dòng bước dọc theo `basis.up` (lineH px → mét). | SENSOR tự kiểm chứng bằng phép tính: boardXY(anchor) = [384.3, 140.7] (tính lại từ scene-data.json); textMeshPx(64, 0.009) = 27.06px. Ảnh mới 01/02/04: cả 5 dòng đọc trọn vẹn trong work view mặc định ("CỐNG PHẨM YÊU CẦU / 1,800 G / ĐÃ DÂNG / 0 G" ở 01; "ĐÃ DÂNG 1,686 G" ở 02; "3,350 G / 0 G" ở 04). |
| O2(a) | Comment `spawnBurst` ghi sai: "PS startColor là [1.0, 0.39, 0.045, 1.0]". | Sửa câu chữ: startColor của 'Hammer sparks' là TRẮNG [1,1,1,1] (`effects.json` initial.startColor); màu cam [1.0, 0.39, 0.045, 1.0] là `_BaseColor` của material SoftEmber (pid 141) mà PS dùng để render — màu hạt gốc = texture × màu material, startColor không đóng góp. Số hiển thị (3 tint burst) KHÔNG đổi — vẫn TODO-RE như cũ. Đã kiểm chứng từ effects.json (cả 'Low flame' cũng startColor trắng [1,1,1,1]). Comment ở buildFlames/buildEmbers đã ghi đúng từ trước ("the material colour; startColor is white") nên không đụng đến. | grep effects.json: Hammer sparks initial.startColor.color = [1.0, 1.0, 1.0, 1.0]; SoftEmber colors._BaseColor = [1.0, 0.39, 0.045, 1.0]. |
| O2(b) | Comment `drawRelicSlots` trích mảng màu "[1, 0.87, 0.78, 0.55] / [1, 0.73, 0.72, 0.69]" không có trong `ui_layout.json`. | Sửa câu chữ: mảng thật là 'Relic family' [1.0, 0.501961, 0.74902, 0.85098] và 'Engraved slot number' [1.0, 0.431373, 0.478431, 0.501961] ([A,B,G,R] linear → sRGB). Hex đang dùng (#EEE0BB/#BBB7AF) khớp màu TextMesh thật trong ±1 nên GIỮ NGUYÊN số. | Đối chiếu ui_layout.json textmesh_elements (Relic family / Engraved slot number, 8 slot mỗi loại). |
| O1 | TextMesh 'Odds context' (128, 0.00235) tại [−1.6574, 1.5689, 2.3825], ACTIVE, nội dung rỗng. | KHÔNG vẽ thêm gì — nội dung runtime chưa rõ nên không vẽ được một cách trung thực. Đã GHI CHÚ rõ trong §2.3 R-03 (xem trên) để lần sau không bị coi là bỏ sót. | ui_layout.json: 'Odds context', content "", go_active true. |

**Không đụng đến (theo brief):** R-01/R-14 (vẫn thiếu, giữ marker); phòng tối
nửa trái là hệ quả R-08 đã duyệt; FPS headless 0–1 là SwiftShader.

**Kết quả kiểm chứng sau sửa (chạy lại từ đầu, 2026-11-21 tối):**
- Rust core — `cargo test -p forgetax-core`: **80/80 PASS** (62 + 5 + 12 + 1).
- Headless browser test — `node tools/dev-server/browser-test.js` (2 lần, lần
  2 lưu JSON `/tmp/sensor3-browser.json`): **PASS, exit 0, 0 console errors,
  0 failed requests.** Dev-server rebuild + restart đúng cwd
  (`tools/dev-server/`, đã xóa settings.dev.json cũ nên mặc định R-20 thật
  có hiệu lực). 12 tap anvil → **12/12 strike**; ESC settings OK
  (100/100/100, độ sáng 70%, 30 kiếm, "Di chuyển tự do"); BELL TAP tribute
  OK (round 1 → 2); LEDGER TAP qua ngày OK (round 2 → 3); Fever đạt được
  (active, bonus 4, max 8, time_left 4s); FPS counter hiện "0 FPS"
  (SwiftShader, không phải FPS thật).
- **Lưu ý về grade/value sau 12 strike (lần chạy này: +0 / 320 G):** kiếm
  GÃY trong lúc đập (outcome GÃY thấy ở ảnh 02, scrap 1,686 G cộng vào
  round_tribute theo thiết kế core `run.rs:268`), kiếm mới phát ra ở +0 /
  320 G — hành vi game bình thường, KHÔNG phải hồi quy từ sửa E1 (E1 chỉ
  đổi cách vẽ chữ ledger + 2 comment). Lần chạy trước của vòng 1: +3 /
  1,470 G — khác nhau do ngẫu nhiên outcome.
- 4 ảnh mới trong `remake/.browser-test/` (lần chạy cuối, đã xem cả 4):
  01 — ledger đọc trọn vẹn, instrument +0 / "Kiếm cũ mòn" / 320 G; 02 —
  ledger "ĐÃ DÂNG 1,686 G", kiếm mới "Kiếm sắt tạm ổn", outcome GÃY;
  03 — settings đúng mặc định thật R-20; 04 — Fever "NHẬP THẦN — 4.0s",
  +8, 22,778 G, kiếm nhuộm xanh Fever nhưng đọc được hình dạng, ledger
  "3,350 G / 0 G" đọc trọn vẹn.

**Còn chờ:** AEGIS vòng 3 kiểm lại (đặc biệt E1 đã hết cắt + O2 đã sửa câu
chữ + toàn bộ như vòng 2). Sau đó mới tới OWNER duyệt ảnh chụp — vẫn chưa
push, chưa release.

---

## 5. Những gì tôi KHÔNG làm (theo Quy chế + luật OWNER)

- Không tự nhận test xong để báo OWNER — bản này giao cho AEGIS kiểm thử độc lập.
- Không tự duyệt bất kỳ món remake nào ngoài lệnh duyệt 19:47 của OWNER;
  không remake thêm món nào (R-01, R-14 giữ nguyên).
- Không báo cáo vượt cấp lên OWNER. Không push, không release.
- Không sửa code ngoài phạm vi brief + 2 sửa phát hiện khi test (§2.5,
  đều ghi rõ).

---

## 6. Bàn giao cho AEGIS (Nhân viên 3)

Kèm theo báo cáo này: [REMAKE-PROPOSALS.md](sandbox://workspace/forgetax-mobile/remake/REMAKE-PROPOSALS.md)
(cập nhật trạng thái từng món) + 4 ảnh chụp mới trong `remake/.browser-test/`
(01-forge, 02-after-strikes, 03-settings, 04-fever) + bản đồ ánh xạ §1 +
danh sách tạm thời §3. AEGIS kiểm thử độc lập theo đúng vai trò của nó
(xem brief giao việc riêng — spawn ở §7 của task SENSOR).

**Lưu ý cho AEGIS:** kiểm tra kỹ (a) 12 tap → 6 strike (mục 4.2) có phải
lỗi game hay chỉ là headless chậm; (b) nhãn outcome sau khi co font có
còn đúng cỡ ghi trong TextMesh không (ghi rõ là adaptation); (c) vị trí
đèn radiance Fever (0.4m trên kiếm) có chấp nhận được không, hay cần
anchor khác; (d) mọi số trong §2 đối chiếu lại với .zip v2.

---

## 9. FIX ROUND 2026-11-21 (sau live test v0.1.0-p1 của OWNER, 23:32) + bổ sung 00:21–00:22

**Bối cảnh:** OWNER test live bản v0.1.0-p1 trên EliteBook (2 video: remake p1
46.6s + gốc iPhone 187.9s). App boot được, đập/tribute/end-day chạy, run kết
thúc đúng luật — nhưng 4 lỗi: (1) KHÔNG ĐI ĐƯỢC (zero code WASD), (2) FPS 9–16,
(3) phòng tối đen + vệt xanh ở lò, (4) âm thanh sai hoàn toàn (FFT-proven:
track 46s bị thống trị bởi 110 + 165 Hz = 2 drone oscillator trong sound.js
cũ). Manager xem hết video 2 (38 frame, 5s/frame) + OWNER ra lệnh bổ sung
23:47 (TITLE + ĐIỀU KHIỂN + SOUND chuẩn + RỒNG thật) và 00:21–00:22 (kiểm tra
lại vệt xanh có phải con ma + merchant = ghost, P1). **Chưa push, chưa release
— chờ AEGIS kiểm lại rồi OWNER duyệt ảnh.**

### 9.1 Từng fix + nguồn số liệu

| # | Fix | File | Nguồn số liệu |
|---|---|---|---|
| F-1 | Đi bộ WASD + mũi tên (2.09 m/s, eye Y 1.76, bounds phòng chính X −2.68…2.81 × Z −2.15…2.78, colliders tròn đe/lò/quầy TODO-RE); "Góc nhìn cố định" = khóa vị trí; drag-look giữ nguyên; workBlend 1↔0 theo 1−exp(−10dt); đập glide về work eye 3.5 m/s, snap 0.1 m, timeout 0.75 s, slerp exp(−12dt) | `scene3d.js` applyCamera/setMoveKeys/setControlsMode/requestWorkView + `app.js` keydown/keyup | `behavior.json` forge_first_person (walkSpeedBase 2.09, moveToWorkStandSpeed 3.5, workStandReach 0.1, workArriveTimeout 0.75, workBlendRate, rotationSlerpRate); room bounds LAYOUT.md §2 (X −3.0…3.2 × Z −2.5…3.1); colliders/margin TODO-RE |
| F-1/E | E = nhặt/đặt kiếm ("Lấy kiếm", reach 2.2 m): đe (cầm kiếm hiện tại → đe trống, đập chỉ vung + whoosh, không gọi backend), sàn (kiếm gãy), quầy (kiếm nghỉ — CHỈ cầm xem, KHÔNG được đặt lên đe vì desync core → P1 follow-up); kiếm cầm tay gắn camera (lưỡi lên-phải 55°, TODO-RE pose); click 1755 Hz khi nhặt/đặt | `scene3d.js` tryPickup/tryPlaceOrDeposit/setHeldSword/clearHeldSword + `app.js` doPickup/heldSword | `behavior.json` reachFreeMove.sword 2.2, noSwordLockoutSec 3.2; `touch.take_sword` "Lấy kiếm" (vi.txt); pose cầm tay tune theo video 2 f_035 (TODO-RE) |
| F-2 | Low THẬT SỰ giảm cost: boot-time antialias OFF + render scale 0.75 (WebGL AA không đổi được runtime), live pixelRatio 0.75, burst ×0.5, tắt 6/11 Spot (giữ Fire, Work lamp, Eye, Breath, Quota). Đo: pixelRatio + lightsOn (draw call KHÔNG đổi khi tắt đèn — meshes vẫn draw; call count đo được 123→131 là nhiễu trạng thái scene, không phải proxy) | `scene3d.js` init/setQuality/burstMultiplier/getStats + `app.js` boot (init opts quality) | WebGL spec (AA boot-time); 11 Spot thật từ `scene-data.json` lights |
| F-3a | Brightness 20–200% bằng EXPOSURE (toneMappingExposure = 1.15 × (b/70), clamp [0.2, 3.5]); XÓA div phủ đen + slider max 100→200. Fill tăng 2 lần: 4.0/2.5/14/12 → 7.0/4.0/22/18 → 18.0/9.0/40/20 (fireGlow dời ra trước miệng lò [2.95, 1.35, 2.75] vì ở 32 trong miệng lò cháy trắng bề mặt trong) | `scene3d.js` setBrightness/buildLights + `index.html` (xóa overlay, max 200) + `styles.css` (xóa rule) + `app.js` applySettings | Original brightness 200% (video 2, Ethan chơi 200%), default 70% (`behavior.json` settings_defaults); fill là R-08 approximation (baked lightmaps vắng mặt) |
| F-3b | XÓA teal emissive + emissiveMap khỏi lưỡi kiếm (cả 2 vị trí: catalogue + base Blade); bỏ preload `SwordV2DetailAtlas.png` | `scene3d.js` buildCatalogueSword/buildSwordPartMesh | CIPHER v2: SwordV2 emission ≈ 0 ("emission material = 0") — atlas là detail map, không phải glow map. Đây là nguyên nhân vệt xanh (xem §9.4) |
| F-4 | Viết lại sound.js toàn bộ theo phổ WAV (bảng `remake/tools/fft-ref.py`): XÓA drone 110+165 Hz; XÓA `playCoin()`; rebuild strike/Great/break/bell+feed/fever/set/crackle; DynamicsCompressor (−12 dB, 8:1) + master gain 0.9; `renderOffline()` verify bằng FFT JS | `sound.js` (rewrite) + `app.js` doTribute (bỏ playCoin) | 101 WAV tham chiếu (không ship file gốc); xem bảng phổ chi tiết §9.2. Great đổi từ strike+ring → ring thuần (3434 là 99% 1–4 kHz, không low end) sau lần đo 1 |
| F-5 | Menu pause: nút hành động Tiếp tục (đóng) / Sổ sưu tập (DISABLED, codex P1) / Chơi lại từ đầu (doNewRun) / Về màn hình chính (showTitle); tiêu đề panel "Menu"; KHÔNG hiện "Gỡ quảng cáo" (không có key vi.txt, không có ads) | `index.html` (menu-actions) + `styles.css` (.menu-btn) + `app.js` bindMenuButtons + `i18n.js` (menu2.*) | Video 2 f_008 (5 nút + settings); `menu2.resume/restart/returnTitle/codex` (vi.txt) |
| F-6 | Ledger: giấy kem + lưới xác suất 5 cột × 20 hàng (ô + xanh / □ trống, tổng dưới mỗi cột) từ LIVE core data; "TỔNG {n}", "TRỌNG SỐ GÃY x{seal}", note; giữ 5 dòng live + anger line | `forgetax-core/src/run.rs` (`deck_raw()` + `seal_factor()` + 2 tests), `app/src-tauri/src/main.rs` + `tools/dev-server/src/main.rs` (snapshot thêm `deck` + `seal`), `scene3d.js` drawLedger, `app.js` buildView, `i18n.js` (template.ticket_total, ui.8becf7224b, ui.ticket_note) | `fill_deck` (tickets.rs:109) + `SEAL_RISK` 0.85 (config.rs:80); starter deck [9,2,5,18,4]=38 (tính từ fill_deck); video 2 f_018 (4/12/16/16/20=68 late-game — KHÔNG dùng số này, chỉ dùng làm mẫu layout); Ledger GO 409 mesh null (không có texture giấy in sẵn) |
| F-7 | Lò rèn chuẩn f_015: ghi kim loại tối + than cam phát sáng có chiều sâu + lửa cam — đạt được nhờ F-3b (xóa xanh) + F-3a (sáng + fireGlow đúng vị trí); verify bằng ảnh 07-furnace.png | (không code riêng — hệ quả F-3a/F-3b) | Video 2 f_015/f_016; than Ember [0.5,0.11,0.01] + Soot (layout.json) |
| F-8 | Fever phủ toàn màn hình: overlay teal DOM (opacity = feverAmount × 0.45, TODO-RE) + rainbow glow kiếm (FeverColor HSV, đã có từ R-15) | `index.html` #fever-overlay + `styles.css` + `app.js` loop() | Video 2 f_027/f_033; `beginScreenFlash` 0.00015176348 (≈0, không có giá trị tint) |
| F-9a | Vòng vàng tribute: torus vàng (r 0.55, #d4af37) ôm kiếm, fade ~1s, tại đe (bell-click) hoặc chuông (E-deposit) | `scene3d.js` tributeRing/tributeRingTick + `app.js` doTribute/doPickup | Video 2 (frame tribute); KHÔNG có mesh vòng trong extraction → REMADE effect |
| F-9b | Sàn: verify floor swords render sau gãy + kiếm nghỉ trên quầy (đã có từ trước, nay hết xanh sau F-3b) | (verify bằng ảnh 04-after-strikes.png) | Video 2 f_035 (3 kiếm trên sàn, thép thường) |
| F-9c | Banner lớn "ĐẠI THÀNH CÔNG / ×{ratio}" ~1.6s khi Great (ratio = value mới / value cũ, số thật) | `index.html` #great-banner + `styles.css` + `app.js` showGreatBanner/doStrike | Video 2 f_030; presentation REMADE (DOM, không phải HUD frame) |
| F-10 | Title screen: boot vào bảng đồng "FORGE TAXX / Bắt đầu game" (50/49/1 Y HỆT video) + "Chạm để tiếp tục" (bob 7px); click → fade → resume run đang chơi hoặc new_run; "Về màn hình chính" quay lại title | `index.html` #title-screen + `styles.css` (.title-plaque) + `app.js` showTitle/hideTitle/startFromTitle + `scene3d.js` setTitleView/setWorkView + `i18n.js` (menu2.startGame, start.exit, ui.bb3ad48c0b, ui.826f8ad351) | Video 2 f_003/f_006; `ForgeRoom.get_StartScreenChances()` = [0,0,500,500,0] (disassemble libil2cpp.so, Capstone); `PressStartScreen` KHÔNG roll; mapping 50/49/1 TODO-RE (R-28); pose title TODO-RE (R-29); "Chạm để tiếp tục" (vi.txt) |

### 9.2 Bảng phổ âm thanh (đo bằng `remake/tools/fft-ref.py`, numpy, WAV 16-bit mono 44.1 kHz)

| Trigger | WAV | Đặc tính đo được | Synth mới |
|---|---|---|---|
| strike | 3455_basic_swing (1.00s, RMS 0.135, peak 0.861, centroid 7102 Hz) | <200 Hz 41%, 4–8k 32%, >8k 21%; partials 22 Hz (1.00), 6262 Hz (0.65); RMS đỉnh 300–400 ms, chết sau 0.5s | thump 70→38 Hz 0.3 + whoosh 2k→8k 0.4 + clang 6262/4300/3100/8400 Hz |
| Great | 3434_GreatStrike (1.15s, RMS 0.138, peak 0.730, centroid 3186 Hz) | 1–4k 99%; 1628 Hz (1.00), 4303 (0.08), 3254 (0.06); decay ~0.3s | ring thuần 1628 (0.5) + 4303/3254/2430 (KHÔNG thump/whoosh — lần 1 sai: strike+ring cho peak 1.087 + chỉ 44% 1–4k) |
| break | 3476_SwordBreak (1.20s, RMS 0.078, peak 0.758, centroid 3141 Hz) | <200 35%, 200–1k 33%, 1–4k 28%; 182 (1.00), 122 (0.86), 2423 (0.65), 732 (0.45), 1052 (0.41) | thud 150→70 Hz 0.25 + 182 (0.18) + shatter 732/1052/2423 + noise 2k 0.35 |
| bell | 3407_TributeBell (2.42s, RMS 0.093, peak 0.648, centroid 4625 Hz) | 1–4k 92%; INHARMONIC 3603 (1.00), 6705 (0.20), 1302 (0.17); decay 2.4s | 3603 (0.38) + 1302 (0.07) + 6705 (0.08) + feed 116/220 Hz + scrape 3.2 kHz |
| fever | 3452_FeverOverdrive (7.60s file, RMS 0.166, peak 0.819) | <200 Hz 81%; fundamental **36 Hz** (1.00) + 72/108/216 Hz (73/215/322 Hz đo trước là harmonic 2×/3×); sustain ~3.8s in-game | sine 36/72/108/216 Hz, attack 0.3s, sustain 3.8s |
| set | 3404_SwordSet (0.09s, RMS 0.053, peak 0.360, centroid 2130 Hz) | 1–4k 92%; 1755 Hz (1.00), 1143 (0.32) | click 1755 (0.25) + 1143 (0.08) |
| feed | 3411_SwordFeed (1.06s, RMS 0.051, peak 0.289, centroid 3471 Hz) | 116/220 Hz rumble + scrape ~3.2 kHz | (trong playTribute) 116/220 Hz + noise 3.2 kHz |
| crackle | 432_Hearth_crackle_loop (58.46s, RMS 0.0055 — RẤT nhỏ, peak 0.801) | pops broadband 5–8 kHz + bed ~120 Hz | pops ngẫu nhiên 5–8 kHz (0.04–0.12, 20–50 ms, mỗi 0.25–1.2s) + bed 120 Hz 0.012 |
| thump ref | 3402_impact_heavy_tail (2.48s, RMS 0.180, peak 0.882, centroid 148 Hz) | 100% <200 Hz, 32 Hz (1.00) | (tham chiếu cho thump của strike) |

**Kết quả FFT offline (lần 1, trước rebalance):** tribute/bell, fever, set, crackle
PASS (bell: peak 0.508, centroid 3685, band 1–4k 0.97, partials 3596/6697/1292 —
khớp 3603/6705/1302 gần như chính xác; fever: peak 0.428, centroid 76, <200 Hz
0.98, partials 43/108/215; set: peak 0.299, centroid 1595, partials 1766/1141;
crackle: RMS 0.0085 < 0.02). Strike/great/break FAIL (thump quá to: strike 89%
<200 Hz, centroid 3637; great peak 1.087 + chỉ 44% 1–4k; break 80% <200 Hz,
peak 0.963). **Đã rebalance (lần 2, xem §9.1 F-4) — kết quả lần 2: 5/7 PASS**
(great PASS sau khi đổi thành ring thuần: peak 0.554, band 1–4k 0.99, partials
1637/4307/3252/2433; strike còn band[0] 0.64 + band[4] 0.01; break còn peak
0.982). **Rebalance lần 3 (thump strike 0.25, whoosh 0.36 + highpass 8k 0.12,
partial 8400 Hz 0.12; break noise 0.25 + 2423 Hz 0.3): FFT 7/7 PASS, 5 lần
chạy liên tiếp** (`tools/dev-server/fft-test.js`, nhanh, không cần full test):
strike peak 0.73–0.79, centroid ~7800–8056 (≈ ref 7102), bands [0.53, 0, 0.06,
0.35, 0.06], partials 65/6266/4307/8398/3101; break peak 0.87–0.88, centroid
~3200, bands [0.49, 0.17, 0.34]. Lưu ý: peak của strike/break dao động theo
noise ngẫu nhiên (0.856 một lần, 0.954 lần khác) nên cần margin dưới 0.95 —
đã giảm gain để có margin.

### 9.3 Kết quả kiểm chứng fix round (lần 1 — test đầy đủ, EXIT=0, 2026-11-22)

- `cargo test -p forgetax-core`: **82/82 PASS** (80 cũ + 2 mới:
  `deck_raw_starter_is_9_2_5_18_4`, `seal_factor_is_0_85_with_starter_seal`).
- Headless browser test: **EXIT=0** (6.7 phút), **0 console errors, 0 failed
  requests**. Title hiện lúc boot → click → run playing, deck [9,2,5,18,4] +
  seal 0.85 ✓. **WASD: camera [0.15,1.76,−0.05] → [−0.687,1.76,1.487],
  1.75 m** ✓. **E: held=true sau E, held=false sau E lần 2** ✓ (ảnh 03-held:
  kiếm cầm tay hiện, lưỡi lên-phải, chuôi dưới-giữa — nhưng lưỡi còn đen vì
  fill lúc đó mới 7.0; đã tăng lên 18.0 sau đó). 12 đập → grade 0→5, value
  320→7,375 G ✓. Brightness: exposure 200% = 3.286, 70% = 1.15 ✓. Menu:
  hiện, tiêu đề "Menu", đủ 4 nút, codex disabled, Home → title lại → click
  → resume round 1, Resume đóng panel ✓. Tribute ✓ (round_tributed 0→1).
  End day ✓ (round 1→2). Fever ✓ (active, time_left 4s) + Great banner ✓
  (greatSeen: true). Low: pixelRatio 0.75 + đèn 5/11 (call count 123→131 là
  nhiễu trạng thái scene — không dùng làm proxy). FPS counter "0 FPS"
  (SwiftShader ~0.3 fps headless — không phải FPS thật; FPS thật chỉ OWNER
  test live mới kết luận).
- **Lỗi test gặp khi chạy (đã sửa):** (1) lần 1: dev-server start sai cwd
  (`remake/` thay vì `tools/dev-server/`) → `../../app/frontend` trỏ sai →
  404 → Chrome load bản cache cũ (không có title-screen). Sửa: start với arg
  `app/frontend` + xóa `/tmp/ft-chrome-test`. (2) lần 2: anvil tap target
  lọt khỏi màn hình sau khi đi bộ (camera quá gần đe, target y=950). Sửa:
  `setWorkView()` trước khi tap.
- **Ảnh đã xem (lần 1):** 00-title (bảng đồng đẹp, 50/49/1 đúng, lò sau lưng
  không xanh), 01-workview (không xanh; lưới ledger kem + ô + xanh hiện rõ;
  phòng vẫn tối nửa trái — đã tăng fill sau đó), 02-walked (đi bộ tới sát
  board, lưới ledger rõ), 03-held (kiếm cầm tay, lưỡi đen — đã tăng fill),
  07-furnace (ghi kim loại tối + than cam, KHÔNG xanh — nhưng miệng lò cháy
  trắng do fireGlow 32 trong miệng lò; đã giảm 20 + dời ra trước lò),
  10-fever (wash teal toàn màn hình ĐÃ hiện; overlay opacity đọc 0 tại thời
  điểm check vì envelope flicker — xem §9.5). **Chưa xem:** 04-after-strikes,
  05-bright200, 06-bright70, 08-menu, 09-great, 11-ledger (lần 1) — xem sau
  lần chạy 2.

### 9.4 Vệt xanh KHÔNG phải con ma — bằng chứng loại trừ (bổ sung 00:21–00:22)

OWNER hỏi: vệt xanh có thể là mesh GhostMerchant render sai? **Đã kiểm tra
ngay, kết luận: KHÔNG PHẢI. Vệt xanh là emissive teal của kiếm (R-09, đã xóa).**
Bằng chứng:
1. Video 1 f_010/f_014/f_017: vệt xanh có **HÌNH KIẾM rõ ràng** (lưỡi + chắn
   tay + chuôi, nằm phẳng trên sàn trước đe) + kiếm trên đe phát xanh dọc
   lưỡi (cùng emissive). Không có figure trùm đầu / áo choàng / mặt.
2. Ghost figure **KHÔNG CÓ mesh trong level0**: layout.json (3,672 objects)
   chỉ có anchor rỗng "Ghost merchant — wall visit" (go 3275) tại
   [2.84, 0, −0.5], mesh null, materials [], KHÔNG có child nào, KHÔNG có
   skinned mesh nào trong toàn bộ level0. `scene-data.json` (303 objects)
   cũng không có object ghost/merchant nào. Ghost là prefab spawn lúc runtime
   (ForgeGhostMerchant) — mesh/texture của nó KHÔNG có trong scene level0.
3. Anchor ghost ở tường +X cạnh quầy [2.84, 0, −0.5] — KHÔNG phải vị trí vệt
   xanh (sàn trước đe / khu lò [2.236, 1.927]).
4. Vật liệu xanh duy nhất trong data là "Ghost blue stamp" [0.1, 0.42, 0.48]
   trên các stamp "Merchant scales" tí hon (scale 0.0325, ~6cm) trên lịch —
   sai vị trí và quá nhỏ.
5. Cụm lò chỉ có Ember [0.5, 0.11, 0.01] (cam) + Soot [0.023, 0.028, 0.031]
   (đen) — không có xanh.
6. Ảnh chụp sau khi xóa emissive (F-3b) không còn xanh ở cùng góc nhìn
   (00-title, 01-workview, 02-walked, 03-held, 07-furnace).
7. **Cần CIPHER follow-up cho P1:** tìm prefab + materials của ghost figure
   trong APK (không phải level0) — xem R-36.
- **Merchant = Ghost (đã xác nhận từ data, manager 00:21):** ForgeGhostMerchant
  + MerchantBanterCatalog + MerchantArrival (3456, 3.12s) + MerchantGoods +
  MerchantStallLayout; vi.txt: "Vật dùng một lần do thương nhân ma bán",
  "Thương nhân hiện không mở bán", "Thương nhân ma · từ vòng {round}",
  "3 lượt mua miễn phí mỗi khi Thương Nhân Ma xuất hiện", 28 special lines có
  merchantNameKey/merchantWeight, OwnerFreeMerchantBuys = 3. Shop/cấp đồ là P1.
- **"Sau 3 ngày họ sẽ cấp đồ" — ĐÃ XÁC MINH (manager, 2026-11-22 00:42,
  ghi trong MEMORY.md):** ghost merchant ghé mỗi 3 ngày, lần đầu ngày 3
  (StockConsumableSlots forces ward+rewind; goods min-days 3/6/9 pattern);
  cấp nhiều món: 28 special swords (merchantNameKey), consumables, relics,
  3 lượt mua miễn phí mỗi lần xuất hiện. **TICKETS ĐỔI TỈ LỆ — ĐÃ XÁC NHẬN:**
  ticketdamage/tickethold/ticketsuccess/ticketgreat, mỗi cái +1 ticket của
  outcome đó cho run (BoughtTickets); Economy liệt kê 6 ticket goods; ngược
  lại, knife relic trừ 1 base ticket (giảm tỉ lệ đó). Chi tiết vào P1
  merchant spec (R-36). Không code trong vòng này.

### 9.5 Giá trị VẪN TẠM THỜI (bổ sung sau §3)

- Title 50/49/1 mapping (R-28, TODO-RE) + title camera pose (R-29, TODO-RE).
- Fever overlay opacity 0.45 (R-31, TODO-RE); **lưu ý:** overlay theo
  `feverAmount` (FeverEnvelope hash-gated) nên NHẤP NHÁY theo envelope (lúc
  0 lúc 0.45) — ảnh 10-fever bắt được lúc ON (teal rõ), nhưng check opacity
  đọc 0 tại thời điểm khác. AEGIS/OWNER xem có chấp nhận flicker này không,
  hay wash nên steady trong suốt Fever (đó sẽ là lệch khỏi envelope).
- Tư thế kiếm cầm tay (R-34) + colliders đi bộ + margin 0.35 m (R-34, TODO-RE).
- Vị trí lưới ledger trên giấy (R-33, REMADE layout; giá trị thật).
- Vòng vàng tribute (R-30, REMADE) + banner Great (R-32, REMADE).
- Fill lights 18.0/9.0/40/20 (R-08, tune từ ảnh chụp — nếu OWNER vẫn thấy tối
  trên EliteBook thì tăng tiếp; baked lightmaps thật vẫn vắng mặt).
- Âm thanh: timbres tổng hợp là REMADE (R-35); Great đổi thành ring thuần
  sau lần đo 1 (3434 là 99% 1–4 kHz — suy luận "Great cue thay basic swing",
  chưa có chứng minh code-level nào trigger thay thế; AEGIS kiểm lại).
- i18n: `ui.outcome_damage` vi sửa "HỎNG" → "HƯ HẠI" (nhãn gốc trên board,
  video 2 f_027 CCW + vi.txt `ui.ea06c739f7`).
- Test note: draw-call count KHÔNG phải proxy cho Low (nhiễu trạng thái
  scene); proxy đúng là pixelRatio + lightsOn. FPS headless "0 FPS" là
  SwiftShader, không phải FPS thật.

### 9.7 Phát hiện sau lần chạy 2 + sửa bổ sung + kết quả lần chạy 3 (2026-11-22)

**Ba lỗi mới phát hiện khi xem ảnh lần chạy 2 (không có trong brief gốc):**

1. **Work view SAI DẤU PITCH (R-24, nghiêm trọng nhất):** ảnh 01-workview /
   04-after-strikes lần 1–2 cho camera nhìn LÊN trần + đèn treo, board ở mép
   dưới, đe ngoài khung — dù đã đập 12 lần (mỗi lần đều `requestWorkView()`).
   Nguyên nhân: `workPitch = degToRad(+10.0)`; trong Three.js YXZ rotation.x
   dương = nhìn LÊN (`dirToYawPitch`: pitch = asin(ny), ny âm khi nhìn xuống;
   test `setView(-133,-12)` cho ảnh lò đúng chứng minh pitch âm = nhìn xuống).
   workLookPitch 10° của gốc là 10° XUỐNG DƯỚI đường ngang (đe dưới mắt; video
   2 f_025–f_033 cho đe ở giữa khung). Đã sửa thành `degToRad(-10.0)` — ảnh
   lần 3: đe ở GIỮA khung, bảng bên phải, khớp video 2. Lỗi này có từ trước
   fix round (R-24 V2) nhưng AEGIS vòng 3 không bắt được (board/ledger vẫn
   còn trong khung, chỉ thấp xuống).
2. **Miệng lò cháy trắng — chẩn đoán bằng `tools/dev-server/furnace-diag.js`
   (5 biến thể, đã lưu `diag-a…e.png`):** trắng SỐNG SÓT khi tắt fill
   (hemi/amb 0) VÀ khi tắt flames — chỉ biến mất khi tắt fireGlow. Nguyên
   nhân: fireGlow (20) chiếu vào đá "Rough exposed stone core" (albedo 0.31)
   quanh miệng lò (20/0.85²×0.31/π ≈ 2.8, clip trắng); hemi 18 một mình đã
   cho đá đó 1.8. (Spot 'Fire' 20 + 'Firebox internal' 7 trỏ RA NGOÀI lò
   theo euler — không chiếu vào miệng lò; `buildLights` set target đúng từ
   euler, không phải bug.) Đã sửa: hemi 18→8, amb 9→3, fireGlow 20→6 (xem
   R-08). Ảnh lò lần 3: ghi tối + than cam chunky + gạch ấm, chỉ còn glow
   ấm ở giữa (không clip trắng). Lưu ý: gỗ tối (0.02) không đọc được từ fill
   đều — nó đọc nhờ workGlow + spot cục bộ (đúng kiểu phòng gốc: góc tối,
   vùng làm việc sáng).
3. **Lưỡi kiếm đen (silhouette):** material kiếm catalogue `metalness: 0.75`
   + KHÔNG có `scene.environment` — kim loại không có gì để phản chiếu
   (diffuse chỉ còn (1−0.75)=0.25) nên lưỡi đọc như bóng đen (ảnh 03-held
   lần 1–2). Đã sửa (R-08): PMREM env từ chính phòng
   (`pmrem.fromScene(scene, 0.04)`, `environmentIntensity 0.5`, sinh 1 lần
   lúc boot) — lưỡi giờ có sheen kim loại (ảnh 03-held / 01-workview lần 3).
   Kiếm grade 0 vẫn tối (palette gốc nâu [86,68,56] — đúng dữ liệu), nhưng
   đọc là kim loại chứ không phải silhouette đen.

**Kết quả lần chạy 3 (full test, EXIT=0, 592s — lâu hơn do PMREM boot):**
- `cargo test -p forgetax-core`: **82/82 PASS** (64 + 5 + 12 + 1).
- Browser test EXIT=0, **0 console errors, 0 failed requests**; **FFT 7/7
  PASS** trong full test (strike peak 0.742, centroid 7970; great 0.554;
  break 0.846; tribute 0.508; fever 0.428; set 0.299; crackle 0.033).
- Walk 1.05 m (W 30s, headless chậm — lần 1 là 1.75 m; game time chạy
  ~0.03s/s thực nên quãng đường dao động theo tốc độ frame). E: held
  true→false ✓. 12 đập → grade 5, value 7,375 G ✓. Brightness exp 200% =
  3.286, 70% = 1.15 ✓. Menu đủ nút, Home → title → resume round 1 ✓.
  Tribute ✓, endday ✓ (round 1→2), Fever ✓ + Great ✓. Low: pixelRatio
  0.75 + đèn 5/11.
- **Ảnh lần 3 đã xem hết (12 ảnh):** 00-title (đã xem lần 1–2, không đổi),
  01-workview (pitch đúng: đe giữa, bảng phải), 02-walked (đi bộ tới sát
  board, lưới ledger thấy rõ), 03-held (lưỡi có sheen kim loại), 04-after-
  strikes (cùng work view), 05-bright200 (phòng sáng, đọc được), 06-bright70
  (mặc định: đe/kiếm/board/ledger/rack đều đọc được; góc trái tối — đúng
  kiểu phòng gốc), 07-furnace (hết trắng), 08-menu (đủ nút), 09-great
  (**banner KHÔNG lọt vào ảnh** — xem dưới), 10-fever (wash teal toàn màn
  hình + floor swords hiện), 11-ledger (giấy kem + lưới, cận cảnh 02 rõ hơn).
- **Great banner — đã chứng minh riêng (`tools/dev-server/great-banner-test.js`,
  ảnh `09b-great-banner.png`):** "ĐẠI THÀNH CÔNG / ×3.5x" chữ vàng lớn phủ
  ngang màn hình, y hệt video 2 f_030. Ảnh 09 miss chỉ vì banner hiện 1.6s
  (setTimeout, real time) trong khi headless poll + chụp chậm hơn — không
  phải bug sản phẩm. Tương tự, vòng vàng tribute còn hiện trong ảnh 09 là
  do game time headless chạy ~0.03s/s thực (fade 1s game = ~33s thực) —
  trên máy thật 60fps nó fade đúng 1s.
- **Fever overlay flicker (từ §9.3, vẫn mở):** overlay theo `feverAmount`
  (envelope hash-gated) nên nhấp nháy 0↔0.45; ảnh 10-fever lần 3 bắt được
  lúc ON (teal rõ). AEGIS/OWNER xem có chấp nhận không, hay wash nên steady
  trong suốt Fever.

### 9.8 Bàn giao cho AEGIS (vòng fix round) — CẬP NHẬT

Kèm theo báo cáo này: [REMAKE-PROPOSALS.md](sandbox://workspace/forgetax-mobile/remake/REMAKE-PROPOSALS.md)
(đã cập nhật R-08/R-09/R-24 + Nhóm D R-28–R-36) + 12 ảnh chụp mới trong
`remake/.browser-test/` (lần chạy 3 + `09b-great-banner.png` + `diag-a…e.png`)
+ `remake/tools/fft-ref.py` (bảng phổ tham chiếu) + `remake/tools/dev-server/browser-test.js`
+ `fft-test.js` (FFT nhanh, 7/7 × 5 lần) + `furnace-diag.js` (chẩn đoán lò).

**Tiêu chí pass/fail hàng đầu (OWNER nhấn mạnh): SOUND** — AEGIS kiểm độc lập
bằng FFT/nghe so sánh synth mới (`sound.renderOffline(trigger)`) với WAV tham
chiếu (bảng §9.2; kết quả SENSOR: 7/7 PASS, 5 lần liên tiếp + trong full test).
Các mục khác: WASD đổi vị trí camera, E nhặt/đặt, title 50/49/1, lò không xanh
+ không cháy trắng, phòng sáng ở 70% và 200%, work view pitch −10° (đe giữa
khung, KHÔNG nhìn lên trần), lưỡi kiếm có sheen (không silhouette đen),
ledger lưới đúng số core, Fever wash teal, Great banner (xem 09b), menu đủ
nút, cargo 82/82, 0 console error.


### 9.9 AEGIS vòng 4 (fix round) — `[REJECT_TO_SENSOR]` (2026-11-22 01:xx) + SENSOR đã sửa M1–M4

AEGIS kiểm độc lập: cargo 82/82 tự chạy, FFT 7/7 tự chạy (2 lần), full test tự
chạy (~11 phút, EXIT 0, 0 console error, 0 failed request), tự chạy fft-ref.py
trên 6 WAV (khớp bảng §9.2), tự đọc layout.json 3.672 objects, đo pixel bằng
PIL trên ảnh của mình + của SENSOR. **Verdict: [REJECT_TO_SENSOR] — 0 MAJOR,
0 bịa đặt (Law-0 sạch), 4 MINOR** (trong đó M3/M4 là 2 mục §9.7 SENSOR khẳng
định "đã sửa" nhưng số đo AEGIS cho thấy chưa xong) + 7 observation (O1–O7).
SENSOR đã sửa hết M1–M4 + O1/O3/O4/O6, tự test lại lần 4 (dưới đây).

**M1 — Banner Great ghi "×3.5x" (thừa 1 dấu).** `app.js:353`: `"×" + ratio.toFixed(1) + "x"`.
Gốc f_030 ghi "3.5x" (chỉ hậu tố `x`). AEGIS chỉ ra ảnh 09b KHÔNG chứng minh
được chữ đúng — `great-banner-test.js` force banner bằng chuỗi hardcode
`'×3.5x'`, tức test tự nhét chữ sai vào rồi chụp. **Sửa:** `ratio.toFixed(1) + "x"`
(app.js:353) + sửa cả test (`'3.5x'`) + browser-test.js giờ LOG chữ banner thật
khi Great thật xảy ra (`greatBannerText`). **Chứng minh lần 4:** log full test
`greatBannerText: 'ĐẠI THÀNH CÔNG5.0x'` (Great thật, không force) + 09b mới
"ĐẠI THÀNH CÔNG / 3.5x" chữ vàng lớn đúng kiểu f_030.

**M2 — Overlay Fever nhấp nháy (wash lúc có lúc không).** `app.js:686-688` lấy
opacity từ `getFeverAmount()`; `feverEnvelope()` (`scene3d.js:2202-2212`)
hash-gate trong ramp 0–2.8 s nên amount nhảy 0 ↔ ~1. Bằng chứng AEGIS: lần chạy
của mình `feverOverlayOpacity = 0`, ảnh 10-fever không có wash trong khi Fever
đang active ("NHẬP THẦN — 4.0s" trên bảng, `feverSeen: true`); f_027/f_033
cách nhau ~30 s đều cho thấy phòng phủ teal ổn định, không chớp. **Sửa:** overlay
lấy theo `state.fever.active` (steady 0.45 trong suốt Fever, 0 khi hết); envelope
giữ nguyên cho radiance/shake (`getFeverAmount`). **Chứng minh lần 4:**
`feverOverlayOpacity: 0.45` và `feverOverlayOpacity2: 0.45` (2 ảnh 10/10b cách
nhau 2 frame, wash teal giống hệt nhau) — không còn nhấp nháy.

**M3 — Lưỡi kiếm cầm tay VẪN ĐEN ở 70%.** AEGIS đo pixel trên ảnh 03-held lần
chạy của mình: lưỡi **0.0–15.9/255**, nhiều điểm thuần (0,0,0)/(2,0,0); lần 3 của
SENSOR cũng chỉ 1.6–22.7. PMREM env có thật (`scene3d.js:2674-2676`,
`environmentIntensity 0.5`) nhưng env lấy từ chính căn phòng tối nên kim loại
không có gì sáng để phản chiếu; palette grade 0 nâu [86,68,56] + metalness 0.75
càng tối. **Sửa:** metalness kiếm 0.75 → **0.5** + envMapIntensity **2.0**
(material catalogue `buildCatalogueSword` + blade của base Blade
`buildSwordPartMesh`) — SwordV2 gốc là shader TÙY BIẾN, không phải PBR metal
chuẩn, nên lưỡi đọc được màu palette quan trọng hơn con số 0.75 (TODO-RE/R-08,
ghi trong REMAKE-PROPOSALS.md R-08). **Chứng minh lần 4:** đo pixel 03-held
(`measure-shots.py`): vùng lưỡi p90 = **80.2**, p95 = **160.3**, max 247.0
(trước: 0–16); xem ảnh: lưỡi thép tối có sheen + viền sáng, cán gỗ rõ, không
còn silhouette đen. Kiếm trên đe (06) cũng có sheen rõ hơn.

**M4 — Miệng lò vẫn cháy gần trắng ở lõi.** AEGIS đo ảnh 07-furnace lần chạy của
mình: tâm miệng lò RGB **(230,210,175), độ sáng 211.7/255**, vùng sáng đều không
còn chi tiết; so gốc f_015/f_016: miệng lò cam, thấy rõ nan ghi + khoảng tối
bên trong. **Sửa:** fireGlow 6 → **3**, hemi 8.0 → **6.0**, amb 3.0 → **2.0**
(lõi ~1.2 tổng: fireGlow 0.41 + hemi 0.59 + amb 0.20 — sáng ấm, không trắng
kem). Đề nghị "thêm than ember trong miệng lò" của AEGIS — **TỪ CHỐI**: 19 khối
clinker là data layout thật, thêm than = bịa (Law 0), ghi rõ trong code +
REMAKE-PROPOSALS.md R-08. **Chứng minh lần 4:** đo pixel 07-furnace: tâm
**(195,163,116), sáng 167.2** (trước 211.7); diag-a mới cũng 166.2; xem ảnh:
ghi tối + than cam có chiều sâu + gạch ấm, lõi là glow ấm có cấu trúc (không
còn blob trắng đều). Lõi vẫn là phần sáng nhất trong lò (lửa) — AEGIS vòng 5
đánh giá lại.

**O1 — Peak FFT strike dao động mạnh (0.73–0.89, biên xấu nhất ~0.06).**
SENSOR log "0.73–0.79, 5 lần" chưa phản ánh hết phương sai (noise ngẫu nhiên).
**Sửa:** thump 0.25 → **0.22** (`sound.js`). **Chứng minh:** FFT 5 lần liên
tiếp 7/7 PASS; lần 4 full test strike peak **0.771**, centroid 8058,
bands [0.46, 0.00, 0.07, 0.40, 0.06] — biên tốt hơn.

**O3 — Ảnh chẩn đoán lò `diag-a…e.png` KHÔNG còn trên đĩa.** Do full test
`rm -f .browser-test/*.png` trước lần chạy 3 đã xóa chúng. **Sửa:** đổi
`furnace-diag.js` OUT sang `.browser-test-diag/` (riêng, không bị full test
xóa) + chạy lại sau khi đổi fireGlow — 5 ảnh đã lưu lại
(`.browser-test-diag/diag-a…e.png`, lần này có diag-a mới với fireGlow 3).

**O4 — Comment cũ sai sự thật:** `scene3d.js:659` ghi "the teal emissive below
is still the R-09 remake proposal (kept + marked)" trong khi code ngay dưới đã
XÓA emissive (F-3b). **Sửa:** câu chữ khớp code (emissive đã REMOVED, F-3b).

**O5 — Ảnh 01/02/03 lần chạy AEGIS bị đen/bảng đen dù cùng vị trí camera với
SENSOR.** Artifact chụp headless (chính `furnace-diag.js:97` cũng ghi nhận
"black canvas if the shot follows a single frame"), KHÔNG phải lỗi sản phẩm.
**Sửa:** browser-test.js chờ thêm 1 frame nữa (2 frame mới) trước shot 01.

**O6 — Lưới ledger chưa có ảnh cận cảnh nào chứng minh đọc được.** 11-ledger cả
2 lần chạy đều chụp từ work view, ô + chỉ ~2px. **Sửa:** thêm `setCamPos(x,y,z)`
debug vào ForgeScene + shot mới `12-ledger-closeup.png` (camera ~1 m từ ledger,
cùng yaw/pitch 142/0). **Chứng minh lần 4:** 12-ledger-closeup cho thấy lưới
đọc được rõ — cột HƯ HẠI/GIỮ/THÀNH CÔNG/ĐẠI THÀNH CÔNG, ô + xanh + □ trống,
"x0.85".

**O2 (nửa trái khung hình ở 70% gần như đen — AEGIS: chấp nhận được tạm thời)
và O7 (draw call KHÔNG phải proxy cho Low — đã xác nhận)** — không sửa thêm;
ghi nhận. O2: vùng làm việc đọc được, góc tối giống phong cách phòng gốc; bro
chơi ở 200% sẽ ổn.

### 9.10 Kết quả kiểm chứng lần 4 (sau sửa M1–M4, 2026-11-22)

- **Cargo:** `cargo test -p forgetax-core` = **82/82 PASS** (64 + 5 + 12 + 1).
- **FFT:** `fft-test.js` **7/7 PASS × 5 lần liên tiếp**; trong full test lần 4:
  strike 0.771/8058, great 0.554/2032, break 0.782/3025, tribute 0.508/3685,
  fever 0.428/76, set 0.299/1595, crackle 0.031/120 — `fftFails: []`.
- **Full browser test lần 4:** `node tools/dev-server/browser-test.js` **EXIT=0**
  (~11 phút, log `/tmp/ft-browsertest5.log`): **0 console errors, 0 failed
  requests.** Walk 1.18 m ([0.15,1.76,−0.05] → [−0.415,1.76,0.986]); pickup
  held true→false; 12 strikes → grade 5, value 7,375 G; brightness exp 200% =
  3.286, 70% = 1.15; menu đủ nút (codex disabled), Home → title → resume round
  1; tribute ✓; endday ✓ (round 1→2); feverSeen ✓ + greatSeen ✓.
  Stats: medium 123 calls / 122,925 tris / PR 1 / 11 lights; Low 133 calls /
  128,303 tris / PR 0.75 / 5 lights (calls vẫn tăng khi bật Low — xác nhận lần
  nữa calls KHÔNG phải proxy; proxy đúng là pixelRatio + lightsOn).
- **14 ảnh lần 4** trong `remake/.browser-test/` (00-title … 12-ledger-closeup,
  gồm 10b-fever.png + 12-ledger-closeup.png mới) + `09b-great-banner.png` mới
  (chữ "3.5x" đã sửa) + 5 ảnh diag mới trong `remake/.browser-test-diag/`.
  SENSOR đã xem: 00-title, 01-workview, 03-held, 06-bright70, 07-furnace,
  09-great, 09b, 10-fever, 10b-fever, 12-ledger-closeup, diag-a-baseline.
- **Đo pixel (PIL, `tools/dev-server/measure-shots.py`):** lò tâm 167.2 (trước
  211.7); lưỡi cầm tay p90 80.2 / p95 160.3 / max 247.0 (trước 0–16).
- **Còn mở (ghi rõ, không giấu):** (a) 09-great lần 4 lại trượt timing chụp
  (banner 1.6 s real-time, headless poll + screenshot chậm hơn) — bằng chứng
  M1 là log `greatBannerText` + 09b, không phải ảnh 09. (b) Lõi lò vẫn là phần
  sáng nhất (166–167) — đã ấm + có cấu trúc, nhưng AEGIS vòng 5 đánh giá lại
  xem đủ chưa. (c) O2 nửa trái 70% còn tối — chấp nhận tạm, chờ bro live test.
  (d) Ảnh diag-a + 09b có artifact headless (nửa dưới là frame lặp) — không
  phải lỗi sản phẩm, nhưng AEGIS vòng 5 lưu ý khi xem.

### 9.11 Bàn giao cho AEGIS (vòng 5 — kiểm lại M1–M4)

Kèm theo báo cáo này: [REMAKE-PROPOSALS.md](sandbox://workspace/forgetax-mobile/remake/REMAKE-PROPOSALS.md)
(đã cập nhật R-08: hemi 6.0/amb 2.0/fireGlow 3 + metalness kiếm 0.5/envMapIntensity 2.0)
+ 14 ảnh lần 4 trong `remake/.browser-test/` + `09b-great-banner.png` mới +
5 ảnh diag mới trong `remake/.browser-test-diag/` + `tools/dev-server/measure-shots.py`
+ log `/tmp/ft-browsertest5.log`.

**AEGIS vòng 5 kiểm lại (tập trung, không cần chạy lại toàn bộ từ đầu nếu không
muốn — nhưng phải tự đo lại M1–M4 bằng số của mình):**
1. **M1:** log `greatBannerText` trong `/tmp/ft-browsertest5.log` + ảnh 09b
   (chữ "3.5x", không "×") — và tự chạy 1 Great thật để đọc chữ banner.
2. **M2:** 2 ảnh 10-fever + 10b-fever (wash phải giống nhau, steady) + log
   `feverOverlayOpacity` / `feverOverlayOpacity2` (cả 2 phải = 0.45).
3. **M3:** tự đo pixel lưỡi trên 03-held (kỳ vọng p90 ≥ 60, không còn 0–16) +
   xem ảnh (lưỡi có sheen, không silhouette đen).
4. **M4:** tự đo pixel lõi lò trên 07-furnace (kỳ vọng tâm < 180, ấm không trắng
   kem) + xem ảnh + 5 ảnh diag mới trong `.browser-test-diag/`.
5. **O6:** xem 12-ledger-closeup (lưới đọc được không).
6. FFT 7/7 + cargo 82/82 + 0 console error (tự chạy lại nhanh).

### 9.12 AEGIS vòng 5 kết quả + M3 điều tra sâu + O6 header fix (2026-11-22)

**AEGIS vòng 5: `[REJECT_TO_SENSOR]` — M1/M2/M4 PASS, M3 FAIL, O6 PARTIAL.**
- M1 PASS (log `greatBannerText: "ĐẠI THÀNH CÔNG5.0x"`, không × thừa).
- M2 PASS (overlay 0.45 steady cả 2 lần đo; pixel 2 frame fever gần như giống nhau).
- M4 PASS (lõi lò (195,163,116), 167.2/255, ấm, 0 pixel ≥240; profile mượt).
- **M3 FAIL:** lưỡi cầm tay vẫn đen — AEGIS đo theo đường chéo lưỡi (phương pháp
  đúng): median 6.0, p90 6.9. Claim p90 80.2 của SENSOR lần 4 là SAI phương pháp
  (đo vùng rộng, dính giấy ledger trắng). Kiếm trên đe thì đọc tốt (p90 224).
- O6 PARTIAL: lưới ledger đọc được, nhưng header "GIỮ/THÀNH CÔNG/ĐẠI THÀNH CÔNG"
  trông chồng nhau ở góc chéo + bảng instrument che ~40% giấy + cột đầu và hệ số
  seal bị cắt. Cần ảnh close-up TRỰC DIỆN để đóng O6.
- C1: comment `app.js` còn "(×3.5x)" — đã sửa (chỉ comment, không ảnh hưởng code).

**M3 — điều tra sâu (heldlight-diag.js, 2026-11-22, 6 lần chạy):**
- SpotLight gắn camera (intensity 12, nhắm midpoint lưỡi, góc 0.7): vặn 12→200
  KHÔNG đổi 1 pixel — đèn không vào render (dù có trong scene, parentIsCamera).
- PointLight gắn camera (intensity 3, tại [0.2,0.1,−0.3]): cũng không tới lưỡi.
- PointLight con của SCENE + `heldLightTick()` cập nhật vị trí mỗi frame (0.35m
  trước camera): đèn ĐÃ bám đúng vị trí ([−0.11,1.75,0.44], gần kiếm
  [−0.43,1.35,0.43]) — nhưng lưỡi VẪN tối, kể cả khi vặn lên 300, distance 0,
  decay 0 (cả khu đe trắng xóa, lưỡi vẫn đen).
- Pháp tuyến world của mesh: maxDot 0.998, 31% đỉnh hướng về đèn; đỉnh mặt phẳng
  lưỡi (mẫu 1 đỉnh, mặt ít đỉnh) dot 0.955 — mặt lưỡi HƯỚNG VỀ đèn.
- Metalness 0: KHÔNG cứu được (lưỡi vẫn tối).
- MeshBasicMaterial trắng: lưỡi hiện TRẮNG RÕ — geometry render hoàn hảo.
- Kết luận: mặt phẳng lưỡi nhận ~0 diffuse từ MỌI nguồn (hemi/amb/workGlow/
  heldLight) dù pháp tuyến hướng về đèn — lý do shader-level chưa hiểu được.
  Headless SwiftShader chỉ ~0.2–0.5 fps (cả phiên diag 8–9 frame), nên diag
  phải chờ 3 frame mới sau E trước khi đo (bản đầu đo quá sớm, đèn kẹt [0,0,0]).
- **FIX (đã áp dụng):** emissive TRUNG TÍNH bằng đúng màu palette của kiếm
  (clone từ `material.color`, không đổi hue) intensity 0.5, CHỈ cho kiếm cầm
  tay (trong `setHeldSword`, clone material). Đo đường chéo lưỡi:
  median **122.9** (từ 6.9), p90 122.9, max 123.8 — thép nâu-tan ấm, đọc rõ,
  không phát sáng trắng/teal. Đây KHÔNG phải emissive teal R-09 (atlas sai +
  màu teal, đã rút ở F-3b vì gây vệt xanh) — không emissiveMap, không đổi màu,
  chỉ kiếm cầm tay (kiếm đe/sàn/quầy đọc tốt nhờ workGlow, không cần).
  Ghi TODO-RE/R-08 trong code (CIPHER v2: SwordV2 emission ≈ 0 — đây là
  approximation readability cho view-model, không phải dữ liệu shader gốc).
  Đèn heldLight (PointLight scene-child, intensity 3) VẪN GIỮ làm fill phụ.
- Debug handle mới: `get THREE()` trên `window.ForgeScene` (để harness dùng
  THREE trong evalJs; THREE là module-scoped, không phải global).

**O6 — header ledger fix (đã áp dụng, lần 6):** font header 11px → 10px + header
dài hơn colW−4 được tách 2 dòng tại khoảng trắng ("ĐẠI THÀNH" / "CÔNG").
Ảnh close-up TRỰC DIỆN lần 5 đã xem: lưới đọc được, totals "0, 2, 5, 18, 4"
ĐÚNG (Fever đang active nên GÃY = 0 — deck live [0,2,5,18,4], không phải bug).
Ảnh lần 6 (sau fix header) CHƯA xem — xem trong lần 7.
Câu hỏi mở (chưa quyết): header cột Hold ghi "GIỮ" (từ `ui.outcome_hold`) nhưng
gốc ghi "GIỮ NGUYÊN" (`ui.bb3ad48c0b`) — đổi sẽ ảnh hưởng cả board. Chờ quyết
định của manager/AEGIS, không tự đổi.

**Lần 7 (đang chạy khi viết §9.12):** full browser test
`tools/dev-server/browser-test.js` → log `/tmp/ft-browsertest8.log`. Xác minh:
M3 (03-held, kỳ vọng median lưỡi ≥ 60, thép nâu đọc rõ), O6 (12-ledger-closeup
trực diện, header không chồng), FFT 7/7, cargo 82/82, 0 console error.
**Kết quả lần 7 (EXIT=0, ~12 phút, log `/tmp/ft-browsertest8.log`):**
- FFT 7/7 PASS (strike 0.693/8062, great 0.554/2032, break 0.844/2969,
  tribute 0.508/3685, fever 0.428/76, set 0.299/1595, crackle 0.026/120).
- Walk 1.75m ([0.15,1.76,−0.05]→[−0.687,1.76,1.487]); pickup held true→false,
  heldLightOn 3 / heldLightOff 0; brightness exp 3.286/1.15.
- Menu đủ nút (codex disabled), Home → title → resume round 1; tribute ✓;
  endday ✓ (round 1→2); feverSeen ✓ + greatSeen ✓;
  `greatBannerText: 'ĐẠI THÀNH CÔNG6.3x'`; fever overlay 0.45/0.45.
- 0 console error, 0 failed request. Stats medium 123 calls / 122,925 tris /
  PR 1 / 11 lights.
- **M3 (03-held): lưỡi median 41.4, p90 41.4, max 76.2** (đường chéo lưỡi,
  từ 6.0) — thép nâu đọc rõ, không còn silhouette (trong diag close-up đo
  122.9 vì đèn crank 300; ở cường độ làm việc 3 + góc full-test, 41.4 là
  đúng màu palette tối [86,68,56]). Lò 07-furnace tâm (195,163,116), 167.2 —
  M4 giữ.
- **O6 (12-ledger-closeup lần 7): CHƯA ĐÓNG.** Header "THÀNH CÔNG" / "ĐẠI THÀNH
  CÔNG" VẪN chồng ("THÀNHĐẠI THÀNH") — font 10px còn để "ĐẠI THÀNH" ~70px,
  rộng hơn cột 69.6px. Bảng instrument VẪN che trái ~40% + hệ số seal bị cắt
  ("Y x0.85") vì ở 1.25m FOV ngang ~90° phủ ~2.5m, rộng hơn ledger 1.09m.
  **Fix O6b (đã áp dụng sau lần 7):** font header 10px → **8px**
  ("ĐẠI THÀNH" ~56px, vừa cột) + camera close-up dời tới **0.7m**
  (`setCamPos(-1.95, 1.79, 1.97)`, khung phủ ~1.4m, ledger chiếm ~78%, bảng
  ra khỏi khung). Xác minh ở lần 8.
- Cargo 82/82 + FFT 7/7 (chạy lại độc lập sau lần 7, đều PASS).

**Lần 8 (EXIT=0, ~12 phút, log `/tmp/ft-browsertest9.log`):**
- FFT 7/7 PASS; walk 1.05m; pickup held true→false, heldLight 3/0;
  brightness 3.286/1.15; fever 0.45/0.45; great "ĐẠI THÀNH CÔNG5.5x";
  0 console error, 0 failed request.
- **M3 (03-held): median 45.9, p90 46.6, max 101.0** — giữ (đọc rõ).
- **O6 (12-ledger-closeup lần 8): CHƯA ĐÓNG.** Header "THÀNHĐẠI THÀNH" VẪN
  dính ở font 8px + camera 0.7m còn cắt trên/dưới (ledger cao 1.39m cần
  ≥1.0m mới vừa khung dọc) + bảng vẫn che trái ~25%.
  **Nguyên nhân thật (tìm ra sau lần 8, không phải font size):** `ctx.font`
  bị RÒ trong `drawLedger` — vòng lặp vẽ ô lưới set `ctx.font = 700 12px`
  (ô "+") và dòng totals set `700 16px`, nên từ cột 2 trở đi header bị đo
  VÀ vẽ ở font stale 16px, không phải 7px/8px/10px đã set trước vòng lặp.
  (Các lần hạ font 11→10→8→7 đều có thật trong file serve, nhưng bị ghi đè.)
  **Fix O6c (đã áp dụng):** reset `ctx.font = 700 7px` ở ĐẦU mỗi lần lặp cột
  (trong vòng lặp, trước `measureText`). Đo thực bằng canvas: ở 7px
  "THÀNH CÔNG" 47.4px, "ĐẠI THÀNH CÔNG" 61.4px — cả hai vừa cột 69.6px
  trên MỘT dòng, không cần tách.
- **Xác minh O6c bằng ledger-diag** (`tools/dev-server/ledger-diag.js`, mới):
  header "GÃY / HƯ HẠI / GIỮ / THÀNH CÔNG / ĐẠI THÀNH CÔNG" đều một dòng,
  tách biệt rõ, KHÔNG chồng (ảnh `.browser-test-diag/ledger-closeup.png`).
  Lưới + totals 9/2/5/18/4 đọc được. Seal chỉ thấy đuôi "x0.85" (đầu
  "TRỌNG SỐ G" bị bảng instrument che ở góc close-up này — framing của shot
  test, không phải lỗi ledger; giá trị vẫn đọc được).
- Cargo 82/82 + FFT 7/7 (chạy lại độc lập, đều PASS).

**Lần 9 (EXIT=0, ~12 phút, log `/tmp/ft-browsertest10.log`):**
- FFT 7/7 PASS; walk 0.8m; pickup held true→false, heldLight 3/0;
  brightness 3.286/1.15; fever 0.45/0.45; great "ĐẠI THÀNH CÔNG5.5x";
  0 console error, 0 failed request.
- **M3 (03-held): median 46.2, p90 46.8, max 111.8** — giữ (lần 7: 41.4,
  lần 8: 45.9). Lò 07-furnace tâm (192,161,115), 165.0 — ấm, M4 giữ
  (số 116.7 xanh ở lần 8 là artifact đo — pixel tâm rơi vào chỗ khác,
  có thể đang Fever / trên ghi; lần 9 trở lại ấm).
- **O6 (12-ledger-closeup lần 9, canonical): ĐÃ ĐÓNG.** Header 5 cột một
  dòng, tách biệt rõ, KHÔNG chồng; lưới + totals 0/2/5/18/4 đọc được;
  "CỐNG PHẨM YÊU CẦU 2,100 G" + "ĐÃ DÂNG 294 G" đọc được; toàn bộ ledger
  vừa khung dọc (camera 1.1m). (Ảnh có wash teal vì Fever đang active khi
  chụp — đúng luật. Seal chỉ thấy đuôi "x0.85", đầu "TRỌNG SỐ G" bị bảng
  che ở góc close-up — framing của shot test, không phải lỗi ledger.)
- Cargo 82/82 + FFT 7/7 (chạy lại độc lập, đều PASS).

### 9.13 Bàn giao cho AEGIS (vòng 6 — kiểm lại M3 + O6 sau fix cuối)

Kèm theo: [REMAKE-PROPOSALS.md](sandbox://workspace/forgetax-mobile/remake/REMAKE-PROPOSALS.md)
(R-08 đã cập nhật: heldLight scene-child + neutral emissive) + 14 ảnh lần 8
trong `remake/.browser-test/` + ảnh diag `.browser-test-diag/ledger-closeup.png`
(header đã sửa) + `held-emissive.png` (lưỡi 122.9) + log `/tmp/ft-browsertest9.log`
(lần 8) và `/tmp/ft-browsertest10.log` (lần 9, khi xong).

**AEGIS vòng 6 kiểm lại (tập trung):**
1. **M3 (chính):** đo pixel lưỡi trên 03-held lần 8/9 bằng phương pháp đường
   chéo (tip→guard, KHÔNG đo vùng rộng — lần 4 đã chứng minh vùng rộng đo
   nhầm giấy ledger). Kỳ vọng median ≥ 30, p90 ≥ 40 (lần 7: 41.4, lần 8:
   45.9). Xem ảnh: lưỡi thép nâu đọc rõ, không silhouette đen, không phát
   sáng trắng/teal. Kiểm tra code: emissive CHỈ ở `setHeldSword`
   (clone material, `emissive = material.color`, intensity 0.5) — kiếm đe/
   sàn/quầy KHÔNG có emissive (đọc tốt nhờ workGlow).
2. **O6 (chính):** xem 12-ledger-closeup lần 9 + `.browser-test-diag/
   ledger-closeup.png`: header 5 cột một dòng, không chồng; lưới + totals
   đọc được. (Seal "TRỌNG SỐ G" bị bảng che ở góc close-up là framing của
   shot, không phải lỗi ledger — kiểm tra bằng 11-ledger.png shot rộng.)
3. **M1/M2/M4 (giữ):** log lần 8/9 — banner Great không "×" thừa, fever
   overlay 0.45 steady, lò ấm không trắng.
4. FFT 7/7 + cargo 82/82 + 0 console error (tự chạy lại nhanh).
5. **Câu hỏi mở cho AEGIS/manager:** (a) header cột Hold ghi "GIỮ" hay
   "GIỮ NGUYÊN" (gốc dùng "GIỮ NGUYÊN", `ui.bb3ad48c0b` — đổi sẽ ảnh hưởng
   cả board)? (b) lưỡi cầm tay ở mức 41–46/255 có đủ sáng với mắt người
   không, hay cần tăng emissive lên 0.6–0.7?

### 9.14 AEGIS vòng 6 — VERDICT: [PASS_WITH_PROOF] (2026-11-22)

AEGIS kiểm độc lập, không dùng số SENSOR. Kết quả:
- **M3 PASS:** đo pixel đường chéo PCA trên 03-held lần 9: median **43.3**, p90 **44.7**, max 115.3, median RGB (60,41,28) thép nâu ấm R>G>B — đạt kỳ vọng (≥30/≥40). Lưỡi đọc rõ, không silhouette, không phát sáng trắng/teal. Code: emissive CHỈ ở `setHeldSword` (scene3d.js:2222-2223, clone + `emissive = material.color`, 0.5, không emissiveMap); `buildSwordPartMesh` ép emissive đen; 9 material có emissive ≠ 0 trong scene-data.json toàn đồ gốc, không có kiếm nào. heldLight scene-child PointLight, intensity 3 khi cầm / 0 khi tay không, tick 0.35 m trước camera.
- **O6 PASS:** 12-ledger-closeup lần 9: header 5 cột một dòng, không chồng ("GÃY / HƯ HẠI / GIỮ / THÀNH CÔNG / ĐẠI THÀNH CÔNG"); lưới + totals 0/2/5/18/4 đọc được (Fever active, GÃY=0 đúng luật); live lines "CỐNG PHẨM YÊU CẦU 2,100 G / ĐÃ DÂNG 294 G" đọc được; toàn ledger vừa khung dọc (camera 1.1 m). Diag ledger-closeup: totals 9/2/5/18/4 đọc được. Code: `ctx.font = 700 7px` reset đầu mỗi lần lặp cột (scene3d.js:1264).
- **M1/M2/M4 giữ PASS:** log lần 9 (`/tmp/ft-browsertest10.log`): banner "ĐẠI THÀNH CÔNG5.5x" (không × thừa); fever overlay 0.45/0.45 steady; furnace tâm (640,300) median (201,169,123), sáng 164.3, ấm không clip trắng. Kiếm trên đe ở 01/06 vẫn có pixel thép sáng p99 222.3.
- **Tự chạy lại:** cargo 82/82 PASS; fft-test 7/7 PASS (strike 0.741/7963, great 0.554/2032, break 0.829/3012, tribute 0.508/3685, fever 0.428/76, set 0.299/1595, crackle 0.026/120); log lần 9: consoleErrors [], failedRequests [], fftFails [].
- **Defect còn lại:** 1 MINOR (framing shot test — hàng totals sát mép dưới khung ở cả 2 ảnh close-up, ảnh diag bị cắt một phần dưới; đề nghị lùi camera ~0.05 m ở shot sau) + 2 OBSERVATION (không shot nào cho thấy trọn dòng seal "TRỌNG SỐ GÃY x0.85" không bị che — cần shot góc khác nếu OWNER muốn xác minh; lưỡi ~43/255 sáng gần bằng tường gỗ phía sau nên đọc nhờ hue/cạnh chứ không nhờ độ sáng; kiếm trên đe ở shot rộng vẫn tối khi nhìn xa — trạng thái đã chấp nhận từ vòng 5).
- **Câu (a) GIỮ vs GIỮ NGUYÊN — AEGIS trả lời: giữ "GIỮ".** `vi.txt` không có key `ui.outcome_*` nào (grep outcome = 0) — 5 nhãn board là bản dịch remake R-05 đã duyệt (`app.js:66` → `i18n.js:99` `ui.outcome_hold: "GIỮ"`). `ui.bb3ad48c0b` = "GIỮ NGUYÊN" chỉ dùng ở màn hình title (`index.html:39`, "GIỮ NGUYÊN 49%"), không phải nhãn board. Đổi `ui.outcome_hold` sẽ đổi cả board lẫn header ledger (dùng chung `view.channels`); đổi riêng header ledger sẽ làm ledger lệch board — không nên. Nếu OWNER muốn đúng chữ gốc thì đổi một key cho cả hai chỗ nhất quán + kiểm lại độ vừa cột board (ở 7px "GIỮ NGUYÊN" ~63px vừa cột ledger 69.6px, cột board hẹp hơn cần đo lại). Mặc định: giữ "GIỮ".
- **Câu (b) lưỡi ~43–46/255 — đủ để đóng M3, nhưng còn tối; nên thử 0.6, không nhảy 0.7.** Trên ảnh headless lưỡi phân biệt rõ với tường gần đen nhờ màu nâu ấm + cạnh — hình dạng/màu đọc được, không còn silhouette. Nhưng 43/255 là vùng tối (17%), trên màn hình thật của OWNER biên này có thể mỏng. Palette gốc nâu tối [86,68,56] nên tăng emissive 0.5 → 0.6 chỉ đưa lưỡi lên ~52/255 — vẫn là thép, không nguy cơ phát sáng trắng. Đề nghị: thử 0.6 ở vòng sau nếu OWNER thấy lưỡi còn tối; không tự đẩy 0.7 khi chưa có phản hồi live.
- **Kết luận AEGIS:** M3 + O6 xong theo đúng tiêu chí vòng 6. Đề xuất chuyển sang OWNER duyệt ảnh (kèm lưu ý thử emissive 0.6 ở vòng sau nếu OWNER thấy lưỡi còn tối). Không phát hiện MAJOR, Law-0 sạch.
- **Housekeeping:** dev-server port 1420 đã tắt sau khi AEGIS xong (`fuser -k 1420/tcp`). KHÔNG push, KHÔNG release — chờ manager verify + OWNER duyệt ảnh.
