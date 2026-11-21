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
