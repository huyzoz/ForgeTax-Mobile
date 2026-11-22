// Focused diag for the ledger close-up (O6, AEGIS round 5).
// Loads the page, starts a run, teleports the camera to the frontal
// ledger close-up position and screenshots it — so the header font /
// grid readability can be checked without running the full 12-min
// browser test.
// Usage: node tools/dev-server/ledger-diag.js
// Writes: .browser-test-diag/ledger-closeup.png
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9226;
const BASE = "http://127.0.0.1:1420/";
const OUT = path.join(process.env.HOME, "workspace/forgetax-mobile/remake/.browser-test-diag");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function httpJson(url) { return (await fetch(url)).json(); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync("/tmp/ft-chrome-ledger", { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,720",
    "--user-data-dir=/tmp/ft-chrome-ledger",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });
  let targets = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { targets = await httpJson(`http://127.0.0.1:${PORT}/json`); break; } catch {}
  }
  if (!targets) throw new Error("chrome devtools not up");
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails?.exception?.description || "js error");
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args?.map((a) => a.value || a.description).join(" "));
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const i = ++msgId; pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, "base64"));
    console.log("wrote", name);
  };
  const waitForFrame = async (prevFrames, timeoutMs = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const cur = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
      if (cur > prevFrames) return;
      await sleep(500);
    }
    throw new Error("no new frame");
  };
  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    await sleep(4000);
    let frames = 0;
    for (let i = 0; i < 60; i++) {
      try { frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames; if (frames > 0) break; } catch {}
      await sleep(500);
    }
    if (!frames) throw new Error("scene not ready");
    // Start the run (click the title).
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
    await sleep(1000);
    // Frontal ledger close-up (1.1 m along the slate normal, yaw 176).
    // Headless SwiftShader is ~0.2 fps, so wait for 3 new frames.
    await evalJs(`window.ForgeScene.setCamPos(-1.90, 1.79, 1.57)`);
    await evalJs(`window.ForgeScene.setView(176, 0)`);
    for (let i = 0; i < 3; i++) {
      frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
      await waitForFrame(frames);
    }
    await sleep(2000);
    await shot("ledger-closeup.png");
    console.log("console errors:", errors);
  } finally {
    ws.close();
    chrome.kill("SIGKILL");
  }
}
main().catch((e) => { console.error("DIAG FAILED:", e.message); process.exit(1); });
