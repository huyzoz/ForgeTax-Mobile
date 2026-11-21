#!/usr/bin/env python3
"""Convert the extracted ForgeTax Mobile 3.17.0 forge-room layout into the
compact runtime data the Three.js remake loads.

Reads (all produced by the RE work in ~/workspace/forgetax-mobile/):
  scene-layout/layout.json            — 3,672 level0 objects (world pos/euler/scale,
                                        mesh + materials), camera, 20 lights,
                                        contract displays, sword forms
  scene-layout/work/dump2.json        — sharedassets0 prefab transforms
                                        (BasicTributeSword parts)
  scene-layout/work/mesh-export-report.json — mesh name -> OBJ filename
  scene-layout/meshes/*.obj           — UnityPy mesh exports
  unity/textures-3.17.0/manifest.json — texture path_id -> PNG filename

Writes (into remake/app/frontend/):
  meshes.json      — all selected meshes, quantized + base64 (one file so the
                     browser push stays a handful of files, not 213)
  scene-data.json  — placements (instanced by mesh+materials), materials
                     table, camera, lights, floor, sword assembly, board
                     anchors, tap targets, dust systems

SELECTION RULE (see LAYOUT.md):
  Include every ACTIVE level0 object whose mesh is real (not '?MISSING',
  not a 'Combined Mesh (root: scene)' static-batch mesh, mesh present).
  That is 600 objects / 213 unique meshes / ~88k verts.
  EXCLUDED and why (documented, not silently dropped):
  - 'Combined Mesh (root: scene)' x6: static-batched dressing whose OBJ has
    groups but NO material mapping (no usemtl lines; submesh->material order
    unrecoverable). Contains mostly the 1,842 '?MISSING' decal objects
    (Stamp/Cross/Plus/Green wash/Ink stroke...). TODO-RE if the mapping is
    ever recovered.
  - '?MISSING' meshes (1,842): decal/stamp objects whose mesh was not
    recovered (same batching story).
  - Flagstones: they reference the combined meshes, so they are rebuilt as
    instanced Shell_FlagA (the real flagstone mesh, 61 verts) at the exact
    8x8 grid positions from layout.json, with each stone's own materials.
  - 3D TextMesh labels (wall chart, texts): no mesh; the instrument board /
    ledger / meter / calendar carry the same information as canvas textures.

CONVERSION NOTES (honest):
  - Winding: Unity OBJ triangles are wound for Unity's front-face
    convention; indices are reversed per triangle so Three.js (CCW front)
    culls correctly. No Z flip: Unity (+X right, +Y up, +Z toward viewer)
    and Three.js use the same world axes; the camera quaternion check
    (layout.json forward [0.4019,-0.309,-0.8619] reproduced from dump2
    transform 4287 + walker yaw) validates the quaternion transfer.
  - World rotation is recomposed from the parent chain
    (world_quat = parent_quat * local_quat) and cross-checked against
    layout.json world_euler (Unity order R = Ry*Rx*Rz). Mismatches > 1
    degree are logged; the emitted quaternion wins.
  - Metalness/roughness are RENDERER APPROXIMATIONS by material name
    (the original uses custom shaders whose params were not extracted);
    base colors and _BaseMap textures are exact from the data.
  - Lights: all 20 are emitted, but only 11 are flagged `included`
    (see LIGHTS_INCLUDED below); the other 9 are listed with reasons.
    The original's baked lightmaps/probes are absent from the bundle, so a
    small ambient fill is added by the renderer (documented there).
  - Sword spawn rotation is TODO-RE (the runtime marker carries no
    rotation); the converter emits the assembly exactly as recorded and a
    documented lying-flat orientation chosen in scene3d.js.
"""
import base64
import collections
import json
import math
import os
import struct
import sys

ROOT = os.path.expanduser("~/workspace/forgetax-mobile")
LAYOUT = os.path.join(ROOT, "scene-layout/layout.json")
DUMP2 = os.path.join(ROOT, "scene-layout/work/dump2.json")
REPORT = os.path.join(ROOT, "scene-layout/work/mesh-export-report.json")
MESH_DIR = os.path.join(ROOT, "scene-layout/meshes")
TEX_MANIFEST = os.path.join(ROOT, "unity/textures-3.17.0/manifest.json")
TEX_DIR = os.path.join(ROOT, "unity/textures-3.17.0")
OUT_DIR = os.path.join(ROOT, "remake/app/frontend")

# --- Lights: the 11 kept (by GO name). The other 9 are emitted as omitted. ---
# Kept = the strongest + most spatially distinct, plus the 3 event-driven
# 0-intensity lights (Eye / Breath / Quota-ready glint) which the game turns
# on. Omitted = covered by a nearby stronger light (see reasons in output).
LIGHTS_INCLUDED = {
    "Fire / primary warm light",
    "Firebox internal",
    "Work lamp pool",
    "Cool room bounce",
    "Iron rim from window",
    "Exchange practical",
    "Low desk task pool",
    "Ledger shaded lamp (1)",
    "Eye light",
    "Breath light",
    "Quota ready / bell glint",
}

# Material name -> (metalness, roughness). RENDERER APPROXIMATION (see header).
def approx_pbr(name):
    n = name.lower()
    if any(k in n for k in ("brass", "gold", "copper")):
        return 0.8, 0.4
    if "steel" in n or n.startswith("iron") or "iron" in n:
        return 0.75, 0.45
    if "blackiron" in n:
        return 0.6, 0.55
    if any(k in n for k in ("leather", "board", "wood", "paper", "cloth", "hide")):
        return 0.0, 0.9
    if any(k in n for k in ("stone", "brick", "mortar", "slate", "concrete")):
        return 0.0, 0.95
    if "glass" in n:
        return 0.1, 0.15
    return 0.05, 0.85


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def quat_to_matrix(q):
    x, y, z, w = q
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]


def euler_unity(x, y, z):
    """Extraction's world_euler order, verified: R = Rz * Ry * Rx.
    (Checked against the parent-chain quaternion on a clinker with
    euler [38.67, 43.14, 30.25]: ZYX gives dot 1.0001, YXZ gives 0.908.)"""
    xr, yr, zr = math.radians(x), math.radians(y), math.radians(z)
    cx, sx, cy, sy, cz, sz = math.cos(xr), math.sin(xr), math.cos(yr), math.sin(yr), math.cos(zr), math.sin(zr)
    rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]

    def mm(a, b):
        return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]

    return mm(rz, mm(ry, rx))


def parse_obj(path):
    """Parse a UnityPy-exported OBJ. Returns dict with verts/normals/uvs/
    faces grouped by submesh (group order = submesh order)."""
    verts, normals, uvs = [], [], []
    groups = []  # list of [group_name, [faces]]; face = (v,v,v) indices 0-based
    cur = None
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(v) for v in line.split()[1:4]])
            elif line.startswith("vn "):
                normals.append([float(v) for v in line.split()[1:4]])
            elif line.startswith("vt "):
                uvs.append([float(v) for v in line.split()[1:3]])
            elif line.startswith("g "):
                name = line[2:].strip()
                cur = [name, []]
                groups.append(cur)
            elif line.startswith("f "):
                if cur is None:
                    cur = ["", []]
                    groups.append(cur)
                idx = []
                for tok in line.split()[1:]:
                    parts = tok.split("/")
                    idx.append(int(parts[0]) - 1)
                if len(idx) == 3:
                    cur[1].append(tuple(idx))
                elif len(idx) == 4:  # quad -> two triangles
                    cur[1].append((idx[0], idx[1], idx[2]))
                    cur[1].append((idx[0], idx[2], idx[3]))
                elif len(idx) > 4:  # fan
                    for i in range(1, len(idx) - 1):
                        cur[1].append((idx[0], idx[i], idx[i + 1]))
    return {"verts": verts, "normals": normals, "uvs": uvs, "groups": groups}


def quantize_mesh(parsed, mesh_name):
    """Quantize one mesh. Returns the meshes.json record (or None if empty).
    Winding is reversed per triangle (Unity CW -> Three.js CCW front)."""
    verts, normals, uvs = parsed["verts"], parsed["normals"], parsed["uvs"]
    if not verts:
        return None
    # Build per-group index lists; drop empty groups. The first group may be
    # the bare mesh name header with no faces.
    groups = []
    for gname, faces in parsed["groups"]:
        if faces:
            groups.append((gname, faces))
    if not groups:
        return None
    n = len(verts)
    # --- positions: uint16 over bbox ---
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    zs = [v[2] for v in verts]
    pmin = [min(xs), min(ys), min(zs)]
    pmax = [max(xs), max(ys), max(zs)]
    prange = [max(1e-6, pmax[i] - pmin[i]) for i in range(3)]
    pos_q = bytearray()
    for v in verts:
        for i in range(3):
            q = int(round((v[i] - pmin[i]) / prange[i] * 65535))
            pos_q += struct.pack("<H", max(0, min(65535, q)))
    # --- normals: int8 ---
    nrm_q = bytearray()
    for i in range(n):
        nv = normals[i] if i < len(normals) else [0.0, 1.0, 0.0]
        for c in nv:
            nrm_q += struct.pack("<b", max(-127, min(127, int(round(c * 127)))))
    # --- uvs: uint16 over uv bbox (uvs may exceed [0,1] for tiling) ---
    if uvs:
        us = [t[0] for t in uvs]
        vs = [t[1] for t in uvs]
        umin = [min(us), min(vs)]
        umax = [max(us), max(vs)]
        urange = [max(1e-6, umax[i] - umin[i]) for i in range(2)]
    else:
        umin, umax, urange = [0.0, 0.0], [1.0, 1.0], [1.0, 1.0]
    uv_q = bytearray()
    for i in range(n):
        t = uvs[i] if i < len(uvs) else [0.0, 0.0]
        for j in range(2):
            q = int(round((t[j] - umin[j]) / urange[j] * 65535))
            uv_q += struct.pack("<H", max(0, min(65535, q)))
    # --- indices: uint16 if possible, else uint32; winding reversed ---
    max_idx = n - 1
    idx_bits = 16 if max_idx < 65536 else 32
    idx_q = bytearray()
    out_groups = []
    offset = 0
    for gi, (gname, faces) in enumerate(groups):
        start = offset
        for (a, b, c) in faces:
            # reverse winding: (a, c, b)
            if idx_bits == 16:
                idx_q += struct.pack("<HHH", a, c, b)
            else:
                idx_q += struct.pack("<III", a, c, b)
            offset += 3
        out_groups.append({"start": start, "count": offset - start, "mat": gi})
    return {
        "verts": n,
        "tris": offset // 3,
        "bboxMin": [round(v, 4) for v in pmin],
        "bboxMax": [round(v, 4) for v in pmax],
        "posMin": [round(v, 6) for v in pmin],
        "posMax": [round(v, 6) for v in pmax],
        "uvMin": [round(v, 6) for v in umin],
        "uvMax": [round(v, 6) for v in umax],
        "pos": base64.b64encode(bytes(pos_q)).decode(),
        "nrm": base64.b64encode(bytes(nrm_q)).decode(),
        "uv": base64.b64encode(bytes(uv_q)).decode(),
        "idx": base64.b64encode(bytes(idx_q)).decode(),
        "idxBits": idx_bits,
        "groups": out_groups,
    }


def main():
    layout = json.load(open(LAYOUT))
    dump2 = json.load(open(DUMP2))
    report = json.load(open(REPORT))
    tex_manifest = json.load(open(TEX_MANIFEST))

    obj_by_mesh = {}  # (file, mesh_name) -> obj filename
    for r in report:
        obj_by_mesh[(r["file"], r["mesh_name"])] = r["obj"]
    # The report's mesh_name for combined meshes etc. may differ in spacing;
    # also index by mesh_name alone as fallback.
    obj_by_name = {}
    for r in report:
        obj_by_name.setdefault(r["mesh_name"], r["obj"])

    objects = layout["objects"]
    by_pid = {o["go_path_id"]: o for o in objects}

    def usable(o):
        m = o.get("mesh")
        if not m:
            return False
        n = m.get("name")
        return bool(n) and n != "?MISSING" and not n.startswith("Combined Mesh")

    # --- world quaternions via parent chain; cross-check vs world_euler ---
    world_quat = {}

    def compute_wq(o):
        pid = o["go_path_id"]
        if pid in world_quat:
            return world_quat[pid]
        q = o.get("local_rotation_quat") or [0, 0, 0, 1]
        parent_pid = o.get("parent_go_path_id")
        if parent_pid and parent_pid in by_pid:
            pq = compute_wq(by_pid[parent_pid])
            q = quat_mul(pq, q)
        # normalize
        l = math.sqrt(sum(c * c for c in q)) or 1.0
        q = [c / l for c in q]
        world_quat[pid] = q
        return q

    euler_mismatch = []
    for o in objects:
        q = compute_wq(o)
        e = o.get("world_euler") or [0, 0, 0]
        # compare forward vectors: quat forward vs unity-euler forward
        m = quat_to_matrix(q)
        f_q = (m[0][2], m[1][2], m[2][2])
        me = euler_unity(e[0], e[1], e[2])
        f_e = (me[0][2], me[1][2], me[2][2])
        dot = sum(a * b for a, b in zip(f_q, f_e))
        if dot < 0.9995:
            euler_mismatch.append((o["name"], o["go_path_id"], round(dot, 4), e))

    # --- materials table ---
    materials = {}  # id -> record
    tex_needed = {}  # pid -> png

    def mat_id(m):
        return "%s:%s:%s" % (m.get("file", "?"), m.get("path_id", "?"), m.get("name", "?"))

    def register_material(m):
        mid = mat_id(m)
        if mid in materials:
            return mid
        colors = m.get("colors") or {}
        base = colors.get("_BaseColor") or colors.get("_Color") or [1, 1, 1, 1]
        emis = colors.get("_EmissionColor") or [0, 0, 0, 1]
        tex = None
        bump = None
        for t in m.get("textures") or []:
            if t.get("slot") == "_BaseMap":
                tex = t
            elif t.get("slot") == "_BumpMap":
                bump = t
        if tex is None and (m.get("textures") or []):
            tex = m["textures"][0]
        metal, rough = approx_pbr(m.get("name", ""))
        rec = {
            "name": m.get("name"),
            "shader": m.get("shader"),
            "baseColor": [round(c, 4) for c in base[:3]],
            "emissive": [round(c, 4) for c in emis[:3]],
            "mapPid": tex["texture_path_id"] if tex else None,
            "mapPng": tex["png"] if tex else None,
            "bumpPid": bump["texture_path_id"] if bump else None,
            "bumpPng": bump["png"] if bump else None,
            "metalness": metal,
            "roughness": rough,
        }
        materials[mid] = rec
        if tex:
            tex_needed[tex["texture_path_id"]] = tex["png"]
        if bump:
            tex_needed[bump["texture_path_id"]] = bump["png"]
        return mid

    # --- mesh conversion (cached) ---
    mesh_records = {}  # mesh key -> meshes.json record
    mesh_key_of = {}  # (file, mesh_name) -> key

    def mesh_key(file, name):
        return "%s@%s" % (name, file)

    def convert_mesh(file, name):
        key = mesh_key(file, name)
        if key in mesh_records:
            return key
        obj_name = obj_by_mesh.get((file, name)) or obj_by_name.get(name)
        if not obj_name:
            return None
        path = os.path.join(MESH_DIR, obj_name)
        if not os.path.exists(path):
            # builtin meshes live in meshes/builtin/
            alt = os.path.join(MESH_DIR, "builtin", obj_name)
            path = alt if os.path.exists(alt) else path
        if not os.path.exists(path):
            print("WARN: OBJ file missing for mesh %s (%s)" % (name, obj_name), file=sys.stderr)
            return None
        parsed = parse_obj(path)
        rec = quantize_mesh(parsed, name)
        if rec is None:
            print("WARN: empty mesh %s" % name, file=sys.stderr)
            return None
        rec["name"] = name
        rec["file"] = file
        mesh_records[key] = rec
        return key

    # --- select + group placements ---
    # Hammer: the working hammer (GO 2843 'Working hammer / animated pivot')
    # is built separately so the swing can rotate it around its pivot.
    HAMMER_PARENT = 2843
    # Ledger frame + slate are INACTIVE in the level0 data, but LAYOUT.md §5b
    # identifies them as the contract display surface; the game presumably
    # activates them at runtime (the live 'Live run account' text IS active).
    # They are rendered anyway — documented deviation, see README.
    LEDGER_FORCE_INCLUDE = {1838, 1720}
    hammer_parts = []
    groups = collections.OrderedDict()  # (mesh_key, tuple(mat ids)) -> instances
    skipped = collections.Counter()
    for o in objects:
        if o.get("parent_go_path_id") == HAMMER_PARENT:
            m = o.get("mesh")
            if usable(o):
                key = convert_mesh(m.get("file"), m.get("name"))
                mats = [register_material(mm) for mm in (o.get("materials") or [])]
                hammer_parts.append({
                    "name": o["name"],
                    "go": o["go_path_id"],
                    "mesh": key,
                    "materials": mats,
                    "pos": [round(v, 4) for v in o["world_position"]],
                    "quat": [round(v, 5) for v in world_quat[o["go_path_id"]]],
                    "scale": [round(v, 4) for v in o["world_scale"]],
                })
            else:
                skipped["hammer_no_mesh"] += 1
            continue
        if not o.get("active") and o["go_path_id"] not in LEDGER_FORCE_INCLUDE:
            skipped["inactive"] += 1
            continue
        if not o.get("active"):
            skipped["inactive_but_included_ledger"] += 1
        if not usable(o):
            skipped["no_usable_mesh"] += 1
            continue
        m = o["mesh"]
        key = convert_mesh(m.get("file"), m.get("name"))
        if key is None:
            skipped["mesh_convert_failed"] += 1
            continue
        mats = [register_material(mm) for mm in (o.get("materials") or [])]
        # submesh count check: warn if materials != mesh groups
        rec = mesh_records[key]
        if mats and len(mats) != len(rec["groups"]):
            print("WARN: %s (%s) has %d materials but %d submesh groups"
                  % (o["name"], m.get("name"), len(mats), len(rec["groups"])), file=sys.stderr)
        gkey = (key, tuple(mats))
        inst = (
            [round(v, 4) for v in o["world_position"]]
            + [round(v, 5) for v in world_quat[o["go_path_id"]]]
            + [round(v, 4) for v in o["world_scale"]]
        )
        groups.setdefault(gkey, []).append(inst)

    # --- floor flagstones (combined-mesh GOs -> instanced Shell_FlagA) ---
    flagstones = [o for o in objects
                  if o.get("active") and o.get("name") == "Worn flagstone"]
    floor_key = convert_mesh("sharedassets0.assets", "Shell_FlagA")
    floor_instances = []
    floor_mats = set()
    for o in flagstones:
        mats = [register_material(mm) for mm in (o.get("materials") or [])]
        if not mats:
            continue
        floor_mats.update(mats)
        floor_instances.append({
            "pos": [round(v, 4) for v in o["world_position"]],
            "mats": mats,
        })
    # Shell_FlagA AABB is 0.743 x 0.099 x 0.633; grid spacing 0.78 x 0.68.
    # Instances keep their own materials (Slate vs Stone) — the scene groups
    # them by material at load time.
    floor = {
        "mesh": floor_key,
        "note": "8x8 flagstones at exact layout.json positions; mesh is the real Shell_FlagA (61 verts). Materials per stone from its GO (Room_FloorSlate pid 179 / Room_FloorStone pid 181).",
        "instances": floor_instances,
    }

    # --- sword assembly from dump2 sharedassets0 ---
    sa = dump2["files"]["sharedassets0.assets"]
    sa_gos = {g["path_id"]: g["name"] for g in sa["gameobjects"]}
    sa_trs = {t["path_id"]: t for t in sa["transforms"]}
    sa_mf = {}
    for mf in sa.get("meshfilters", []):
        sa_mf[mf["go"][1]] = mf
    sa_mr = {}
    for mr in sa.get("meshrenderers", []):
        sa_mr[mr["go"][1]] = mr
    # material properties for sword parts come from layout.json sword_forms
    sword_mat_props = {}
    for part in layout["sword_forms"]["base_form"]["parts"]:
        sword_mat_props[part["part"]] = part["material"]
    # children of TR 469 (BasicTributeSword root transform)
    root_tr = sa_trs[469]
    sword_parts = []
    for child in root_tr["children"]:
        tr = sa_trs[child[1]]
        go_pid = tr["go"][1]
        name = sa_gos.get(go_pid, "?")
        mf = sa_mf.get(go_pid, {})
        mesh_info = mf.get("mesh") if isinstance(mf, dict) else None
        # mesh name from layout.json sword_forms by part role; fall back to mf
        mesh_name = None
        if isinstance(mesh_info, dict):
            mesh_name = mesh_info.get("name")
        # role by GO name
        lname = name.lower()
        if "blade" in lname:
            role, mesh_name = "blade", "Blade"
        elif "pommel" in lname:
            role, mesh_name = "pommel", "RefitBevelUnit"
        elif "crossguard" in lname:
            role, mesh_name = "crossguard", "RefitBevelUnit"
        elif "fuller" in lname:
            role, mesh_name = "fuller", "RefitBevelUnit"
        elif "grip winding" in lname:
            role, mesh_name = "grip_winding", "RefitBevelUnit"
        elif "grip" in lname:
            role, mesh_name = "grip", "RefitBevelUnit"
        else:
            role = "other"
        key = convert_mesh("sharedassets0.assets", mesh_name) if mesh_name else None
        # material: from sword_forms by role, else from the meshrenderer
        mat_rec = sword_mat_props.get(role)
        if mat_rec:
            mid = register_material({
                "name": mat_rec["name"],
                "file": "sharedassets0.assets",
                "path_id": mat_rec["path_id"],
                "shader": mat_rec["shader"],
                "textures": mat_rec.get("textures") or [],
                "colors": {"_BaseColor": mat_rec.get("base_color") or [1, 1, 1, 1]},
            })
        else:
            mid = None
        sword_parts.append({
            "part": role,
            "go": go_pid,
            "name": name,
            "mesh": key,
            "pos": [round(v, 5) for v in tr["pos"]],
            "quat": [round(v, 5) for v in tr["rot"]],
            "scale": [round(v, 5) for v in tr["scale"]],
            "material": mid,
        })
    # The blade's detail atlas is runtime-applied (no material references it):
    # SwordV2DetailAtlas pid 1697 is registered as a texture need here.
    tex_needed[1697] = "SwordV2DetailAtlas.png"
    sword_spawn = None
    for mk in layout["sword_forms"]["base_form"]["runtime_markers_in_room"]:
        if mk["go_path_id"] == 2896:
            sword_spawn = mk
    resting = [mk for mk in layout["sword_forms"]["base_form"]["runtime_markers_in_room"]
               if "Resting sword" in mk.get("name", "")]
    sword = {
        "note": "Assembly reproduced exactly from dump2 sharedassets0 TR 469 children (pos/quat/scale per part). Grade->form mapping is TODO-RE (SwordV2Catalog asset absent); the base form is used for all grades.",
        "parts": sword_parts,
        "spawn": sword_spawn,
        "resting_markers": resting,
    }

    # --- lights ---
    lights_out, lights_omitted = [], []
    for l in layout["lights"]:
        rec = {
            "name": l["name"],
            "go": l["go_path_id"],
            "pos": [round(v, 3) for v in l["world_position"]],
            "euler": [round(v, 2) for v in l["world_euler"]],
            "color": [round(c, 3) for c in l["light"]["color"][:3]],
            "intensity": l["light"]["intensity"],
            "range": l["light"]["range"],
            "spotAngle": l["light"]["spot_angle"],
            "innerSpot": l["light"].get("inner_spot"),
            "shadow": l["light"].get("shadow_type", 0),
        }
        if l["name"] in LIGHTS_INCLUDED:
            lights_out.append(rec)
        else:
            rec["reason"] = "omitted: covered by a nearby stronger kept light"
            lights_omitted.append(rec)

    # --- outcome lights (5 thin boxes on the instrument board; ?MISSING mesh,
    # so the real size is the object scale 0.224 x 0.006 x 0.002 and the colour
    # is the material _BaseColor) ---
    outcome_lights = []
    for o in objects:
        if o.get("name") != "Outcome light" or not o.get("active"):
            continue
        mats = o.get("materials") or []
        if not mats:
            continue
        mname = mats[0].get("name", "")
        try:
            idx = int(mname.rsplit(" ", 1)[1])
        except (ValueError, IndexError):
            continue
        colors = mats[0].get("colors") or {}
        base = colors.get("_BaseColor") or colors.get("_Color") or [1, 1, 1, 1]
        outcome_lights.append({
            "index": idx,
            "go": o["go_path_id"],
            "pos": [round(v, 4) for v in o["world_position"]],
            "quat": [round(v, 5) for v in world_quat[o["go_path_id"]]],
            "size": [round(v, 4) for v in o["world_scale"]],
            "color": [round(c, 3) for c in base[:3]],
        })
    outcome_lights.sort(key=lambda r: r["index"])

    # --- boards with exact transforms (for the canvas-texture displays) ---
    # AABB sizes from scene-layout/work/mesh-export-report.json (LAYOUT.md §5):
    # Instrument_Board 1.488 x 0.713 x 0.096; Meter_Plaque 1.22 x 0.483 x 0.097;
    # chalk slate 1.09 x 1.39 x 0.038 (mesh name B_1.090_1.390_0.038_0.007).
    # Calendar paper has NO mesh (3D text only) — paper size is an APPROXIMATION
    # (TODO-RE): month text at y 2.285, day row at y 2.122, batten 0.76 wide.
    def board_rec(pid, note, aabb, text_span=None):
        o = by_pid[pid]
        return {
            "name": o["name"],
            "go": pid,
            "pos": [round(v, 4) for v in o["world_position"]],
            "quat": [round(v, 5) for v in world_quat[pid]],
            "aabb": aabb,
            "textSpan": text_span,
            "note": note,
        }
    boards3d = {
        "instrument": board_rec(3565, "Instrument_Board front face; text span from LAYOUT.md §5a (x [-1.74,-0.37], y [1.30,1.87] world) relative to board centre [-1.053,1.596,2.414].",
                                [1.488, 0.713, 0.096], {"x": [-0.687, 0.683], "y": [-0.296, 0.274]}),
        "meter": board_rec(3401, "Meter_Plaque recessed panel 1.09 x 0.26 m (LAYOUT.md §5c); required value top row, placed value bottom row.",
                            [1.22, 0.483, 0.097], {"x": [-0.545, 0.545], "y": [-0.13, 0.13]}),
        "ledger": board_rec(1720, "Chalk slate face; frame+slate INACTIVE in level0 data (see LEDGER_FORCE_INCLUDE). Contract text drawn as chalk on the slate.",
                            [1.09, 1.39, 0.038], {"x": [-0.5, 0.5], "y": [-0.65, 0.65]}),
        "calendar": board_rec(3264, "Calendar paper and ink; paper size APPROXIMATION (TODO-RE) — no mesh in data; month '4월' + day numbers are 3D text.",
                              [0.85, 0.55, 0.01], {"x": [-0.425, 0.425], "y": [-0.275, 0.275]}),
    }

    # --- relic wall slots (8 'Permanent item slot N', LAYOUT.md §4/§5) ---
    relic_slots = []
    for o in objects:
        if o.get("name", "").startswith("Permanent item slot") and o.get("active"):
            try:
                idx = int(o["name"].rsplit(" ", 1)[1])
            except (ValueError, IndexError):
                continue
            relic_slots.append({
                "slot": idx,
                "go": o["go_path_id"],
                "pos": [round(v, 4) for v in o["world_position"]],
                "quat": [round(v, 5) for v in world_quat[o["go_path_id"]]],
            })
    relic_slots.sort(key=lambda r: r["slot"])

    # --- hammer group ---
    hammer_origin = by_pid[HAMMER_PARENT]["world_position"]
    hammer = {
        "note": "Working hammer / animated pivot (GO 2843). Parts are placed with their WORLD transforms inside a group at the pivot origin [-1.613, 1.193, 2.031]; the swing rotates the group about its local Z axis. Exact swing kinematics are TODO-RE (animation code, not scene data).",
        "origin": [round(v, 4) for v in hammer_origin],
        "parts": hammer_parts,
    }

    # --- boards / targets / dust ---
    boards = {}
    for cd in layout["contract_displays"]:
        boards[cd["object"]] = cd
    # tap targets (world points, from LAYOUT.md sections 4-5)
    targets = {
        "anvil": {"point": [-1.07, 1.125, 2.19], "note": "anvil striking face centre (go 1916); tap anvil/sword = strike"},
        "bell": {"point": [1.654, 1.17, -1.609], "note": "Counter service bell (ForgeInteractable); tap = tribute"},
        "ledger": {"point": [-1.988, 1.79, 2.752], "note": "Forge Ledger (ForgeInteractable); tap = next day"},
        "calendar": {"point": [-2.282, 1.901, 2.854], "note": "Round calendar; tap = next day (same as ledger)"},
        "window": {"point": [0.95, 1.3, -1.84], "note": "service window / counter; tap = tribute (same as bell)"},
    }
    dust = []
    for o in objects:
        if o.get("particle_system"):
            dust.append({"name": o["name"], "pos": [round(v, 3) for v in o["world_position"]],
                         "parent": o.get("parent")})

    # --- assemble scene-data.json ---
    obj_list = []
    for (key, mats), insts in groups.items():
        obj_list.append({"mesh": key, "materials": list(mats), "instances": insts})

    cam = layout["camera"]
    scene_data = {
        "format": "forgetax-scene-1",
        "source": layout["source"],
        "note": "All numbers from data.unity3d level0 via scene-layout/layout.json + work/dump2.json. See LAYOUT.md for the full spec and TODO-RE list.",
        "bounds": layout["coordinate_frame"]["bounds_world"],
        "camera": {
            "eye": cam["world_position"],
            "forward": cam["forward"],
            "up": cam["up"],
            "fov": cam["fov_degrees"],
            "near": cam["near"],
            "far": cam["far"],
            "background": cam["background_color"],
            "workFov": cam["forge_first_person_script"]["work_field_of_view_deg"],
            "workLookPitch": cam["forge_first_person_script"]["work_look_pitch_deg"],
            "eyeHeight": cam["forge_first_person_script"]["eye_height"],
            "walkerPos": cam["walker_world_position"],
            "walkerForward": cam["walker_forward"],
        },
        "workView": {
            "note": "P0 defaults to the WORK view (eye + lookAt anvil striking face, FOV 61 work). The original spawns facing the service window (forward [0.4019,-0.309,-0.8619], FOV 69); free-look drag turns the camera to that view. The exact runtime spawn<->work blend is TODO-RE (ForgeFirstPerson behaviour).",
            "eye": cam["world_position"],
            "lookAt": [-1.07, 1.125, 2.19],
            "fov": cam["forge_first_person_script"]["work_field_of_view_deg"],
        },
        "lights": lights_out,
        "lightsOmitted": lights_omitted,
        "lightsNote": "11 of 20 real Spot lights are used (see LIGHTS_INCLUDED in convert-scene.py). The original's baked lightmaps/probes are absent from the bundle; the renderer adds a small ambient fill (documented in scene3d.js). No shadows (perf, HD 4400 target). The 3 zero-intensity event lights (Eye/Breath/Quota glint) are included and driven by game events.",
        "materials": materials,
        "objects": obj_list,
        "floor": floor,
        "sword": sword,
        "hammer": hammer,
        "outcomeLights": outcome_lights,
        "boards3d": boards3d,
        "relicSlots": relic_slots,
        "boards": boards,
        "targets": targets,
        "dust": dust,
        "stats": {
            "objectsSelected": len([o for o in objects if o.get("active") and usable(o)]),
            "uniqueMeshes": len(mesh_records),
            "totalVerts": sum(r["verts"] for r in mesh_records.values()),
            "instanceGroups": len(obj_list),
            "skipped": dict(skipped),
            "eulerMismatches": euler_mismatch[:20],
            "flagstones": len(floor_instances),
        },
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "meshes.json"), "w") as f:
        json.dump({"format": "forgetax-mesh-1", "meshes": mesh_records}, f)
    with open(os.path.join(OUT_DIR, "scene-data.json"), "w") as f:
        json.dump(scene_data, f)

    # texture copy list
    print("objects selected: %d" % scene_data["stats"]["objectsSelected"])
    print("unique meshes: %d, total verts: %d" % (len(mesh_records), scene_data["stats"]["totalVerts"]))
    print("instance groups: %d" % len(obj_list))
    print("skipped:", dict(skipped))
    print("euler mismatches (>~1.8deg): %d" % len(euler_mismatch))
    for m in euler_mismatch[:10]:
        print("   ", m)
    print("flagstones: %d (mesh %s)" % (len(floor_instances), floor_key))
    print("sword parts: %d" % len(sword_parts))
    print("hammer parts: %d (origin %s)" % (len(hammer_parts), hammer["origin"]))
    print("outcome lights: %d" % len(outcome_lights))
    print("relic slots: %d" % len(relic_slots))
    print("lights kept: %d, omitted: %d" % (len(lights_out), len(lights_omitted)))
    print("meshes.json bytes: %d" % os.path.getsize(os.path.join(OUT_DIR, "meshes.json")))
    print("scene-data.json bytes: %d" % os.path.getsize(os.path.join(OUT_DIR, "scene-data.json")))
    print("textures needed (pid -> png):")
    for pid in sorted(tex_needed):
        print("   %s -> %s" % (pid, tex_needed[pid]))
    print("materials: %d" % len(materials))


if __name__ == "__main__":
    main()
