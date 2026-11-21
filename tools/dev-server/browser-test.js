// Headless-browser test for the ForgeTax Mobile P0 frontend.
// Uses Chrome DevTools Protocol over the built-in Node WebSocket client.
// Steps: load page, collect console errors, screenshot forge screen,
// strike 12x, screenshot, open settings (ESC), screenshot, strike until
// Fever is active, screenshot Fever state, enable FPS, read FPS counter.
// Writes screenshots to ~/workspace/forgetax-mobile/remake/.browser-test/
// and prints a JSON summary to stdout.
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9222;
const BASE = "http://127.0.0.1:1420/";
const OUT = path.join(process.env.HOME, "workspace/forgetax-mobile/remake/.browser-test");
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(url) {
  const res = await fetch(url);
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
    await sleep(500);
    // 3D scene must be up: WebGL canvas present + ForgeScene ready.
    const scene3d = await evalJs(`(() => { const c = document.querySelector('#gl canvas'); return { canvas: !!c, ready: !!(window.ForgeScene && window.ForgeScene.ready), webgl: c ? !!c.getContext('webgl2') : false }; })()`);
    if (!scene3d.canvas || !scene3d.ready) throw new Error("3D scene not ready: " + JSON.stringify(scene3d));
    await shot("01-forge.png");

    // Strike 12 times via the real button.
    let strikes = 0;
    for (let i = 0; i < 12; i++) {
      const ok = await evalJs(`(() => { const b = document.getElementById('btn-strike'); if (b.disabled) return false; b.click(); return true; })()`);
      if (ok) strikes++;
      await sleep(120);
    }
    await sleep(400);
    const afterStrikes = await evalJs(`(() => { const s = document.getElementById('sword-grade').textContent; const v = document.getElementById('sword-value').textContent; const c = document.getElementById('contract-line').textContent; return { grade: s, value: v, contract: c }; })()`);
    await shot("02-after-strikes.png");

    // Open settings with ESC.
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(400);
    const settingsVisible = await evalJs(`getComputedStyle(document.getElementById('settings-panel')).display`);
    await shot("03-settings.png");
    // Enable FPS from the panel, then close with ESC.
    await evalJs(`(() => { const c = document.getElementById('set-fps'); c.checked = true; c.dispatchEvent(new Event('change')); return true; })()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(600);

    // Strike until Fever is active (or the sword breaks / round ends).
    let feverSeen = false;
    for (let i = 0; i < 120 && !feverSeen; i++) {
      await evalJs(`(() => { const b = document.getElementById('btn-strike'); if (!b.disabled) b.click(); return true; })()`);
      await sleep(100);
      feverSeen = await evalJs(`document.getElementById('fever-label').textContent.includes('Nhập thần —') || document.getElementById('fever-fill').classList.contains('active')`);
      // A broken sword leaves the anvil immediately (core advance()), so
      // the next sword is already up — no manual recovery needed here.
    }
    await sleep(300);
    const feverLabel = await evalJs(`document.getElementById('fever-label').textContent`);
    if (feverSeen) await shot("04-fever.png");
    const fpsText = await evalJs(`document.getElementById('fps-counter').textContent`);
    const fpsVisible = await evalJs(`getComputedStyle(document.getElementById('fps-counter')).display`);

    // Tribute the current sword (tests the tribute path end-to-end).
    const tributeBefore = await evalJs(`document.getElementById('tribute-line').textContent`);
    await evalJs(`(() => { const b = document.getElementById('btn-tribute'); if (!b.disabled) b.click(); return true; })()`);
    await sleep(400);
    const tributeAfter = await evalJs(`document.getElementById('tribute-line').textContent`);

    const summary = {
      appVisible,
      scene3d,
      strikesClicked: strikes,
      afterStrikes,
      settingsVisible,
      feverSeen,
      feverLabel,
      fpsCounter: { visible: fpsVisible, text: fpsText },
      tribute: { before: tributeBefore, after: tributeAfter },
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
