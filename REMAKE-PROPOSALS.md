# DANH SÁCH ĐỀ NGHỊ REMAKE — ForgeTax Mobile P0 (SENSOR quản lý)

**Luật OWNER (2026-11-21 18:34):** mỗi món muốn remake, CIPHER phải thử trích xuất
VÀI LẦN trước và chứng minh không lấy được (ghi rõ đã thử những gì). Chỉ sau đó
mới được đề nghị remake. SENSOR lập + giữ danh sách này, trình OWNER duyệt
**TỪNG MÓN** — chưa duyệt thì KHÔNG được remake. SENSOR quản lý danh sách nhưng
KHÔNG tự duyệt, KHÔNG tự remake trước. Món nào OWNER duyệt rồi mới remake, và
phải ghi rõ `REMADE` trong code + báo cáo bàn giao, không bao giờ giả vờ là đồ gốc.

**Tình trạng danh sách này:** lập ngày 2026-11-21 bởi SENSOR (thay thế) sau khi
kiểm toán toàn bộ build P0 trên đĩa đối chiếu `.zip` v1 của CIPHER
(`ForgeTax-Mobile-CIPHER-P0.zip`, MD5 `1cbf83eb1f8766cb490229bfa98bb2a1`).
Các món R-01…R-27 đã CÓ trong build do SENSOR trước làm **trước khi luật này
ban hành** — SENSOR hiện tại KHÔNG remake thêm món nào, chỉ liệt kê trung thực
để OWNER duyệt từng món. Món nào OWNER không duyệt sẽ sửa/gỡ theo lệnh OWNER.
(Cập nhật sau kiểm thử AEGIS 2026-11-21 18:44: bổ sung R-26, R-27; rút lại F-03;
thêm F-01b. Tổng hiện tại: 26 món.)

**Cập nhật 2026-11-21 (SENSOR fix sau lệnh duyệt của OWNER 19:47):** OWNER đã
DUYỆT HẾT nhóm A (12 món) + sửa nhóm C (5 món) + sửa nhóm B theo số thật của
CIPHER v2 (`ForgeTax-Mobile-CIPHER-P0v2.zip`, MD5
`56d3bbaddfcab859db832e888accc918`). Kết quả:
- Nhóm A: 12/12 **ĐÃ DUYỆT — REMADE** (ghi `REMADE — approved by OWNER
  2026-11-21` trong code). Riêng R-17 và R-20 được v2 NÂNG CẤP bằng số thật
  (không còn remake): R-17 dùng EvolutionCatalogue + ResolveId (117 prefab
  thật); R-20 dùng defaults thật (100/100/100, 70%, 30, free).
- Nhóm C: F-01, F-01b, F-02, F-05 **ĐÃ SỬA**; F-04 **ĐÃ SỬA TRONG V2**
  (CIPHER sửa LAYOUT.md + /04, SENSOR chỉ xác nhận).
- Nhóm B: R-02, R-03, R-07, R-10, R-11, R-12, R-24 **ĐÃ SỬA THEO SỐ THẬT**;
  R-06, R-09, R-13, R-15, R-26 **SỬA MỘT PHẦN** (phần còn lại giữ marker
  TODO-RE, chờ trace thêm hoặc OWNER duyệt remake riêng); R-01, R-14 **VẪN
  THIẾU — KHÔNG ĐỤNG ĐẾN** (đã chứng minh không lấy được, giữ đề nghị remake).
- Ba mục CHƯA THỬ (BEHAVIOR M13, EFFECTS M11, BEHAVIOR M6) chưa phải đường
  cùng — ghi chú để task CIPHER sau, không tự kết luận là không lấy được.

**Trạng thái từng món:**
- `CHỜ V2` — CIPHER v2 đang thử trích xuất hạng mục này (UI layout/styling,
  behavior, effects). Chưa đủ điều kiện đề nghị remake chính thức; nếu v2
  thất bại, CIPHER ghi bằng chứng các lần thử rồi mới đề nghị. Giá trị hiện
  trong build (nếu có) là tạm thời, chưa được duyệt.
- `ĐỀ NGHỊ — CHỜ OWNER DUYỆT` — CIPHER đã thử nhiều lần, có bằng chứng không
  lấy được (ghi trong cột "Bằng chứng"). Đề nghị remake theo cột "Đề nghị".
  OWNER duyệt từng món mới được giữ.
- `SỬA THEO NGUỒN GỐC` — không phải remake: giá trị đúng ĐÃ CÓ trong nguồn,
  code hiện tại dùng sai. Liệt kê để sửa sau khi OWNER duyệt (không tự sửa
  trước, để khỏi vô hiệu hóa bộ ảnh/test vừa chạy).

---

## Nhóm A — Đề nghị remake (CIPHER đã chứng minh không lấy được)

### R-04 — Tên di vật tiếng Việt (8 starter + toàn bộ P0)
- **Vị trí:** `app/frontend/app.js` `RELIC_NAMES` (8 tên: "Đinh Cong", "Đá Mài Cũ",
  "Nút Thắt Đen", "Con Dấu Kiểm Định", "Đinh Vàng", "Đá Niêm Phong",
  "Chén Thánh Tang Lễ", "Sắt Nối Nứt") + `scene3d.js` `drawRelicSlots` (hiển thị
  tên lên 8 slot tường) + `i18n.js` `ui.relics` ("Di vật").
- **Bằng chứng không lấy được:** trong dữ liệu game KHÔNG có tên di vật tiếng Việt
  (KE-HOACH-P0-P1-P2.md + LAYOUT.md §5e: slot chỉ có số khắc + relic family;
  tên relic trong Economy/vi.txt là key tiếng Anh). CIPHER đã quét toàn bộ
  TextAsset (21 file) + dump.cs — không có bản dịch tên relic.
- **Đề nghị:** giữ 8 tên Việt tự dịch, ghi rõ trong code + giao diện là bản dịch
  của remake (không phải text gốc). Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-05 — Nhãn 5 kênh outcome tiếng Việt
- **Vị trí:** `app/frontend/i18n.js` `ui.outcome_*` ("GÃY / HỎNG / GIỮ / THÀNH CÔNG /
  ĐẠI THÀNH CÔNG") — hiển thị trên instrument board (`scene3d.js` `drawInstrument`).
- **Bằng chứng:** từ gốc tiếng Anh BREAK / DAMAGE / HOLD / SUCCESS / GREAT lấy từ
  code FillDeck (REA-REPORT §11–§12) là có; nhưng chuỗi text 3D gốc trên board
  chưa được trích (layout.json chỉ có anchor + tên ngữ nghĩa, không có chuỗi text).
  Bản Việt là dịch mới.
- **Đề nghị:** giữ 5 nhãn Việt dịch từ 5 từ gốc tiếng Anh, ghi rõ là bản dịch.
  Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-08 — Đèn fill thay thế baked lightmaps / light probes
- **Vị trí:** `app/frontend/scene3d.js` `buildLights()` — HemisphereLight
  `(0x8a6a4a, 0x1a120c, 4.0)`, AmbientLight `(0x241a12, 2.5)`, workGlow PointLight
  `(1.0,0.74,0.43)/14/3.5` tại `(−1.07, 2.1, 2.19)`, fireGlow PointLight
  `(1.0,0.59,0.27)/12/5` tại `(2.72, 1.2, 2.43)`.
- **Bằng chứng:** ánh sáng nền của gốc là baked lightmaps + light probes —
  KHÔNG CÓ trong bundle (LAYOUT.md §1/§3; CIPHER đã liệt kê toàn bộ
  `data.unity3d`, không có lightmap/probe asset). 11/20 Spot light thật đã dùng;
  9 đèn còn lại ghi trong `scene-data.json lightsOmitted`.
- **Đề nghị:** giữ 4 đèn fill thay thế (ghi rõ là approximation, không phải dữ
  liệu gốc). Không giữ thì phòng tối đen, không nhìn được đe/kiếm.
  Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).
- Lưu ý (đã sửa 2026-11-21): `flamesTick` KHÔNG còn ghi đè `fireLight.intensity`
  — fireLight giữ đúng 20.0 gốc; Fever có đèn radiance riêng (xem R-15).

### R-16 — Hướng đặt kiếm trên đe (spawn orientation)
- **Vị trí:** `app/frontend/scene3d.js` `swordBasisQuat()` — prefab +Y → world +X,
  mặt fuller (−Z) hướng lên.
- **Bằng chứng:** runtime marker GO 2896 `[−1.543, 1.193, 2.166]` chỉ có vị trí,
  KHÔNG có rotation (LAYOUT.md §7) — đã chứng minh không lấy được hướng từ data.
- **Đề nghị:** giữ hướng suy ra (kiếm vừa khít mặt đe x −1.635…−0.713), ghi rõ là
  lựa chọn suy ra, không phải dữ liệu. Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-17 — Dạng kiếm theo grade: dùng dạng cơ bản cho mọi grade
- **Vị trí:** `app/frontend/scene3d.js` `buildSwords()` — base Blade + RefitBevelUnit
  cho mọi grade.
- **Bằng chứng:** SwordV2Catalog asset KHÔNG CÓ trong APK — CIPHER đã liệt kê
  toàn bộ APK (chỉ có data.unity3d + resources.resource + sharedassets0.resource;
  0 ScriptableObject trong data.unity3d). 510 tên kiếm có, grade/prefab không.
  (`/04_BANG_CHUNG_NGUON_GOC.md` mục C.1–C.2.)
- **NÂNG CẤP LỚN TỪ V2 (không còn remake):** CIPHER v2 tìm được
  `EvolutionCatalogue` (117 entry {id, grade, family, displayName, prefab},
  grade 0–999) + `ForgeSwordEvolutionSet` 28 special line + 510 mesh kiếm thật
  (`02_ASSETS_GOC/meshes-swords/`). Code nay dùng catalogue + thuật toán
  `ResolveId` (BEHAVIOR.md §8.4) + lazy-load `swords/<id>.json` (111 prefab
  đã convert, 23 MB); chỉ 6 id (8/13/18/23/28/33) chưa rõ đường chọn → fallback
  base Blade, ghi TODO-RE. Dạng cơ bản cho mọi grade KHÔNG còn áp dụng.
  Trạng thái: **ĐÃ DUYỆT — NÂNG CẤP BẰNG SỐ THẬT V2** (OWNER 2026-11-21 19:47).

### R-18 — Vị trí kiếm gãy trên sàn
- **Vị trí:** `app/frontend/scene3d.js` `addBrokenSword()` — x `−1.7 + (i%3)*0.45`,
  z `1.35 + floor(i/3)*0.35`, y `0.06`, yaw `i*0.5`.
- **Bằng chứng:** kiếm gãy spawn lúc chạy, KHÔNG có object nào trong level0
  (LAYOUT.md §10; không có floor-sword object trong 3,672 objects) — đã chứng
  minh không có dữ liệu vị trí/dạng.
- **Đề nghị:** giữ lưới đặt tạm, ghi TODO-RE. Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-19 — Khung + slate Forge Ledger (INACTIVE trong level0) vẫn render
- **Vị trí:** `app/frontend/scene3d.js` `makeBoardPlane('ledger', …)` + `drawLedger()`.
- **Bằng chứng:** frame + slate của Ledger INACTIVE trong dữ liệu level0
  (LAYOUT.md §5b; `LEDGER_FORCE_INCLUDE` trong convert-scene.py) — chỉ text
  'Live run account' là active. CIPHER đã xác nhận trạng thái active/inactive
  từng object.
- **Đề nghị:** giữ render khung + slate làm mặt hiển thị hợp đồng (theo mapping
  §9), ghi rõ khung/slate là INACTIVE trong gốc. Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-20 — Giá trị mặc định settings + hệ số độ sáng + mặc định âm thanh
- **Vị trí:** `app/frontend/app.js` `defaultSettings()` (master 80, music 60,
  sfx 90, brightness 100, quality auto, show_fps false, floor_swords 3,
  controls hub, lock_on false, language vi); hệ số overlay độ sáng `0.7`
  (`applySettings`); `sound.js` `masterVol 0.8 / musicVol 0.6 / sfxVol 0.9`;
  "Sound ON by default".
- **Bằng chứng:** giá trị mặc định gốc KHÔNG CÓ trong dữ liệu RE
  (LAYOUT.md §10.8 — CIPHER đã quét, không có default settings nào).
- **NÂNG CẤP LỚN TỪ V2 (không còn remake):** CIPHER v2 tìm được số thật
  (`behavior.json` settings_defaults): master/music/sfx = 1.0 (100% cả ba),
  brightness 0.7 (70%), haptics true, floorSwordLimit 30, hubControls false =
  DI CHUYỂN TỰ DO. Code nay dùng số thật (`app.js` defaultSettings +
  `sound.js` 1.0/1.0/1.0 + `index.html` slider max 30). Quality + language
  default chưa map được — giữ marker.
  Trạng thái: **ĐÃ DUYỆT — DÙNG SỐ THẬT V2** (OWNER 2026-11-21 19:47).

### R-21 — Màn hình kết thúc ván (end-of-run overlay DOM)
- **Vị trí:** `app/frontend/index.html` `#overlay` + `app.js` `showOverlay()` +
  `i18n.js` `ui.victory / ui.defeated / ui.new_run / ui.endless_continue`.
- **Bằng chứng:** KHÔNG có vật trong phòng cho màn endless/new-run
  (LAYOUT.md §10.6) — đã chứng minh không có UI kết thúc trong scene.
- **Đề nghị:** giữ overlay DOM (cách duy nhất hiển thị thắng/thua), ghi rõ không
  có trong gốc. Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-22 — Phím/tương tác PC (không có tương đương trên mobile)
- **Vị trí:** `app/frontend/app.js` — Space = đập; drag-look `0.004 rad/px`,
  giới hạn `±785 / ±125 px`; ngưỡng click `6 px`; toast `2600 ms`;
  Fever tick `200 ms`.
- **Bằng chứng:** gốc là game mobile cảm ứng; không có binding phím/chuột nào
  trong dữ liệu — đã chứng minh không có nguồn tương đương.
- **Đề nghị:** giữ làm adaptation cho PC, ghi rõ là adaptation. Trạng thái:
  **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47).

### R-25 — Âm thanh tổng hợp WebAudio (timbres tự tạo)
- **Vị trí:** `app/frontend/sound.js` — toàn bộ tần số/gain (vd. strike 740 Hz +
  2130 Hz + noise 4200 Hz; tribute 523/784/1046 Hz; ambient drone 110/165.4 Hz).
- **Bằng chứng:** file WAV gốc (101) CÓ trong APK nhưng CẤM ship (clean-room —
  remake phải tái tạo); thời điểm trigger + độ dài clip gốc đã có (REA-REPORT
  §10: 3455_basic_swing 1.00s, 3434_GreatStrike 1.15s, 3476_SwordBreak 1.20s,
  3407_TributeBell 2.42s, 3452_FeverOverdrive 3.80s). Timbre tổng hợp không thể
  trích từ WAV (không được dùng WAV làm nguồn).
- **Đề nghị:** giữ WebAudio tái tạo (ghi rõ recreated, không phải âm gốc).
  Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47; ghi `REMADE — approved by OWNER 2026-11-21` trong code).

### R-27 — Title tab trình duyệt (O-2 của AEGIS — bổ sung sau kiểm thử)
- **Vị trí:** `app/frontend/index.html:6`
  `<title>ForgeTax Mobile — Bản làm lại cho PC</title>`.
- **Bằng chứng:** chuỗi tự đặt, hiển thị với người dùng; SENSOR chỉ nhắc trong
  handoff §1.2 nhưng sót khỏi danh sách ban đầu (AEGIS phát hiện).
- **Đã làm:** title đổi thành "ForgeTax: Blacksmith Legends" (`index.html:6`).
  Trạng thái: **ĐÃ DUYỆT — REMADE** (OWNER 2026-11-21 19:47).

---

## Nhóm B — Đã có kết quả CIPHER v2 (2026-11-21)

CIPHER v2 ĐÃ XONG (`ForgeTax-Mobile-CIPHER-P0v2.zip`): UI layout (113 TextMesh),
behavior (MonoBehaviour), effects (118 ParticleSystem). Kết quả từng món ghi ở
trạng thái bên dưới: lấy được → SENSOR sửa theo số thật; lấy một phần → sửa
phần có, phần còn lại giữ marker TODO-RE; không lấy được (R-01, R-14) → giữ
nguyên + marker, chờ OWNER duyệt remake riêng. **Giá trị tạm thời còn lại
trong build đều có marker TODO-RE, không trình bày như số thật.**

### R-01 — Toàn bộ CSS (settings panel / overlay / toast / fps)
- **Vị trí:** `app/frontend/styles.css` toàn bộ — palette `#0d0a08 / #171310 /
  #241c16 / #c9963c / #f0e6d6 / #e8622a / #3a2c1e / #7ac74f / #ffcf4d / #d8c9a8 /
  #a89878 / #6a5a44 / #4a3826`; kích thước 1280×720, card 560px, font 20/14/12/11px,
  radius 4/8/12px, z-index 25/30/40/50/60; font stack `"Segoe UI", "Be Vietnam Pro"`.
- **Tình trạng nguồn:** `.zip` v1 KHÔNG có styling UI nào (RectTransform /
  TextMesh styles chưa trích — LAYOUT.md §10). CIPHER v2 đang trích.
  Trạng thái: **VẪN THIẾU — KHÔNG ĐỤNG ĐẾN** (đã chứng minh, 2026-11-21): CSS gốc không có trong v2; giữ đề nghị remake, code hiện giữ nguyên + marker. **Thêm sau AEGIS D3 (2026-11-21):** marker TODO-RE/R-01 nay đã ghi ở đầu `styles.css` — trước đó chỉ có trong handoff/proposals.

### R-02 — Kiểu chữ 3D trên board (font/cỡ/màu/shadow)
- **Vị trí:** `app/frontend/scene3d.js` `boardText()` mặc định (sans-serif, 44px,
  `#f0e6d6`, weight 700, shadow `rgba(0,0,0,0.85)` blur 6) + mọi cỡ/màu trong
  `drawInstrument / drawMeter / drawLedger / drawCalendar` (20–56px;
  `#ffcf4d / #ff9a4d / #7ac74f / #e0322a`) + `drawRelicSlots` (30px).
- **Tình trạng nguồn:** gốc dùng Font Material 3D TextMesh; font/cỡ/màu từng text
  KHÔNG có trong v1 (chỉ có anchor). CIPHER v2 đang trích.
  Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): font stack ForgeKorean → Malgun Gothic; glyph em ≈ size × characterSize / 10 (hiệu chuẩn từ row gap, KHÔNG phải công thức Unity); màu text từ TextMesh [A,B,G,R] linear → sRGB; `boardText()` + `drawInstrument/drawMeter/drawLedger/drawCalendar/drawRelicSlots` dùng `textMeshPx()` + `BOARD_FONT`. **SỬA SAU AEGIS D2 (2026-11-21):** các (size, cs) trước đó (64, 0.012)/(48, 0.0095) lấy nhầm từ các TextMesh [−2.7953, …] (thuộc object khác, không phải board). Giá trị đúng (board's own entries): instrument — tên (128, 0.0058), +grade (128, 0.0062), tribute value (128, 0.007), value caption (128, 0.00225), latest strike (128, 0.00305), consecutive (128, 0.0025), outcome labels (128, 0.002617), final prob (128, 0.003407); meter — required number (64, 0.0085), captions (64, 0.0062), placed number (64, 0.012); ledger Live-run block (64, 0.009).

### R-03 — Nội dung nhãn trên board (chữ Việt hardcode)
- **Vị trí:** `app/frontend/scene3d.js` — 'GIÁ TRỊ', 'CỐNG PHẨM', 'NHẬP THẦN —',
  'CHUỖI', 'Cần:', 'Đã dâng:', 'Cơn giận của rồng:', 'SỔ HỢP ĐỒNG',
  'Ngày X / 24', 'ĐỦ CỐNG PHẨM', 'CẦN', 'ĐÃ DÂNG', 'KIẾM' (fallback).
- **Tình trạng nguồn:** chuỗi text 3D gốc KHÔNG có trong v1 (layout.json chỉ có
  anchor + tên ngữ nghĩa). Một số cụm trùng/khớp vi.txt đã xác minh
  (`ui.tribute` "CỐNG PHẨM", `ending.anger` "CƠN GIẬN CỦA RỒNG",
  `template.tribute_offer` "ĐÃ DÂNG: …", `contract.remaining` "Hợp đồng Ngày
  {0} / {1}", `inspect.value` "Giá trị {0}") nhưng các nhãn board tự thân
  không có chuỗi nguồn. CIPHER v2 phải thử trích nội dung TextMesh.
  Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): nhãn lấy từ 85 TextMesh trong `ui_layout.json` (đối chiếu vi.txt); '강화' caption INACTIVE — không vẽ; instruction meter INACTIVE — bỏ 'ĐỦ CỐNG PHẨM' (quotaMet chỉ hiện bằng bell glint); title Ledger + day line + 'Cần:/Đã dâng:' INACTIVE — bỏ, chỉ vẽ block Live-run 5 dòng; tháng 'Tháng 4' (vi.txt calendar.month.4); 31 ngày 7×5. **SỬA SAU AEGIS D2 (2026-11-21):** value caption '상납 가치' [−1.6555,1.7088] #D3D1C5 là **ACTIVE — đã thêm** (vẽ 'GIÁ TRỊ CỐNG PHẨM', dịch mới); block Live-run nguồn là MỘT TextMesh nhiều dòng '요구액\n1,800 G\n\n올려놓은 몫\n0 G' (64, 0.009) #5D4932; z riêng từng cột outcome/prob đã áp (board hơi nghiêng).

### R-06 — Động học vung búa
- **Vị trí:** `app/frontend/scene3d.js` `hammerSwingTick()` — giơ 0.85 rad / 130 ms
  (ease-out), đập 90 ms (ease-in).
- **Tình trạng nguồn:** animation code không có trong scene data (LAYOUT.md §10.5
  TODO-RE). CIPHER v2 (behavior/AnimationClip) đang thử. Trạng thái: **SỬA MỘT PHẦN THEO SỐ THẬT V2** (2026-11-21): timing thật (raise 0.16/speed, down 0.095/speed, returnOffset 0.10/speed, returnRest 0.21/speed, impact 0.255s, cooldown 0.64/speed). GÓC giơ búa (0.85 rad) KHÔNG có nguồn — giữ marker TODO-RE, không tự đặt góc mới. noSwordLockoutSec 3.2 chưa implement ở frontend (core rule) — ghi trong handoff. **SỬA SAU AEGIS D1 (2026-11-21):** neo cooldown đặt ngay lúc strike bắt đầu (trước Backend.invoke + 255 ms impact wait), không phải trong `finally` — trước đó gate thật ~895 ms nên 12 tap chỉ 6 strike; sau sửa 12 tap → 12 strike (browser test xác nhận).

### R-07 — Rung camera khi Fever
- **Vị trí:** `app/frontend/scene3d.js` `applyCamera()` — 0.004/0.003 rad,
  tần số 37/43.
- **Tình trạng nguồn:** đường cong FeverCameraPower/Age TODO-RE (LAYOUT.md §5e/
  §10.5). CIPHER v2 đang thử. Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): feverShake {x 0.013, z 1.15 (ROTATION deg), rot 0.38, fovAmp 1.4, freqs [93,117,32,81,67,23]}, power = envelope(age)×1.3, FOV offset TRỪ; kèm rewardShake + quakeShake (quake chưa có trigger ở P0). Hệ số 81 Hz là giả định 0.38° (TODO-RE); mapping trục (yaw/pitch/roll) là suy ra, ghi rõ. **Thêm sau AEGIS D5 (2026-11-21):** biên độ Y của Fever shake (0.009) MƯỢN từ rewardShake.y — feverShake KHÔNG có Y trong data — đã ghi rõ TODO-RE tại dòng code.

### R-09 — Áp dụng detail atlas lên lưỡi kiếm (teal emissive)
- **Vị trí:** `app/frontend/scene3d.js` `buildSwordPartMesh()` — blade emissive
  `(0.04, 0.20, 0.24)`, intensity `0.55`, emissiveMap `SwordV2DetailAtlas.png`.
- **Tình trạng nguồn:** texture atlas là thật (pid 1697); cách áp dụng qua shader
  ForgeTax/SwordV2/Surface TODO-RE (LAYOUT.md §7). CIPHER v2 (shader params)
  đang thử. Trạng thái: **SỬA MỘT PHẦN THEO SỐ THẬT V2** (2026-11-21): shader + atlas + palette đã có → áp phần có (màu base = palette primary, emissiveMap = SwordV2DetailAtlas). Scalar params + teal emissive (0.04,0.20,0.24)/0.55 KHÔNG có trong dữ liệu (emission material = 0) → vẫn là đề nghị remake, giữ marker. ModelScale formula chưa trích — dùng scale base [0.59,0.62,0.72] (TODO-RE).

### R-10 — Ngọn lửa lò (3 sprite SoftFlame)
- **Vị trí:** `app/frontend/scene3d.js` `buildFlames()` + `flamesTick()` — 3 vị trí /
  cỡ 0.55/0.42/0.38, màu `(1.0,0.55,0.15)`, opacity 0.85, pulse 0.16, boost
  Fever 1.6.
- **Tình trạng nguồn:** lửa gốc là ParticleSystem (118 systems), tham số KHÔNG
  có trong v1. CIPHER v2 (effects) đang thử. Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): Low flame PS thật ([2.1324,1.2,1.8185], maxP 40, life 0.3–0.75s, speed 0.3, size 0.08–0.18, emit 30/s, Box [1.13,0.33,0.025], SoftParticle, baseColor [1.0,0.39,0.045,1.0]) — thay 3 sprite bằng Points system rate-based + shader size/alpha.

### R-11 — Tham số tàn lửa (embers)
- **Vị trí:** `app/frontend/scene3d.js` `buildEmbers()/resetEmber()/embersTick()` —
  số lượng 12/30/60 theo quality, size 0.09, opacity 0.8, màu `(1.0,0.55,0.2)`,
  vận tốc lên 0.25–0.6, life 1.5–4s, spread `[0.5,0.05,0.4]`.
- **Tình trạng nguồn:** vị trí gốc đã có (Draft embers `[2.001,1.25,1.681]` +
  Hearth bed `[2.17,1.06,1.85]`); tham số hạt KHÔNG có trong v1. CIPHER v2
  đang thử. Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): Draft embers PS thật ([2.0013,1.25,1.681], maxP 90, life 1.9s, speed 0.45, size 0.021, emit 8/s, Box [1.1,0.05,0.45]) — rate-based, BỎ quality tiers (low/medium/high).

### R-12 — Tham số bụi bay (dust)
- **Vị trí:** `app/frontend/scene3d.js` `buildDust()/dustTick()` — 24 hạt/system,
  size 0.03, opacity 0.22, màu `(0.9,0.85,0.75)`, vận tốc, life 5–10s.
- **Tình trạng nguồn:** 4 vị trí gốc đã có (Warm/Cold/Shelf/Dust and stone);
  tham số KHÔNG có trong v1. CIPHER v2 đang thử. Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): 4 hệ bụi thật (Warm/Cold/Shelf: maxP 32, life 8–12s, speed 0.012–0.035, size 0.004–0.01, emit 2/s, drift (0.008,0.013,0.004); Lazy soot: maxP 24, life 2.5s, speed 0.2, size 0.18–0.35, emit 4/s, [0.25,0.29,0.3,0.13]) + màu startColor thật. **SỬA SAU AEGIS D4 (2026-11-21):** spawn volume là Box thật trong data (effects.json shape.typeName = Box + shape.scale): Warm [0.85,0.8,0.65], Cold [1.2,0.95,0.4], Shelf [0.3,0.7,1.3], Lazy [0.7,0.3,0.03] — đã thay sphere r=1.0 (comment cũ ghi sai là shape chưa rõ).

### R-13 — Tham số tia lửa khi đập (spark burst)
- **Vị trí:** `app/frontend/scene3d.js` `spawnBurst()/burstsTick()` — số lượng
  10/24/48 theo quality (×2 khi gãy), màu strike `(1.0,0.72,0.3)` / great
  `(1.0,0.85,0.3)` / break `(1.0,0.32,0.15)`, size 0.11, opacity 0.95, vận tốc,
  life 0.35–0.7s, gravity 4.5.
- **Tình trạng nguồn:** 'Hammer sparks' ParticleSystem có trong data nhưng tham
  số KHÔNG có trong v1. CIPHER v2 đang thử. Trạng thái: **SỬA MỘT PHẦN THEO SỐ THẬT V2** (2026-11-21): Hammer sparks PS thật ([−1.1897,1.24,2.2], maxP 90, life 0.44s, speed 2.3, size 0.018, gravity 1.4, emit 0/s event-driven, Hemisphere r=0.05 angle 16°). SỐ HẠT BURST mỗi lần đập KHÔNG có trong dữ liệu — giữ quality counts + marker, chờ trace thêm hoặc OWNER duyệt remake riêng. **Thêm sau AEGIS D6 (2026-11-21):** 3 màu tint burst (strike/great/break) cũng KHÔNG có nguồn (PS startColor là [1.0,0.39,0.045,1.0]) — đã ghi marker TODO-RE riêng.

### R-14 — Đèn outcome nháy khi có kết quả mới
- **Vị trí:** `app/frontend/scene3d.js` `flashOutcomeLight()/outcomeLightsTick()` —
  base 0.35, flash +2.2, decay 1.2/s.
- **Tình trạng nguồn:** hộp đèn + material là thật (5 boxes 0.224×0.006×0.002 m,
  màu _BaseColor thật); hành vi "kết quả mới nhất phát sáng" KHÔNG có nguồn
  trong v1. CIPHER v2 (behavior) đang thử. Trạng thái: **VẪN THIẾU — KHÔNG ĐỤNG ĐẾN** (đã chứng minh, 2026-11-21): hành vi 'kết quả mới nhất phát sáng' không có nguồn; giữ đề nghị remake, code hiện (base 0.35, flash +2.2, decay 1.2/s) giữ nguyên + marker. **Thêm sau AEGIS D3 (2026-11-21):** marker TODO-RE/R-14 nay đã ghi trong code (`scene3d.js` buildOutcomeLights + outcomeLightsTick) — trước đó chỉ có trong handoff/proposals.

### R-15 — Hệ số sáng đèn theo cơn giận / đủ cống phẩm / Fever
- **Vị trí:** `app/frontend/scene3d.js` `update()` + `flamesTick()` — eye ×0.8,
  breath ×0.5 mỗi mức giận; quota light 2.0 khi đủ; fireLight 26 khi Fever
  (20 khi thường — 20 KHỚP dữ liệu gốc, 26 là tự đặt).
- **Tình trạng nguồn:** đèn Eye/Breath/Quota 0.0 mặc định, bật theo sự kiện
  (LAYOUT.md §5e) — hệ số scale KHÔNG có trong v1. CIPHER v2 đang thử.
  Trạng thái: **SỬA MỘT PHẦN THEO SỐ THẬT V2** (2026-11-21): công thức radiance Fever thật (intensity = amount×(sin(age×35)+impact×3.5+2.2), offset 0.06, FeverColor HSV, hueBase=0 TODO-RE) + đèn radiance riêng; fireLight giữ 20 (bỏ boost 26 tự đặt). eyePressureByMood + setDanger/warningCount đã ghi (constants). Anger→Eye/Breath (0.8/0.5) + quota 2.0 KHÔNG có nguồn — giữ marker.

### R-24 — Góc nhìn work: pitch code ~−14° vs script field 10°
- **Vị trí:** `app/frontend/scene3d.js` `init()` — work view tính từ
  eye `[0.15,1.76,−0.05]` → lookAt mặt đe `[−1.07,1.125,2.19]`, FOV 61.
- **Tình trạng nguồn:** CẢ HAI giá trị đều có trong data (lookAt + field
  `work_look_pitch_deg` 10.0 trong ForgeFirstPerson) nhưng chúng KHÔNG KHỚP
  nhau (pitch tính từ lookAt ≈ −14°). Cần CIPHER v2 (behavior) xác định cách
  blend spawn↔work view đúng. AEGIS đã tự tính lại: **−13.98° ≈ −14°**, xác
  nhận R-24 ghi đúng. Trạng thái: **ĐÃ SỬA THEO SỐ THẬT V2** (2026-11-21): pitch = workLookPitch = 10.0 (Range(0,35)); workBlend tiến tới đích 1−exp(−10·dt); FOV lerp 69→61 theo clamp01(workBlend) + kick×0.35; Punch kick cap 1.4. BỎ lookAt −14°. Kick decay rate KHÔNG có trong data — dùng 7/s mượn từ rewardImpulse decay (ghi rõ).

### R-26 — Kích thước giấy calendar (O-1 của AEGIS — bổ sung sau kiểm thử)
- **Vị trí:** `app/frontend/scene3d.js` `makeBoardPlane('calendar', 0.85, 0.55, …)`.
- **Tình trạng nguồn:** code tự ghi "Paper size is an APPROXIMATION (TODO-RE) —
  the paper has no mesh in the data" (chỉ có batten 0.76 m + text anchors).
  SENSOR đã sót món này khỏi danh sách ban đầu; AEGIS phát hiện (grep "calendar"
  = 0 kết quả trong REMAKE-PROPOSALS.md cũ).
- **Đề nghị:** chờ CIPHER v2 xem có lấy được kích thước giấy từ dữ liệu text/UI
  không; nếu không, đề nghị giữ 0.85×0.55 làm approximation ghi rõ.
  Trạng thái: **SỬA MỘT PHẦN THEO SỐ THẬT V2** (2026-11-21): biên đo từ 31 TextMesh ngày (x [−2.6028,−1.9633] rộng 0.64m, y [1.5878,2.2851] cao 0.70m; giấy CAO hơn RỘNG) → đổi thành 0.70×0.76 (canvas 512×556), ghi rõ approximation, chờ OWNER duyệt kích thước chính xác.

---

## Nhóm C — Sửa theo nguồn gốc (không phải remake — code hiện dùng sai số liệu đã có)

### F-01 — Màu outcome trong app.js sai so với _BaseColor gốc
- **Vị trí:** `app/frontend/app.js` `OUTCOME_COLORS` (hex `#e0322a / #e8a23c /
  #c8ccd4 / #7ac74f / #ffcf4d`) — dùng cho màu chữ kết quả trên board.
- **Nguồn đúng:** `scene3d.js` `OUTCOME_COLORS` (linear RGB từ LAYOUT.md §5a
  _BaseColor: BREAK `[0.57,0.174,0.144]`, damage `[0.558,0.342,0.144]`, Hold
  `[0.42,0.438,0.432]`, Success `[0.222,0.516,0.426]`, Great `[0.6,0.474,0.192]`).
  Hex trong app.js KHÔNG khớp (vd. BREAK thật ≈ `#C77368`, không phải `#e0322a`).
- **Đã sửa 2026-11-21:** `app.js` OUTCOME_COLORS = `#C7746A/#C59E6A/#ADB1B0/
  #82BEAF/#CBB779` (chuyển đổi sRGB đúng từ _BaseColor thật, công thức IEC).
  Trạng thái: **ĐÃ SỬA.**
- **F-01b (AEGIS phát hiện thêm, cùng họ lỗi):** `scene3d.js:633`
  `drawInstrument` tính màu label/bar bằng `v*255` trực tiếp từ giá trị linear
  ra hex canvas sRGB — vd. BREAK ra `#912C24` thay vì sRGB đúng `#C77468`.
  (Màu dùng cho light/material 3D bằng linear là đúng trong Three.js — chỉ
  đường canvas 2D là sai.) **Đã sửa 2026-11-21:** thêm `linearToSrgbHex()` /
  `textMeshColorToHex()` (công thức IEC) trong `scene3d.js`; `drawInstrument`
  dùng hex sRGB đúng cho label/bar (màu TextMesh cũng qua cùng hàm).
  Trạng thái: **ĐÃ SỬA.**

### F-02 — Mặt phẳng ledger 1.0×1.3 (slate gốc 1.09×1.39)
- **Vị trí:** `app/frontend/scene3d.js` `makeBoardPlane('ledger', 1.0, 1.3, …)`.
- **Nguồn đúng:** `scene-data.json` boards3d.ledger aabb `[1.09, 1.39, 0.038]`.
- **Đã sửa 2026-11-21:** `makeBoardPlane('ledger', 1.09, 1.39, 512, 652)`.
  Trạng thái: **ĐÃ SỬA.**

### F-03 — ~~Comment đầu scene3d.js ghi sai "600 real objects"~~ — RÚT LẠI (AEGIS bác bỏ)
- **Kết luận của AEGIS (đã tự kiểm chứng):** "600" **khớp đúng**
  `scene-data.json stats.objectsSelected = 600` (đếm trong `convert-scene.py:729`:
  active+usable objects) và "216" khớp `uniqueMeshes = 216`. Khẳng định ban đầu
  của SENSOR ("600 không khớp số nào") là **sai sự thật** — SENSOR nhận sai.
  303 là số instance-group, không phải số objects. Comment chỉ gây hiểu lầm nhẹ
  (render thực tế là 589 instances + 60 flagstones = 649 placements) — có thể
  làm rõ câu chữ, KHÔNG được "sửa" thành "303 objects" như SENSOR đề nghị ban đầu.
- Trạng thái: **ĐÃ RÚT LẠI — không phải lỗi.**

### F-04 — Lỗi tài liệu của CIPHER: grip winding x9 (thực tế x8) — cần [REJECT_TO_CIPHER]
- **Vấn đề:** LAYOUT.md §7 ghi "Grip winding (x9)" với 9 path_id
  `[439,440,441,442,444,445,447,452,457]`. Kiểm chứng từ dump2 sharedassets0:
  TR 469 (BasicTributeSword root) có đúng 13 children, trong đó 8 Grip winding
  `[457,441,442,440,444,452,439,445]`; pid **447 KHÔNG phải con của TR 469**
  (thuộc assembly kiếm khác). `scene-data.json` (8 windings) là ĐÚNG, LAYOUT.md
  là SAI.
- **Hướng xử lý:** [REJECT_TO_CIPHER] — CIPHER sửa LAYOUT.md §7 (x9 → x8, bỏ
  pid 447) và cập nhật `/04_BANG_CHUNG_NGUON_GOC.md`. Không phải việc của SENSOR.
  Trạng thái: **ĐÃ SỬA TRONG V2** (CIPHER sửa LAYOUT.md §7 + /04; SENSOR chỉ
  xác nhận lại, không sửa gì thêm).

### F-05 — Comment "3 dust particle systems" (thực tế filter khớp 4)
- **Vị trí:** `app/frontend/scene3d.js` `buildDust()` — comment ghi 3 hệ, code lọc
  `/dust/i` khớp 4 hệ ('Warm dust / work lamp', 'Cold dust / iron bars',
  'Shelf dust', 'Dust and stone').
- **Đã sửa 2026-11-21:** `buildDust()` nay có đúng 4 hệ ambient (Warm/Cold/
  Shelf/Lazy soot) + comment ghi 4; 'Dust and stone' là one-shot dragon-visit,
  loại khỏi danh sách ambient (ghi rõ trong comment). Trạng thái: **ĐÃ SỬA.**

---

## Tổng kết số lượng

| Nhóm | Số món | Trạng thái |
|---|---|---|
| A — Đề nghị remake (OWNER duyệt 2026-11-21 19:47) | 12 (R-04, R-05, R-08, R-16, R-17, R-18, R-19, R-20, R-21, R-22, R-25, R-27) | **ĐÃ DUYỆT — REMADE** (R-17/R-20 nâng cấp bằng số thật v2) |
| B — Kết quả CIPHER v2 | 14 (R-01, R-02, R-03, R-06, R-07, R-09, R-10, R-11, R-12, R-13, R-14, R-15, R-24, R-26) | 7 sửa hết (R-02, R-03, R-07, R-10, R-11, R-12, R-24); 5 sửa một phần (R-06, R-09, R-13, R-15, R-26); 2 vẫn thiếu (R-01, R-14) |
| C — Sửa theo nguồn gốc | 5 (F-01 [+F-01b], F-02, F-04, F-05; F-03 ĐÃ RÚT LẠI) | **ĐÃ SỬA HẾT** (F-04 sửa trong v2) |

**Cam kết của SENSOR:** không tự duyệt món nào, không remake thêm món nào trước
khi OWNER duyệt. Món nào được duyệt sẽ được ghi `REMADE` trong code + báo cáo
bàn giao, không bao giờ trình bày như đồ gốc.
