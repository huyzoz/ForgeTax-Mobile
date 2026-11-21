// ForgeTax Mobile remake — P0 frontend (2D DOM, no 3D, no canvas 3D).
//
// The game logic lives in the Rust core (forgetax-core); this file only
// renders state and forwards input. Backend bridge:
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

let state = null;
let settings = null;
let striking = false;
let feverTickAcc = 0;
let lastFeverActive = false;
let drag = null;
let viewOffset = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const els = {};

function collectEls() {
  ["loading", "error", "app", "contract-line", "quota-line", "quota-fill",
   "tribute-line", "anger-pips", "sword-grade", "sword-value", "sword-peak",
   "sword-el", "hammer-el", "scene-inner", "scene", "sparks-layer",
   "floor-layer", "chances", "fever-fill", "fever-label",
   "relic-chips", "btn-strike", "btn-tribute", "btn-endday", "btn-settings",
   "outcome-pop", "toast", "fps-counter", "brightness-overlay",
   "settings-panel", "overlay", "overlay-title", "overlay-sub",
   "overlay-btn-endless", "overlay-btn-new"].forEach((id) => { els[id] = $(id); });
}

function showError(msg) {
  els.loading.style.display = "none";
  els.app.style.display = "none";
  els.error.style.display = "flex";
  els.error.textContent = t("ui.error") + " (" + msg + ")";
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  if (!state) return;
  const s = state;
  // Contract line: "Hợp đồng  Ngày {round} / 24" (or endless day).
  els["contract-line"].textContent = s.endless
    ? t("contract.endless", [s.round])
    : t("contract.remaining", [s.round, 24]);
  // Quota: "CỐNG PHẨM YÊU CẦU  {quota} G" + progress bar.
  els["quota-line"].textContent = t("ui.quota_caption") + "  " + fmtGold(s.quota) + " G";
  const pct = Math.min(100, (s.round_tribute / s.quota) * 100);
  els["quota-fill"].style.width = pct + "%";
  // Tribute offered: "ĐÃ DÂNG: {count} kiếm / {value} G".
  els["tribute-line"].textContent = t("template.tribute_offer", {
    count: s.round_tributed,
    value: fmtGold(s.round_tribute),
  });
  // Anger pips (3).
  els["anger-pips"].innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement("span");
    pip.className = "anger-pip" + (i < s.anger ? " on" : "");
    pip.textContent = "◆";
    els["anger-pips"].appendChild(pip);
  }
  els["anger-pips"].title = t("ending.anger");
  // Sword.
  if (s.sword) {
    els["sword-grade"].textContent = "+" + s.sword.grade;
    els["sword-value"].textContent = t("inspect.value", [fmtGold(s.sword.value) + " G"]);
    els["sword-peak"].textContent = t("menu2.bestGrade") + ": " + fmtGold(s.sword.peak_value) + " G";
    els["sword-el"].classList.toggle("broken", s.sword.broken);
    els["sword-el"].classList.toggle("great", s.sword.great_forged);
    els["sword-el"].style.display = "block";
  } else {
    els["sword-el"].style.display = "none";
  }
  // Chances bars (per-mille).
  renderChances(s.chances);
  // Fever meter.
  const f = s.fever;
  els["fever-fill"].style.width = (f.active ? 100 : (f.charge / f.needed) * 100) + "%";
  els["fever-fill"].classList.toggle("active", f.active);
  els["fever-label"].textContent = f.active
    ? t("ui.fever") + " — " + f.time_left.toFixed(1) + "s"
    : f.charge >= f.needed
      ? t("fever.ready")
      : t("ui.fever") + " " + f.charge + "/" + f.needed;
  // Relic chips.
  els["relic-chips"].innerHTML = "";
  s.relics.forEach((id) => {
    const chip = document.createElement("span");
    chip.className = "relic-chip";
    chip.textContent = RELIC_NAMES[id] || id;
    chip.title = id;
    els["relic-chips"].appendChild(chip);
  });
  // Buttons.
  const playing = s.state === "playing";
  els["btn-strike"].disabled = !playing || !s.sword || s.sword.broken;
  els["btn-tribute"].disabled = !playing || !s.sword || s.sword.broken;
  els["btn-endday"].disabled = !playing;
  // End overlays.
  if (s.state === "victory") {
    showOverlay(t("ui.victory"), t("contract.lastday"), true);
  } else if (s.state === "defeated") {
    showOverlay(t("ui.defeated"), t("ending.anger"), false);
  } else {
    hideOverlay();
  }
  // Fever start sound (edge-triggered).
  if (f.active && !lastFeverActive) sound.playFever();
  lastFeverActive = f.active;
}

function renderChances(chances) {
  const order = ["break", "damage", "hold", "success", "great"];
  els.chances.innerHTML = "";
  order.forEach((key, i) => {
    const pm = chances[i];
    const row = document.createElement("div");
    row.className = "chance-row " + key;
    const label = document.createElement("span");
    label.className = "chance-label";
    label.textContent = t(OUTCOME_KEYS[key]);
    const bar = document.createElement("div");
    bar.className = "chance-bar";
    const fill = document.createElement("div");
    fill.className = "chance-fill";
    fill.style.width = (pm / 10) + "%";
    bar.appendChild(fill);
    const val = document.createElement("span");
    val.className = "chance-val";
    val.textContent = (pm / 10).toFixed(1) + "%";
    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(val);
    els.chances.appendChild(row);
  });
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

function popOutcome(text, cls) {
  els["outcome-pop"].textContent = text;
  els["outcome-pop"].className = "pop show " + cls;
  setTimeout(() => els["outcome-pop"].classList.remove("show"), 900);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function sparkBurst(n) {
  const layer = els["sparks-layer"];
  const count = { low: 6, medium: 18, high: 36 }[qualityLevel()] || 18;
  for (let i = 0; i < Math.min(n, count); i++) {
    const s = document.createElement("div");
    s.className = "spark";
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 90;
    s.style.left = "50%";
    s.style.top = "38%";
    s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    s.style.setProperty("--dy", Math.sin(angle) * dist - 30 + "px");
    layer.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }
}

function qualityLevel() {
  if (!settings) return "medium";
  if (settings.quality === "auto") return "medium";
  return settings.quality;
}

async function doStrike() {
  if (striking || !state || state.state !== "playing") return;
  striking = true;
  sound.ensure();
  els["hammer-el"].classList.add("swing");
  setTimeout(() => els["hammer-el"].classList.remove("swing"), 220);
  try {
    const payload = await Backend.invoke("strike", {});
    if (!payload) return;
    state = payload.state;
    sparkBurst(24);
    const o = payload.outcome;
    popOutcome(t(OUTCOME_KEYS[o]), o);
    if (o === "great") sound.playGreat();
    else if (o === "break") {
      sound.playBreak();
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
  return {
    master: 80, music: 60, sfx: 90, haptics: false, brightness: 100,
    quality: "auto", show_fps: false, floor_swords: 3, controls: "hub",
    lock_on: false, language: "vi",
  };
}

function applySettings() {
  if (!settings) return;
  LANG = settings.language === "en" ? "en" : "vi";
  document.documentElement.lang = LANG;
  // Static text.
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
  // Floor swords.
  renderFloorSwords(settings.floor_swords);
  // View mode.
  if (settings.controls === "hub" || settings.lock_on) {
    viewOffset = { x: 0, y: 0 };
    els["scene-inner"].style.transform = "translate(0px, 0px)";
  }
  // Volumes.
  sound.setVolumes(settings.master, settings.music, settings.sfx);
  // Settings panel controls.
  syncSettingsPanel();
  render();
}

function renderFloorSwords(n) {
  els["floor-layer"].innerHTML = "";
  for (let i = 0; i < Math.max(0, Math.min(8, n)); i++) {
    const s = document.createElement("div");
    s.className = "floor-sword";
    s.style.left = (6 + i * 11) + "%";
    s.style.transform = "rotate(" + (-18 + i * 5) + "deg)";
    els["floor-layer"].appendChild(s);
  }
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
// View drag (controls = free)
// ---------------------------------------------------------------------------
function bindDrag() {
  const scene = els.scene;
  scene.addEventListener("pointerdown", (e) => {
    if (!settings || settings.controls !== "free" || settings.lock_on) return;
    drag = { x: e.clientX, y: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener("pointermove", (e) => {
    if (!drag) return;
    viewOffset.x = Math.max(-80, Math.min(80, drag.ox + (e.clientX - drag.x)));
    viewOffset.y = Math.max(-40, Math.min(40, drag.oy + (e.clientY - drag.y)));
    els["scene-inner"].style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px)`;
  });
  scene.addEventListener("pointerup", () => { drag = null; });
  scene.addEventListener("pointercancel", () => { drag = null; });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  collectEls();
  bindSettingsPanel();
  bindDrag();
  els["btn-strike"].addEventListener("click", doStrike);
  els["btn-tribute"].addEventListener("click", doTribute);
  els["btn-endday"].addEventListener("click", doEndDay);
  els["btn-settings"].addEventListener("click", () => toggleSettings());
  els["overlay-btn-new"].addEventListener("click", doNewRun);
  els["overlay-btn-endless"].addEventListener("click", doEndless);
  els.scene.addEventListener("click", (e) => {
    // Clicking the anvil / sword strikes (but not when dragging).
    if (drag) return;
    if (e.target.closest(".anvil") || e.target.closest(".sword")) doStrike();
  });
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
