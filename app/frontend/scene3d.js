// ForgeTax Mobile remake — P0 3D forge room, REBUILT from the REAL scene layout.
//
// SOURCES (all from the 3.17.0 APK, package com.soucean.cantkeepfire):
//   scene-layout/LAYOUT.md + layout.json — room objects, camera, lights, boards
//   scene-data.json + meshes.json — converted by tools/convert-scene.py
//   textures/ — original Texture2D PNGs (see textures/MANIFEST.md)
//   scene-layout/ui_layout.json + UI_LAYOUT.md — 113 3D TextMesh labels
//     (board font/size/colour/anchors), 9 fonts, 0 Canvas in level0
//   scene-layout/behavior.json + BEHAVIOR.md — ForgeFirstPerson,
//     ForgeInteractables, Fever, hammer timing, camera shake, settings
//     defaults, sword EvolutionCatalogue (117 entries) + 28 special lines
//   scene-layout/effects.json + EFFECTS.md — 118 particle systems
//   swords/ + swords-manifest.json + sword-catalogue.json — the 111
//     ResolveId-reachable sword prefabs, converted by tools/convert-swords.py
// Every number below cites its source in a comment.
// TODO-RE marks anything unrecovered — never presented as exact.
//
// What this replaces: the previous scene3d.js was an invented arrangement
// (camera 8.4 m outside the room, furnace/anvil at made-up spots, an
// extruded-profile sword, hand-placed lights). Ethan played the original
// and rejected it. This version renders the real room: 600 real objects,
// 216 real meshes, 11 real Spot lights, the real sword forms (Evolution
// catalogue, ResolveId), the real camera pose, and the contract/day/quota
// displays as 3D text on the real in-room boards (LAYOUT.md §5, §9).
//
// PERF (documented decision): the 600 static objects are MERGED into one
// mesh per material (~96 draw calls) instead of one InstancedMesh per
// group (~400 draw calls) — the HD 4400 target is draw-call bound, not
// vertex bound (88k verts total). 11 of the 20 real Spot lights are used
// (LIGHTS_INCLUDED in convert-scene.py); the original's baked lightmaps /
// light probes are absent from the bundle, so a small hemisphere fill
// stands in for them (see the LIGHTS note below). No shadows (perf).
// Sword prefabs are LAZY-LOADED one at a time (swords/<pid>.json, 60-450 KB
// each) — the full 111-prefab set is 23 MB on disk and is never all loaded.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function b64ToU8(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// F-01b — linear -> sRGB (exact IEC formula). The _BaseColor / m_Color
// values in the extraction are LINEAR; canvas 2D hex needs sRGB. (The
// old code did v*255 straight from linear — wrong, e.g. BREAK rendered
// #912C24 instead of #C77468.)
function linearToSrgb(v) {
  const c = clamp(v, 0, 1);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function linearRgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.round(linearToSrgb(v) * 255).toString(16).padStart(2, '0')).join('');
}
// ui_layout.json TextMesh colours are [A, B, G, R] (ABGR, A = 1.0) —
// verified: under ABGR all 5 outcome labels match their semantic colours,
// under RGBA 0/5 match. Values are LINEAR, so they go through
// linearToSrgb before becoming a canvas hex.
function textMeshColorToHex(abgr) {
  return linearRgbToHex([abgr[3], abgr[2], abgr[1]]);
}
// R-02 — board text font stack. The room's TextMesh fonts are ForgeKorean
// (font_names ["Malgun Gothic"]) and LegacyRuntime (Liberation Sans /
// Arial). ForgeKorean is the original's Korean UI font; on Ethan's Windows
// PC it resolves to Malgun Gothic (present in Windows). The 2D canvas has
// no access to the original's font files (they are engine fonts, not
// extracted assets) — the system-font stack is the documented stand-in.
const BOARD_FONT = '"Malgun Gothic", "Noto Sans", "Liberation Sans", Arial, sans-serif';
// R-02 — glyph-size calibration (empirical, NOT a documented Unity
// formula): canvas font em ≈ TextMesh size × characterSize / 10.
// Calibrated against the recorded row gaps (instrument outcome row y 1.49
// vs probability row y 1.435 = 0.055 m apart; calendar 7×5 grid, column
// pitch 0.1047 m, row pitch 0.1324 m; meter panel 0.26 m with two rows
// 0.136 m apart). With k = 0.1 every label fits its row with sensible
// fill (calendar digits 0.052 m in 0.1324 m rows, outcome labels 0.0335 m
// in a 0.055 m gap, meter numbers 0.054-0.077 m). Documented as calibrated.
function textMeshPx(size, characterSize, plane) {
  const emM = (size * characterSize) / 10;
  return (emM * plane.canvasW) / plane.w;
}

// Decode one meshes.json record into local-space typed arrays.
// Format (tools/convert-scene.py quantize_mesh): positions uint16 over
// posMin..posMax, normals int8 (/127), uvs uint16 over uvMin..uvMax,
// indices uint16 or uint32 (idxBits), winding already reversed
// (Unity CW -> Three.js CCW front).
function decodeMesh(rec) {
  const n = rec.verts;
  const pb = b64ToU8(rec.pos);
  const nb = b64ToU8(rec.nrm);
  const ub = b64ToU8(rec.uv);
  const ib = b64ToU8(rec.idx);
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const pr = [rec.posMax[0] - rec.posMin[0], rec.posMax[1] - rec.posMin[1], rec.posMax[2] - rec.posMin[2]];
  const ur = [rec.uvMax[0] - rec.uvMin[0], rec.uvMax[1] - rec.uvMin[1]];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rec.posMin[0] + (pb[i * 6] | (pb[i * 6 + 1] << 8)) / 65535 * pr[0];
    pos[i * 3 + 1] = rec.posMin[1] + (pb[i * 6 + 2] | (pb[i * 6 + 3] << 8)) / 65535 * pr[1];
    pos[i * 3 + 2] = rec.posMin[2] + (pb[i * 6 + 4] | (pb[i * 6 + 5] << 8)) / 65535 * pr[2];
    let nx = nb[i * 3], ny = nb[i * 3 + 1], nz = nb[i * 3 + 2];
    if (nx > 127) nx -= 256; if (ny > 127) ny -= 256; if (nz > 127) nz -= 256;
    nrm[i * 3] = nx / 127; nrm[i * 3 + 1] = ny / 127; nrm[i * 3 + 2] = nz / 127;
    uv[i * 2] = rec.uvMin[0] + (ub[i * 4] | (ub[i * 4 + 1] << 8)) / 65535 * ur[0];
    uv[i * 2 + 1] = rec.uvMin[1] + (ub[i * 4 + 2] | (ub[i * 4 + 3] << 8)) / 65535 * ur[1];
  }
  let idx;
  if (rec.idxBits === 16) {
    idx = new Uint16Array(ib.buffer, ib.byteOffset, ib.byteLength / 2);
  } else {
    idx = new Uint32Array(ib.buffer, ib.byteOffset, ib.byteLength / 4);
  }
  return { pos, nrm, uv, idx, groups: rec.groups, verts: n };
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let renderer = null;
let scene = null;
let camera = null;
let containerEl = null;
let data = null;      // scene-data.json
let meshData = null;  // meshes.json
let readyFlag = false;
let webglFlag = false;

const texCache = new Map();   // png filename -> THREE.Texture
const matCache = new Map();   // material id -> THREE.Material
const meshCache = new Map();  // mesh key -> decoded mesh

let hammerGroup = null;       // Group at the real hammer pivot (GO 2843)
let hammerSwingT = -1;        // swing animation clock (-1 = idle)
let swordGroup = null;        // Group at the real sword spawn marker (GO 2896)
let restingSwords = [];       // 3 swords on the transaction counter
let brokenSwords = [];        // broken-sword remnants on the floor (TODO-RE form)
let outcomeLightMeshes = [];  // 5 thin boxes on the instrument board
let boardPlanes = {};         // key -> {mesh, canvas, ctx, tex, basis}
let relicSlotPlanes = [];     // 8 small name planes on the -X wall
let flameSystem = null;       // Low flame particle system (Points, R-10)
let emberSystem = null;       // Draft embers particle system (Points, R-11)
let dustSystems = [];         // 4 ambient dust systems (Points, R-12)
let sparkBursts = [];         // active strike bursts (Points, R-13)
let spotLights = {};          // name -> THREE.SpotLight
let eyeLight = null, breathLight = null, quotaLight = null;
let fireLight = null;         // Fire / primary warm light (intensity 20, real)
let feverRadiance = null;     // R-15: Fever presentation radiance Light
let fillLights = {};          // {hemi, amb} — the baked-lightmap stand-in fill
// R-17: sword appearance data (loaded in init).
let swordManifest = null;     // swords-manifest.json: id -> {file, bbox, paletteColor, viName, ...}
let swordCatalogue = null;    // sword-catalogue.json: 117 entries + 28 special lines
let currentAppearanceId = 1;  // appearance id currently shown on the anvil
let currentAppearanceName = 'Kiếm cũ mòn'; // VI name of the current appearance (swords-manifest viName)
let swordMeshCache = new Map(); // appearance id -> decoded mesh record

// Camera: work view by default (LAYOUT.md §2). The eye is FIXED in P0 —
// the original's walker movement (ForgeFirstPerson) is P1 scope; free-look
// drag rotates the view only.
let viewYaw = 0, viewPitch = 0;   // radians, absolute (YXZ)
let workYaw = 0, workPitch = 0;   // radians, work view (R-24: pitch = workLookPitch 10°)
let feverOn = false;
let quality = 'medium';
let floorSwordCap = 30;           // R-20: floorSwordLimit 30 (real default)
let lastOutcome = null;
let lastView = null;   // last update() payload (for redraws on language change)
let animT = 0;
// R-24 — work-view blend + Punch kick (behavior.json forge_first_person):
// workBlend approaches its target (1 = working) at 1 - exp(-10*dt);
// FOV = lerp(69, 61, clamp01(workBlend)) + kick * 0.35 (DAT 0.35);
// pitch = workLookPitch - kick when working. P0 defaults to the work view
// (workBlend starts at 1); the spawn<->work blend is TODO-RE (no walking
// in P0, the eye is fixed) — the FOV stays at the work value while the
// user free-looks. Punch kick cap 1.4 (DAT_00e0dc34); the kick DECAY RATE
// is NOT in the data — 7/s borrows the extracted rewardImpulse decay rate
// (behavior.json rewardShake) and is flagged as an approximation, never
// presented as data.
let workBlend = 1;
let punchKick = 0;
// R-07 — Fever/reward/quake camera shake (behavior.json forge_first_person,
// ForgeFirstPerson.LateUpdate RVA 0x2411160). Fever: power = amount *
// (impact * 0.6 + 0.7), impact 1.0 -> power = amount * 1.3; age =
// FeverAge(bonus, timeLeft) (BEHAVIOR.md §3.2). Reward: impulse set to 1
// on a Great, decays 7/s. Quake: not triggered in P0 (dragon visit, P2)
// — constants recorded, no caller.
let rewardImpulse = 0;
let rewardAge = 0;
let quakeAmount = 0;
let quakeAge = 0;
// R-07/R-15 — Fever presentation age (behavior.json fever, BEHAVIOR.md
// §3.2). The age is derived from the Fever's timeLeft, but update() only
// runs on state changes (every 0.2 s during Fever), while the shake
// oscillates at up to ~15 Hz — so the age is INTERPOLATED per frame:
// age = feverAgeBase + (animT - feverAgeT0) * feverAgeRate. The rate
// (3.8 / max(0.01, max(4,bonus) - 0.2)) comes from the FeverAge formula;
// the envelope (feverAmount) is recomputed per frame in
// feverRadianceTick() and reused by applyCamera().
let feverAgeBase = 0;
let feverAgeRate = 1;
let feverAgeT0 = 0;
let feverBonus = 4;
let feverAmount = 0;
// R-15 — dragon anger -> eye/breath intensity + quota light (PARTIAL):
// eyePressureByMood (Low/Question/Dry/Threat/Sneer/Roar) + setDanger /
// warningCount (min(missedTributes, markCount)) exist in behavior.json
// dragon_anger, but the MOOD source is BEHAVIOR M6 (caller-trace, not yet
// attempted) and the warning crayon marks have no mesh (TODO-RE) — so the
// mood/marks cannot be applied yet. The anger -> Eye/Breath intensity
// scale + the quota 2.0 below are the previous SENSOR's values, NOT
// sourced — kept + marked (R-15 remainder, awaiting OWNER remake approval).
// TODO-RE / R-15: replace the 0.8 / 0.5 / 2.0 factors when the mood source
// (M6) or the marks mesh is recovered.

// Outcome channel _BaseColor values (LAYOUT.md §5a, linear): 0 BREAK
// [0.57, 0.174, 0.144], 1 damage [0.558, 0.342, 0.144], 2 Hold
// [0.42, 0.438, 0.432], 3 Success [0.222, 0.516, 0.426], 4 Great
// [0.6, 0.474, 0.192] — F-01. The sRGB conversions live in app.js
// (OUTCOME_COLORS) and the outcome-light meshes use data.outcomeLights
// (scene-data.json, same source). The instrument LABEL colours are the
// TextMesh text colours (ui_layout.json, ABGR linear -> sRGB, see
// drawInstrument) — a different, brighter set — so no table is kept here.

// ---------------------------------------------------------------------------
// Textures / materials
// ---------------------------------------------------------------------------
async function loadTexture(png, { srgb = true } = {}) {
  if (texCache.has(png)) return texCache.get(png);
  const tex = await new THREE.TextureLoader().loadAsync('textures/' + png);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texCache.set(png, tex);
  return tex;
}

async function buildMaterial(mid, rec) {
  if (matCache.has(mid)) return matCache.get(mid);
  const params = {
    color: new THREE.Color(rec.baseColor[0], rec.baseColor[1], rec.baseColor[2]),
    metalness: rec.metalness,
    roughness: rec.roughness,
  };
  if (rec.emissive && (rec.emissive[0] || rec.emissive[1] || rec.emissive[2])) {
    params.emissive = new THREE.Color(rec.emissive[0], rec.emissive[1], rec.emissive[2]);
  }
  if (rec.mapPng) params.map = await loadTexture(rec.mapPng, { srgb: true });
  if (rec.bumpPng) {
    params.bumpMap = await loadTexture(rec.bumpPng, { srgb: false });
    params.bumpScale = 0.6;
  }
  const mat = new THREE.MeshStandardMaterial(params);
  matCache.set(mid, mat);
  return mat;
}

function getMesh(key) {
  if (meshCache.has(key)) return meshCache.get(key);
  const rec = meshData.meshes[key];
  if (!rec) return null;
  const dec = decodeMesh(rec);
  meshCache.set(key, dec);
  return dec;
}

// ---------------------------------------------------------------------------
// Static geometry: merge all placements into one mesh per material.
// ---------------------------------------------------------------------------
function mergeStatic() {
  // accumulator per material id: {pos:[], nrm:[], uv:[], idx:[]}
  const acc = new Map();
  const tmpM = new THREE.Matrix4();
  const tmpN = new THREE.Matrix3();
  const tmpV = new THREE.Vector3();
  const tmpNv = new THREE.Vector3();

  function accFor(mid) {
    if (!acc.has(mid)) acc.set(mid, { pos: [], nrm: [], uv: [], idx: [] });
    return acc.get(mid);
  }

  // Append one submesh group of one instance into its material accumulator.
  function addInstanceGroup(meshKey, group, materials, inst) {
    const mesh = getMesh(meshKey);
    if (!mesh) return;
    const mid = materials[group.mat] || materials[0];
    if (!mid) return;
    const a = accFor(mid);
    tmpM.compose(
      new THREE.Vector3(inst[0], inst[1], inst[2]),
      new THREE.Quaternion(inst[3], inst[4], inst[5], inst[6]),
      new THREE.Vector3(inst[7], inst[8], inst[9]));
    tmpN.getNormalMatrix(tmpM);
    const base = a.pos.length / 3;
    const vmap = new Map();
    const getV = (vi) => {
      let ni = vmap.get(vi);
      if (ni !== undefined) return ni;
      tmpV.set(mesh.pos[vi * 3], mesh.pos[vi * 3 + 1], mesh.pos[vi * 3 + 2]).applyMatrix4(tmpM);
      tmpNv.set(mesh.nrm[vi * 3], mesh.nrm[vi * 3 + 1], mesh.nrm[vi * 3 + 2]).applyMatrix3(tmpN).normalize();
      ni = base + vmap.size;
      vmap.set(vi, ni);
      a.pos.push(tmpV.x, tmpV.y, tmpV.z);
      a.nrm.push(tmpNv.x, tmpNv.y, tmpNv.z);
      a.uv.push(mesh.uv[vi * 2], mesh.uv[vi * 2 + 1]);
      return ni;
    };
    for (let i = group.start; i < group.start + group.count; i += 3) {
      a.idx.push(getV(mesh.idx[i]), getV(mesh.idx[i + 1]), getV(mesh.idx[i + 2]));
    }
  }

  for (const obj of data.objects) {
    const mesh = getMesh(obj.mesh);
    if (!mesh) continue;
    for (const inst of obj.instances) {
      for (const g of mesh.groups) addInstanceGroup(obj.mesh, g, obj.materials, inst);
    }
  }
  // Floor flagstones: instanced Shell_FlagA at exact grid positions
  // (LAYOUT.md §4 — 60 stones, materials Room_FloorSlate pid 179 /
  // Room_FloorStone pid 181 per stone). Flagstones are axis-aligned.
  const floorMesh = getMesh(data.floor.mesh);
  if (floorMesh) {
    for (const f of data.floor.instances) {
      const inst = [f.pos[0], f.pos[1], f.pos[2], 0, 0, 0, 1, 1, 1, 1];
      for (const g of floorMesh.groups) addInstanceGroup(data.floor.mesh, g, f.mats, inst);
    }
  }

  return acc;
}

async function buildStaticMeshes() {
  const acc = mergeStatic();
  const group = new THREE.Group();
  group.name = 'room-static';
  for (const [mid, a] of acc) {
    const mat = await buildMaterial(mid, data.materials[mid]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
    geo.setIndex(a.idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false; // the camera is inside the room; always visible
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------
// Lights — the 11 real Spot lights (LAYOUT.md §3; positions/colors/
// intensities/ranges/angles from layout.json). Direction = the light
// GameObject's world +Z (Unity spot lights emit along +Z), computed from
// the recorded world_euler (ZYX order — verified against the parent-chain
// quaternion, dot = 1.0000 for all 11 kept lights).
//
// LIGHTS NOTE: the original's base illumination is BAKED lightmaps +
// light probes (section 'Baked lighting / light probes' in LAYOUT.md §1),
// which are absent from the bundle. A HemisphereLight fill stands in for
// them — it is a documented approximation, not original data. The 9
// omitted spot lights are listed in scene-data.json lightsOmitted.
// No shadows (perf, HD 4400 target).
// ---------------------------------------------------------------------------
function eulerToDir(e) {
  // Unity world_euler (ZYX order) -> forward (+Z) direction.
  const [x, y, z] = e.map((d) => (d * Math.PI) / 180);
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  // R = Rz * Ry * Rx; forward = R * (0,0,1)
  const fx = cz * sy * cx + sz * sx;
  const fy = sz * sy * cx - cz * sx;
  const fz = cy * cx;
  return new THREE.Vector3(fx, fy, fz);
}

function buildLights() {
  for (const l of data.lights) {
    const light = new THREE.SpotLight(
      new THREE.Color(l.color[0], l.color[1], l.color[2]),
      l.intensity,
      l.range,
      (l.spotAngle * Math.PI) / 180 / 2,
      1 - (l.innerSpot || l.spotAngle * 0.7) / l.spotAngle,
      2, // physical decay (Unity URP spot falloff)
    );
    light.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const dir = eulerToDir(l.euler);
    light.target.position.set(l.pos[0] + dir.x, l.pos[1] + dir.y, l.pos[2] + dir.z);
    scene.add(light);
    scene.add(light.target);
    spotLights[l.name] = light;
    if (l.name === 'Eye light') eyeLight = light;
    if (l.name === 'Breath light') breathLight = light;
    if (l.name === 'Quota ready / bell glint') quotaLight = light;
    if (l.name === 'Fire / primary warm light') fireLight = light;
  }
  // R-15 (PARTIAL): the Fever presentation radiance light — a separate
  // PointLight, intensity and colour driven per frame by
  // feverRadianceTick() (amount * (sin(age*35) + impact*3.5 + 2.2),
  // FeverColor HSV). Starts at 0. POSITION (TODO-RE): the recorded
  // radianceOffset is 0.06, but its ANCHOR is unrecovered — placing the
  // light 0.06 m from the sword spawn blows the blade out white (the
  // 1/d^2 falloff at 0.06 m multiplies the real 4.7-6.7 intensity by
  // ~280x; seen in the 2026-11-21 browser test, 04-fever.png). It is
  // placed 0.4 m above the sword instead, so the Fever glow tints the
  // sword/anvil without erasing it. The intensity FORMULA is real data
  // and is not changed.
  feverRadiance = new THREE.PointLight(new THREE.Color(1, 1, 1), 0, 6, 2);
  feverRadiance.position.set(-1.543, 1.193 + 0.4, 2.166);
  scene.add(feverRadiance);
  // R-08 — REMADE (approved by OWNER 2026-11-21): the hemisphere fill +
  // ambient + the two warm point lights below stand in for the original's
  // BAKED lightmaps / light probes, which are ABSENT from the bundle
  // (no lightmap textures in the APK). They are NOT original data —
  // they exist so the room is visible at all (the 11 real spots all
  // point horizontally, LAYOUT.md §3, and none lights the anvil top or
  // the furnace mouth directly).
  // Hemisphere fill — stands in for the missing baked lightmaps/probes
  // (approximation, NOT original data). Warm from above (fire/ceiling),
  // dark floor bounce. Level tuned 2026-11-21 from headless screenshots:
  // the original albedos are very dark (flagstone mean RGB 40, iron 47),
  // so 0.55/0.5 left the room pitch black; 3.0/2.0 was still dim on the
  // anvil; 4.0/2.5 reads as the original's moody-but-visible forge.
  const hemi = new THREE.HemisphereLight(0x8a6a4a, 0x1a120c, 4.0);
  scene.add(hemi);
  // Small ambient so the shadowed corners are never pure black.
  const amb = new THREE.AmbientLight(0x241a12, 2.5);
  scene.add(amb);
  fillLights.hemi = hemi;
  fillLights.amb = amb;
  // Two warm point lights standing in for the original's BAKED light
  // pools (also absent from the bundle — approximation, NOT original
  // data). The original's anvil + sword and the furnace mouth ARE clearly
  // visible to the player; with only the horizontal spot lights + the
  // hemisphere fill, the dark iron (albedo ~0.05 linear) renders as a
  // black blob and the furnace as a black box, because the 11 real spots
  // all point horizontally (LAYOUT.md §3) and none lights the anvil top
  // or the furnace mouth directly.
  // (a) Work light over the anvil — same warm colour as the real 'Work
  // lamp pool' spot (1.0, 0.74, 0.43); lights the anvil face + sword so
  // the player can see what they are striking.
  const workGlow = new THREE.PointLight(new THREE.Color(1.0, 0.74, 0.43), 14, 3.5, 2);
  workGlow.position.set(-1.07, 2.1, 2.19);
  scene.add(workGlow);
  // (b) Fire glow just outside the furnace mouth — same warm colour as
  // the real 'Fire / primary warm light' (1.0, 0.59, 0.27). It sits in
  // front of the mouth (mouth faces yaw 43.66°, dir (0.69, 0, 0.72);
  // ember bed [2.17, 1.06, 1.85] + 0.8 m along that dir) so it lights
  // the furnace front stones and spills warm light onto the floor. (A
  // light placed AT the ember bed lights only the furnace interior —
  // the exterior faces point away from it — so the furnace stayed a
  // black box; verified 2026-11-21.) The SoftFlame sprites + embers at
  // the bed itself are the visible fire.
  const fireGlow = new THREE.PointLight(new THREE.Color(1.0, 0.59, 0.27), 12, 5, 2);
  fireGlow.position.set(2.72, 1.2, 2.43);
  scene.add(fireGlow);
  fillLights.workGlow = workGlow;
  fillLights.fireGlow = fireGlow;
}

// ---------------------------------------------------------------------------
// Sword — the REAL base form (LAYOUT.md §7): Blade (pid 340, 48 verts) +
// RefitBevelUnit parts (pommel / crossguard / fuller / grip / 8 windings),
// materials Steel / BlackIron / Leather / Board, from dump2 sharedassets0
// TR 469 children (pos/quat/scale per part, exact).
//
// Spawn orientation (TODO-RE — the runtime marker [−1.543, 1.193, 2.166]
// carries no rotation): the sword (prefab span y −0.122…0.83, ~0.95 m)
// fits the anvil face (x −1.71…−0.51) only with prefab +Y -> world +X
// (pommel left, tip right) and fuller side (prefab −Z face) up. The
// marker is the prefab origin (at the guard), so the sword spans
// x −1.635…−0.713 — fully on the face. Documented choice, not data.
//
// ---------------------------------------------------------------------------
// Sword appearance — Evolution catalogue (R-17, CIPHER v2).
// The anvil sword's FORM follows ForgeSwordAppearance / ForgeSwordEvolution
// (BEHAVIOR.md §8.4): appearanceId = Id(sword) where grade =
// max(highestVisualGrade, grade) and the parent/branch come from the sword's
// spawn (parent = (serial-1)%3, branch = appearanceRandom.Next(4)).
// The 117-entry EvolutionCatalogue + 28 special lines are in
// sword-catalogue.json; the 111 ResolveId-reachable prefabs are in
// swords/<pid>.json (tools/convert-swords.py). The 6 ids 8/13/18/23/28/33
// are in the catalogue but NO selection path outputs them (M7) — if one is
// ever requested the base Blade is used as a fallback (TODO-RE).
// The special-line path (ForgeSpecialLine.IdAt) is implemented for
// completeness, but P0 swords have no special line (special lines come via
// the merchant, P1) — only the ordinary ResolveId path runs in P0.
// ---------------------------------------------------------------------------
function grandTier(grade) {
  if (grade < 25) return -1;
  if (grade > 29) return 1;
  return 0;
}
// ForgeSwordEvolution.ResolveId(highestGrade, parent, branch) RVA 0x25846E4.
function resolveAppearanceId(grade, parent, branch) {
  if (grade < 2) return 1;
  if (grade <= 3) return 38;
  if (grade <= 5) return 39;
  if (grade <= 9) return ((grade > 7 ? 1 : 0) | (parent << 1)) + 2;
  if (grade <= 998) {
    parent = clamp(parent, 0, 2);
    branch = clamp(branch, 0, 3);
    const tier = grandTier(grade);
    if (tier >= 0) {
      const u = branch < 2 ? (parent << 1) | 1 : parent * 2 + 5;
      return (tier === 0 ? 3998 : 3999) + (u + branch) * 2;
    }
    if (branch < 2) {
      if (grade <= 13) return (parent * 2 + 40) | branch;
      const u = grade <= 15 ? 1 : grade <= 17 ? 2 : grade <= 19 ? 3 : 4;
      return (branch | (parent << 1)) * 5 + u + 8;
    }
    return Math.min((grade - 10) >> 1, 5) + (branch + parent * 2) * 6 + 34;
  }
  const u = branch < 2 ? (parent << 1) | 1 : parent * 2 + 5;
  return branch + u + 4023;
}
// ForgeSpecialLine.StageOf (RVA 0x2638454) + IdAt (RVA 0x263873C).
function specialLineStageOf(grade, bonusStages) {
  if (grade < 25) return clamp(grade >> 1, 0, 10);
  if (grade <= 29) return 11;
  if (grade >= 50 && bonusStages >= 1) return 13;
  if (grade >= 999) return 13;
  return 12;
}
function specialLineIdAt(idBase, grade, bonusStages) {
  const stage = specialLineStageOf(grade, bonusStages);
  const maxStage = bonusStages > 0 ? 14 : 13;
  return idBase + (stage === maxStage ? 99 : stage);
}
// The branch is a System.Random draw at spawn (appearanceRandom.Next(4),
// ForgeRoom.SpawnIssuedSword RVA 0x25B54FC). The remake uses a
// deterministic hash of the sword serial so the form is STABLE across
// reloads (same 0..3 distribution, but NOT the original's RNG sequence).
// TODO-RE: replace with a real per-run RNG seeded at run start if the
// original's appearanceRandom sequence is ever recovered.
function appearanceBranch(serial) {
  let x = (serial >>> 0) + 0x9E3779B9;
  x = Math.imul(x ^ (x >>> 16), 0x21F0AAAD);
  x = Math.imul(x ^ (x >>> 15), 0x735A2D97);
  return ((x ^ (x >>> 15)) >>> 0) % 4;
}

async function loadSwordMesh(appearanceId) {
  if (swordMeshCache.has(appearanceId)) return swordMeshCache.get(appearanceId);
  const rec = swordManifest ? swordManifest[String(appearanceId)] : null;
  if (!rec || !rec.file) return null;
  try {
    const data = await (await fetch(rec.file)).json();
    const dec = decodeMesh(data);
    swordMeshCache.set(appearanceId, { dec, rec });
    return swordMeshCache.get(appearanceId);
  } catch (e) {
    console.warn("sword mesh load failed", appearanceId, e);
    return null;
  }
}

// Build one catalogue sword as a Group at the anvil spawn marker.
// Scale = the base Blade part's scale [0.59, 0.62, 0.72] (data.sword.parts)
// — the per-grade ForgeSwordSize.ModelScale formula is NOT extracted
// (BEHAVIOR.md §8.4), so the base scale is used for all grades (TODO-RE).
// The mesh is positioned by the pommel: offsetY = -0.092 - minY*0.62
// (the base assembly's Iron pommel part sits at prefab Y -0.092); X/Z are
// centred on the anvil's striking line. Returns null if the prefab cannot
// be loaded (caller falls back to the base Blade assembly).
async function buildCatalogueSword(appearanceId) {
  const loaded = await loadSwordMesh(appearanceId);
  if (!loaded) return null;
  const { dec, rec } = loaded;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dec.pos.slice(), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(dec.nrm.slice(), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(dec.uv.slice(), 2));
  geo.setIndex(Array.from(dec.idx));
  // R-09 (PARTIAL): the SwordV2 shader + detail atlas + per-id palette
  // exist (ForgeTax/SwordV2/Surface, _DetailAtlas -> SwordV2DetailAtlas,
  // _SwordPalette per id). Applied: the blade's base colour = the palette's
  // primary colour (row 0 col 0 of main-<id>_palette.png, stored in the
  // manifest at build time — e.g. id 1 brown [86,68,56], id 38 steel grey
  // [140,142,147]). NOT reproduced: the shader's per-texel palette lookup
  // (the Body mesh has one group/material, so the palette's per-part rows
  // cannot be applied separately) and the shader's scalar params — the
  // teal emissive below is still the R-09 remake proposal (kept + marked).
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.75, roughness: 0.45 });
  if (rec.paletteColor) {
    mat.color.setRGB(rec.paletteColor[0] / 255, rec.paletteColor[1] / 255, rec.paletteColor[2] / 255, THREE.SRGBColorSpace);
  }
  mat.emissive = new THREE.Color(0.04, 0.20, 0.24);
  mat.emissiveIntensity = 0.55;
  mat.emissiveMap = await loadTexture('SwordV2DetailAtlas.png', { srgb: true });
  const mesh = new THREE.Mesh(geo, mat);
  const min = rec.bboxMin, max = rec.bboxMax;
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  mesh.position.set(-cx * 0.59, -0.092 - min[1] * 0.62, -cz * 0.72);
  mesh.scale.set(0.59, 0.62, 0.72);
  const g = new THREE.Group();
  g.name = 'sword-' + appearanceId;
  g.add(mesh);
  return g;
}

function swordBasisQuat() {
  // R-16 — REMADE (approved by OWNER 2026-11-21): the sword's in-world
  // orientation (prefab +Y -> world +X, fuller up) is a REMADE choice —
  // the original's sword orientation is NOT in the extraction (no sword
  // rotation in the level0 data). Rotation mapping prefab +Y -> world
  // +X and prefab −Z -> world +Y.
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1),  // prefab +X -> world −Z
    new THREE.Vector3(1, 0, 0),   // prefab +Y -> world +X
    new THREE.Vector3(0, -1, 0),  // prefab +Z -> world −Y
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

async function buildSwordPartMesh(part) {
  const mesh = getMesh(part.mesh);
  if (!mesh) return null;
  const group = mesh.groups[0];
  const geo = new THREE.BufferGeometry();
  const n = mesh.verts;
  geo.setAttribute('position', new THREE.BufferAttribute(mesh.pos.slice(), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(mesh.nrm.slice(), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(mesh.uv.slice(), 2));
  const idx = group ? Array.from(mesh.idx.subarray(group.start, group.start + group.count)) : [];
  geo.setIndex(idx);
  let mat = await buildMaterial(part.material, data.materials[part.material]);
  // The blade's Steel + T_ForgeIron_Albedo albedo is ~0.01 linear (the
  // texture is very dark, mean RGB 47), so the bare blade renders as a
  // near-black sliver on the dark anvil. The original's blade is NOT
  // bare Steel — the runtime SwordV2 system applies the teal
  // SwordV2DetailAtlas (pid 1697) through the ForgeTax/SwordV2/Surface
  // shader (LAYOUT.md §7). The exact shader application is TODO-RE, so
  // the blade gets a documented approximation of that look: the real
  // detail atlas as an emissive map with a teal emissive tint, so the
  // blade reads as the original's veined steel instead of black. Only
  // the blade (not the fittings) gets this.
  if (part.name === 'Forged steel blade') {
    mat = mat.clone();
    mat.emissive = new THREE.Color(0.04, 0.20, 0.24);
    mat.emissiveIntensity = 0.55;
    mat.emissiveMap = await loadTexture('SwordV2DetailAtlas.png', { srgb: true });
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(part.pos[0], part.pos[1], part.pos[2]);
  m.quaternion.set(part.quat[0], part.quat[1], part.quat[2], part.quat[3]);
  m.scale.set(part.scale[0], part.scale[1], part.scale[2]);
  return m;
}

async function buildSwordGroup() {
  const g = new THREE.Group();
  g.name = 'sword';
  for (const part of data.sword.parts) {
    const m = await buildSwordPartMesh(part);
    if (m) g.add(m);
  }
  return g;
}

// Rebuild the anvil sword for the current appearance (called from
// update()). The appearance id comes from the highest grade reached +
// the sword's parent/branch (R-17). Rebuilds only when the id changes.
async function updateAnvilSword(view) {
  if (!view || !view.sword) return;
  const serial = (view.round - 1) * 3 + (view.swordIndex || 0) + 1;
  const parent = (serial - 1) % 3;
  const branch = appearanceBranch(serial);
  const grade = view.swordHighestGrade != null ? view.swordHighestGrade : view.sword.grade;
  let id = resolveAppearanceId(grade, parent, branch);
  // The 6 catalogue-only ids are never output by ResolveId; if one ever
  // appears (e.g. a future selection path), fall back to the base Blade.
  if (swordManifest && swordManifest[String(id)] && !swordManifest[String(id)].reachable) {
    id = 1;
  }
  if (id === currentAppearanceId && swordGroup) {
    const rec = swordManifest ? swordManifest[String(id)] : null;
    currentAppearanceName = rec ? rec.viName : (view.swordName || ('Kiếm #' + id));
    return;
  }
  const g = await buildCatalogueSword(id);
  if (!g) {
    // Catalogue load failed — fall back to the base Blade assembly.
    if (id !== 1 || !swordGroup) {
      const fallback = await buildSwordGroup();
      if (fallback) {
        if (swordGroup) scene.remove(swordGroup);
        swordGroup = fallback;
        const spawn = data.sword.spawn.world_position;
        swordGroup.position.set(spawn[0], spawn[1], spawn[2]);
        swordGroup.quaternion.copy(swordBasisQuat());
        scene.add(swordGroup);
      }
    }
    currentAppearanceId = 1;
    currentAppearanceName = view.swordName || 'Kiếm cũ mòn';
    return;
  }
  if (swordGroup) scene.remove(swordGroup);
  swordGroup = g;
  const spawn = data.sword.spawn.world_position;
  swordGroup.position.set(spawn[0], spawn[1], spawn[2]);
  swordGroup.quaternion.copy(swordBasisQuat());
  scene.add(swordGroup);
  currentAppearanceId = id;
  const rec = swordManifest ? swordManifest[String(id)] : null;
  currentAppearanceName = rec ? rec.viName : (view.swordName || ('Kiếm #' + id));
}

async function buildSwords() {
  // Sword on the anvil (runtime marker GO 2896, LAYOUT.md §7) — the
  // catalogue prefab for the current appearance (R-17); the base Blade
  // assembly is the fallback if the catalogue cannot load.
  const startId = 1;
  const g = await buildCatalogueSword(startId);
  if (g) {
    swordGroup = g;
    currentAppearanceId = startId;
    const rec = swordManifest ? swordManifest[String(startId)] : null;
    currentAppearanceName = rec ? rec.viName : 'Kiếm cũ mòn';
  } else {
    swordGroup = await buildSwordGroup();
    currentAppearanceId = 1;
    currentAppearanceName = 'Kiếm cũ mòn';
  }
  const spawn = data.sword.spawn.world_position;
  swordGroup.position.set(spawn[0], spawn[1], spawn[2]);
  swordGroup.quaternion.copy(swordBasisQuat());
  scene.add(swordGroup);

  // Resting swords on the transaction counter (runtime markers GO
  // 1450/506/1142, LAYOUT.md §7 — lying on the counter at
  // [0.5, 1.125/1.143/1.161, −1.579/−1.779/−1.979], NOT on the floor).
  // They are the round's un-forged swords (grade 0 -> appearance id 1).
  // Orientation is the same TODO-RE choice as the anvil sword
  // (prefab +Y -> world +X, fuller up).
  for (const mk of data.sword.resting_markers) {
    const p = mk.world_position;
    if (!p) continue;
    const s = (await buildCatalogueSword(1)) || (await buildSwordGroup());
    s.position.set(p[0], p[1], p[2]);
    s.quaternion.copy(swordBasisQuat());
    scene.add(s);
    restingSwords.push(s);
  }
}

// ---------------------------------------------------------------------------
// Hammer — the REAL working hammer (GO 2843 'Working hammer / animated
// pivot', LAYOUT.md §4): 13 parts (hickory grip, 8 leather windings,
// forged head, polished cap, leather wrap, station_Hammer redraw mesh),
// placed with their WORLD transforms inside a group at the pivot origin
// [−1.6135, 1.193, 2.0311]. The hammer RESTS on/near the anvil — it does
// NOT float mid-air (the old scene's bug).
//
// The swing rotates the group about its local Z axis through the pivot.
// Exact swing kinematics are TODO-RE (animation code, not scene data):
// raise ~49° over 130 ms, slam back over 90 ms.
// ---------------------------------------------------------------------------
async function buildHammer() {
  hammerGroup = new THREE.Group();
  hammerGroup.name = 'hammer';
  const origin = data.hammer.origin;
  hammerGroup.position.set(origin[0], origin[1], origin[2]);
  for (const part of data.hammer.parts) {
    const mesh = getMesh(part.mesh);
    if (!mesh) continue;
    // All groups of the part mesh, each with its own material.
    for (const g of mesh.groups) {
      const mid = part.materials[g.mat] || part.materials[0];
      if (!mid) continue;
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position', new THREE.BufferAttribute(mesh.pos.slice(), 3));
      gGeo.setAttribute('normal', new THREE.BufferAttribute(mesh.nrm.slice(), 3));
      gGeo.setAttribute('uv', new THREE.BufferAttribute(mesh.uv.slice(), 2));
      gGeo.setIndex(Array.from(mesh.idx.subarray(g.start, g.start + g.count)));
      const mat = await buildMaterial(mid, data.materials[mid]);
      const m = new THREE.Mesh(gGeo, mat);
      // Part position relative to the pivot origin; world quat as recorded.
      m.position.set(part.pos[0] - origin[0], part.pos[1] - origin[1], part.pos[2] - origin[2]);
      m.quaternion.set(part.quat[0], part.quat[1], part.quat[2], part.quat[3]);
      m.scale.set(part.scale[0], part.scale[1], part.scale[2]);
      hammerGroup.add(m);
    }
  }
  scene.add(hammerGroup);
}

function hammerSwingTick(dt) {
  if (hammerSwingT < 0) return;
  hammerSwingT += dt;
  // R-06 (PARTIAL) — real hammer timing (behavior.json hammer_strike,
  // ForgeTax hammerBlow, speed 1.0 in P0 — no speed relics):
  // raise 0.16s, down 0.095s (impact at 0.16+0.095 = 0.255s), return
  // offset 0.10s, return rest 0.21s. Total cycle 0.565s. The cooldown
  // (nextStrikeTime = now + 0.64/speed) is enforced in app.js.
  // The RAISE ANGLE (0.85 rad) has NO source — it is the previous SENSOR's
  // value, kept + marked (TODO-RE / R-06 remainder). Do NOT invent a new
  // angle. The return phases do not change the angle (the hammer rests
  // at 0 after the slam); they are the positional return, not modelled
  // here (the hammer group returns to rest by the angle reaching 0).
  const RAISE = 0.16, DOWN = 0.095, RETURN_OFFSET = 0.10, RETURN_REST = 0.21;
  const IMPACT = RAISE + DOWN; // 0.255s
  const TOTAL = IMPACT + RETURN_OFFSET + RETURN_REST; // 0.565s
  let angle = 0;
  if (hammerSwingT < RAISE) {
    const t = hammerSwingT / RAISE;
    angle = -0.85 * (1 - (1 - t) * (1 - t));
  } else if (hammerSwingT < IMPACT) {
    const t = (hammerSwingT - RAISE) / DOWN;
    angle = -0.85 * (1 - t * t);
  } else if (hammerSwingT < TOTAL) {
    angle = 0;
  } else {
    angle = 0;
    hammerSwingT = -1;
  }
  hammerGroup.rotation.z = angle;
  // R-24: Punch kick (ForgeFirstPerson.Punch RVA 0x241221C, cap 1.4) —
  // set at the impact moment, decays at 7/s (see the punchKick note in
  // the module state; the decay rate is a flagged approximation).
  if (hammerSwingT >= IMPACT && hammerSwingT - dt < IMPACT) {
    punchKick = 1.4;
  }
}

// ---------------------------------------------------------------------------
// Boards — the in-room displays (LAYOUT.md §5, §9). The original renders
// contract/day/quota/grade/value/chances as 3D text (Font Material) on the
// boards; we draw the same text on canvas textures placed on the board
// faces. NO DOM text frames remain.
//
// Plane basis rule (derived from the recorded text positions): the display
// face of every board is its mesh's local −Z side (the +Z side faces the
// wall / away from the player — verified for all four boards: the
// outcome-light z and the text z are all on the −Z side of the board
// centre). So: normal = the mesh +Z direction if it points toward the
// room centre, else −mesh +Z; up = mesh +Y; right = up × normal.
// Canvas positions are PROJECTED from the recorded world text anchors
// (LAYOUT.md §5), so the layout matches the original's placement.
// ---------------------------------------------------------------------------
function boardBasis(quatArr, center) {
  const q = new THREE.Quaternion(quatArr[0], quatArr[1], quatArr[2], quatArr[3]);
  const zPlus = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const yPlus = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const toCenter = new THREE.Vector3(-center[0], 1.5 - center[1], -center[2]);
  const normal = zPlus.dot(toCenter) > 0 ? zPlus : zPlus.clone().negate();
  const up = yPlus.y > 0.5 ? yPlus : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const upN = new THREE.Vector3().crossVectors(normal, right).normalize();
  return { right, up: upN, normal };
}

function makeBoardPlane(key, w, h, canvasW, canvasH) {
  const b = data.boards3d[key];
  const basis = boardBasis(b.quat, b.pos);
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const pos = new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2])
    .addScaledVector(basis.normal, b.aabb[2] / 2 + 0.002);
  mesh.position.copy(pos);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.right, basis.up, basis.normal));
  mesh.renderOrder = 2;
  scene.add(mesh);
  const plane = { key, mesh, canvas, ctx, tex, basis, center: new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2]), w, h, canvasW, canvasH };
  boardPlanes[key] = plane;
  return plane;
}

// Project a recorded world anchor onto the board canvas (pixels).
function boardXY(plane, worldPos) {
  const rel = new THREE.Vector3(worldPos[0] - plane.center.x, worldPos[1] - plane.center.y, worldPos[2] - plane.center.z);
  const lx = rel.dot(plane.basis.right);
  const ly = rel.dot(plane.basis.up);
  return [
    (lx / plane.w + 0.5) * plane.canvasW,
    (0.5 - ly / plane.h) * plane.canvasH,
  ];
}

function boardText(plane, worldPos, text, { size = 44, color = '#f0e6d6', align = 'left', weight = 700, font = BOARD_FONT, maxWidth = 0 } = {}) {
  let [x, y] = boardXY(plane, worldPos);
  const ctx = plane.ctx;
  // maxWidth (px): shrink the font until the string fits — the VI outcome
  // labels are much longer than the original's short Korean labels
  // ("ĐẠI THÀNH CÔNG" at the recorded 34px is ~240px wide, but the
  // outcome columns are only 0.253 m = 189px apart), so without this the
  // adjacent labels overlap (seen in the 2026-11-21 browser test).
  // The recorded size is kept when the string already fits.
  let px = size;
  ctx.font = `${weight} ${px}px ${font}`;
  if (maxWidth > 0) {
    const w0 = ctx.measureText(text).width;
    if (w0 > maxWidth) {
      px = Math.max(10, Math.floor(px * (maxWidth / w0)));
      ctx.font = `${weight} ${px}px ${font}`;
    }
  }
  ctx.fillStyle = color;
  // The recorded anchors sit near the board edges (LAYOUT.md §5) and the
  // canvas x-axis runs opposite to the board's local +X on some boards, so
  // a string drawn from its anchor can run off the canvas (the instrument
  // sword name and the ledger day line were clipped). Measure first and
  // flip the alignment toward the board centre so the text stays on the
  // board; the anchor stays the text's near edge. The original's text
  // pivot is TODO-RE (LAYOUT.md §10).
  // NOTE: the drop shadow below is a REMADE readability aid (the
  // original's TextMesh has no shadow) — kept so the text stays legible
  // on the unlit board planes.
  let a = align;
  const w = ctx.measureText(text).width;
  if (a === 'left' && x + w > plane.canvasW) a = 'right';
  else if (a === 'right' && x - w < 0) a = 'left';
  if (a === 'center') x = Math.max(w / 2, Math.min(plane.canvasW - w / 2, x));
  ctx.textAlign = a;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function clearBoard(plane) {
  plane.ctx.clearRect(0, 0, plane.canvasW, plane.canvasH);
  plane.tex.needsUpdate = true;
}

// --- instrument board (LAYOUT.md §5a, R-02/R-03) ---
// Board centre [−1.053, 1.596, 2.414], 1.488×0.713 m; text span
// x [−1.74, −0.37], y [1.30, 1.87] → plane 1.37 × 0.57 m.
// TextMesh anchors + colours (ui_layout.json textmesh_elements, colour
// [A,B,G,R] linear → sRGB via textMeshColorToHex; size/characterSize
// → px via textMeshPx; ALL size 128 on this board):
// sword name [−1.654, 1.821, 2.4269] #FDF8EA (128, 0.0058);
// +grade [−0.4474, 1.821, 2.3365] #FDF1CE (128, 0.0062);
// value caption '상납 가치' [−1.6555, 1.7088, 2.4071] #D3D1C5 (128,
// 0.00225) — ACTIVE, drawn in VI as 'GIÁ TRỊ CỐNG PHẨM' (fresh
// translation, marked); tribute value [−0.4589, 1.7088, 2.3176]
// #FFEBAA (128, 0.007); latest strike [−1.6567, 1.6201, 2.3915]
// #D1D0C7 (128, 0.00305); consecutive [−0.46, 1.6201, 2.302] #D3D1C5
// (128, 0.0025); outcome labels y 1.49 #F99386/#F7C786/#DADEDD/#A3EEDB/
// #FFE69A (128, 0.002617); final probability y 1.435 #9E9E97 (128,
// 0.003407); outcome lights y 1.527 (3D boxes); bars y 1.354.
// (AEGIS 2026-11-21 D2: the previous values (64, 0.012)/(48, 0.0095)
// were taken from the WRONG TextMesh entries — the [−2.7953, …] set
// belongs to a different object, not this board. The values above are
// the board's own entries, verified 2026-11-21.)
// The '강화' caption is INACTIVE in the extraction — NOT drawn.
// The latest-strike / consecutive row (y 1.62) is the dynamic row: the
// anchors are recorded, the strings are runtime values (VI translation,
// not a source string). The latest-strike label is coloured by the
// outcome (a REMADE display aid — the TextMesh default is #D1D0C7 and
// the runtime colour is unrecovered, TODO-RE).
function drawInstrument(view) {
  const p = boardPlanes.instrument;
  clearBoard(p);
  const ctx = p.ctx;
  if (!view || !view.sword) {
    boardText(p, [-1.053, 1.596, 2.414], '—', { size: 48, align: 'center' });
    return;
  }
  const s = view.sword;
  // Per-row TextMesh (size, cs) — see the header comment (AEGIS D2).
  const namePx = textMeshPx(128, 0.0058, p);
  const gradePx = textMeshPx(128, 0.0062, p);
  const tribPx = textMeshPx(128, 0.007, p);
  const valCapPx = textMeshPx(128, 0.00225, p);
  const strikePx = textMeshPx(128, 0.00305, p);
  const consecPx = textMeshPx(128, 0.0025, p);
  // R-17: the name is the CURRENT APPEARANCE's VI name (the catalogue
  // prefab's displayName, translated via vi.txt) — not the base sword's
  // name. currentAppearanceName is updated by updateAnvilSword.
  boardText(p, [-1.654, 1.821, 2.4269], currentAppearanceName || view.swordName || 'KIẾM', { size: namePx, color: '#FDF8EA' });
  boardText(p, [-0.4474, 1.821, 2.3365], '+' + s.grade, { size: gradePx, color: '#FDF1CE', align: 'right' });
  // Value caption '상납 가치' (ACTIVE) + tribute value = the sword's
  // value (the TextMesh shows the sword's value here, not the round
  // tribute — the two coincide at tribute time).
  boardText(p, [-1.6555, 1.7088, 2.4071], 'GIÁ TRỊ CỐNG PHẨM', { size: valCapPx, color: '#D3D1C5' });
  boardText(p, [-0.4589, 1.7088, 2.3176], fmtNum(s.value) + ' G', { size: tribPx, color: '#FFEBAA', align: 'right' });
  if (view.fever && view.fever.active) {
    boardText(p, [-1.6567, 1.6201, 2.3915], 'NHẬP THẦN — ' + view.fever.timeLeft.toFixed(1) + 's', { size: strikePx, color: '#ff9a4d' });
    boardText(p, [-0.46, 1.6201, 2.302], '', { size: consecPx, align: 'right' });
  } else {
    boardText(p, [-1.6567, 1.6201, 2.3915], view.lastOutcomeLabel || '—', { size: strikePx, color: view.lastOutcomeColor || '#f0e6d6' });
    boardText(p, [-0.46, 1.6201, 2.302], view.consecutive != null ? 'CHUỖI ' + view.consecutive : '', { size: consecPx, color: '#D3D1C5', align: 'right' });
  }
  // 5 outcome channels (LAYOUT.md §5a): columns at the outcome-light x
  // positions; label y 1.49, probability y 1.435, bar y 1.354 (bar grows
  // with probability — world scale x starts 0.0 in the original).
  const chans = view.channels || [];
  const outPx = textMeshPx(128, 0.002617, p);
  const probPx = textMeshPx(128, 0.003407, p);
  // Outcome label colours (ui_layout.json TextMesh, [A,B,G,R] linear →
  // sRGB via textMeshColorToHex): BREAK [1, 0.239216, 0.290196,
  // 0.94902], DAMAGE [1, 0.239216, 0.568627, 0.929412], HOLD [1,
  // 0.721569, 0.729412, 0.701961], SUCCESS [1, 0.709804, 0.858824,
  // 0.368627], GREAT [1, 0.321569, 0.788235, 1.0]. The per-column z
  // (label / probability) is the recorded TextMesh z — the board is
  // slightly tilted, so the depth varies across the columns.
  const outCols = ['#F99386', '#F7C786', '#DADEDD', '#A3EEDB', '#FFE69A'];
  const outZ = [2.3689, 2.3499, 2.3309, 2.312, 2.293];
  const probZ = [2.3592, 2.3402, 2.3212, 2.3023, 2.2833];
  chans.forEach((c, i) => {
    const lx = data.outcomeLights[i] ? data.outcomeLights[i].pos[0] : -1.565 + i * 0.253;
    const col = outCols[i] || '#f0e6d6';
    // maxWidth = the outcome column width (0.22 m, leaving a margin
    // inside the 0.253 m pitch) — the VI labels shrink to fit instead
    // of overlapping their neighbours.
    const colW = (0.22 / 1.37) * p.canvasW;
    boardText(p, [lx, 1.49, outZ[i] || 2.36], c.label, { size: outPx, color: col, align: 'center', maxWidth: colW });
    boardText(p, [lx, 1.435, probZ[i] || 2.35], c.pct.toFixed(1) + '%', { size: probPx, color: '#9E9E97', align: 'center' });
    // Probability bar: 0.20 m wide at full probability, anchored at the
    // column's left edge (x −0.10 from the light centre). The original's
    // bars are 3D (scale-x from 0); the 2D bar here reproduces the same
    // growth on the board plane.
    const [bx, by] = boardXY(p, [lx - 0.10, 1.354, 2.353]);
    const barW = (0.20 / 1.37) * p.canvasW * (c.pct / 100);
    const barH = 12;
    ctx.fillStyle = 'rgba(240,230,214,0.18)';
    ctx.fillRect(bx, by - barH / 2, (0.20 / 1.37) * p.canvasW, barH);
    ctx.fillStyle = col;
    ctx.fillRect(bx, by - barH / 2, barW, barH);
  });
  p.tex.needsUpdate = true;
}

// --- Meter_Plaque / tribute counter (LAYOUT.md §5c, R-02/R-03) ---
// Plaque centre [0.95, 0.83, −1.295]; recessed panel 1.09 × 0.26 m.
// TextMesh anchors + colours (ui_layout.json, [A,B,G,R] linear →
// sRGB; all size 64, cs per row): required number `1,800`
// [0.5, 0.9196, −1.2797] #DDD7C7 (64, 0.0085); required caption
// '검 요구가치' [1.43, 0.9196, −1.2797] #EEE6CD (64, 0.0062); placed
// number `0` [0.5, 0.7843, −1.2305] #FDF1D0 (64, 0.012); placed
// caption '올려놓은 가치' [1.43, 0.7834, −1.2301] #D3CBB8 (64,
// 0.0062). (AEGIS 2026-11-21 D2: the previous single (64, 0.012)
// for all four rows was +41% for the required number and +93% for
// the captions.) The captions are shown in VI (fresh translation,
// marked — the Korean source string is the recorded one). The
// instruction line is INACTIVE — NOT drawn; quotaMet is shown by the
// bell glint light only (see update()).
function drawMeter(view) {
  const p = boardPlanes.meter;
  clearBoard(p);
  if (!view) return;
  const reqPx = textMeshPx(64, 0.0085, p);
  const capPx = textMeshPx(64, 0.0062, p);
  const placedPx = textMeshPx(64, 0.012, p);
  boardText(p, [0.5, 0.9196, -1.2797], fmtNum(view.quota), { size: reqPx, color: '#DDD7C7' });
  boardText(p, [1.43, 0.9196, -1.2797], 'GIÁ TRỊ YÊU CẦU', { size: capPx, color: '#EEE6CD', align: 'right' });
  boardText(p, [0.5, 0.7843, -1.2305], fmtNum(view.roundTribute), { size: placedPx, color: '#FDF1D0' });
  boardText(p, [1.43, 0.7834, -1.2301], 'GIÁ TRỊ ĐÃ ĐẶT', { size: capPx, color: '#D3CBB8', align: 'right' });
  p.tex.needsUpdate = true;
}

// --- Forge Ledger (LAYOUT.md §5b, R-02/R-03) ---
// R-19 — REMADE (approved by OWNER 2026-11-21): the Ledger's frame +
// slate are INACTIVE in the level0 data — they are rendered anyway as
// the contract display surface (the live 'Live run account' text IS
// active and sits on the slate). Slate face 1.09 × 1.39 m at
// [−1.983, 1.79, 2.673], yaw −3.8° (F-02).
// The frame + slate are INACTIVE in the level0 data (see
// LEDGER_FORCE_INCLUDE in convert-scene.py) — rendered anyway as the
// contract display surface; the live 'Live run account' text IS active.
// The title, the day line and the 'Cần:'/'Đã dâng:' lines are INACTIVE
// — NOT drawn. The live content is the 5-line Live-run block at
// [−2.252, 2.185, 2.605] (ui_layout.json): the source is ONE multiline
// TextMesh '요구액\n1,800 G\n\n올려놓은 몫\n0 G', size 64, cs 0.009,
// colour #5D4932 (the Live-run text's recorded colour), line_spacing
// 1.12. (AEGIS 2026-11-21 D2: the previous (48, 0.0095) was −21% too
// small.) Line 1 the vi.txt heading "CỐNG PHẨM YÊU CẦU", line 2 the
// quota value, line 3 blank, line 4 "ĐÃ DÂNG", line 5 the tribute
// value. The anger line below is
// NOT a source string — it is a REMADE readability aid (the dragon's
// anger has no TextMesh), coloured #C7746A (the BREAK outcome colour,
// F-01) and marked as such.
function drawLedger(view) {
  const p = boardPlanes.ledger;
  clearBoard(p);
  if (!view) return;
  const px = textMeshPx(64, 0.009, p);
  const lineH = px * 1.12;
  const anchor = [-2.252, 2.185, 2.605];
  const [bx, by] = boardXY(p, anchor);
  const lines = [
    'CỐNG PHẨM YÊU CẦU',
    fmtNum(view.quota) + ' G',
    '',
    'ĐÃ DÂNG',
    fmtNum(view.roundTribute) + ' G',
  ];
  // E1 (AEGIS vòng 2): the VI title 'CỐNG PHẨM YÊU CẦU' is ~328px at the
  // recorded 27.1px — ~6.7× the original Korean '요구액' (~49px) — so a
  // bare fillText from the anchor (canvas x ≈ 384) ran off the 512px
  // canvas and clipped to 'CÔNG PH...'. The 5 lines now go through
  // boardText() (same pattern as the outcome labels): maxWidth = the
  // width from the canvas left edge to the anchor, so the title keeps
  // its recorded size and flips toward the board centre (boardText's
  // built-in flip) instead of shrinking to ~10px or clipping. The
  // anchor and the recorded (64, 0.009) size are unchanged — this is
  // an adaptation for the long VI string only. Per-line world positions
  // are stepped along the board's up vector (lineH px → metres).
  const maxW = Math.floor(bx);
  const stepM = (lineH * p.h) / p.canvasH;
  lines.forEach((line, i) => {
    if (!line) return;
    const wp = [
      anchor[0] - p.basis.up.x * i * stepM,
      anchor[1] - p.basis.up.y * i * stepM,
      anchor[2] - p.basis.up.z * i * stepM,
    ];
    boardText(p, wp, line, { size: px, color: '#5D4932', align: 'left', maxWidth: maxW });
  });
  if (view.anger > 0) {
    boardText(p, [-1.98, 1.45, 2.632], 'Cơn giận của rồng: ' + view.anger + '/3', { size: 36, color: '#C7746A' });
  }
  p.tex.needsUpdate = true;
}

// --- Round calendar (LAYOUT.md §5d, R-02/R-03/R-26) ---
// The 31 day numbers are recorded TextMesh labels (ui_layout.json,
// size 80, cs 0.0065, colour [1, 0.070588, 0.113725, 0.160784] ABGR ->
// #705E49 sRGB): day 1 at [−2.5917, 2.1219, 2.8238], 7 columns
// (pitch 0.1047 m), 5 rows (pitch 0.1324 m), the row sloping −0.0022 m
// per column (the calendar's slight −0.6° Z rotation). The month
// '4월' is at [−2.274, 2.2851, 2.8214] (size 80, cs 0.014125, same
// colour) — shown in VI as 'Tháng 4' (vi.txt calendar.month.4).
// Paper size (R-26): the text span is x [−2.6028, −1.9633] (0.64 m),
// y [1.5878, 2.2851] (0.70 m) — the paper is TALLER than wide, so the
// old 0.85×0.55 is wrong in both dimensions and ratio. The plane is
// 0.70×0.76 (0.03 m margins), canvas 512×556 — an APPROXIMATION
// (the paper has no mesh; only the text span is measured), awaiting
// OWNER approval of the exact size.
function drawCalendar(view) {
  const p = boardPlanes.calendar;
  const ctx = p.ctx;
  clearBoard(p);
  // Paper background (the original's paper is a 3D text object with no
  // mesh; a plain paper-coloured plane stands in for it — REMADE).
  ctx.fillStyle = '#d8c9a8';
  ctx.fillRect(0, 0, p.canvasW, p.canvasH);
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, p.canvasW - 8, p.canvasH - 8);
  const monthPx = textMeshPx(80, 0.014125, p);
  boardText(p, [-2.274, 2.2851, 2.8214], 'Tháng 4', { size: monthPx, color: '#705E49', align: 'center' });
  // 31 days in a 7×5 grid, at the recorded positions (formula fit to the
  // 31 recorded anchors, max error < 1 mm).
  const dayPx = textMeshPx(80, 0.0065, p);
  ctx.font = `700 ${dayPx}px ${BOARD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 1; d <= 31; d++) {
    const col = (d - 1) % 7;
    const row = Math.floor((d - 1) / 7);
    const wx = -2.5917 + col * 0.1047;
    const wy = 2.1219 - row * 0.1324 - col * 0.00218;
    const [x, y] = boardXY(p, [wx, wy, 2.8238]);
    if (view && d === view.round && view.round <= 31) {
      // The current-day circle is a REMADE readability aid (the
      // original's marker is not in the extraction) — red ring, as before.
      ctx.strokeStyle = '#a03028';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, dayPx * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = view && d === view.round ? '#a03028' : '#705E49';
    ctx.fillText(String(d), x, y);
  }
  p.tex.needsUpdate = true;
}

// --- outcome lights (3D boxes on the instrument board) ---
// 5 thin boxes (0.224 × 0.006 × 0.002 m) at the recorded positions
// (LAYOUT.md §5a), colours = the real 'Outcome light 0..4' materials.
// The latest outcome's light glows; the others sit dim.
// R-14 — TODO-RE (STILL MISSING, remake proposal — NOT in the v2 data):
// the flash behaviour (base emissive 0.35, decay 1.2/s, flash +2.2)
// is the previous SENSOR's invention, KEPT + marked. The outcome
// light flash (R-14) was never recovered by CIPHER; do not present
// these three numbers as source data.
function buildOutcomeLights() {
  for (const rec of data.outcomeLights) {
    const col = new THREE.Color(rec.color[0], rec.color[1], rec.color[2]);
    const mat = new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rec.size[0], rec.size[1], rec.size[2]), mat);
    mesh.position.set(rec.pos[0], rec.pos[1], rec.pos[2]);
    mesh.quaternion.set(rec.quat[0], rec.quat[1], rec.quat[2], rec.quat[3]);
    scene.add(mesh);
    outcomeLightMeshes.push({ index: rec.index, mesh, mat, flash: 0 });
  }
}

function flashOutcomeLight(idx) {
  const rec = outcomeLightMeshes.find((r) => r.index === idx);
  if (rec) rec.flash = 1;
}

function outcomeLightsTick(dt) {
  // R-14 — TODO-RE: the decay 1.2/s and flash +2.2 are NOT source
  // data (see buildOutcomeLights). The base 0.35 is the recorded
  // emissive intensity of the outcome-light materials.
  for (const rec of outcomeLightMeshes) {
    if (rec.flash > 0) rec.flash = Math.max(0, rec.flash - dt * 1.2);
    rec.mat.emissiveIntensity = 0.35 + rec.flash * 2.2;
  }
}

// --- relic wall slots (LAYOUT.md §4/§5) ---
// 8 'Permanent item slot N' on the −X wall at x −2.638,
// y 1.071 (slots 1–4) / 1.551 (slots 5–8), z 0.752/1.187/1.622/2.057.
// Each owned relic gets a small name plane at its slot (facing +X).
// NOTE: no Vietnamese relic names exist in the game data — the VI names
// are our translation (see KE-HOACH-P0-P1-P2.md) and are shown as such.
function buildRelicSlots() {
  for (const slot of data.relicSlots) {
    const basis = boardBasis(
      slot.quat,
      slot.pos,
    );
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.105), mat);
    const pos = new THREE.Vector3(slot.pos[0], slot.pos[1], slot.pos[2])
      .addScaledVector(basis.normal, 0.06);
    mesh.position.copy(pos);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.right, basis.up, basis.normal));
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);
    relicSlotPlanes.push({ slot: slot.slot, mesh, canvas, ctx, tex });
  }
}

function drawRelicSlots(relicNames) {
  relicSlotPlanes.forEach((rec, i) => {
    const name = relicNames[i];
    if (!name) { rec.mesh.visible = false; return; }
    // R-02/R-03: the slot label is the relic FAMILY name (27px, #EEE0BB)
    // + the slot number (20px, #BBB7AF), side by side, centred as a pair
    // (ui_layout.json relic-slot TextMesh: 'Relic family' size 64, cs
    // 0.007, colour [1.0, 0.501961, 0.74902, 0.85098] ABGR linear →
    // #EEE0BB sRGB; 'Engraved slot number' size 64, cs 0.005, colour
    // [1.0, 0.431373, 0.478431, 0.501961] ABGR linear → #BBB7AF sRGB;
    // both hex within ±1 of the converted TextMesh colours, so the
    // numbers are kept as-is. An earlier comment quoted different
    // arrays that are not in ui_layout.json — corrected 2026-11-21,
    // AEGIS vòng 2 O2.)
    // The pair shrinks to fit the 256px canvas if the family name is
    // long (the VI names are longer than the original's short labels).
    rec.ctx.clearRect(0, 0, 256, 64);
    rec.ctx.textBaseline = 'middle';
    rec.ctx.shadowColor = 'rgba(0,0,0,0.9)';
    rec.ctx.shadowBlur = 5;
    let namePx = 27, numPx = 20;
    rec.ctx.font = `700 ${namePx}px ${BOARD_FONT}`;
    const nameW0 = rec.ctx.measureText(name).width;
    rec.ctx.font = `700 ${numPx}px ${BOARD_FONT}`;
    const numW0 = rec.ctx.measureText(String(rec.slot)).width;
    const gap = 8;
    if (nameW0 + gap + numW0 > 250) {
      const s = 250 / (nameW0 + gap + numW0);
      namePx = Math.max(12, Math.floor(namePx * s));
      numPx = Math.max(10, Math.floor(numPx * s));
    }
    rec.ctx.font = `700 ${namePx}px ${BOARD_FONT}`;
    const nameW = rec.ctx.measureText(name).width;
    rec.ctx.font = `700 ${numPx}px ${BOARD_FONT}`;
    const numW = rec.ctx.measureText(String(rec.slot)).width;
    const total = nameW + gap + numW;
    let x = (256 - total) / 2;
    rec.ctx.font = `700 ${namePx}px ${BOARD_FONT}`;
    rec.ctx.fillStyle = '#EEE0BB';
    rec.ctx.textAlign = 'left';
    rec.ctx.fillText(name, x, 32);
    rec.ctx.font = `700 ${numPx}px ${BOARD_FONT}`;
    rec.ctx.fillStyle = '#BBB7AF';
    rec.ctx.fillText(String(rec.slot), x + nameW + gap, 32);
    rec.ctx.shadowBlur = 0;
    rec.tex.needsUpdate = true;
    rec.mesh.visible = true;
  });
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
function fmtNum(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function loadSpriteTexture(png) {
  // cfxr sprites are R-channel masks (G=B=0, A=255) — used as a map with
  // a warm colour and additive blending, the R mask reads as a hot glow.
  return loadTexture(png, { srgb: false });
}

// ---------------------------------------------------------------------------
// Particles — real ParticleSystem params (R-10/R-11/R-12/R-13).
// Source: scene-layout/effects.json (118 systems, 10 level0) + EFFECTS.md.
// The real modules are SizeModule (size 1.0 -> 0.0 over life) +
// ColorModule (alpha fades over life) — reproduced per particle by the
// ShaderMaterial below (attributes aSize / aLife / aMaxLife). The
// texture mask channel differs per texture (verified by reading the PNGs):
//   cfxr_* sprites: R-channel mask (G=B=0, A=255) -> maskMode 0
//   SoftParticle.png: white blob, alpha mask -> maskMode 1
//   SoftFlame.png: baked orange RGB + alpha mask -> maskMode 2
//     (fragment rgb = tex.rgb * color, i.e. Unity's texture x startColor)
// The emission is RATE-BASED (rateOverTime) for flame/embers/dust —
// the old quality tiers (low/medium/high counts) are REMOVED (the
// original has no quality tiers). The sparks are event-driven (rate 0).
// ---------------------------------------------------------------------------
const PARTICLE_VERT = `
attribute float aSize;
attribute float aLife;
attribute float aMaxLife;
varying float vAlpha;
uniform float uScale;
void main() {
  float t = clamp(aLife / max(aMaxLife, 0.0001), 0.0, 1.0);
  vAlpha = t;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * t * (uScale / max(-mv.z, 0.01));
  gl_Position = projectionMatrix * mv;
}`;
const PARTICLE_FRAG = `
uniform sampler2D map;
uniform vec3 color;
uniform float opacity;
uniform int maskMode;
varying float vAlpha;
void main() {
  vec4 tex = texture2D(map, gl_PointCoord);
  float mask = maskMode == 0 ? tex.r : tex.a;
  vec3 rgb = maskMode == 2 ? tex.rgb * color : color;
  float a = mask * vAlpha * opacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(rgb, a);
}`;

let particlePxScale = 360; // 0.5 * drawing-buffer height (matches THREE PointsMaterial)
let softDotTex = null;

function makeSoftDotTexture() {
  // Procedural soft dot for the textureless dust systems (Cold/Shelf
  // have NO texture in the extraction — a soft white blob with an alpha
  // mask, REMADE stand-in).
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makePointsSystem(maxP, tex, color, opacity, blending, maskMode) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(maxP * 3);
  const aSize = new Float32Array(maxP);
  const aLife = new Float32Array(maxP);
  const aMaxLife = new Float32Array(maxP);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1));
  geo.setAttribute('aMaxLife', new THREE.BufferAttribute(aMaxLife, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex },
      color: { value: color },
      opacity: { value: opacity },
      maskMode: { value: maskMode },
      uScale: { value: particlePxScale },
    },
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: blending || THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return {
    points, mat, geo, pos, aSize, aLife, aMaxLife,
    vel: new Float32Array(maxP * 3),
    count: maxP, cursor: 0, emitAcc: 0, rate: 0, gravity: 0,
  };
}

function findDeadSlot(s) {
  for (let k = 0; k < s.count; k++) {
    const i = (s.cursor + k) % s.count;
    if (s.aLife[i] <= 0) { s.cursor = (i + 1) % s.count; return i; }
  }
  return -1;
}

function tickParticles(s, dt, spawnFn) {
  if (s.rate > 0) {
    s.emitAcc += s.rate * dt;
    let n = Math.floor(s.emitAcc);
    s.emitAcc -= n;
    for (let k = 0; k < n; k++) {
      const i = findDeadSlot(s);
      if (i < 0) break;
      spawnFn(s, i);
    }
  }
  for (let i = 0; i < s.count; i++) {
    if (s.aLife[i] <= 0) continue;
    s.aLife[i] -= dt;
    if (s.aLife[i] <= 0) { s.aLife[i] = 0; continue; }
    if (s.gravity) s.vel[i * 3 + 1] -= s.gravity * dt;
    s.pos[i * 3] += s.vel[i * 3] * dt;
    s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
    s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
  }
  s.geo.attributes.position.needsUpdate = true;
  s.geo.attributes.aLife.needsUpdate = true;
  s.geo.attributes.aSize.needsUpdate = true;
  s.geo.attributes.aMaxLife.needsUpdate = true;
  s.mat.uniforms.uScale.value = particlePxScale;
}

// R-10 — Low flame (effects.json level0 'Low flame / licking above the
// coals'): pos [2.1324, 1.2, 1.8185], maxP 40, life 0.3-0.75s, speed 0.3,
// size 0.08-0.18, emit 30/s, shape Box [1.13, 0.33, 0.025], texture
// SoftParticle, baseColor [1.0, 0.39, 0.045, 1.0] (the material colour;
// startColor is white). The flame rises (velocity +Y).
function buildFlames() {
  const tex = texCache.get('SoftParticle.png');
  if (!tex) return;
  flameSystem = makePointsSystem(40, tex, new THREE.Color(1.0, 0.39, 0.045), 1.0, THREE.AdditiveBlending, 1);
  flameSystem.rate = 30;
  flameSystem.origin = [2.1324, 1.2, 1.8185];
  flameSystem.spawn = (s, i) => {
    s.pos[i * 3] = s.origin[0] + (Math.random() - 0.5) * 1.13;
    s.pos[i * 3 + 1] = s.origin[1] + (Math.random() - 0.5) * 0.33;
    s.pos[i * 3 + 2] = s.origin[2] + (Math.random() - 0.5) * 0.025;
    s.vel[i * 3] = (Math.random() - 0.5) * 0.1;
    s.vel[i * 3 + 1] = 0.3;
    s.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    s.aMaxLife[i] = 0.3 + Math.random() * 0.45;
    s.aLife[i] = s.aMaxLife[i];
    s.aSize[i] = 0.08 + Math.random() * 0.10;
  };
}

function flamesTick(dt) {
  if (!flameSystem) return;
  tickParticles(flameSystem, dt, flameSystem.spawn);
  // R-15 (PARTIAL): the fireLight stays at its real intensity 20 — the
  // old invented Fever boost to 26 is REMOVED. The Fever radiance is a
  // separate light (feverRadiance, driven in update()).
}

// R-11 — Draft embers (effects.json level0 'Draft embers'): pos
// [2.0013, 1.25, 1.681], maxP 90, life 1.9s, speed 0.45, size 0.021,
// emit 8/s, shape Box [1.1, 0.05, 0.45], same colour/texture as the
// flame ([1.0, 0.39, 0.045], SoftParticle). Rate-based — NO quality
// tiers (the old low/medium/high counts are removed).
function buildEmbers() {
  const tex = texCache.get('SoftParticle.png');
  if (!tex) return;
  emberSystem = makePointsSystem(90, tex, new THREE.Color(1.0, 0.39, 0.045), 1.0, THREE.AdditiveBlending, 1);
  emberSystem.rate = 8;
  emberSystem.origin = [2.0013, 1.25, 1.681];
  emberSystem.spawn = (s, i) => {
    s.pos[i * 3] = s.origin[0] + (Math.random() - 0.5) * 1.1;
    s.pos[i * 3 + 1] = s.origin[1] + (Math.random() - 0.5) * 0.05;
    s.pos[i * 3 + 2] = s.origin[2] + (Math.random() - 0.5) * 0.45;
    s.vel[i * 3] = (Math.random() - 0.5) * 0.2;
    s.vel[i * 3 + 1] = 0.45;
    s.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    s.aMaxLife[i] = 1.9;
    s.aLife[i] = 1.9;
    s.aSize[i] = 0.021;
  };
}

function embersTick(dt) {
  if (!emberSystem) return;
  tickParticles(emberSystem, dt, emberSystem.spawn);
}

// R-12 — ambient dust (effects.json level0, 4 systems; F-05: the count
// is 4, not 3 — the filter matches Warm/Cold/Shelf + Dust-and-stone, but
// the correct ambient 4 are Warm/Cold/Shelf/Lazy soot; Dust-and-stone is
// a one-shot dragon-visit effect, excluded). All: life 8-12s, speed
// 0.012-0.035, size 0.004-0.01, emit 2/s, maxP 32, drift velocity
// (0.008, 0.013, 0.004) — except Lazy soot (maxP 24, life 2.5s, speed
// 0.2, size 0.18-0.35, emit 4/s, colour [0.25, 0.29, 0.3, 0.13]).
// Colours are the recorded startColors (linear, converted by THREE):
// Warm [0.9, 0.65, 0.32, 0.3], Cold [0.46, 0.63, 0.52, 0.19],
// Shelf [0.9, 0.74, 0.43, 0.2]. Warm uses SoftFlame; Cold/Shelf have NO
// texture (procedural soft dot); Lazy soot uses SoftParticle.
// The spawn volume IS in the data (effects.json shape.typeName = Box
// + shape.scale per system — AEGIS 2026-11-21 D4: the earlier comment
// claiming the shape type was unrecovered was wrong): Warm
// [0.85, 0.8, 0.65], Cold [1.2, 0.95, 0.4], Shelf [0.3, 0.7, 1.3],
// Lazy [0.7, 0.3, 0.03] — the box's full size in metres around the
// recorded origin.
function buildDust() {
  const softFlame = texCache.get('SoftFlame.png');
  const softParticle = texCache.get('SoftParticle.png');
  if (!softDotTex) softDotTex = makeSoftDotTexture();
  const defs = [
    { name: 'Warm dust', pos: [-1.1932, 2.023, 2.1662], box: [0.85, 0.8, 0.65], color: [0.9, 0.65, 0.32], alpha: 0.3, tex: softFlame, mode: 2, maxP: 32, rate: 2, life: [8, 12], size: [0.004, 0.01], speed: [0.012, 0.035] },
    { name: 'Cold dust', pos: [0.95, 1.855, -1.289], box: [1.2, 0.95, 0.4], color: [0.46, 0.63, 0.52], alpha: 0.19, tex: softDotTex, mode: 1, maxP: 32, rate: 2, life: [8, 12], size: [0.004, 0.01], speed: [0.012, 0.035] },
    { name: 'Shelf dust', pos: [-2.468, 1.746, 1.174], box: [0.3, 0.7, 1.3], color: [0.9, 0.74, 0.43], alpha: 0.2, tex: softDotTex, mode: 1, maxP: 32, rate: 2, life: [8, 12], size: [0.004, 0.01], speed: [0.012, 0.035] },
    { name: 'Lazy soot', pos: [2.2429, 1.67, 1.9342], box: [0.7, 0.3, 0.03], color: [0.25, 0.29, 0.3], alpha: 0.13, tex: softParticle, mode: 1, maxP: 24, rate: 4, life: [2.5, 2.5], size: [0.18, 0.35], speed: [0.2, 0.2] },
  ];
  for (const d of defs) {
    if (!d.tex) continue;
    const sys = makePointsSystem(d.maxP, d.tex, new THREE.Color(d.color[0], d.color[1], d.color[2]), d.alpha, THREE.NormalBlending, d.mode);
    sys.rate = d.rate;
    sys.origin = d.pos;
    sys.spawn = (s, i) => {
      // Random point in the recorded Box (shape.scale, full size) —
      // effects.json shape.typeName = Box (AEGIS D4).
      s.pos[i * 3] = s.origin[0] + (Math.random() - 0.5) * d.box[0];
      s.pos[i * 3 + 1] = s.origin[1] + (Math.random() - 0.5) * d.box[1];
      s.pos[i * 3 + 2] = s.origin[2] + (Math.random() - 0.5) * d.box[2];
      const sp = d.speed[0] + Math.random() * (d.speed[1] - d.speed[0]);
      const dl = Math.hypot(0.008, 0.013, 0.004);
      s.vel[i * 3] = (0.008 / dl) * sp;
      s.vel[i * 3 + 1] = (0.013 / dl) * sp;
      s.vel[i * 3 + 2] = (0.004 / dl) * sp;
      s.aMaxLife[i] = d.life[0] + Math.random() * (d.life[1] - d.life[0]);
      s.aLife[i] = s.aMaxLife[i];
      s.aSize[i] = d.size[0] + Math.random() * (d.size[1] - d.size[0]);
    };
    dustSystems.push(sys);
  }
}

function dustTick(dt) {
  for (const s of dustSystems) {
    tickParticles(s, dt, s.spawn);
  }
}

// R-13 — Hammer sparks (effects.json level0 'Hammer sparks'): pos
// [-1.1897, 1.24, 2.2], maxP 90, life 0.44s, speed 2.3, size 0.018,
// gravity 1.4, emit 0/s (event-driven — one burst per strike), shape
// Hemisphere radius 0.05, angle 16° (a narrow cone around +Y).
// The BURST COUNT per strike is NOT in the data (the PS emits 0/s and
// the caller count is not in the extraction) — the quality-tier counts
// below are the previous SENSOR's values, KEPT + marked (R-13 partial,
// awaiting a trace of the strike caller or OWNER remake approval).
// Do NOT present them as data.
function spawnBurst(kind) {
  const tex = texCache.get('cfxr_electric_spark.png');
  if (!tex) return;
  // TODO-RE / R-13: the per-strike burst count is NOT in the data.
  const counts = { low: 10, medium: 24, high: 48 };
  const n = (counts[quality] || 24) * (kind === 'break' ? 2 : 1);
  // TODO-RE / R-13: the per-kind burst TINTS are NOT in the data
  // either. The 'Hammer sparks' PS startColor is WHITE [1,1,1,1]
  // (effects.json, initial.startColor); the orange [1.0, 0.39, 0.045,
  // 1.0] is the _BaseColor of the SoftEmber material (pid 141) the PS
  // renders with — the particle colour in the original is texture ×
  // material colour, startColor contributes nothing. (An earlier
  // comment wrongly called [1.0, 0.39, 0.045, 1.0] the PS startColor —
  // corrected 2026-11-21, AEGIS vòng 2 O2.) The three tints below are
  // the previous SENSOR's, KEPT + marked; do not present them as
  // source data.
  const colors = {
    strike: new THREE.Color(1.0, 0.72, 0.3),
    great: new THREE.Color(1.0, 0.85, 0.3),
    break: new THREE.Color(1.0, 0.32, 0.15),
  };
  const sys = makePointsSystem(n, tex, colors[kind] || colors.strike, 0.95, THREE.AdditiveBlending, 0);
  sys.gravity = 1.4;
  const origin = [-1.1897, 1.24, 2.2];
  for (let i = 0; i < n; i++) {
    // Spawn in the hemisphere disc (radius 0.05, XZ plane).
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.05;
    sys.pos[i * 3] = origin[0] + Math.cos(a) * r;
    sys.pos[i * 3 + 1] = origin[1];
    sys.pos[i * 3 + 2] = origin[2] + Math.sin(a) * r;
    // Velocity: speed 2.3 in a 16° cone around +Y.
    const th = Math.random() * Math.PI * 2;
    const cone = Math.random() * (16 * Math.PI / 180);
    sys.vel[i * 3] = Math.sin(cone) * Math.cos(th) * 2.3;
    sys.vel[i * 3 + 1] = Math.cos(cone) * 2.3;
    sys.vel[i * 3 + 2] = Math.sin(cone) * Math.sin(th) * 2.3;
    sys.aMaxLife[i] = 0.44;
    sys.aLife[i] = 0.44;
    sys.aSize[i] = 0.018;
  }
  sys.geo.attributes.position.needsUpdate = true;
  sys.geo.attributes.aLife.needsUpdate = true;
  sys.geo.attributes.aSize.needsUpdate = true;
  sys.geo.attributes.aMaxLife.needsUpdate = true;
  sparkBursts.push(sys);
}

function burstsTick(dt) {
  for (let b = sparkBursts.length - 1; b >= 0; b--) {
    const s = sparkBursts[b];
    let alive = false;
    for (let i = 0; i < s.count; i++) {
      if (s.aLife[i] <= 0) continue;
      alive = true;
      s.aLife[i] -= dt;
      if (s.aLife[i] <= 0) { s.aLife[i] = 0; continue; }
      s.vel[i * 3 + 1] -= s.gravity * dt;
      s.pos[i * 3] += s.vel[i * 3] * dt;
      s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
      s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.aLife.needsUpdate = true;
    if (!alive) {
      scene.remove(s.points);
      s.points.geometry.dispose();
      s.points.material.dispose();
      sparkBursts.splice(b, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Camera + input
// ---------------------------------------------------------------------------
function dirToYawPitch(d) {
  // Three.js YXZ: forward = (−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)
  const len = Math.hypot(d[0], d[1], d[2]);
  const nx = d[0] / len, ny = d[1] / len, nz = d[2] / len;
  const pitch = Math.asin(clamp(ny, -1, 1));
  const yaw = Math.atan2(-nx, -nz);
  return { yaw, pitch };
}

function applyCamera(dt) {
  // R-24 — work view (behavior.json forge_first_person, BEHAVIOR.md §1):
  // pitch = workLookPitch = 10° when working (the old lookAt -14° is
  // dropped); FOV = lerp(69, 61, clamp01(workBlend)) + kick * 0.35
  // (DAT 0.35); pitch = workPitch - kick (Punch, cap 1.4).
  // R-07 — Fever / reward / quake shake (ForgeFirstPerson.LateUpdate
  // RVA 0x2411160, BEHAVIOR.md §1.3-1.4). All angles below are DEGREES
  // (the decompile multiplies by the deg2rad factor); the axis assignment
  // (which frequency drives yaw vs pitch vs roll) is NOT in behavior.json
  // — the mapping used here (81 Hz yaw / 67 Hz pitch / 23 Hz roll for
  // Fever; 83 Hz yaw / 97 Hz pitch for reward) is a documented
  // approximation, flagged TODO-RE. The 81 Hz Fever coefficient is hidden
  // inside an opaque call in the decompile — assumed 0.38° (same as the
  // 67 Hz component), flagged TODO-RE.
  if (dt) {
    punchKick = Math.max(0, punchKick - 7 * dt);
    rewardImpulse = Math.max(0, rewardImpulse - 7 * dt);
    quakeAmount = Math.max(0, quakeAmount - 0.9 * dt);
    rewardAge += dt;
    quakeAge += dt;
  }
  const DEG = Math.PI / 180;
  let px = 0, py = 0, yaw = 0, pitch = 0, roll = 0, fovDelta = 0;
  // Fever shake (only while working and power > 0). The age is the
  // per-frame interpolated FeverAge (see the feverAge* module vars —
  // update() only runs every 0.2 s during Fever, too coarse for a
  // ~15 Hz shake). The FeverAge helper's Max/Min reading is flagged
  // (CIPHER M9, unverified), not absolute.
  if (feverOn) {
    const age = feverAgeBase + (animT - feverAgeT0) * feverAgeRate;
    const amount = feverAmount;
    const power = amount * (1.0 * 0.6 + 0.7); // impact 1.0 -> amount * 1.3
    if (power > 0) {
      px += power * Math.sin(93 * age) * 0.013;
      // TODO-RE / R-07 (AEGIS 2026-11-21 D5): feverShake has NO Y
      // amplitude (behavior.json feverShake = {x 0.013, z 1.15, rot
      // 0.38, fovAmp 1.4}) — the 0.009 below is BORROWED from
      // rewardShake.y (0.009) and the Fever Y amplitude is unrecovered.
      py += power * Math.cos(117 * age) * 0.009;
      yaw += power * Math.sin(81 * age) * 0.38 * DEG;
      pitch += power * Math.sin(67 * age) * 0.38 * DEG;
      roll += power * Math.sin(23 * age) * 1.15 * DEG;
      // The Fever FOV offset is SUBTRACTED (zoom-in), not added.
      fovDelta -= power * (Math.sin(32 * age) * 1.4 + 2.5);
    }
  }
  // Reward shake (on a Great; impulse set in update()).
  if (rewardImpulse > 0) {
    px += rewardImpulse * Math.sin(103 * rewardAge) * 0.006;
    py += rewardImpulse * Math.cos(89 * rewardAge) * 0.009;
    yaw += rewardImpulse * Math.sin(83 * rewardAge) * 0.32 * DEG;
    pitch += rewardImpulse * Math.cos(97 * rewardAge) * 0.40 * DEG;
    fovDelta += rewardImpulse * (-1.1);
  }
  // Quake shake (dragon visit, P2 — not triggered in P0; constants
  // recorded from behavior.json quakeShake, no caller yet).
  if (quakeAmount > 0) {
    px += quakeAmount * Math.sin(61 * quakeAge) * 0.016;
    py += quakeAmount * Math.sin(47 * quakeAge + 1.3) * 0.022;
    yaw += quakeAmount * Math.sin(53 * quakeAge) * 0.6 * DEG;
    pitch += quakeAmount * Math.sin(37 * quakeAge) * 1.1 * DEG;
    roll += quakeAmount * Math.sin(71 * quakeAge) * 0.6 * DEG; // TODO-RE: 3rd coeff unrecovered
  }
  // Punch kick (R-24): FOV + kick*0.35, pitch - kick (degrees).
  fovDelta += punchKick * 0.35;
  pitch -= punchKick * DEG;
  camera.rotation.set(viewPitch + pitch, viewYaw + yaw, roll, 'YXZ');
  camera.position.set(
    data.camera.eye[0] + px,
    data.camera.eye[1] + py,
    data.camera.eye[2],
  );
  const fov = 69 + (61 - 69) * clamp(workBlend, 0, 1) + fovDelta;
  if (Math.abs(camera.fov - fov) > 0.001) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

// Tap targets — invisible Box3 proxies at the real ForgeInteractable
// positions (LAYOUT.md §4). Raycast is math-only (no proxy meshes).
//   strike: anvil striking face [−1.07, 1.125, 2.19] (1.20×0.46 m) + sword
//   tribute: service window counter [0.95, 1.01, −1.84] + bell [1.654, 1.17, −1.609]
//   endday: Forge Ledger [−1.988, 1.79, 2.752] / Round calendar [−2.282, 1.901, 2.854]
const TAP_BOXES = [
  { action: 'strike', min: [-2.05, 0.85, 1.8], max: [-0.55, 1.45, 2.6] },
  { action: 'tribute', min: [0.0, 0.9, -2.3], max: [1.95, 1.7, -1.35] },
  { action: 'endday', min: [-2.69, 0.94, 2.55], max: [-1.29, 2.64, 2.85] },
  { action: 'endday', min: [-2.78, 1.55, 2.75], max: [-1.78, 2.25, 2.95] },
];

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _box = new THREE.Box3();
const _hit = new THREE.Vector3();

function pickAt(clientX, clientY) {
  if (!readyFlag || !camera) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  let best = null, bestDist = Infinity;
  for (const b of TAP_BOXES) {
    _box.min.set(b.min[0], b.min[1], b.min[2]);
    _box.max.set(b.max[0], b.max[1], b.max[2]);
    const hit = _ray.ray.intersectBox(_box, _hit);
    if (hit) {
      const dist = _ray.ray.origin.distanceTo(_hit);
      if (dist < bestDist) { bestDist = dist; best = b.action; }
    }
  }
  return best;
}

function debugTargetPoint(name) {
  if (!readyFlag || !camera) return { x: 0, y: 0, visible: false };
  const t = data.targets[name];
  if (!t) return { x: 0, y: 0, visible: false };
  const v = new THREE.Vector3(t.point[0], t.point[1], t.point[2]).project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
    visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
  };
}

// ---------------------------------------------------------------------------
// Broken swords on the floor (settings.floor_swords cap, R-20 default 30).
// The original has a floor_swords setting ("Số kiếm tối đa trên sàn"), so
// broken swords accumulate on the floor at runtime — but no floor-sword
// objects exist in level0 (they are runtime-spawned), so their exact form
// and placement are TODO-RE (R-18, awaiting OWNER remake approval).
// R-17: the broken sword keeps the APPEARANCE it had at break (the
// catalogue prefab for currentAppearanceId); the base Blade assembly is
// the fallback if the catalogue cannot load. P0 shows it lying flat on
// the floor in front of the anvil, up to the cap, oldest removed first.
// (The 3 counter swords are NOT floor swords and are always shown.)
// ---------------------------------------------------------------------------
function addBrokenSword() {
  if (!swordGroup) return;
  const i = brokenSwords.length;
  const appearanceId = currentAppearanceId;
  buildCatalogueSword(appearanceId).then((g) => g || buildSwordGroup()).then((g) => {
    const x = -1.7 + (i % 3) * 0.45;
    const z = 1.35 + Math.floor(i / 3) * 0.35;
    g.position.set(x, 0.06, z);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.5);
    g.quaternion.copy(yawQ).multiply(swordBasisQuat());
    scene.add(g);
    brokenSwords.push(g);
    while (brokenSwords.length > floorSwordCap) {
      const old = brokenSwords.shift();
      scene.remove(old);
    }
  });
}

// ---------------------------------------------------------------------------
// Public API (used by app.js)
// ---------------------------------------------------------------------------
function feverEnvelope(age) {
  // FeverEnvelope (behavior.json fever, BEHAVIOR.md §3.2): window
  // [0, 3.8), full from 2.8; the 0..2.8 ramp is a hash-gated fade
  // (see the note in applyCamera). Outside the window the amount is 0.
  if (age < 0 || age >= 3.8) return 0;
  if (age >= 2.8) return 1.0;
  const ap = age - 2.8;
  const h = ((ap * 7 + ap * ap * 3) % 1 + 1) % 1;
  const threshold = clamp(age, 0, 1) * (-0.56) + 0.72;
  return h < threshold ? age * (-0.55) + 1.0 : 0;
}

function feverRadianceTick() {
  // R-15 (PARTIAL) — Fever presentation radiance (behavior.json fever):
  // radianceIntensity = amount * (sin(age*35) + impact*3.5 + 2.2),
  // radianceOffset 0.06, FeverColor = HSV(frac(age*0.72 + hueBase), 0.88,
  // 1.0). The hueBase is NOT extracted — 0 is used, flagged TODO-RE.
  // The emission params (emitPerSec = age*150*amount, emitBurstMax 35,
  // emitBegin 90) are recorded but NOT reproduced: the emitting particle
  // system is not identified in the level0 PS list (TODO-RE).
  if (!feverRadiance) return;
  if (!feverOn) {
    feverRadiance.intensity = 0;
    feverAmount = 0;
    return;
  }
  const age = feverAgeBase + (animT - feverAgeT0) * feverAgeRate;
  const amount = feverEnvelope(age);
  feverAmount = amount;
  const power = amount * 1.3; // impact 1.0 -> amount * (1.0*0.6 + 0.7)
  feverRadiance.intensity = amount * (Math.sin(age * 35) + 1.0 * 3.5 + 2.2);
  const hue = ((age * 0.72) % 1 + 1) % 1; // hueBase 0 (TODO-RE)
  // HSV (0.88, 1.0) -> HSL (1.0, 0.56).
  feverRadiance.color.setHSL(hue, 1.0, 0.56);
  // The position is set once in buildLights (0.4 m above the sword —
  // see the TODO-RE note there); it is not re-set here.
}

function update(view) {
  if (!readyFlag) return;
  lastView = view;
  drawInstrument(view);
  drawMeter(view);
  drawLedger(view);
  drawCalendar(view);
  drawRelicSlots(view.relics || []);
  if (swordGroup) swordGroup.visible = !!view.sword;
  // R-17: the anvil sword's appearance follows the highest grade +
  // the sword's parent/branch (ResolveId). Async — rebuilds only when
  // the appearance id changes.
  updateAnvilSword(view);
  // Fever: flames + camera shake (flamesTick) + board line (drawInstrument).
  feverOn = !!(view.fever && view.fever.active);
  if (feverOn && view.fever) {
    const bonus = view.fever.bonus ?? 4;
    const timeLeft = view.fever.timeLeft ?? 0;
    const m4 = Math.max(4, bonus);
    feverAgeRate = 3.8 / Math.max(0.01, m4 - 0.2);
    feverAgeBase = Math.max(0, m4 - timeLeft) * feverAgeRate;
    feverAgeT0 = animT;
    feverBonus = bonus;
  }
  // Dragon anger (LAYOUT.md §5e): no numeric meter exists — anger is shown
  // by the tunnel eye glow (Eye/Breath lights, 0.0 by default, event-driven)
  // and the crayon wall marks (no mesh — TODO-RE). Light intensity scales
  // with anger (0–3).
  // R-15 (remainder): the 0.8 / 0.5 factors below are the previous
  // SENSOR's values, NOT sourced — kept + marked (the mood source is
  // BEHAVIOR M6, not yet attempted). TODO-RE / R-15.
  if (eyeLight) eyeLight.intensity = (view.anger || 0) * 0.8;
  if (breathLight) breathLight.intensity = (view.anger || 0) * 0.5;
  // Quota met: the bell glint light (green, 0.0 by default) turns on.
  // R-15 (remainder): the 2.0 factor is the previous SENSOR's value,
  // NOT sourced — kept + marked. TODO-RE / R-15.
  if (quotaLight) quotaLight.intensity = view.quotaMet ? 2.0 : 0;
  // New outcome: flash its instrument light + spark burst.
  if (view.lastOutcome && view.lastOutcome !== lastOutcome) {
    const idx = ['break', 'damage', 'hold', 'success', 'great'].indexOf(view.lastOutcome);
    if (idx >= 0) flashOutcomeLight(idx);
    spawnBurst(view.lastOutcome === 'great' ? 'great' : view.lastOutcome === 'break' ? 'break' : 'strike');
    // R-07: the reward shake impulse is set to 1 on a Great (decays 7/s).
    if (view.lastOutcome === 'great') {
      rewardImpulse = 1.0;
      rewardAge = 0;
    }
    lastOutcome = view.lastOutcome;
  }
}

function strike() {
  // Hammer swing (R-06: 0.565 s total — raise 0.16 s, down 0.095 s
  // (impact at 0.255 s), return offset 0.10 s, return rest 0.21 s).
  if (hammerGroup) hammerSwingT = 0;
}

function setQuality(q) {
  quality = q || 'medium';
  // The particle systems are rate-based now (R-10/R-11/R-12: no quality
  // tiers in the original), so quality no longer rebuilds them. It only
  // still affects the spark burst count (R-13, TODO-RE — the per-strike
  // burst count is not in the data).
}

function setFloorSwords(n) {
  // R-20: the real default is 30 (not 3); the settings slider max is 30.
  floorSwordCap = clamp(n == null ? 30 : n, 0, 30);
  while (brokenSwords.length > floorSwordCap) {
    const old = brokenSwords.shift();
    scene.remove(old);
  }
}

function setViewOffset(xPx, yPx) {
  // Accumulated drag offsets in pixels from the work view.
  // 0.004 rad/px: a full turn needs ~785 px of dragging (several swipes).
  viewYaw = workYaw - clamp(xPx, -785, 785) * 0.004;
  viewPitch = clamp(workPitch - clamp(yPx, -125, 125) * 0.004, -1.0, 0.6);
}

function setView(yawDeg, pitchDeg) {
  viewYaw = (yawDeg * Math.PI) / 180;
  viewPitch = (pitchDeg * Math.PI) / 180;
}

// Debug probe for the test harness / verifier (not game UI).
function getDebug() {
  return {
    frames: frameCount,
    viewYawDeg: (viewYaw * 180) / Math.PI,
    viewPitchDeg: (viewPitch * 180) / Math.PI,
    camYawDeg: (camera.rotation.y * 180) / Math.PI,
    camPitchDeg: (camera.rotation.x * 180) / Math.PI,
    ready: readyFlag,
  };
}

// Debug: adjust the baked-lightmap stand-in fill live (test harness only).
// The original's base illumination is baked lightmaps (absent from the
// bundle); the fill level is tuned so the dark original albedos read like
// the original's moody-but-visible room, not pitch black.
function setFill(hemiI, ambI) {
  if (fillLights.hemi) fillLights.hemi.intensity = hemiI;
  if (fillLights.amb) fillLights.amb.intensity = ambI;
}

// Scene stats for the test harness / verifier: mesh counts, draw calls,
// triangles rendered last frame, and the static merged meshes' bounding
// boxes (to prove the room geometry is really in the scene and where).
function getStats() {
  const stat = {
    children: scene.children.length,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    staticMeshes: [],
    boards: [],
  };
  for (const m of scene.getObjectByName('room-static').children) {
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    stat.staticMeshes.push({
      material: m.material.name || "?",
      verts: m.geometry.attributes.position.count,
      bboxMin: b ? [b.min.x, b.min.y, b.min.z].map((v) => +v.toFixed(2)) : null,
      bboxMax: b ? [b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(2)) : null,
      side: m.material.side,
      visible: m.visible,
    });
  }
  for (const name of Object.keys(boardPlanes)) {
    const p = boardPlanes[name];
    stat.boards.push({
      name,
      pos: [p.mesh.position.x, p.mesh.position.y, p.mesh.position.z].map((v) => +v.toFixed(3)),
      visible: p.mesh.visible,
    });
  }
  // The real sword (base form) + the hammer group, for the verifier.
  const swordInfo = { parts: 0, bboxMin: null, bboxMax: null };
  if (swordGroup) {
    const b = new THREE.Box3().setFromObject(swordGroup);
    swordInfo.parts = swordGroup.children.length;
    if (b.min.x !== Infinity) {
      swordInfo.bboxMin = [b.min.x, b.min.y, b.min.z].map((v) => +v.toFixed(3));
      swordInfo.bboxMax = [b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(3));
    }
    swordInfo.pos = [swordGroup.position.x, swordGroup.position.y, swordGroup.position.z].map((v) => +v.toFixed(3));
  }
  stat.sword = swordInfo;
  const hammerInfo = { parts: 0, bboxMin: null, bboxMax: null };
  if (hammerGroup) {
    const b = new THREE.Box3().setFromObject(hammerGroup);
    hammerInfo.parts = hammerGroup.children.length;
    if (b.min.x !== Infinity) {
      hammerInfo.bboxMin = [b.min.x, b.min.y, b.min.z].map((v) => +v.toFixed(3));
      hammerInfo.bboxMax = [b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(3));
    }
    hammerInfo.pos = [hammerGroup.position.x, hammerGroup.position.y, hammerGroup.position.z].map((v) => +v.toFixed(3));
  }
  stat.hammer = hammerInfo;
  return stat;
}

// ---------------------------------------------------------------------------
// Init + render loop
// ---------------------------------------------------------------------------
let clock = null;
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  const dt = Math.min(0.1, clock.getDelta());
  animT += dt;
  hammerSwingTick(dt);
  outcomeLightsTick(dt);
  embersTick(dt);
  dustTick(dt);
  burstsTick(dt);
  flamesTick(dt);
  feverRadianceTick();
  applyCamera(dt);
  renderer.render(scene, camera);
}

function resize() {
  if (!renderer || !containerEl || !camera) return;
  const w = containerEl.clientWidth || 1280;
  const h = containerEl.clientHeight || 720;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Particle point size scale (0.5 * drawing-buffer height, matching
  // THREE.PointsMaterial's sizeAttenuation).
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  particlePxScale = size.y * 0.5;
}

async function init(el) {
  containerEl = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  containerEl.appendChild(renderer.domElement);

  data = await (await fetch('scene-data.json')).json();
  meshData = await (await fetch('meshes.json')).json();
  // R-17: sword appearance data (swords-manifest.json + sword-catalogue.json,
  // built by tools/convert-swords.py from the real prefabs). If either
  // fails to load, the anvil sword falls back to the base Blade assembly.
  try {
    swordManifest = await (await fetch('swords-manifest.json')).json();
  } catch (e) { console.warn('swords-manifest.json missing — base Blade fallback', e); }
  try {
    swordCatalogue = await (await fetch('sword-catalogue.json')).json();
  } catch (e) { console.warn('sword-catalogue.json missing — ResolveId still runs on the built-in table', e); }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(data.camera.background[0], data.camera.background[1], data.camera.background[2]);
  camera = new THREE.PerspectiveCamera(data.workView.fov, 1280 / 720, data.camera.near, data.camera.far);

  // Work view: eye [0.15, 1.76, −0.05], FOV 61 (LAYOUT.md §2,
  // ForgeFirstPerson workFieldOfView). R-24: pitch = workLookPitch = 10°
  // (behavior.json forge_first_person, field Range(0,35)) — the old
  // lookAt-derived −14° is dropped. The YAW still comes from the work
  // lookAt direction (the camera faces the anvil's striking face
  // [−1.07, 1.125, 2.19]); only the lookAt's Y component is discarded.
  // The spawn view (facing the service window, FOV 69) is reachable via
  // free-look drag; the exact spawn↔work blend is TODO-RE (no walking in
  // P0 — workBlend stays 1, FOV stays at the work value 61).
  const wv = dirToYawPitch([
    data.workView.lookAt[0] - data.workView.eye[0],
    data.workView.lookAt[1] - data.workView.eye[1],
    data.workView.lookAt[2] - data.workView.eye[2],
  ]);
  workYaw = wv.yaw;
  workPitch = THREE.MathUtils.degToRad(10.0); // R-24: workLookPitch
  viewYaw = workYaw;
  viewPitch = workPitch;

  // Preload the textures the materials + particles need.
  const needed = new Set();
  for (const mid of Object.keys(data.materials)) {
    const r = data.materials[mid];
    if (r.mapPng) needed.add(r.mapPng);
    if (r.bumpPng) needed.add(r.bumpPng);
  }
  needed.add('cfxr_electric_spark.png');
  needed.add('cfxr_ember_blur.png');
  needed.add('SoftFlame.png');
  needed.add('SoftParticle.png'); // R-10/R-12: flame + Lazy soot texture
  // SwordV2DetailAtlas (pid 1697) — the detail atlas for the catalogue
  // swords' teal emissive (R-09, partial; see buildCatalogueSword).
  needed.add('SwordV2DetailAtlas.png');
  await Promise.all([...needed].map((png) => loadTexture(png, { srgb: png !== 'cfxr_electric_spark.png' && png !== 'cfxr_ember_blur.png' })));

  await buildStaticMeshes();
  buildLights();
  await buildSwords();
  await buildHammer();
  buildOutcomeLights();
  buildRelicSlots();
  makeBoardPlane('instrument', 1.37, 0.57, 1024, 426);
  makeBoardPlane('meter', 1.09, 0.26, 1024, 244);
  // F-02: the ledger slate is 1.09 × 1.39 m (the real slate, not 1.0×1.3).
  makeBoardPlane('ledger', 1.09, 1.39, 512, 652);
  // R-26: the calendar paper is 0.70 × 0.76 m (measured from the 31
  // TextMesh day labels; APPROXIMATION, awaiting OWNER approval).
  makeBoardPlane('calendar', 0.70, 0.76, 512, 556);
  buildFlames();
  buildEmbers();
  buildDust();

  window.addEventListener('resize', resize);
  resize();
  clock = new THREE.Clock();
  readyFlag = true;
  webglFlag = true;
  animate();
}

window.ForgeScene = {
  init,
  update,
  strike,
  addBrokenSword,
  setQuality,
  setFloorSwords,
  setViewOffset,
  setView,
  pickAt,
  debugTargetPoint,
  getDebug,
  getStats,
  setFill,
  resize,
  get ready() { return readyFlag; },
  get webgl() { return webglFlag; },
};
