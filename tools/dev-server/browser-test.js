// Headless-browser test for the ForgeTax Mobile P0 frontend (REAL room).
// Uses Chrome DevTools Protocol over the built-in Node WebSocket client.
// Steps: load page, collect console errors, screenshot the work view,
// strike 12x via ANVIL TAP (raycast), screenshot, open settings (ESC),
// screenshot, enable FPS, turn to the spawn view and tribute via BELL TAP,
// end the day via LEDGER TAP, strike until Fever is active, screenshot.
// State is read from the dev-server (POST /api/get_state) — there are no
// DOM text frames left to read (LAYOUT.md §9).
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
    // chances list, no fever bar, no relic chips, no grade badge.
    const hudGone = await evalJs(`['topbar','contract-line','quota-line','tribute-line','anger-pips','sword-grade','sword-value','sword-peak','chances','fever-box','fever-label','relic-chips','btn-strike','btn-tribute','btn-endday','btn-settings','outcome-pop'].every((id) => !document.getElementById(id))`);
    if (!hudGone) throw new Error("DOM HUD elements still present — §9 removal incomplete");
    await shot("01-forge.png");

    // Strike 12 times via ANVIL TAP (raycast pick in the 3D scene).
    // Tap pacing 700 ms: the real strike cooldown is 0.64 s
    // (behavior.json hammer_strike, nextStrikeTime = now + 0.64/speed),
    // so faster taps would mostly be ignored by doStrike.
    const anvilPt = await evalJs(`window.ForgeScene.debugTargetPoint('anvil')`);
    if (!anvilPt.visible) throw new Error("anvil tap target not visible in the work view: " + JSON.stringify(anvilPt));
    const stateBefore = await getState();
    let strikes = 0;
    for (let i = 0; i < 12; i++) {
      await tap(anvilPt.x, anvilPt.y);
      strikes++;
      await sleep(700);
    }
    await sleep(400);
    const afterStrikes = await getState();
    await shot("02-after-strikes.png");

    // Open settings with ESC.
    await key("Escape", "Escape", 27);
    await sleep(400);
    const settingsVisible = await evalJs(`getComputedStyle(document.getElementById('settings-panel')).display`);
    await shot("03-settings.png");
    // Enable FPS from the panel, then close with ESC.
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
    let feverSeen = false;
    for (let i = 0; i < 150 && !feverSeen; i++) {
      const st = await getState();
      if (st.state !== "playing") {
        await httpJson(BASE + "api/new_run", "POST");
        await sleep(200);
        continue;
      }
      await tap(anvilPt.x, anvilPt.y);
      await sleep(700); // real 0.64 s cooldown — faster taps are ignored
      feverSeen = (await getState()).fever.active;
    }
    await sleep(300);
    const feverState = await getState();
    if (feverSeen) {
      // Let one frame run so the Fever flame boost / camera shake is visible.
      frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
      await waitForFrame(frames);
      await shot("04-fever.png");
    }
    const fpsText = await evalJs(`document.getElementById('fps-counter').textContent`);
    const fpsVisible = await evalJs(`getComputedStyle(document.getElementById('fps-counter')).display`);

    const summary = {
      appVisible,
      scene3d,
      hudGone,
      anvilTap: anvilPt,
      strikesClicked: strikes,
      stateBefore: { round: stateBefore.round, grade: stateBefore.sword?.grade, value: stateBefore.sword?.value },
      afterStrikes: { round: afterStrikes.round, grade: afterStrikes.sword?.grade, value: afterStrikes.sword?.value, strikes: afterStrikes.strikes },
      settingsVisible,
      bellTap: bellPt,
      tribute: { before: { round_tributed: tributeBefore.round_tributed, sword: tributeBefore.sword?.id, round: tributeBefore.round }, after: { round_tributed: tributeAfter.round_tributed, sword: tributeAfter.sword?.id, round: tributeAfter.round }, worked: tributeWorked },
      ledgerTap: ledgerPt,
      endday: { beforeRound: enddayBefore.round, afterRound: enddayAfter.round, worked: enddayWorked },
      feverSeen,
      fever: feverState.fever,
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
