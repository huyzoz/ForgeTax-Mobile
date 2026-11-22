// Headless-browser test for the ForgeTax Mobile P0 frontend (REAL room).
// Uses Chrome DevTools Protocol over the built-in Node WebSocket client.
// Flow (fix round 2026-11-21): title screen -> click "Bắt đầu game" ->
// WASD walk proof -> E pickup proof -> sound FFT (offline synth vs the
// reference WAV table) -> strike 12x via ANVIL TAP (raycast) -> brightness
// 200% + 70% (exposure, no black overlay) -> pause Menu buttons ->
// quality Low (real cost cut) -> tribute via BELL TAP -> end day via
// LEDGER TAP -> strike until Fever (+ Great banner) -> ledger screenshot.
// State is read from the dev-server (POST /api/get_state).
// Writes screenshots to ~/workspace/forgetax-mobile/remake/.browser-test/
// and prints a JSON summary to stdout.
// Requires the dev-server running on port 1420:
//   cd ~/workspace/forgetax-mobile/remake && cargo run -p forgetax-dev-server
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9222;
const BASE = "http://127.0.0.1:1420/";
const OUT = path.join(process.env.HOME, "workspace/forgetax-mobile/remake/.browser-test");
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(url, method = "GET", body = null) {
  const res = await fetch(url, method === "GET" ? undefined : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  });
  return res.json();
}

// F-4 reference table (remake/tools/fft-ref.py, measured 2026-11-21 from
// the 101 reference WAVs). The offline synth must match the CHARACTER
// of each trigger (centroid / band shares / top partials / peak < 1.0).
// Tolerances are deliberately loose (the synth is an approximation).
const FFT_REF = {
  strike:  { centroid: [4000, 9000], bands: { 0: [0.25, 0.6], 3: [0.15, 0.5], 4: [0.05, 0.4] }, partials: [[6000, 7000]] },
  great:   { centroid: [1000, 4000], bands: { 2: [0.8, 1.0] }, partials: [[1500, 1750]] },
  break:   { centroid: [1500, 5000], bands: { 0: [0.15, 0.6], 1: [0.1, 0.6] }, partials: [[150, 250]] },
  tribute: { centroid: [3000, 6000], bands: { 2: [0.7, 1.0] }, partials: [[3400, 3800]] },
  fever:   { centroid: [0, 600], bands: { 0: [0.6, 1.0] }, partials: [[30, 45]] },
  set:     { centroid: [1000, 3000], bands: { 2: [0.6, 1.0] }, partials: [[1650, 1850]] },
  crackle: { rmsMax: 0.02 },
};

function fftCheck(name, got) {
  const ref = FFT_REF[name];
  const fails = [];
  if (got.peak >= 0.95) fails.push(`peak ${got.peak} >= 0.95 (clipping)`);
  if (ref.centroid && (got.centroid < ref.centroid[0] || got.centroid > ref.centroid[1]))
    fails.push(`centroid ${got.centroid} not in [${ref.centroid}]`);
  if (ref.bands) for (const [bi, [lo, hi]] of Object.entries(ref.bands)) {
    const v = got.bands[+bi];
    if (v < lo || v > hi) fails.push(`band[${bi}] ${v} not in [${lo},${hi}]`);
  }
  if (ref.partials) for (const [lo, hi] of ref.partials) {
    if (!got.partials.some(([f]) => f >= lo && f <= hi)) fails.push(`no partial in [${lo},${hi}] (got ${JSON.stringify(got.partials)})`);
  }
  if (ref.rmsMax != null && got.rms > ref.rmsMax) fails.push(`rms ${got.rms} > ${ref.rmsMax} (crackle must be very quiet)`);
  return fails;
}

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox",
    // WebGL in this headless env needs software ANGLE (SwiftShader);
    // --disable-gpu kills WebGL entirely (probe 2026-11-21: NO WEBGL).
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,720",
    "--user-data-dir=/tmp/ft-chrome-test",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });

  const errors = [];
  const failedReqs = [];
  let ws = null;
  let msgId = 0;
  const pending = new Map();

  try {
    // Wait for the DevTools endpoint.
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try { targets = await httpJson(`http://127.0.0.1:${PORT}/json`); break; }
      catch { await sleep(250); }
    }
    if (!targets) throw new Error("DevTools endpoint never came up");
    const page = targets.find((t) => t.type === "page");
    if (!page) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        errors.push(msg.params.args.map((a) => a.value || a.description || "").join(" "));
      } else if (msg.method === "Runtime.exceptionThrown") {
        errors.push("EXCEPTION: " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      } else if (msg.method === "Network.loadingFailed") {
        failedReqs.push(msg.params.errorText);
      } else if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
        failedReqs.push(msg.params.response.status + " " + msg.params.response.url);
      }
    };

    const evalJs = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    const shot = async (name) => {
      const r = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, "base64"));
      return path.join(OUT, name);
    };
    const getState = async () => httpJson(BASE + "api/get_state", "POST");
    const tap = async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    };
    const key = async (k, code, vk) => {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
    };
    const keyDown = async (k, code, vk) => {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
    };
    const keyUp = async (k, code, vk) => {
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");
    // Force an exact 1280x720 viewport (the app's fixed window size);
    // --window-size alone yields a shorter viewport in headless Chrome.
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    // Wait for the app to render.
    let appVisible = false;
    for (let i = 0; i < 40; i++) {
      appVisible = await evalJs(`document.getElementById('app') && getComputedStyle(document.getElementById('app')).display !== 'none'`);
      if (appVisible) break;
      await sleep(250);
    }
    if (!appVisible) throw new Error("app never became visible; loading=" + await evalJs(`document.getElementById('loading').textContent`) + " error=" + await evalJs(`document.getElementById('error').textContent`));
    // Wait for at least one scene frame to have rendered. Headless
    // SwiftShader renders the real room (88k verts, 11 spot lights) at
    // ~0.3 fps, so a fixed sleep is not enough — poll the frame counter
    // (ForgeScene.getDebug().frames, incremented in animate()).
    const waitForFrame = async (prevFrames, timeoutMs = 30000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const d = await evalJs(`window.ForgeScene.getDebug()`);
        if (d.frames > prevFrames) return d.frames;
        await sleep(500);
      }
      throw new Error(`no new frame within ${timeoutMs}ms (frames still ${prevFrames})`);
    };
    await waitForFrame(0);
    // 3D scene must be up: WebGL canvas present + ForgeScene ready.
    const scene3d = await evalJs(`(() => { const c = document.querySelector('#gl canvas'); return { canvas: !!c, ready: !!(window.ForgeScene && window.ForgeScene.ready), webgl: c ? !!c.getContext('webgl2') : false }; })()`);
    if (!scene3d.canvas || !scene3d.ready) throw new Error("3D scene not ready: " + JSON.stringify(scene3d));
    // No DOM HUD must remain (LAYOUT.md §9): no topbar, no buttons, no
    // chances list, no fever bar, no relic chips, no grade badge. The
    // title screen, pause Menu buttons, fever wash and great banner are
    // the only allowed DOM (F-5/F-8/F-9c/F-10). The black brightness
    // overlay must be GONE (F-3a: brightness is exposure now).
    const hudGone = await evalJs(`['topbar','contract-line','quota-line','tribute-line','anger-pips','sword-grade','sword-value','sword-peak','chances','fever-box','fever-label','relic-chips','btn-strike','btn-tribute','btn-endday','btn-settings','outcome-pop','brightness-overlay'].every((id) => !document.getElementById(id))`);
    if (!hudGone) throw new Error("DOM HUD elements still present — §9 removal incomplete");
    const statsMedium = await evalJs(`window.ForgeScene.getStats()`);

    // --- F-10: the title screen must show at boot (no run yet). ---
    const title = await evalJs(`(() => { const el = document.getElementById('title-screen'); return { visible: getComputedStyle(el).display !== 'none', text: el.textContent }; })()`);
    if (!title.visible) throw new Error("title screen not visible at boot");
    if (!/FORGE TAXX/.test(title.text) || !/1%/.test(title.text) || !/49%/.test(title.text) || !/50%/.test(title.text))
      throw new Error("title screen text wrong: " + title.text.slice(0, 200));
    await shot("00-title.png");
    // Click "Bắt đầu game" (the title overlay is clickable anywhere).
    await tap(640, 360);
    let state0 = null;
    for (let i = 0; i < 20; i++) {
      state0 = await getState();
      if (state0 && state0.state === "playing") break;
      await sleep(250);
    }
    if (!state0 || state0.state !== "playing") throw new Error("no run started after clicking the title");
    const titleGone = await evalJs(`getComputedStyle(document.getElementById('title-screen')).display === 'none'`);
    if (!titleGone) throw new Error("title screen did not hide after starting");
    // The Ledger grid's live values come from the core (F-6).
    const deckOk = JSON.stringify(state0.deck) === "[9,2,5,18,4]" && state0.seal === 0.85;
    if (!deckOk) throw new Error("deck/seal wrong in the snapshot: " + JSON.stringify({ deck: state0.deck, seal: state0.seal }));
    await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
    // O5 (AEGIS 2026-11-22): one new frame is not enough — the compositor
    // can still capture a stale black canvas (AEGIS's 01/02/03 were
    // black). Wait for a SECOND new frame before the first shot.
    await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
    await shot("01-workview.png");

    // --- F-4: sound — render each trigger offline and FFT-compare. ---
    const fft = {};
    for (const name of ["strike", "great", "break", "tribute", "fever", "set", "crackle"]) {
      const got = await evalJs(`sound.renderOffline('${name}')`);
      fft[name] = { got, fails: fftCheck(name, got) };
    }
    const fftFails = Object.entries(fft).filter(([, v]) => v.fails.length > 0).map(([k, v]) => k + ": " + v.fails.join("; "));

    // --- F-1: WASD walking — hold W (toward the anvil) and prove the
    // camera position changes. Headless SwiftShader runs ~0.3 fps and
    // dt is clamped to 0.1 s/frame, so the game advances ~0.03 s/s of
    // real time: a 30 s hold walks ~1.9 m at 2.09 m/s.
    const camBefore = (await evalJs(`window.ForgeScene.getDebug()`)).camPos;
    await keyDown("w", "KeyW", 87);
    await sleep(30000);
    await keyUp("w", "KeyW", 87);
    await sleep(1000);
    const camAfter = (await evalJs(`window.ForgeScene.getDebug()`)).camPos;
    const walkDist = Math.hypot(camAfter[0] - camBefore[0], camAfter[2] - camBefore[2]);
    const walked = walkDist > 0.5;
    await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
    await shot("02-walked.png");

    // --- F-1/E: pick up the anvil sword with E, then put it back. ---
    // (The walk above brings the camera within the 2.2 m reach.)
    let heldAfterE = false, heldAfterE2 = null, heldLightOn = null, heldLightOff = null;
    await key("e", "KeyE", 69);
    await sleep(600);
    heldAfterE = (await evalJs(`window.ForgeScene.getDebug()`)).held;
    // M3 (AEGIS round 5): the view-model fill light must be ON while a
    // sword is held and OFF after putting it back.
    heldLightOn = (await evalJs(`window.ForgeScene.getDebug()`)).heldLight;
    if (heldAfterE) {
      await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
      await shot("03-held.png");
      await key("e", "KeyE", 69);
      await sleep(600);
      heldAfterE2 = (await evalJs(`window.ForgeScene.getDebug()`)).held;
      heldLightOff = (await evalJs(`window.ForgeScene.getDebug()`)).heldLight;
    }

    // --- Strike 12 times via ANVIL TAP (raycast pick in the 3D scene).
    // The walk above leaves the camera close to the anvil (the anvil
    // target projects below the screen from there), so return to the
    // work view first — the strike itself would glide back anyway
    // (requestWorkView), but the TAP raycast needs the work view.
    // Tap pacing 700 ms: the real strike cooldown is 0.64 s
    // (behavior.json hammer_strike, nextStrikeTime = now + 0.64/speed),
    // so faster taps would mostly be ignored by doStrike.
    let f0 = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setWorkView()`);
    await waitForFrame(f0);
    const anvilPt = await evalJs(`window.ForgeScene.debugTargetPoint('anvil')`);
    if (!anvilPt.visible) throw new Error("anvil tap target not visible: " + JSON.stringify(anvilPt));
    const stateBefore = await getState();
    let strikes = 0;
    for (let i = 0; i < 12; i++) {
      await tap(anvilPt.x, anvilPt.y);
      strikes++;
      await sleep(700);
    }
    await sleep(400);
    const afterStrikes = await getState();
    await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
    await shot("04-after-strikes.png");

    // --- F-3a: brightness is exposure, not a black overlay. 200% ->
    // exposure 1.15*(200/70)=3.29; 70% -> 1.15. Screenshots at both.
    const exp200 = await evalJs(`window.ForgeScene.setBrightness(200); window.ForgeScene.getDebug().exposure`);
    await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
    await shot("05-bright200.png");
    const exp70 = await evalJs(`window.ForgeScene.setBrightness(70); window.ForgeScene.getDebug().exposure`);
    await waitForFrame((await evalJs(`window.ForgeScene.getDebug()`)).frames);
    await shot("06-bright70.png");
    // F-7 — the furnace, face-on (yaw -133°, pitch -12° from the work
    // eye): the grate must be dark metal + the coals glowing orange
    // chunks, with NO blue bars (the video-1 blue was the sword
    // emissive, removed in F-3b — the ghost hypothesis is excluded,
    // see the handoff).
    f0 = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setView(-133, -12)`);
    await waitForFrame(f0);
    await shot("07-furnace.png");
    f0 = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setWorkView()`);
    await waitForFrame(f0);

    // --- F-5: the pause Menu (ESC) — action buttons + settings. ---
    await key("Escape", "Escape", 27);
    await sleep(400);
    const menu = await evalJs(`(() => { const p = document.getElementById('settings-panel'); const h = p.querySelector('h2').textContent; return { visible: getComputedStyle(p).display !== 'none', title: h, resume: !!document.getElementById('menu-resume'), codex: !!document.getElementById('menu-codex'), codexDisabled: document.getElementById('menu-codex').disabled, restart: !!document.getElementById('menu-restart'), home: !!document.getElementById('menu-home') }; })()`);
    await shot("08-menu.png");
    // Quality Low must REALLY cut cost (F-2): pixelRatio 0.75 + 5/11
    // spot lights on (was 11). Then back to medium.
    await evalJs(`(() => { const c = document.getElementById('set-quality'); c.value = 'low'; c.dispatchEvent(new Event('change')); return true; })()`);
    await sleep(300);
    const statsLow = await evalJs(`window.ForgeScene.getStats()`);
    await evalJs(`(() => { const c = document.getElementById('set-quality'); c.value = 'medium'; c.dispatchEvent(new Event('change')); return true; })()`);
    await sleep(300);
    const statsMedium2 = await evalJs(`window.ForgeScene.getStats()`);
    // "Về màn hình chính" -> title again; click it -> the run resumes.
    await evalJs(`document.getElementById('menu-home').click()`);
    await sleep(400);
    const titleAgain = await evalJs(`getComputedStyle(document.getElementById('title-screen')).display !== 'none'`);
    await tap(640, 360);
    await sleep(400);
    const resumed = await getState();
    const titleGone2 = await evalJs(`getComputedStyle(document.getElementById('title-screen')).display === 'none'`);
    // "Tiếp tục" closes the panel (re-open it first via ESC).
    await key("Escape", "Escape", 27);
    await sleep(300);
    await evalJs(`document.getElementById('menu-resume').click()`);
    await sleep(300);
    const menuClosed = await evalJs(`getComputedStyle(document.getElementById('settings-panel')).display === 'none'`);

    // Enable FPS from the panel, then close with ESC.
    await key("Escape", "Escape", 27);
    await sleep(300);
    await evalJs(`(() => { const c = document.getElementById('set-fps'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()`);
    await key("Escape", "Escape", 27);
    await sleep(600);

    // Tribute via BELL TAP: turn to the spawn view (facing the service
    // window, yaw −25°, pitch −18° — the real spawn forward, LAYOUT.md §2).
    // Wait for a frame so the camera actually moves before projecting.
    let frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setView(-25, -18)`);
    await waitForFrame(frames);
    const bellPt = await evalJs(`window.ForgeScene.debugTargetPoint('bell')`);
    if (!bellPt.visible) throw new Error("bell tap target not visible in the spawn view: " + JSON.stringify(bellPt));
    const tributeBefore = await getState();
    await tap(bellPt.x, bellPt.y);
    await sleep(400);
    const tributeAfter = await getState();
    const tributeWorked = tributeAfter.round_tributed > tributeBefore.round_tributed
      || tributeAfter.sword?.id !== tributeBefore.sword?.id
      || tributeAfter.round !== tributeBefore.round;

    // End the day via LEDGER TAP: back to the work view.
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setViewOffset(0, 0)`);
    await waitForFrame(frames);
    const ledgerPt = await evalJs(`window.ForgeScene.debugTargetPoint('ledger')`);
    if (!ledgerPt.visible) throw new Error("ledger tap target not visible in the work view: " + JSON.stringify(ledgerPt));
    const enddayBefore = await getState();
    await tap(ledgerPt.x, ledgerPt.y);
    await sleep(400);
    const enddayAfter = await getState();
    const enddayWorked = enddayAfter.round !== enddayBefore.round || enddayAfter.state !== enddayBefore.state;

    // Strike until Fever is active (or the sword breaks / round ends).
    // If a round ends mid-loop, start a fresh run and keep striking.
    // Watch for the Great banner (F-9c) after each strike.
    let feverSeen = false, greatSeen = false, greatBannerText = null;
    for (let i = 0; i < 150 && !feverSeen; i++) {
      const st = await getState();
      if (st.state !== "playing") {
        await httpJson(BASE + "api/new_run", "POST");
        await sleep(200);
        continue;
      }
      await tap(anvilPt.x, anvilPt.y);
      await sleep(700); // real 0.64 s cooldown — faster taps are ignored
      if (!greatSeen && await evalJs(`document.getElementById('great-banner').classList.contains('show')`)) {
        greatSeen = true;
        // M1 (AEGIS 2026-11-22): log the REAL banner text from a real
        // Great — the old proof (09b) was a forced string, which hid the
        // "×3.5x" bug. The ratio must read like the original: "3.5x".
        greatBannerText = await evalJs(`document.getElementById('great-banner').textContent`);
        await shot("09-great.png");
      }
      feverSeen = (await getState()).fever.active;
    }
    await sleep(300);
    const feverState = await getState();
    let feverOverlayOpacity = null, feverOverlayOpacity2 = null;
    if (feverSeen) {
      // Let one frame run so the Fever flame boost / camera shake is visible.
      frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
      await waitForFrame(frames);
      feverOverlayOpacity = await evalJs(`getComputedStyle(document.getElementById('fever-overlay')).opacity`);
      await shot("10-fever.png");
      // M2 (AEGIS 2026-11-22): a SECOND shot two frames later — the old
      // wash followed the hash-gated envelope and flickered, so one shot
      // could catch it OFF. A steady wash (fever.active) must show in
      // BOTH shots.
      frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
      await waitForFrame(frames);
      feverOverlayOpacity2 = await evalJs(`getComputedStyle(document.getElementById('fever-overlay')).opacity`);
      await shot("10b-fever.png");
    }
    // F-6: the Ledger close-up (the grid + cream paper).
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setView(142, 0)`);
    await waitForFrame(frames);
    await shot("11-ledger.png");
    // O6 (AEGIS 2026-11-22, round 5): the first close-up (setCamPos
    // (-1.6, 1.8, 1.9) + setView(142, 0)) was OBLIQUE — the column
    // headers looked overlapped ("GIỮTHÀNHCÔ") and the instrument board
    // covered ~40% of the paper, so it could not prove whether the
    // overlap was perspective or a real canvas bug. The slate ("Chalk
    // slate face", GO 1720) sits at [-1.9828, 1.79, 2.6732] with a Y
    // quat of -3.8°, so its face normal is (0.066, 0, -0.998) — it faces
    // into the room toward -Z. A FRONTAL shot is 1.25 m along that
    // normal: [-1.90, 1.79, 1.43], yaw 176° (the board is then ~67°
    // off-axis, out of frame). If the headers still overlap here, the
    // canvas layout itself is wrong.
    // O6b (run 7, 2026-11-22): at 1.25 m the instrument board STILL
    // covered the left ~40% (the ~90° horizontal FOV at 1.25 m spans
    // ~2.5 m, wider than the ledger's 1.09 m) and cut the seal line to
    // "Y x0.85". Move to 0.7 m along the normal ([-1.95, 1.79, 1.97]):
    // the frame then spans ~1.4 m, the ledger fills ~78% of it, and the
    // board (left of the ledger) is out of frame.
    // O6c (run 8, 2026-11-22): 0.7 m was TOO CLOSE — it cut the top
    // ("CỐNG PHẨM YÊU CẦU" cropped) and the bottom (totals row cropped)
    // because the 1.39 m tall ledger needs ≥1.0 m to fit vertically,
    // and the board STILL covered the left ~25%. Use 1.1 m
    // ([-1.90, 1.79, 1.57]): the full ledger (1.39 m) fits vertically
    // (coverage ~1.52 m) and the board is at the frame's left edge.
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await evalJs(`window.ForgeScene.setCamPos(-1.90, 1.79, 1.57)`);
    await evalJs(`window.ForgeScene.setView(176, 0)`);
    await waitForFrame(frames);
    await shot("12-ledger-closeup.png");
    const fpsText = await evalJs(`document.getElementById('fps-counter').textContent`);
    const fpsVisible = await evalJs(`getComputedStyle(document.getElementById('fps-counter')).display`);

    const summary = {
      appVisible,
      scene3d,
      hudGone,
      stats: { medium: statsMedium, low: statsLow, mediumAgain: statsMedium2 },
      title: { visibleAtBoot: title.visible, hiddenAfterStart: titleGone, deckOk },
      fft: Object.fromEntries(Object.entries(fft).map(([k, v]) => [k, { peak: v.got.peak, rms: v.got.rms, centroid: v.got.centroid, bands: v.got.bands, partials: v.got.partials, fails: v.fails }])),
      fftFails,
      walk: { before: camBefore, after: camAfter, dist: +walkDist.toFixed(2), walked },
      pickup: { heldAfterE, heldAfterE2, heldLightOn, heldLightOff },
      anvilTap: anvilPt,
      strikesClicked: strikes,
      stateBefore: { round: stateBefore.round, grade: stateBefore.sword?.grade, value: stateBefore.sword?.value },
      afterStrikes: { round: afterStrikes.round, grade: afterStrikes.sword?.grade, value: afterStrikes.sword?.value, strikes: afterStrikes.strikes },
      brightness: { exp200, exp70 },
      menu: { ...menu, titleAgain, resumedRound: resumed.round, titleGone2, menuClosed },
      bellTap: bellPt,
      tribute: { before: { round_tributed: tributeBefore.round_tributed, sword: tributeBefore.sword?.id, round: tributeBefore.round }, after: { round_tributed: tributeAfter.round_tributed, sword: tributeAfter.sword?.id, round: tributeAfter.round }, worked: tributeWorked },
      ledgerTap: ledgerPt,
      endday: { beforeRound: enddayBefore.round, afterRound: enddayAfter.round, worked: enddayWorked },
      feverSeen,
      fever: feverState.fever,
      feverOverlayOpacity,
      feverOverlayOpacity2,
      greatSeen,
      greatBannerText,
      fpsCounter: { visible: fpsVisible, text: fpsText },
      consoleErrors: errors,
      failedRequests: failedReqs,
      screenshots: fs.readdirSync(OUT).filter((f) => f.endsWith(".png")),
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (ws) ws.close();
    chrome.kill("SIGKILL");
  }
}

main().catch((e) => { console.error("TEST FAILED:", e.message); process.exit(1); });
