// Focused diag for the held-sword fill light (M3, AEGIS round 5).
// Loads the page, starts a run, walks to the anvil, picks up the sword
// with E, then inspects the heldLight in the live scene graph and
// screenshots the blade at intensity 12 vs 200.
// Usage: node tools/dev-server/heldlight-diag.js
// Writes: .browser-test-diag/held-12.png, .browser-test-diag/held-200.png
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME_BIN || "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";
const PORT = 9225;
const BASE = "http://127.0.0.1:1420/";
const OUT = path.join(process.env.HOME, "workspace/forgetax-mobile/remake/.browser-test-diag");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function httpJson(url) { return (await fetch(url)).json(); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync("/tmp/ft-chrome-heldlight", { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,720",
    "--user-data-dir=/tmp/ft-chrome-heldlight",
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
    // Walk forward (W) for 12 s of real time (headless game time is slow).
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "w", code: "KeyW", windowsVirtualKeyCode: 87 });
    await sleep(12000);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "w", code: "KeyW", windowsVirtualKeyCode: 87 });
    await sleep(500);
    // Pick up the anvil sword with E.
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
    await sleep(800);
    // Wait for 3 NEW frames before inspecting — heldLightTick() runs
    // from animate(), and headless SwiftShader can be ~0.2 fps, so a
    // fixed sleep is not enough for it to run once with the sword held
    // (the first version of this diag read the light before any frame
    // ran after the pickup, so it always saw [0,0,0]).
    for (let i = 0; i < 3; i++) {
      frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
      await waitForFrame(frames);
    }
    const dbg = await evalJs(`window.ForgeScene.getDebug()`);
    console.log("debug after E:", JSON.stringify({ held: dbg.held, heldLight: dbg.heldLight, camPos: dbg.camPos, hlTick: dbg.hlTick, hlCalls: dbg.hlCalls, hlGuardFail: dbg.hlGuardFail, hlPos: dbg.hlPos, frames: dbg.frames }));
    if (!dbg.held) throw new Error("pickup failed — not holding a sword");
    // Inspect the heldLight (a scene-child PointLight, intensity 3,
    // distance 2.5) + the held sword group + the camera, all in world
    // space, to see whether heldLightTick() is actually tracking.
    const lightInfo = await evalJs(`(() => {
      const scene = window.ForgeScene.scene;
      const held = [];
      let cam = null, heldGroup = null;
      scene.traverse((o) => {
        if (o.isCamera) cam = o;
        if (o.isPointLight && o.intensity === 3 && o.distance === 2.5) {
          o.updateMatrixWorld(true);
          const lp = o.matrixWorld.elements;
          held.push({ type: 'point', intensity: +o.intensity.toFixed(2),
            distance: o.distance, parentIsScene: o.parent === scene,
            pos: [lp[12], lp[13], lp[14]].map((v) => +v.toFixed(2)) });
        }
      });
      if (cam) cam.traverse((o) => { if (o.name && o.name.indexOf('sword-') === 0) heldGroup = o; });
      const out = { heldCount: held.length, held };
      if (heldGroup) { heldGroup.updateWorldMatrix(true, false); const p = heldGroup.matrixWorld.elements; out.heldGroupWorldPos = [p[12], p[13], p[14]].map((v) => +v.toFixed(2)); }
      if (cam) out.camPos = [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(2));
      return out;
    })()`);
    console.log("heldLight:", JSON.stringify(lightInfo));
    // Normal diagnostic (M3): for the held sword mesh, compute the dot
    // product between each vertex's WORLD normal and the direction to
    // the heldLight. If the max dot is ~0 or negative, the blade's
    // faces point away from the light and no light position will fix it
    // (the fix would be the pose/material, not the light).
    const normalInfo = await evalJs(`(() => {
      const THREE = window.ForgeScene.THREE;
      const scene = window.ForgeScene.scene;
      let cam = null, heldGroup = null, heldLight = null;
      scene.traverse((o) => {
        if (o.isCamera) cam = o;
        if (o.isPointLight && o.intensity === 3 && o.distance === 2.5) heldLight = o;
      });
      if (cam) cam.traverse((o) => { if (o.name && o.name.indexOf('sword-') === 0) heldGroup = o; });
      if (!heldGroup || !heldLight) return { error: 'sword or light not found' };
      const mesh = heldGroup.children.find((c) => c.isMesh);
      if (!mesh) return { error: 'no mesh in heldGroup' };
      mesh.updateWorldMatrix(true, false);
      const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      const lp = new THREE.Vector3().setFromMatrixPosition(heldLight.matrixWorld);
      const pos = mesh.geometry.attributes.position, nrm = mesh.geometry.attributes.normal;
      // True local coordinate ranges (the bbox in the sword record may
      // be post-scale; the geometry attribute is the ground truth).
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const range = { x: [+minX.toFixed(3), +maxX.toFixed(3)], y: [+minY.toFixed(3), +maxY.toFixed(3)], z: [+minZ.toFixed(3), +maxZ.toFixed(3)] };
      const v = new THREE.Vector3(), n = new THREE.Vector3(), toLight = new THREE.Vector3();
      let maxDot = -2, sumDot = 0, count = 0, facing = 0;
      // Flat-only: the blade's broad faces are at local |Z| ≈ 0.044
      // (the thin dimension; X is the width, Y the length). Sample
      // those vertices separately from the hilt/crossguard/edges.
      let fMaxDot = -2, fSumDot = 0, fCount = 0, fFacing = 0;
      const step = Math.max(1, Math.floor(pos.count / 200));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
        toLight.copy(lp).sub(v).normalize();
        const d = n.dot(toLight);
        if (d > maxDot) maxDot = d;
        sumDot += d; count++;
        if (d > 0.5) facing++;
        // Flat-only: the blade's broad faces are at the extremes of the
        // THIN dimension (the smallest of the X/Z ranges). Use |coord| >
        // 0.8 * maxAbs on that axis.
        const thinAxis = (maxX - minX) < (maxZ - minZ) ? 'x' : 'z';
        const thinMax = thinAxis === 'x' ? Math.max(Math.abs(minX), Math.abs(maxX)) : Math.max(Math.abs(minZ), Math.abs(maxZ));
        const lc = thinAxis === 'x' ? pos.getX(i) : pos.getZ(i);
        if (Math.abs(lc) > 0.8 * thinMax) {
          if (d > fMaxDot) fMaxDot = d;
          fSumDot += d; fCount++;
          if (d > 0.5) fFacing++;
        }
      }
      return { verts: pos.count, range, sampled: count, maxDot: +maxDot.toFixed(3), meanDot: +(sumDot / count).toFixed(3), fracFacingLight: +(facing / count).toFixed(3),
        flat: { sampled: fCount, maxDot: +fMaxDot.toFixed(3), meanDot: fCount ? +(fSumDot / fCount).toFixed(3) : null, fracFacingLight: fCount ? +(fFacing / fCount).toFixed(3) : null } };
    })()`);
    console.log("blade normals vs heldLight:", JSON.stringify(normalInfo));
    // Screenshot at the working intensity, then crank it 10x and
    // screenshot again — if the blade brightens, the light works.
    // Sleep 3 s first so the headless compositor has presented a frame
    // (the first run's held-3.png was a black canvas because the shot
    // followed the pickup too soon), then wait for two new frames.
    await sleep(3000);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    await shot("held-3.png");
    const before = await evalJs(`window.ForgeScene.getDebug()`);
    await evalJs(`(() => { const scene = window.ForgeScene.scene; scene.traverse((o) => { if (o.isPointLight && o.intensity === 3 && o.distance === 2.5) { o.intensity = 300; o.distance = 0; o.decay = 0; } }); return true; })()`);
    await sleep(1500);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    await shot("held-300.png");
    console.log("heldLight before crank:", before.heldLight);
    // Metalness test (M3): set the held sword's Standard material
    // metalness to 0 (full diffuse, no metal specular). If the blade
    // becomes readable, the fix is to lower metalness for the held
    // sword (the flat's diffuse is not reaching it at metalness 0.5).
    await evalJs(`(() => {
      const scene = window.ForgeScene.scene;
      let cam = null, heldGroup = null;
      scene.traverse((o) => { if (o.isCamera) cam = o; });
      if (cam) cam.traverse((o) => { if (o.name && o.name.indexOf('sword-') === 0) heldGroup = o; });
      if (!heldGroup) return false;
      const mesh = heldGroup.children.find((c) => c.isMesh);
      if (!mesh) return false;
      mesh.material.metalness = 0;
      mesh.material.needsUpdate = true;
      return true;
    })()`);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    await shot("held-metal0.png");
    // Emissive-lift test (M3): restore metalness 0.5, then set a small
    // NEUTRAL emissive in the palette's own colour (id 1 brown
    // [86,68,56]) at intensity 0.5. This is NOT the R-09 teal emissive
    // (wrong atlas + wrong colour, withdrawn) — it is a plain lift in
    // the blade's own colour so the view-model reads like the
    // original's readable held sword (video 2 f_035). If the blade
    // reads ~40-60/255 brown steel, this is the fix (marked TODO-RE /
    // R-08 as a view-model readability approximation).
    await evalJs(`(() => {
      const THREE = window.ForgeScene.THREE;
      const scene = window.ForgeScene.scene;
      let cam = null, heldGroup = null;
      scene.traverse((o) => { if (o.isCamera) cam = o; });
      if (cam) cam.traverse((o) => { if (o.name && o.name.indexOf('sword-') === 0) heldGroup = o; });
      if (!heldGroup) return false;
      const mesh = heldGroup.children.find((c) => c.isMesh);
      if (!mesh) return false;
      mesh.material.metalness = 0.5;
      mesh.material.emissive = new THREE.Color(86 / 255, 68 / 255, 56 / 255);
      mesh.material.emissiveIntensity = 0.5;
      mesh.material.needsUpdate = true;
      return true;
    })()`);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    await shot("held-emissive.png");
    // Material diagnostic (M3): swap the held sword's material for an
    // UNLIT white MeshBasicMaterial and screenshot. If the blade shows
    // up white, the geometry renders and the problem is purely the
    // lighting not reaching it; if it stays dark, the flat is not
    // rendering at all (geometry/culling).
    await evalJs(`(() => {
      const THREE = window.ForgeScene.THREE;
      const scene = window.ForgeScene.scene;
      let cam = null, heldGroup = null;
      scene.traverse((o) => { if (o.isCamera) cam = o; });
      if (cam) cam.traverse((o) => { if (o.name && o.name.indexOf('sword-') === 0) heldGroup = o; });
      if (!heldGroup) return false;
      const mesh = heldGroup.children.find((c) => c.isMesh);
      if (!mesh) return false;
      mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      return true;
    })()`);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    frames = (await evalJs(`window.ForgeScene.getDebug()`)).frames;
    await waitForFrame(frames);
    await shot("held-basic.png");
    console.log("console errors:", errors);
  } finally {
    ws.close();
    chrome.kill("SIGKILL");
  }
}
main().catch((e) => { console.error("DIAG FAILED:", e.message); process.exit(1); });
