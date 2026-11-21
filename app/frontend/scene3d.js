// ForgeTax Mobile remake — P0 3D forge room (Three.js r170, bundled offline).
//
// The game LOGIC lives in the Rust core (forgetax-core); this file only
// renders the forge room and forwards input. Textures are the ORIGINAL
// mobile 3.17.0 textures extracted from the real APK (see
// textures/MANIFEST.md for the path_id of every texture used).
//
// HONESTY (hard rules):
// - Geometry is SIMPLE PRIMITIVES (boxes, cylinders, extruded profiles) —
//   never presented as the original's meshes. The original MESHES were
//   NOT extracted; only textures were. The anvil/sword/hammer shapes are
//   our own primitive assemblies wearing the original's textures.
// - The 10 "blade shape" textures (Large01/Medium01-06/Thin01-02) decode
//   to black RGB + noise alpha (verified pixel-by-pixel) and are NOT
//   blade art — their true shader role is unrecovered (TODO-RE). The 3D
//   blade is an extruded profile + SwordV2DetailAtlas (path_id 1697).
// - `flame.png` / `spark.png` are misnamed (both decode to the same dark
//   rock render); particle sprites use the cfxr masks + SoftFlame.
// - No copied original sound files, no AI-redrawn art. Numbers keep
//   their RE citations / TODO-RE markers from the core.

import * as THREE from 'three';

// Texture files (all under app/frontend/textures/, see MANIFEST.md).
// path_ids are from unity/textures-3.17.0/manifest.json.
const TEX = {
  floor: { file: 'textures/T_Room_Flagstone.png', path_id: 179 },
  brick0: { file: 'textures/T_Room_BrickWear_0.png', path_id: 170 },
  brick1: { file: 'textures/T_Room_BrickWear_1.png', path_id: 184 },
  brick2: { file: 'textures/T_Room_BrickWear_2.png', path_id: 176 },
  mortar: { file: 'textures/T_Room_Mortar.png', path_id: 183 },
  floorWear: { file: 'textures/T_Room_FloorWear.png', path_id: 181 },
  floorScuff: { file: 'textures/T_Room_FloorScuff.png', path_id: 178 },
  grime: { file: 'textures/T_Room_GrimeGradient.png', path_id: 180 },
  cobweb: { file: 'textures/T_Room_Cobweb.png', path_id: 174 },
  iron: { file: 'textures/T_ForgeIron_Albedo.png', path_id: 168 },
  grimeSoft: { file: 'textures/T_ForgeGrimeSoft.png', path_id: 185 },
  mouthHeat: { file: 'textures/T_ForgeMouthHeat.png', path_id: 161 },
  jambSoot: { file: 'textures/T_ForgeJambSoot.png', path_id: 165 },
  rustIron: { file: 'textures/T_Room_RustIron.png', path_id: 163 },
  charredWood: { file: 'textures/T_CharredWood_Albedo.png', path_id: 177 },
  brass: { file: 'textures/T_Room_BrassPatina.png', path_id: 182 },
  bladeDetail: { file: 'textures/SwordV2DetailAtlas.png', path_id: 1697 },
  spark: { file: 'textures/cfxr_electric_spark.png', path_id: 1430 },
  emberGlow: { file: 'textures/cfxr_fire_circle_plain.png', path_id: 1138 },
  emberBlur: { file: 'textures/cfxr_ember_blur.png', path_id: 1274 },
  softFlame: { file: 'textures/SoftFlame.png', path_id: 166 },
  flameStreak: { file: 'textures/cfxr_stretch_flamme_crisp.png', path_id: 1284 },
};

const SWING_MS = 220; // same timing as the 2D hammer swing
const PARTICLE_BUDGET = { low: 6, medium: 18, high: 36 }; // same counts as 2D
const MAX_PARTICLES = 72;
const MAX_EMBERS = 26;

// Anvil top height (world units) — the sword lies here.
const ANVIL_TOP_Y = 1.02;
const STRIKE_POINT = new THREE.Vector3(0, ANVIL_TOP_Y + 0.25, 0.6);

const ForgeScene = (() => {
  let renderer = null;
  let scene = null;
  let camera = null;
  let container = null;
  let badgeEl = null;
  let ready = false;
  let quality = 'medium';
  let viewOffset = { x: 0, y: 0 };
  let feverActive = false;
  let feverT = 0;

  let anvilGroup = null;
  let swordGroup = null;
  let bladeMat = null;
  let hammerPivot = null;
  let floorSwordsGroup = null;
  let feverLight = null;
  let flames = [];
  let sparkSys = null;
  let emberSys = null;
  let swingStart = -1;
  let lastT = 0;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const badgeWorld = new THREE.Vector3(0, ANVIL_TOP_Y + 0.55, 0.6);

  async function loadTextures() {
    const loader = new THREE.TextureLoader();
    const maxAniso = 8;
    const entries = await Promise.all(
      Object.entries(TEX).map(async ([key, spec]) => {
        const tex = await loader.loadAsync(spec.file);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = maxAniso;
        return [key, tex];
      })
    );
    const out = {};
    for (const [key, tex] of entries) out[key] = tex;
    // Tileables repeat; decals/glows clamp.
    for (const k of ['floor', 'brick0', 'brick1', 'brick2', 'iron', 'rustIron', 'charredWood', 'brass', 'mortar', 'floorWear']) {
      out[k].wrapS = THREE.RepeatWrapping;
      out[k].wrapT = THREE.RepeatWrapping;
    }
    out.floor.repeat.set(6, 4);
    out.brick0.repeat.set(6, 2);
    out.brick1.repeat.set(4, 2);
    out.brick2.repeat.set(4, 2);
    out.iron.repeat.set(0.45, 0.45);
    out.rustIron.repeat.set(0.8, 0.8);
    out.charredWood.repeat.set(0.5, 0.5);
    out.brass.repeat.set(1, 1);
    out.mortar.repeat.set(8, 1);
    out.floorWear.repeat.set(5, 3);
    out.bladeDetail.repeat.set(0.6, 0.6);
    return out;
  }

  function std(map, opts = {}) {
    return new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.05, ...opts });
  }

  // Anvil side profile (X = length, Y = height), extruded along Z.
  // Own primitive assembly — NOT the original's anvil mesh.
  function buildAnvil(tex) {
    const g = new THREE.Group();
    const iron = tex.iron.clone();
    iron.needsUpdate = true;
    iron.repeat.set(0.45, 0.45);
    // The iron albedo is dark; a light tint keeps it readable.
    const mat = std(iron, { roughness: 0.75, metalness: 0.55, color: 0xcccccc });
    const s = new THREE.Shape();
    s.moveTo(-1.3, 1.0);
    s.lineTo(1.3, 1.0);
    s.lineTo(1.3, 0.86);
    s.lineTo(0.55, 0.78);
    s.lineTo(0.55, 0.22);
    s.lineTo(0.9, 0.14);
    s.lineTo(0.9, 0.0);
    s.lineTo(-0.9, 0.0);
    s.lineTo(-0.9, 0.14);
    s.lineTo(-0.55, 0.22);
    s.lineTo(-0.55, 0.78);
    s.lineTo(-1.3, 0.86);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.85, bevelEnabled: false });
    geo.translate(0, 0, -0.425);
    const body = new THREE.Mesh(geo, mat);
    g.add(body);
    // Grime decal on the anvil top (transparent overlay plane).
    const grime = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.8),
      new THREE.MeshBasicMaterial({ map: tex.grimeSoft, transparent: true, opacity: 0.55, depthWrite: false })
    );
    grime.rotation.x = -Math.PI / 2;
    grime.position.set(0, ANVIL_TOP_Y + 0.005, 0);
    g.add(grime);
    g.position.set(0, 0, 0.6);
    return g;
  }

  // Sword: extruded blade profile + brass guard + charred-wood handle.
  // Own primitive assembly — NOT the original's sword mesh.
  // TODO-RE: the original blade-shape textures (Large/Medium/Thin) decode
  // to black RGB + noise alpha; their true shader role is unrecovered, so
  // the blade shape here is our own profile and the visible detail comes
  // from SwordV2DetailAtlas (path_id 1697) as the blade map.
  function buildSword(tex) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0.58, 0.085);
    shape.lineTo(-1.15, 0.055);
    shape.lineTo(-1.62, 0.0); // tip
    shape.lineTo(-1.15, -0.055);
    shape.lineTo(0.58, -0.085);
    shape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
    bladeGeo.translate(0, 0, -0.0175);
    bladeMat = new THREE.MeshStandardMaterial({
      map: tex.bladeDetail,
      // The atlas is a dark teal vein pattern: a white base colour lets
      // it show, with a faint cool emissive so the blade never reads black.
      color: 0xffffff,
      metalness: 0.85,
      roughness: 0.38,
      emissive: 0x1c2830,
      emissiveIntensity: 0.6,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.x = -Math.PI / 2;
    blade.position.y = 0.035;
    g.add(blade);
    // Guard (brass) + handle (charred wood) + pommel.
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.1, 0.42),
      std(tex.brass, { metalness: 0.8, roughness: 0.45, color: 0xd8b060 })
    );
    guard.position.set(0.62, 0.05, 0);
    g.add(guard);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.055, 0.55, 10),
      std(tex.charredWood, { roughness: 0.9, metalness: 0.0 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.95, 0.05, 0);
    g.add(handle);
    const pommel = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 8),
      std(tex.brass, { metalness: 0.8, roughness: 0.45, color: 0xd8b060 })
    );
    pommel.position.set(1.24, 0.05, 0);
    g.add(pommel);
    g.position.set(0, ANVIL_TOP_Y + 0.01, 0.6);
    return g;
  }

  // Hammer: pivot at the top of the handle; swing rotates the pivot.
  // Own primitive assembly — NOT the original's hammer mesh.
  function buildHammer(tex) {
    const pivot = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.065, 1.15, 10),
      std(tex.charredWood, { roughness: 0.9, metalness: 0.0, color: 0xc8a888 })
    );
    handle.position.y = -0.575;
    pivot.add(handle);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.24, 0.24),
      std(tex.rustIron, { roughness: 0.8, metalness: 0.6, color: 0xdddddd })
    );
    head.position.y = -1.18;
    pivot.add(head);
    pivot.position.set(1.85, 2.35, 0.6);
    pivot.rotation.z = -0.15; // rest angle
    return pivot;
  }

  // Floor swords: simplified sword meshes lying on the floor.
  function buildFloorSword(tex) {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.02, 0.13),
      new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.85, roughness: 0.4 })
    );
    blade.position.x = -0.35;
    g.add(blade);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.03, 0.3),
      std(tex.brass, { metalness: 0.8, roughness: 0.45, color: 0xd8b060 })
    );
    guard.position.x = 0.35;
    g.add(guard);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8),
      std(tex.charredWood, { roughness: 0.9 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.62;
    g.add(handle);
    return g;
  }

  function makePointsSystem(tex, max, size) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999; // parked below the floor
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points, pos, col, vel: new Float32Array(max * 3), life: new Float32Array(max), maxLife: new Float32Array(max), max };
  }

  function buildScene(tex) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171310);
    scene.fog = new THREE.Fog(0x171310, 13, 28);

    camera = new THREE.PerspectiveCamera(38, 1280 / 484, 0.1, 100);
    camera.position.set(0, 2.6, 8.4);
    camera.lookAt(0, 1.05, 0);

    // Lights (no shadows — keeps 60fps on weak GPUs; noted in README).
    // The room's textures are dark by nature, so the key + anvil lights
    // are strong; without them the anvil/sword read as black silhouettes.
    scene.add(new THREE.AmbientLight(0x8a7a66, 0.9));
    const key = new THREE.DirectionalLight(0xfff2dd, 2.2);
    key.position.set(3, 7, 6);
    scene.add(key);
    const forgeLight = new THREE.PointLight(0xff6a1a, 30, 16, 2);
    forgeLight.position.set(0, 1.8, -3.6);
    scene.add(forgeLight);
    const anvilLight = new THREE.PointLight(0xffd9a0, 14, 9, 2);
    anvilLight.position.set(0.5, 3.4, 2.6);
    scene.add(anvilLight);
    feverLight = new THREE.PointLight(0xff7a1a, 0, 12, 2);
    feverLight.position.set(0, 2.6, 1.6);
    scene.add(feverLight);

    // Floor (flagstone, repeated) + wear overlay.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 18),
      std(tex.floor, { roughness: 0.95, metalness: 0.0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    scene.add(floor);
    const wear = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 18),
      new THREE.MeshStandardMaterial({ map: tex.floorWear, transparent: true, opacity: 0.45, roughness: 0.95, depthWrite: false })
    );
    wear.rotation.x = -Math.PI / 2;
    wear.position.set(0, 0.005, 1);
    scene.add(wear);
    // Scuff decals scattered on the floor.
    const scuffSpots = [[-3.2, 2.6, 0.4], [2.8, 3.4, 2.2], [-1.4, 4.2, 1.1], [3.6, 1.4, 2.9]];
    for (const [x, z, r] of scuffSpots) {
      const d = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({ map: tex.floorScuff, transparent: true, opacity: 0.7, depthWrite: false })
      );
      d.rotation.x = -Math.PI / 2;
      d.rotation.z = r;
      d.position.set(x, 0.01, z);
      scene.add(d);
    }

    // Walls: back + sides (brick wear), mortar base trim, grime gradient.
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), std(tex.brick0, { roughness: 0.92 }));
    backWall.position.set(0, 3.5, -5.2);
    scene.add(backWall);
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), std(tex.brick1, { roughness: 0.92 }));
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-8.5, 3.5, 0.5);
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), std(tex.brick2, { roughness: 0.92 }));
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(8.5, 3.5, 0.5);
    scene.add(rightWall);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.35, 0.15),
      std(tex.mortar, { roughness: 0.95 })
    );
    trim.position.set(0, 0.18, -5.1);
    scene.add(trim);
    const grimeWall = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 2.2),
      new THREE.MeshBasicMaterial({ map: tex.grime, transparent: true, opacity: 0.8, depthWrite: false })
    );
    grimeWall.position.set(0, 1.1, -5.18);
    scene.add(grimeWall);
    // Cobwebs in the top corners.
    for (const [x, flip] of [[-7.6, 1], [7.6, -1]]) {
      const web = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: tex.cobweb, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
      );
      web.position.set(x, 5.6, -5.15);
      web.scale.x = flip;
      scene.add(web);
    }

    // Forge mouth: soot frame + heat glow plane + flame sprites.
    const jamb = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 2.4, 0.3),
      new THREE.MeshStandardMaterial({ map: tex.jambSoot, transparent: true, roughness: 0.95, color: 0x888888 })
    );
    jamb.position.set(-3.4, 1.5, -5.0);
    scene.add(jamb);
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.5),
      new THREE.MeshBasicMaterial({ map: tex.mouthHeat, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.9, color: 0xff8a2a, depthWrite: false })
    );
    mouth.position.set(-3.4, 1.35, -4.82);
    scene.add(mouth);
    for (let i = 0; i < 3; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex.softFlame, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.75, depthWrite: false,
      }));
      spr.position.set(-3.9 + i * 0.5, 1.15, -4.7);
      spr.scale.set(0.9, 1.4, 1);
      spr.userData.phase = i * 2.1;
      flames.push(spr);
      scene.add(spr);
    }

    // Anvil, sword, hammer, floor swords.
    anvilGroup = buildAnvil(tex);
    scene.add(anvilGroup);
    swordGroup = buildSword(tex);
    scene.add(swordGroup);
    hammerPivot = buildHammer(tex);
    scene.add(hammerPivot);
    floorSwordsGroup = new THREE.Group();
    floorSwordsGroup.userData.tex = tex;
    scene.add(floorSwordsGroup);

    // Strike sparks + ambient embers.
    sparkSys = makePointsSystem(tex.spark, MAX_PARTICLES, 0.16);
    scene.add(sparkSys.points);
    emberSys = makePointsSystem(tex.emberBlur, MAX_EMBERS, 0.1);
    scene.add(emberSys.points);
    for (let i = 0; i < MAX_EMBERS; i++) {
      emberSys.pos[i * 3] = (Math.random() - 0.5) * 8;
      emberSys.pos[i * 3 + 1] = 0.2 + Math.random() * 3.2;
      emberSys.pos[i * 3 + 2] = -2 + Math.random() * 5;
      emberSys.vel[i * 3 + 1] = 0.15 + Math.random() * 0.25;
      emberSys.life[i] = 9999;
      emberSys.maxLife[i] = 9999;
      const warm = 0.55 + Math.random() * 0.45;
      emberSys.col[i * 3] = warm;
      emberSys.col[i * 3 + 1] = warm * 0.45;
      emberSys.col[i * 3 + 2] = warm * 0.12;
    }
    emberSys.points.geometry.attributes.position.needsUpdate = true;
    emberSys.points.geometry.attributes.color.needsUpdate = true;
  }

  function burst(n) {
    if (!sparkSys) return;
    const budget = PARTICLE_BUDGET[quality] || 18;
    const count = Math.min(n, budget);
    let spawned = 0;
    for (let i = 0; i < sparkSys.max && spawned < count; i++) {
      if (sparkSys.life[i] > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.25;
      sparkSys.pos[i * 3] = STRIKE_POINT.x + Math.cos(a) * r;
      sparkSys.pos[i * 3 + 1] = STRIKE_POINT.y;
      sparkSys.pos[i * 3 + 2] = STRIKE_POINT.z + Math.sin(a) * r;
      const up = 1.5 + Math.random() * 2.5;
      sparkSys.vel[i * 3] = (Math.random() - 0.5) * 3.2;
      sparkSys.vel[i * 3 + 1] = up;
      sparkSys.vel[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
      sparkSys.life[i] = 0.5 + Math.random() * 0.2;
      sparkSys.maxLife[i] = sparkSys.life[i];
      const warm = 0.75 + Math.random() * 0.25;
      sparkSys.col[i * 3] = warm;
      sparkSys.col[i * 3 + 1] = warm * (0.55 + Math.random() * 0.3);
      sparkSys.col[i * 3 + 2] = warm * 0.15;
      spawned++;
    }
    sparkSys.points.geometry.attributes.color.needsUpdate = true;
  }

  function updateSparks(dt) {
    if (!sparkSys) return;
    let dirty = false;
    for (let i = 0; i < sparkSys.max; i++) {
      if (sparkSys.life[i] <= 0) continue;
      dirty = true;
      sparkSys.life[i] -= dt;
      if (sparkSys.life[i] <= 0) {
        sparkSys.pos[i * 3 + 1] = -999;
        continue;
      }
      sparkSys.vel[i * 3 + 1] -= 5.9 * dt;
      sparkSys.pos[i * 3] += sparkSys.vel[i * 3] * dt;
      sparkSys.pos[i * 3 + 1] += sparkSys.vel[i * 3 + 1] * dt;
      sparkSys.pos[i * 3 + 2] += sparkSys.vel[i * 3 + 2] * dt;
      const f = sparkSys.life[i] / sparkSys.maxLife[i];
      sparkSys.col[i * 3 + 1] *= 0.985;
      sparkSys.col[i * 3] *= (0.985 + 0.015 * f);
    }
    if (dirty) {
      sparkSys.points.geometry.attributes.position.needsUpdate = true;
      sparkSys.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  function updateEmbers(dt, t) {
    if (!emberSys) return;
    for (let i = 0; i < emberSys.max; i++) {
      emberSys.pos[i * 3 + 1] += emberSys.vel[i * 3 + 1] * dt;
      emberSys.pos[i * 3] += Math.sin(t * 0.7 + i * 1.7) * 0.12 * dt;
      if (emberSys.pos[i * 3 + 1] > 3.6) {
        emberSys.pos[i * 3 + 1] = 0.2;
        emberSys.pos[i * 3] = (Math.random() - 0.5) * 8;
        emberSys.pos[i * 3 + 2] = -2 + Math.random() * 5;
      }
    }
    emberSys.points.geometry.attributes.position.needsUpdate = true;
  }

  function updateHammer(now) {
    if (!hammerPivot || swingStart < 0) return;
    const t = (now - swingStart) / SWING_MS;
    if (t >= 1) {
      hammerPivot.rotation.z = -0.15;
      swingStart = -1;
      return;
    }
    // 2D swing keyframes: -38deg -> +6deg (60%) -> 0deg; rest -0.15 rad.
    if (t < 0.6) {
      const u = t / 0.6;
      const e = u * u; // ease-in
      hammerPivot.rotation.z = -0.66 + (0.10 - -0.66) * e;
    } else {
      const u = (t - 0.6) / 0.4;
      hammerPivot.rotation.z = 0.10 + (-0.15 - 0.10) * u;
    }
  }

  function updateBadge() {
    if (!badgeEl || !swordGroup || !swordGroup.visible) {
      if (badgeEl) badgeEl.style.display = 'none';
      return;
    }
    const rect = container.getBoundingClientRect();
    const v = badgeWorld.clone().project(camera);
    badgeEl.style.display = 'block';
    badgeEl.style.left = ((v.x * 0.5 + 0.5) * rect.width - 120) + 'px';
    badgeEl.style.top = ((-v.y * 0.5 + 0.5) * rect.height) + 'px';
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!ready) return;
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    const t = now / 1000;
    updateHammer(now);
    updateSparks(dt);
    updateEmbers(dt, t);
    // Flames pulse; bigger during Fever.
    const flameScale = feverActive ? 1.35 : 1.0;
    for (const spr of flames) {
      const s = 1 + 0.12 * Math.sin(t * 3 + spr.userData.phase);
      spr.scale.set(0.9 * s * flameScale, 1.4 * s * flameScale, 1);
      spr.material.opacity = (feverActive ? 0.95 : 0.75) * (0.9 + 0.1 * Math.sin(t * 5 + spr.userData.phase));
    }
    if (feverActive) {
      feverT += dt;
      feverLight.intensity = 40 * (0.85 + 0.3 * Math.sin(t * 6));
    } else {
      feverLight.intensity = 0;
    }
    camera.position.x = viewOffset.x / 80 * 0.9;
    camera.position.y = 2.6 + (viewOffset.y / 40) * 0.45;
    camera.lookAt(0, 1.05, 0);
    updateBadge();
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 484;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    get ready() { return ready; },

    async init(containerEl) {
      container = containerEl;
      badgeEl = document.getElementById('sword-grade');
      let rendererCreated = false;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        rendererCreated = true;
      } catch (e) {
        throw new Error('WebGL unavailable: ' + (e && e.message ? e.message : e));
      }
      if (!rendererCreated || !renderer.getContext()) {
        throw new Error('WebGL unavailable: no WebGL context (GPU/ANGLE missing)');
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.appendChild(renderer.domElement);
      const tex = await loadTextures();
      buildScene(tex);
      onResize();
      window.addEventListener('resize', onResize);
      ready = true;
      lastT = performance.now();
      requestAnimationFrame(loop);
    },

    setSword(sword) {
      if (!swordGroup) return;
      if (!sword) {
        swordGroup.visible = false;
        return;
      }
      swordGroup.visible = true;
      if (sword.broken) {
        swordGroup.rotation.z = 0.24;
        bladeMat.color.setHex(0x555a63);
        bladeMat.emissive.setHex(0x000000);
      } else if (sword.great_forged) {
        swordGroup.rotation.z = 0;
        bladeMat.color.setHex(0xffffff);
        bladeMat.emissive.setHex(0x8a5a10);
        bladeMat.emissiveIntensity = 0.7;
      } else {
        swordGroup.rotation.z = 0;
        bladeMat.color.setHex(0xffffff);
        bladeMat.emissive.setHex(0x1c2830);
        bladeMat.emissiveIntensity = 0.6;
      }
    },

    setFloorSwords(n) {
      if (!floorSwordsGroup) return;
      const tex = floorSwordsGroup.userData.tex;
      while (floorSwordsGroup.children.length) {
        const c = floorSwordsGroup.children.pop();
        floorSwordsGroup.remove(c);
      }
      const count = Math.max(0, Math.min(8, n));
      for (let i = 0; i < count; i++) {
        const s = buildFloorSword(tex);
        s.position.set(-4.4 + i * 1.25, 0.03, 2.6 + (i % 2) * 0.55);
        s.rotation.y = (-18 + i * 5) * Math.PI / 180;
        floorSwordsGroup.add(s);
      }
    },

    setFever(active) {
      feverActive = !!active;
      if (!active) feverT = 0;
    },

    setQuality(level) {
      quality = level === 'low' || level === 'medium' || level === 'high' ? level : 'medium';
    },

    setViewOffset(x, y) {
      viewOffset = { x, y };
    },

    strike() {
      swingStart = performance.now();
      burst(24);
    },

    burst,

    // Raycast pick: true when the pointer hits the anvil or the sword.
    pickAt(clientX, clientY) {
      if (!ready || !renderer) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([anvilGroup, swordGroup], true);
      return hits.length > 0;
    },
  };
})();

window.ForgeScene = ForgeScene;
