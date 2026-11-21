// i18n for the P0 UI — ForgeTax Mobile remake.
//
// VI strings are copied VERBATIM from the original game's own vi.txt
// (~/workspace/forgetax-mobile/unity/textassets/vi.txt). EN strings come
// from ForgeTax.txt where the `en` field exists; where it is empty the EN
// text is a fresh clone translation, marked "clone EN" below.
//
// Keys marked "clone wording" are fresh Vietnamese written for this
// remake (no vi.txt source exists for those labels) — they are NOT
// presented as the original's text.
//
// The 25 keys missing from vi.txt (all `dev.*`: dev.quality,
// dev.perfBench, dev.adUseMax, dev.adMaxDebugger, dev.tabMoney,
// dev.tabSwords, dev.tabForge, dev.tabCalendar, dev.tabDragon,
// dev.tabShop, dev.tabSystem, dev.secretDoor, dev.forgeMode,
// dev.forgeNormal, dev.forgeNoBreak, dev.forgeAlwaysSuccess, dev.nextDay,
// dev.jumpTo, dev.dragonStart, dev.godMode, dev.dragonKill, dev.dragonLose,
// dev.merchant, dev.armory, dev.allRelics) fall back to English. None of
// them is used by the P0 UI, so the P0 UI is fully Vietnamese.

const I18N = {
  // -- Original strings (vi.txt verbatim) --
  "contract.remaining": { vi: "Hợp đồng  Ngày {0} / {1}", en: "Contract  Day {0} / {1}" },
  "contract.next": { vi: "Cống phẩm ngày mai  {0} G", en: "Tomorrow's tribute  {0} G" },
  "ui.tribute": { vi: "CỐNG PHẨM", en: "TRIBUTE" },
  "ui.quota_caption": { vi: "CỐNG PHẨM YÊU CẦU", en: "TRIBUTE DUE" },
  "template.tribute_offer": { vi: "ĐÃ DÂNG: {count} kiếm / {value} G", en: "OFFERED: {count} blades / {value} G" },
  "menu2.key.strike": { vi: "Đập kiếm trên đe", en: "Strike the sword on the anvil" }, // EN: clone (no en field in source)
  "fever.ready": { vi: "SẴN SÀNG", en: "READY" },
  "contract.continue": { vi: "Tiếp tục rèn", en: "Keep forging" },
  "contract.finish": { vi: "Hoàn tất hợp đồng", en: "Finish the contract" },
  "contract.endless": { vi: "Hợp đồng gia hạn · Ngày {0}", en: "Extended contract · Day {0}" },
  "contract.lastday": { vi: "Hợp đồng kết thúc hôm nay.", en: "The contract ends today." },
  "dev.grade": { vi: "Cấp cường hóa", en: "Grade" },
  "menu2.bestGrade": { vi: "Cấp cao nhất", en: "Best grade" }, // EN: clone
  "inspect.value": { vi: "Giá trị {0}", en: "Value {0}" },
  "ending.anger": { vi: "CƠN GIẬN CỦA RỒNG", en: "DRAGON ANGER" },
  "dev.day": { vi: "Ngày", en: "Day" },
  "protection.anvil": { vi: "Kiếm trên đe", en: "Sword on the anvil" }, // EN: clone
  "dev.skipDay": { vi: "Qua ngày kế tiếp", en: "Skip to the next day" }, // EN: clone
  // Settings — all from vi.txt (verified 2026-11-21).
  "settings.master": { vi: "Âm lượng tổng", en: "Master volume" },
  "settings.music": { vi: "Nhạc · Âm môi trường", en: "Music" },
  "settings.sfx": { vi: "Hiệu ứng âm thanh", en: "Sound effects" },
  "settings.haptics": { vi: "Rung", en: "Haptics" },
  "settings.brightness": { vi: "Độ sáng", en: "Brightness" },
  "settings.quality": { vi: "Chất lượng đồ họa", en: "Graphics quality" },
  "settings.quality.auto": { vi: "Tự động ({0})", en: "Auto ({0})" },
  "settings.quality.low": { vi: "Thấp", en: "Low" },
  "settings.quality.mid": { vi: "Trung bình", en: "Medium" },
  "settings.quality.high": { vi: "Cao", en: "High" },
  "settings.fps": { vi: "Hiện FPS", en: "Show FPS" },
  "settings.floor_swords": { vi: "Số kiếm tối đa trên sàn", en: "Max swords on floor" },
  "settings.floor_swords_value": { vi: "{0} thanh", en: "{0} swords" },
  "settings.controls": { vi: "Điều khiển", en: "Controls" },
  "settings.controls_free": { vi: "Di chuyển tự do", en: "Free move" },
  "settings.controls_hub": { vi: "Góc nhìn cố định", en: "Fixed views" },
  "settings.lock_on": { vi: "Khóa mục tiêu", en: "Lock-On" },
  "settings.on": { vi: "Bật", en: "On" },
  "settings.off": { vi: "Tắt", en: "Off" },
  "menu.language": { vi: "NGÔN NGỮ", en: "LANGUAGE" },
  "menu2.settings": { vi: "Cài đặt", en: "Settings" }, // EN: clone
  "menu2.language": { vi: "Ngôn ngữ", en: "Language" }, // EN: clone
  "menu2.languageHint": { vi: "Thay đổi ngôn ngữ có hiệu lực ngay và được ghi nhớ.", en: "Changing the language takes effect immediately and is remembered." }, // EN: clone
  "dev.fps": { vi: "Hiện FPS", en: "Show FPS" },

  // -- Clone wording (fresh Vietnamese, NOT the original's text) --
  "ui.fever": { vi: "Nhập thần", en: "Fever" }, // name taken from dev.fever's wording
  "ui.swords_left": { vi: "Kiếm còn lại", en: "Swords left" },
  "ui.tribute_button": { vi: "Dâng cống phẩm", en: "Offer tribute" },
  "ui.victory": { vi: "Hoàn thành hợp đồng!", en: "Contract complete!" },
  "ui.defeated": { vi: "Con rồng đã nổi giận…", en: "The dragon is enraged…" },
  "ui.new_run": { vi: "Chơi lại", en: "New run" },
  "ui.endless_continue": { vi: "Tiếp tục (Endless)", en: "Continue (Endless)" },
  "ui.haptics_note": { vi: "Không có động cơ rung trên PC", en: "No vibration motor on PC" },
  "ui.quality_note": { vi: "Trên giao diện 2D này, mục này chỉnh mật độ hạt lửa / chuyển động.", en: "On this 2D UI, this controls spark / animation density." },
  "ui.loading": { vi: "Đang tải…", en: "Loading…" },
  "ui.error": { vi: "Không tải được giao diện. Hãy khởi động lại.", en: "Could not load the interface. Please restart." },
  "ui.outcome_break": { vi: "GÃY", en: "BREAK" },
  "ui.outcome_damage": { vi: "HỎNG", en: "DAMAGE" },
  "ui.outcome_hold": { vi: "GIỮ", en: "HOLD" },
  "ui.outcome_success": { vi: "THÀNH CÔNG", en: "SUCCESS" },
  "ui.outcome_great": { vi: "ĐẠI THÀNH CÔNG", en: "GREAT" },
  "ui.scrap": { vi: "Phế liệu +{0} G", en: "Scrap +{0} G" },
  "ui.fever_payout": { vi: "Nhập thần: +{0} cấp!", en: "Fever: +{0} grades!" },
  "ui.round_cleared": { vi: "Đủ cống phẩm — sang ngày {0}", en: "Quota met — on to day {0}" },
  "ui.round_anger": { vi: "Thiếu cống phẩm — rồng giận ({0}/3)", en: "Short on tribute — dragon anger ({0}/3)" },
  "ui.settings_title": { vi: "Cài đặt", en: "Settings" },
  "ui.relics": { vi: "Di vật", en: "Relics" },
};

// Keys whose VI text is missing in the original (all dev.*) — they fall
// back to English. Listed for the record; none is used by the P0 UI.
const VI_MISSING_KEYS = [
  "dev.quality", "dev.perfBench", "dev.adUseMax", "dev.adMaxDebugger",
  "dev.tabMoney", "dev.tabSwords", "dev.tabForge", "dev.tabCalendar",
  "dev.tabDragon", "dev.tabShop", "dev.tabSystem", "dev.secretDoor",
  "dev.forgeMode", "dev.forgeNormal", "dev.forgeNoBreak",
  "dev.forgeAlwaysSuccess", "dev.nextDay", "dev.jumpTo", "dev.dragonStart",
  "dev.godMode", "dev.dragonKill", "dev.dragonLose", "dev.merchant",
  "dev.armory", "dev.allRelics",
];

let LANG = "vi";

function t(key, params) {
  const entry = I18N[key];
  if (!entry) return key;
  let text = entry[LANG] || entry.en || key;
  if (params) {
    if (Array.isArray(params)) {
      params.forEach((v, i) => { text = text.replace("{" + i + "}", String(v)); });
    } else {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace("{" + k + "}", String(v));
      }
    }
  }
  return text;
}

function fmtGold(v) {
  const n = Math.round(v);
  return n.toLocaleString(LANG === "vi" ? "vi-VN" : "en-US");
}
