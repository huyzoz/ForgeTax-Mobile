// Focused FFT check for the F-4 sound rebuild (fast: no gameplay flow).
// Loads the page, waits for the scene, renders each trigger offline via
// sound.renderOffline(name) and FFT-compares against the reference table
// (same FFT_REF + fftCheck as browser-test.js). Exit 0 = all 7 pass.
// Requires the dev-server running on port 1420.
const { spawn } = require("child_process");

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9223;
const BASE = "http://127.0.0.1:1420/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function httpJson(url) { return (await fetch(url)).json(); }

// Same reference table + tolerances as browser-test.js (remake/tools/fft-ref.py).
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
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,720",
    "--user-data-dir=/tmp/ft-chrome-fft",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });
  let ws = null;
  let msgId = 0;
  const pending = new Map();
  let exit = 0;
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try { targets = await httpJson(`http://127.0.0.1:${PORT}/json`); break; }
      catch { await sleep(250); }
    }
    if (!targets) throw new Error("DevTools endpoint never came up");
    const page = targets.find((t) => t.type === "page");
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
      }
    };
    const evalJs = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    let ok = false;
    for (let i = 0; i < 40; i++) {
      ok = await evalJs(`typeof sound !== 'undefined' && !!sound.renderOffline`);
      if (ok) break;
      await sleep(250);
    }
    if (!ok) throw new Error("sound engine not ready");
    let fails = 0;
    for (const name of ["strike", "great", "break", "tribute", "fever", "set", "crackle"]) {
      const got = await evalJs(`sound.renderOffline('${name}')`);
      const f = fftCheck(name, got);
      const status = f.length ? "FAIL" : "PASS";
      if (f.length) fails++;
      console.log(`${status} ${name}: peak=${got.peak} rms=${got.rms} centroid=${got.centroid} bands=[${got.bands.map((b) => b.toFixed(2)).join(",")}] partials=${JSON.stringify(got.partials.slice(0, 5))}${f.length ? " :: " + f.join("; ") : ""}`);
    }
    console.log(fails === 0 ? "FFT: 7/7 PASS" : `FFT: ${7 - fails}/7 PASS, ${fails} FAIL`);
    exit = fails === 0 ? 0 : 1;
  } catch (e) {
    console.error("ERROR:", e.message);
    exit = 2;
  } finally {
    if (ws) ws.close();
    chrome.kill();
  }
  process.exit(exit);
}
main();
