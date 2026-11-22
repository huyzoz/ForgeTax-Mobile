// Furnace white-blowout diagnostic (fix round 2026-11-22).
// Loads the page, faces the furnace, and screenshots 5 variants that
// isolate the contributors: (a) baseline, (b) fill lights off
// (hemi/amb 0), (c) flame Points hidden, (d) fill off + flames hidden
// (spots + fireGlow only), (e) d + fireGlow off (real spots only).
// Requires the dev-server running on port 1420.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9224;
const BASE = "http://127.0.0.1:1420/";
const OUT = path.join(process.env.HOME, "workspace/forgetax-mobile/remake/.browser-test-diag");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function httpJson(url) { return (await fetch(url)).json(); }

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,720",
    "--user-data-dir=/tmp/ft-chrome-diag",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });
  let ws = null;
  let msgId = 0;
  const pending = new Map();
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
    const shot = async (name) => {
      const r = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, "base64"));
      console.log("wrote", name);
    };
    const tap = async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: BASE });
    let ok = false;
    for (let i = 0; i < 40; i++) {
      ok = await evalJs(`!!(window.ForgeScene && window.ForgeScene.ready)`);
      if (ok) break;
      await sleep(250);
    }
    if (!ok) throw new Error("scene not ready");
    // List every light + Points system in the scene (positions/intensities).
    const inv = await evalJs(`(() => {
      const out = { lights: [], points: [] };
      window.ForgeScene.scene.traverse((o) => {
        if (o.isLight) out.lights.push({ type: o.type, pos: o.position.toArray().map((v) => +v.toFixed(2)), intensity: o.intensity, color: '#' + o.color.getHexString(), distance: o.distance });
        if (o.isPoints) out.points.push({ name: o.name || '?', pos: o.position.toArray().map((v) => +v.toFixed(2)), count: o.geometry?.attributes?.position?.count });
      });
      return out;
    })()`);
    console.log("LIGHTS:", JSON.stringify(inv.lights, null, 1));
    console.log("POINTS:", JSON.stringify(inv.points, null, 1));
    // Start a run (click the title) and face the furnace.
    await tap(640, 360);
    await sleep(1000);
    await evalJs(`window.ForgeScene.setView(-133, -12)`);
    // Wait for TWO new frames: the first frame after a change may not
    // have been composited yet (headless SwiftShader captures a stale
    // black canvas if the shot follows a single frame — diag run 1).
    const waitFrame = async (prev) => {
      const t0 = Date.now();
      while (Date.now() - t0 < 60000) {
        const d = await evalJs(`window.ForgeScene.getDebug()`);
        if (d.frames > prev + 1) return d.frames;
        await sleep(500);
      }
      throw new Error("no new frames");
    };
    let f = await waitFrame(-1);
    await shot("diag-a-baseline.png");
    // (b) fill lights off.
    await evalJs(`window.ForgeScene.setFill(0, 0)`);
    f = await waitFrame(f);
    await shot("diag-b-nofill.png");
    // (c) fill back on, flames hidden.
    await evalJs(`window.ForgeScene.setFill(18, 9); window.ForgeScene.scene.traverse((o) => { if (o.isPoints) o.visible = false; })`);
    f = await waitFrame(f);
    await shot("diag-c-noflames.png");
    // (d) fill off + flames hidden (spots + fireGlow + workGlow only).
    await evalJs(`window.ForgeScene.setFill(0, 0)`);
    f = await waitFrame(f);
    await shot("diag-d-nofill-noflames.png");
    // (e) also switch off the fireGlow point light (the R-08 fill at
    // [2.95, 1.35, 2.75]) — real spot lights only.
    await evalJs(`window.ForgeScene.scene.traverse((o) => { if (o.isPointLight && Math.abs(o.position.x - 2.95) < 0.1 && Math.abs(o.position.z - 2.75) < 0.1) o.visible = false; })`);
    f = await waitFrame(f);
    await shot("diag-e-spotsonly.png");
    console.log("DIAG DONE");
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exitCode = 2;
  } finally {
    if (ws) ws.close();
    chrome.kill();
  }
}
main();
