// Focused proof shot for the F-9c Great banner (the full test's 09-great
// can miss it: the banner shows for 1.6 s of REAL time while the
// headless poll loop is slow). Loads the page, starts a run, forces the
// banner on with real Great text, screenshots it.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9225;
const BASE = "http://127.0.0.1:1420/";
const OUT = path.join(process.env.HOME, "workspace/forgetax-mobile/remake/.browser-test");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function httpJson(url) { return (await fetch(url)).json(); }
async function main() {
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--remote-debugging-port=${PORT}`, "--window-size=1280,720", "--user-data-dir=/tmp/ft-chrome-banner", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
  let ws = null, msgId = 0;
  const pending = new Map();
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) { try { targets = await httpJson(`http://127.0.0.1:${PORT}/json`); break; } catch { await sleep(250); } }
    if (!targets) throw new Error("DevTools endpoint never came up");
    const page = targets.find((t) => t.type === "page");
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result); } };
    const evalJs = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails)); return r.result.value; };
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    let ok = false;
    for (let i = 0; i < 40; i++) { ok = await evalJs(`!!(window.ForgeScene && window.ForgeScene.ready)`); if (ok) break; await sleep(250); }
    if (!ok) throw new Error("scene not ready");
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
    await sleep(1000);
    // Force the banner on with the real Great strings (same as
    // showGreatBanner does) and screenshot before the 1.6 s timeout.
    const state = await evalJs(`(() => { const b = document.getElementById('great-banner'); b.querySelector('.great-title').textContent = 'ĐẠI THÀNH CÔNG'; b.querySelector('.great-ratio').textContent = '3.5x'; b.classList.add('show'); const cs = getComputedStyle(b); return { opacity: cs.opacity, display: cs.display, top: cs.top, zIndex: cs.zIndex, text: b.textContent }; })()`);
    console.log("banner state:", JSON.stringify(state));
    await sleep(400);
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, "09b-great-banner.png"), Buffer.from(r.data, "base64"));
    console.log("wrote 09b-great-banner.png");
  } catch (e) { console.error("ERROR:", e.message); process.exitCode = 2; }
  finally { if (ws) ws.close(); chrome.kill(); }
}
main();
