// ForgeTax Mobile remake — P0 frontend (real 3D room + in-scene UI).
//
// The game logic lives in the Rust core (forgetax-core); this file only
// renders state and forwards input. The forge room is rendered by
// scene3d.js (Three.js, the REAL 3.17.0 scene layout + original textures);
// ALL game state is shown as 3D text on the in-room boards (LAYOUT.md
// §5, §9) — there are no DOM text frames, no action buttons, no topbar.
// Interactions are in-scene taps: anvil/sword = strike, service window /
// counter bell = tribute, ledger/calendar = next day (ForgeInteractable
// targets, LAYOUT.md §4). ESC opens settings (the only DOM panel kept).
// Backend bridge:
//   - In the Tauri app: window.__TAURI__.core.invoke(cmd, args).
//   - In dev/test mode (plain http server): POST /api/<cmd> with JSON.
// If the backend is unreachable, a plain error text is shown — never a
// black window.

const Backend = {
  isTauri() {
    return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  },
  async invoke(cmd, args) {
    if (this.isTauri()) {
      return window.__TAURI__.core.invoke(cmd, args || {});
    }
    // Production (Tauri window) without the bridge means withGlobalTauri
    // is off: fail with a clear message instead of fetching /api/ — the
    // asset protocol answers unknown paths with index.html, which then
    // dies as a confusing JSON parse error ("<!DOCTYPE ..." is not valid
    // JSON). Dev mode (plain http server on localhost) still uses /api/.
    const host = window.location.hostname || "";
    if (host !== "localhost" && host !== "127.0.0.1") {
      throw new Error("Tauri bridge missing (window.__TAURI__ not injected) — check withGlobalTauri in tauri.conf.json");
    }
    const res = await fetch("/api/" + cmd, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args || {}),
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " on " + cmd);
    return res.json();
  },
};

// Starter relic display names — mirrors relics.rs display_name()
// (fresh Vietnamese wording written for this remake).
// REMADE — approved by OWNER 2026-11-21 (R-04): no Vietnamese relic names
// exist in the game data (vi.txt has item.<id>.name in English/Korean
// source only for the P0 starters' descriptions, not VI display names) —
// these VI names are our translation, shown as such.
const RELIC_NAMES = {
  nail: "Đinh Cong",
  file: "Đá Mài Cũ",
  seal: "Nút Thắt Đen",
  coin: "Con Dấu Kiểm Định",
  pin: "Đinh Vàng",
  hold: "Đá Niêm Phong",
  shard: "Chén Thánh Tang Lễ",
  repair: "Sắt Nối Nứt",
};

const OUTCOME_KEYS = {
  break: "ui.outcome_break",
  damage: "ui.outcome_damage",
  hold: "ui.outcome_hold",
  success: "ui.outcome_success",
  great: "ui.outcome_great",
};

// F-01 — REAL outcome colours: the 'Outcome light 0..4' material
// _BaseColor values (LAYOUT.md §5a, linear) converted to sRGB with the
// exact IEC formula (v<=0.0031308 ? 12.92v : 1.055*v^(1/2.4)-0.055):
//   BREAK [0.57,0.174,0.144] -> #C7746A, damage [0.558,0.342,0.144] ->
//   #C59E6A, Hold [0.42,0.438,0.432] -> #ADB1B0, Success [0.222,0.516,
//   0.426] -> #82BEAF, Great [0.6,0.474,0.192] -> #CBB779.
// (The previous self-set hex #e0322a/#e8a23c/#c8ccd4/#7ac74f/#ffcf4d was
// wrong — AEGIS F-01.)
// REMADE — approved by OWNER 2026-11-21 (R-05): the VI outcome labels
// below (GÃY/HỎNG/GIỮ/THÀNH CÔNG/ĐẠI THÀNH CÔNG) are our translation —
// the original's board labels are the Korean TextMesh strings
// (파괴/손상/유지/성공/대성공, ui_layout.json); vi.txt's ticket names
// (Phiếu Đại thành công / Thành công / Giữ nguyên / Hư hại) are the
// closest VI source but are ticket names, not outcome labels.
const OUTCOME_COLORS = {
  break: "#C7746A",
  damage: "#C59E6A",
  hold: "#ADB1B0",
  success: "#82BEAF",
  great: "#CBB779",
};

const OUTCOME_ORDER = ["break", "damage", "hold", "success", "great"];

// Sword names — the original's own Vietnamese names (unity/textassets/
// vi.txt, 45 P0 ids 1–45), loaded at boot. Falls back to English
// (ForgeTax.txt) then to "Kiếm #id" if a name is missing.
let SWORD_NAMES = {};

let state = null;
let settings = null;
let striking = false;
let strikeReadyAt = 0; // R-06: nextStrikeTime = now + 0.64/speed (speed 1.0 in P0).
let feverTickAcc = 0;
let lastFeverActive = false;
let drag = null;
let viewOffset = { x: 0, y: 0 };
let lastOutcome = null;
let lastOutcomeLabel = null;
let consecCount = 0;
// R-17: appearance uses the HIGHEST grade reached (ForgeSwordAppearance
// SyncAppearance: grade = max(highestVisualGrade, grade) — the form does
// NOT step back down after a Damage). Tracked per sword, keyed by
// (round, sword_index); reset when the sword changes.
let swordKey = null;
let swordHighestGrade = 0;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const els = {};

function collectEls() {
  ["loading", "error", "app", "scene", "gl", "toast", "fps-counter",
   "brightness-overlay", "settings-panel", "overlay", "overlay-title",
   "overlay-sub", "overlay-btn-endless", "overlay-btn-new"].forEach((id) => { els[id] = $(id); });
}

function showError(msg) {
  els.loading.style.display = "none";
  els.app.style.display = "none";
  els.error.style.display = "flex";
  els.error.textContent = t("ui.error") + " (" + msg + ")";
}

function fmtGold(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------------------------------------------------------------------------
// Rendering — state -> the 3D room (boards, lights, sword, fever, anger)
// ---------------------------------------------------------------------------
function buildView() {
  const s = state;
  // R-17: track the highest grade per sword (see swordHighestGrade above).
  // The key is (round, sword_index) — the core's sword id cycles 1-45 so
  // the id alone does not identify a sword.
  if (s.sword) {
    const key = s.round + "/" + (s.sword_index ?? 0);
    if (key !== swordKey) {
      swordKey = key;
      swordHighestGrade = s.sword.grade;
    } else if (s.sword.grade > swordHighestGrade) {
      swordHighestGrade = s.sword.grade;
    }
  }
  return {
    sword: s.sword ? { id: s.sword.id, grade: s.sword.grade, value: s.sword.value } : null,
    // Fallback kind name (SWORD_NAMES, vi.txt sword.<id>.name 1-45). The
    // board's identity label uses the APPEARANCE name (swords-manifest
    // viName for the resolved appearance id) — scene3d.js resolves it.
    swordName: s.sword ? (SWORD_NAMES[s.sword.id] || ("Kiếm #" + s.sword.id)) : null,
    swordIndex: s.sword_index ?? 0,
    swordHighestGrade,
    roundTribute: s.round_tribute,
    quota: s.quota,
    quotaMet: s.round_tribute >= s.quota,
    round: s.round,
    endless: s.endless,
    anger: s.anger,
    channels: OUTCOME_ORDER.map((key, i) => ({
      key,
      label: t(OUTCOME_KEYS[key]),
      pct: s.chances[i] / 10,
    })),
    lastOutcome,
    lastOutcomeLabel,
    lastOutcomeColor: lastOutcome ? OUTCOME_COLORS[lastOutcome] : "#f0e6d6",
    consecutive: consecCount,
    fever: {
      active: s.fever.active,
      timeLeft: s.fever.time_left,
      charge: s.fever.charge,
      needed: s.fever.needed,
      // R-07/R-15: bonus (effects+0x128) + max (effects+0xd4) from
      // StartFever — the frontend computes FeverAge / FeverEnvelope /
      // cameraPower from these (behavior.json fever).
      bonus: s.fever.bonus ?? 4,
      max: s.fever.max ?? 8,
    },
    relics: s.relics.map((id) => RELIC_NAMES[id] || id),
  };
}

function render() {
  if (!state) return;
  const s = state;
  if (window.ForgeScene) window.ForgeScene.update(buildView());
  // R-21 — REMADE (approved by OWNER 2026-11-21): the end-of-run overlay
  // (victory / defeated, with the Endless continue button) is a DOM
  // overlay — the original has no end-of-run overlay in the extraction
  // (the run ends on the Ledger / in the dragon presentation, not in a
  // modal). End overlays.
  if (s.state === "victory") {
    showOverlay(t("ui.victory"), t("contract.lastday"), true);
  } else if (s.state === "defeated") {
    showOverlay(t("ui.defeated"), t("ending.anger"), false);
  } else {
    hideOverlay();
  }
  // Fever start sound (edge-triggered).
  if (s.fever.active && !lastFeverActive) sound.playFever();
  lastFeverActive = s.fever.active;
}

function showOverlay(title, sub, showEndless) {
  els["overlay-title"].textContent = title;
  els["overlay-sub"].textContent = sub;
  els["overlay-btn-endless"].style.display = showEndless ? "inline-block" : "none";
  els.overlay.style.display = "flex";
}

function hideOverlay() {
  els.overlay.style.display = "none";
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2600);
}

// ---------------------------------------------------------------------------
// Actions (called by in-scene taps, Space, or the end overlay)
// ---------------------------------------------------------------------------
function qualityLevel() {
  if (!settings) return "medium";
  if (settings.quality === "auto") return "medium";
  return settings.quality;
}

function recordOutcome(o) {
  if (o === lastOutcome) {
    consecCount += 1;
  } else {
    lastOutcome = o;
    consecCount = 1;
  }
  lastOutcomeLabel = t(OUTCOME_KEYS[o]);
}

async function doStrike() {
  if (striking || !state || state.state !== "playing") return;
  // R-06: hammer cooldown — nextStrikeTime = now + 0.64/speed (speed 1.0
  // in P0, no speed relics). Taps inside the window are ignored (the
  // hammer is still cycling), exactly like the original's strikeReady.
  const now = performance.now();
  if (now < strikeReadyAt) return;
  striking = true;
  // R-06: the cooldown anchor is the STRIKE START — nextStrikeTime =
  // now + 0.64/speed (behavior.json hammer_strike.cooldownFormula),
  // set BEFORE the Backend.invoke + the 255 ms impact wait. (AEGIS
  // 2026-11-21 D1: anchoring it in `finally` after the wait made the
  // real gate ~895 ms, so 12 taps at 700 ms gave only 6 strikes.)
  strikeReadyAt = now + 640;
  sound.ensure();
  // 3D hammer swing (real timing: raise 0.16s, down 0.095s, return
  // 0.10s + 0.21s — behavior.json hammer_strike, speed 1.0).
  if (window.ForgeScene) window.ForgeScene.strike();
  const swingStart = performance.now();
  try {
    const payload = await Backend.invoke("strike", {});
    if (!payload) return;
    // R-06: the outcome is revealed at the IMPACT (impactDelayAtSpeed1Sec
    // 0.255s after the swing starts), not when the API answers. Wait out
    // the remainder so the grade/value/burst/flash land on the hammer hit.
    const elapsed = performance.now() - swingStart;
    if (elapsed < 255) await new Promise((r) => setTimeout(r, 255 - elapsed));
    state = payload.state;
    const o = payload.outcome;
    recordOutcome(o);
    if (o === "great") sound.playGreat();
    else if (o === "break") {
      sound.playBreak();
      if (window.ForgeScene) window.ForgeScene.addBrokenSword();
      if (payload.scrap > 0) toast(t("ui.scrap", [fmtGold(payload.scrap)]));
    } else if (o === "success" || o === "damage" || o === "hold") {
      sound.playStrike();
    }
    if (payload.fever_started) toast(t("fever.ready"));
    render();
  } catch (e) {
    showError(String(e));
  } finally {
    striking = false;
  }
}

async function doTribute() {
  if (!state || state.state !== "playing") return;
  sound.ensure();
  try {
    const payload = await Backend.invoke("tribute_sword", {});
    if (!payload) return;
    state = payload.state;
    sound.playTribute();
    sound.playCoin();
    if (payload.settle === "cleared") toast(t("ui.round_cleared", [state.round]));
    else if (payload.settle === "anger") toast(t("ui.round_anger", [state.anger]));
    render();
  } catch (e) {
    showError(String(e));
  }
}

async function doEndDay() {
  if (!state || state.state !== "playing") return;
  try {
    const snap = await Backend.invoke("end_day", {});
    if (!snap) return;
    state = snap;
    sound.playTribute();
    render();
  } catch (e) {
    showError(String(e));
  }
}

async function doNewRun() {
  try {
    state = await Backend.invoke("new_run", {});
    lastOutcome = null;
    lastOutcomeLabel = null;
    consecCount = 0;
    swordKey = null;
    swordHighestGrade = 0;
    strikeReadyAt = 0;
    hideOverlay();
    render();
  } catch (e) {
    showError(String(e));
  }
}

async function doEndless() {
  try {
    state = await Backend.invoke("continue_endless", {});
    hideOverlay();
    render();
  } catch (e) {
    showError(String(e));
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function defaultSettings() {
  // R-20 — REAL defaults from the original (behavior.json
  // settings_defaults, ForgeSettingsData..ctor 0x24FB25C +
  // ForgeUserSettings.Defaults() 0x2503FA0): master/music/sfx 1.0 (100%),
  // brightness 0.7 (70%), haptics true (panel row stays disabled on PC —
  // no vibration motor), floorSwordLimit 30, hubControls false = FREE
  // movement (not hub), showFps false. Quality + language defaults are
  // NOT in the recovered data — "auto"/"vi" stay as marked approximations.
  return {
    master: 100, music: 100, sfx: 100, haptics: true, brightness: 70,
    quality: "auto", show_fps: false, floor_swords: 30, controls: "free",
    lock_on: false, language: "vi",
  };
}

function applySettings() {
  if (!settings) return;
  LANG = settings.language === "en" ? "en" : "vi";
  document.documentElement.lang = LANG;
  // Static text (settings panel + overlay buttons).
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    // The "auto" quality option carries the original's {0} placeholder:
    // fill it with the auto-resolved quality label.
    if (el.dataset.i18n === "settings.quality.auto") {
      const level = qualityLevel();
      const levelKey = { low: "settings.quality.low", medium: "settings.quality.mid", high: "settings.quality.high" }[level];
      el.textContent = t("settings.quality.auto", [t(levelKey)]);
      return;
    }
    el.textContent = t(el.dataset.i18n);
  });
  // Brightness overlay: 100% = no overlay.
  els["brightness-overlay"].style.opacity = String(((100 - settings.brightness) / 100) * 0.7);
  // FPS counter.
  els["fps-counter"].style.display = settings.show_fps ? "block" : "none";
  // Broken swords on the floor (cap) + particle budget follow the setting.
  if (window.ForgeScene) window.ForgeScene.setFloorSwords(settings.floor_swords);
  if (window.ForgeScene) window.ForgeScene.setQuality(qualityLevel());
  // View mode: hub / lock-on = fixed work view; free = drag to look.
  if (settings.controls === "hub" || settings.lock_on) {
    viewOffset = { x: 0, y: 0 };
    if (window.ForgeScene) window.ForgeScene.setViewOffset(0, 0);
  }
  // Volumes.
  sound.setVolumes(settings.master, settings.music, settings.sfx);
  // Settings panel controls.
  syncSettingsPanel();
  render();
}

function syncSettingsPanel() {
  const q = (id) => document.getElementById(id);
  q("set-master").value = settings.master;
  q("set-master-val").textContent = Math.round(settings.master) + "%";
  q("set-music").value = settings.music;
  q("set-music-val").textContent = Math.round(settings.music) + "%";
  q("set-sfx").value = settings.sfx;
  q("set-sfx-val").textContent = Math.round(settings.sfx) + "%";
  q("set-brightness").value = settings.brightness;
  q("set-brightness-val").textContent = Math.round(settings.brightness) + "%";
  q("set-quality").value = settings.quality;
  q("set-fps").checked = settings.show_fps;
  q("set-floor").value = settings.floor_swords;
  q("set-floor-val").textContent = t("settings.floor_swords_value", [settings.floor_swords]);
  q("set-controls-free").checked = settings.controls === "free";
  q("set-controls-hub").checked = settings.controls === "hub";
  q("set-lockon").checked = settings.lock_on;
  q("set-language").value = settings.language;
  q("set-haptics").checked = false;
  q("set-haptics").disabled = true;
}

async function persistSettings() {
  try {
    await Backend.invoke("save_settings", { settings });
  } catch (e) {
    // Settings persistence is best-effort; the game keeps working.
    console.warn("save_settings failed", e);
  }
}

function bindSettingsPanel() {
  const q = (id) => document.getElementById(id);
  const onRange = (id, key) => {
    q(id).addEventListener("input", (e) => {
      settings[key] = Number(e.target.value);
      applySettings();
      persistSettings();
    });
  };
  onRange("set-master", "master");
  onRange("set-music", "music");
  onRange("set-sfx", "sfx");
  onRange("set-brightness", "brightness");
  onRange("set-floor", "floor_swords");
  q("set-quality").addEventListener("change", (e) => {
    settings.quality = e.target.value;
    applySettings();
    persistSettings();
  });
  q("set-fps").addEventListener("change", (e) => {
    settings.show_fps = e.target.checked;
    applySettings();
    persistSettings();
  });
  q("set-controls-free").addEventListener("change", () => {
    settings.controls = "free";
    applySettings();
    persistSettings();
  });
  q("set-controls-hub").addEventListener("change", () => {
    settings.controls = "hub";
    applySettings();
    persistSettings();
  });
  q("set-lockon").addEventListener("change", (e) => {
    settings.lock_on = e.target.checked;
    applySettings();
    persistSettings();
  });
  q("set-language").addEventListener("change", (e) => {
    settings.language = e.target.value;
    applySettings();
    persistSettings();
  });
}

function toggleSettings(open) {
  const panel = els["settings-panel"];
  const show = open === undefined ? panel.style.display !== "flex" : open;
  panel.style.display = show ? "flex" : "none";
  if (show) syncSettingsPanel();
}

// ---------------------------------------------------------------------------
// FPS counter + Fever tick loop
// ---------------------------------------------------------------------------
let frames = 0;
let fpsWindowStart = performance.now();

function loop(now) {
  frames++;
  if (now - fpsWindowStart >= 500) {
    const fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    if (settings && settings.show_fps) {
      els["fps-counter"].textContent = fps + " FPS";
    }
    frames = 0;
    fpsWindowStart = now;
  }
  // Fever tick: accumulate real time, send to the backend every 200ms.
  if (state && state.fever && state.fever.active) {
    feverTickAcc += 1 / 60;
    if (feverTickAcc >= 0.2) {
      const dt = feverTickAcc;
      feverTickAcc = 0;
      Backend.invoke("tick", { dt }).then((payload) => {
        if (!payload) return;
        state = payload.state;
        if (payload.ended === "paidout") {
          toast(t("ui.fever_payout", [payload.grade_gain]));
          sound.playGreat();
        }
        render();
      }).catch((e) => console.warn("tick failed", e));
    }
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Free-look drag (controls = free) + in-scene taps (raycast in 3D)
// ---------------------------------------------------------------------------
let downPos = null;

// Drag range in pixels (0.004 rad/px in scene3d.js): ±785 px = a full
// turn (needed to face the service window / bell behind the work view),
// ±125 px pitch.
const DRAG_X_MAX = 785;
const DRAG_Y_MAX = 125;

function bindDrag() {
  const scene = els.scene;
  scene.addEventListener("pointerdown", (e) => {
    downPos = { x: e.clientX, y: e.clientY };
    if (!settings || settings.controls !== "free" || settings.lock_on) return;
    drag = { x: e.clientX, y: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener("pointermove", (e) => {
    if (!drag) return;
    viewOffset.x = Math.max(-DRAG_X_MAX, Math.min(DRAG_X_MAX, drag.ox + (e.clientX - drag.x)));
    viewOffset.y = Math.max(-DRAG_Y_MAX, Math.min(DRAG_Y_MAX, drag.oy + (e.clientY - drag.y)));
    if (window.ForgeScene) window.ForgeScene.setViewOffset(viewOffset.x, viewOffset.y);
  });
  scene.addEventListener("pointerup", (e) => {
    // Click (not a drag): raycast-pick the 3D room.
    if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 6) {
      if (window.ForgeScene) {
        const action = window.ForgeScene.pickAt(e.clientX, e.clientY);
        if (action === "strike") doStrike();
        else if (action === "tribute") doTribute();
        else if (action === "endday") doEndDay();
      }
    }
    downPos = null;
    drag = null;
  });
  scene.addEventListener("pointercancel", () => { downPos = null; drag = null; });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  collectEls();
  bindSettingsPanel();
  bindDrag();
  els["overlay-btn-new"].addEventListener("click", doNewRun);
  els["overlay-btn-endless"].addEventListener("click", doEndless);
  // R-22 — REMADE (approved by OWNER 2026-11-21): the PC keys /
  // interactions (Escape = settings, Space = strike, drag = free-look,
  // click/tap = strike) are a REMADE control scheme — the original is a
  // mobile touch game (no keyboard, no mouse); the PC bindings are ours.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleSettings();
    if (e.key === " " && els["settings-panel"].style.display !== "flex") {
      e.preventDefault();
      doStrike();
    }
  });
  document.addEventListener("pointerdown", () => sound.ensure(), { once: true });
  try {
    settings = await Backend.invoke("load_settings", {});
    if (!settings || typeof settings !== "object") settings = defaultSettings();
    settings = { ...defaultSettings(), ...settings };
    state = await Backend.invoke("new_run", {});
    // Sword names (the original's own Vietnamese names).
    try {
      SWORD_NAMES = await (await fetch("sword-names.json")).json();
    } catch (e) {
      console.warn("sword-names.json failed to load", e);
      SWORD_NAMES = {};
    }
    // 3D scene init (loads the real room + original textures). If WebGL
    // or a texture is unavailable, show a plain error — never a black window.
    if (!window.ForgeScene) throw new Error("3D module failed to load (scene3d.js / three)");
    await window.ForgeScene.init(els.gl);
    els.loading.style.display = "none";
    els.app.style.display = "flex";
    applySettings();
    render();
    requestAnimationFrame(loop);
  } catch (e) {
    showError(String(e));
  }
}

document.addEventListener("DOMContentLoaded", boot);
