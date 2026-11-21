#!/usr/bin/env python3
"""Convert the 111 ResolveId-reachable sword prefabs into the remake's
runtime format (R-17, CIPHER v2 data).

Sources (all from the 3.17.0 APK, package com.soucean.cantkeepfire):
  scene-layout/behavior.json — sword_form_selection:
    evolutionCatalogue (117 entries {id, grade, family, displayName (Korean),
    prefab}) + ForgeSwordEvolutionSet (28 special lines) + the ResolveId
    algorithm (BEHAVIOR.md §8.4, RVA 0x25846E4) + ForgeSpecialLine.IdAt/
    StageOf (RVA 0x263873C/0x2638454).
  ForgeTax-Mobile-CIPHER-P0v2.zip — 02_ASSETS_GOC/meshes-swords/ (510 OBJs)
  unity/textures-3.17.0/main-XXXX_palette.png — per-sword palette (RGBAHalf,
    8 wide x N tall). Row 0 col 0 = the primary (blade) colour; columns 4-7
    are sentinel/debug slots, NOT real colours (constant across all palettes).
  01_TEXTUAL_GOC/vi.txt — sword.<id>.name (VI name for every catalogue id).

Outputs (into remake/app/frontend/):
  swords/<pid>.json       — one quantized mesh per reachable prefab
                            (same quantize_mesh format as meshes.json:
                            positions uint16, normals int8, uvs uint16,
                            indices uint16/32, base64; winding reversed).
  swords-manifest.json    — id -> {file, bbox, verts, tris, paletteColor
                            (sRGB 0-255, row 0 col 0), grade, family,
                            viName, prefabGo, reachable}
  sword-catalogue.json    — the 117 catalogue entries + 28 special lines
                            + ResolveId/StageOf constants (for the JS
                            resolver in scene3d.js).

REACHABLE SET: brute-forced here with the exact ResolveId algorithm
(grade 0..999 x parent 0..2 x branch 0..3 = 12,000 combos -> 111 ids,
all present in the catalogue). The 6 catalogue ids 8/13/18/23/28/33 are
NOT reachable via ResolveId (verified: they never appear in the
brute-force output) — they are listed in the manifest as unreachable
with a TODO-RE note (their selection path is unrecovered; see
BEHAVIOR.md §8.4 / CIPHER v2 handoff M7). Their OBJs are NOT converted
(no mesh file is written for them; the frontend falls back to the base
Blade for them, which in practice never happens because ResolveId never
outputs them).

NOT converted (P1 scope, not P0): the 28 special lines' 393 prefabs
(worldtree/amber/... idBase+stage) — no P0 sword has a special line
(the special lines come via the merchant, P1). Their catalogue data IS
in sword-catalogue.json for the resolver; their meshes are converted in P1.

SCALE (documented approximation): the catalogue prefabs are rendered at
the base Blade's part scale [0.59, 0.62, 0.72] (data.sword.parts, the
Forged steel blade part) — the per-grade ForgeSwordSize.ModelScale
formula is NOT extracted (BEHAVIOR.md §8.4: "ModelScale formula NOT
extracted"), so the base scale is used for all grades (TODO-RE).
The mesh is positioned by the pommel: offsetY = -0.092 - bboxMin.y
(the base assembly's Iron pommel part sits at prefab Y -0.092).
"""
import base64
import importlib.util
import json
import os
import subprocess
import sys
import zipfile
from PIL import Image

ROOT = os.path.expanduser("~/workspace/forgetax-mobile")
BEHAVIOR = os.path.join(ROOT, "scene-layout/behavior.json")
ZIP = os.path.join(ROOT, "ForgeTax-Mobile-CIPHER-P0v2.zip")
TEX_DIR = os.path.join(ROOT, "unity/textures-3.17.0")
OUT_DIR = os.path.join(ROOT, "remake/app/frontend/swords")
FRONTEND = os.path.join(ROOT, "remake/app/frontend")
SCRATCH = os.path.join(ROOT, "tmp-sword-convert")

# --- ResolveId (BEHAVIOR.md §8.4, RVA 0x25846E4) ---------------------------
def grand_tier(grade):
    if grade < 25:
        return -1
    if grade > 29:
        return 1
    return 0

def resolve_id(grade, parent, branch):
    """ForgeSwordEvolution.ResolveId(highestGrade, parent, branch)."""
    if grade < 2:
        return 1
    if grade <= 3:
        return 38
    if grade <= 5:
        return 39
    if grade <= 9:
        return ((1 if grade > 7 else 0) | (parent << 1)) + 2
    if grade <= 998:
        parent = max(0, min(2, parent))
        branch = max(0, min(3, branch))
        tier = grand_tier(grade)
        if tier >= 0:
            u = (parent << 1) | 1 if branch < 2 else parent * 2 + 5
            base = 3998 if tier == 0 else 3999
            return base + (u + branch) * 2
        if branch < 2:
            if grade <= 13:
                return (parent * 2 + 40) | branch
            if grade <= 15:
                u = 1
            elif grade <= 17:
                u = 2
            elif grade <= 19:
                u = 3
            else:
                u = 4
            return (branch | (parent << 1)) * 5 + u + 8
        return min((grade - 10) >> 1, 5) + (branch + parent * 2) * 6 + 34
    # grade >= 999
    u = (parent << 1) | 1 if branch < 2 else parent * 2 + 5
    return branch + u + 4023

def stage_of(grade, bonus_stages):
    """ForgeSpecialLine.StageOf (RVA 0x2638454)."""
    if grade < 25:
        return max(0, min(10, grade >> 1))
    if grade <= 29:
        return 11
    if grade >= 50 and bonus_stages >= 1:
        return 13
    if grade >= 999:
        return 13
    return 12

def special_id_at(id_base, grade, bonus_stages):
    """ForgeSpecialLine.IdAt (RVA 0x263873C)."""
    stage = stage_of(grade, bonus_stages)
    max_stage = 14 if bonus_stages > 0 else 13
    return id_base + (99 if stage == max_stage else stage)

def main():
    be = json.load(open(BEHAVIOR))
    sfs = [s for s in be["systems"] if s["system"] == "sword_form_selection"][0]["fields"]
    table = sfs["evolutionCatalogue"]["table"]
    by_id = {e["id"]: e for e in table}

    # --- verify ResolveId against the BEHAVIOR.md §8.4 sample (p0/b0) ------
    samples = [
        (0, 0, 0, 1), (2, 0, 0, 38), (4, 0, 0, 39), (6, 0, 0, 2),
        (8, 0, 0, 3), (10, 0, 0, 40), (13, 0, 0, 40), (14, 0, 0, 9),
        (16, 0, 0, 10), (18, 0, 0, 11), (20, 0, 0, 12), (25, 0, 0, 4000),
        (30, 0, 0, 4001), (999, 0, 0, 4024), (14, 0, 2, 48), (14, 1, 0, 19),
    ]
    for g, p, b, want in samples:
        got = resolve_id(g, p, b)
        assert got == want, f"ResolveId({g},{p},{b}) = {got}, want {want}"
    print(f"ResolveId: {len(samples)}/{len(samples)} samples OK")

    # --- brute-force the reachable set --------------------------------------
    reachable = set()
    for g in range(1000):
        for p in range(3):
            for b in range(4):
                reachable.add(resolve_id(g, p, b))
    assert reachable <= set(by_id), "reachable ids missing from catalogue: %s" % sorted(reachable - set(by_id))
    unreachable = sorted(set(by_id) - reachable)
    print(f"reachable: {len(reachable)} ids; catalogue-only (unreachable): {unreachable}")
    assert unreachable == [8, 13, 18, 23, 28, 33], f"unexpected unreachable set: {unreachable}"

    # --- VI names (vi.txt entries list) --------------------------------------
    out = subprocess.run(
        ["unzip", "-p", ZIP, "ForgeTax-Mobile-CIPHER-P0v2/01_TEXTUAL_GOC/vi.txt"],
        capture_output=True, text=True, check=True).stdout
    vi = {e["key"]: e["text"] for e in json.loads(out)["entries"]}
    missing_names = [i for i in by_id if f"sword.{i}.name" not in vi]
    assert not missing_names, f"missing VI names: {missing_names}"
    print(f"VI names: {len(by_id)}/{len(by_id)} catalogue ids present in vi.txt")

    # --- load the converter --------------------------------------------------
    spec = importlib.util.spec_from_file_location("conv", os.path.join(ROOT, "remake/tools/convert-scene.py"))
    conv = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(conv)

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SCRATCH, exist_ok=True)
    zf = zipfile.ZipFile(ZIP)
    manifest = {}
    total_json = 0
    for pid in sorted(reachable):
        entry = by_id[pid]
        go = entry["prefab_go"]  # e.g. '0001' (zero-padded)
        obj_name = f"ForgeTax-Mobile-CIPHER-P0v2/02_ASSETS_GOC/meshes-swords/{go}_00_Body_solid.obj"
        try:
            info = zf.getinfo(obj_name)
        except KeyError:
            print(f"  !! {pid}: OBJ missing in zip: {obj_name}")
            manifest[pid] = {"reachable": True, "missing_obj": True}
            continue
        obj_path = os.path.join(SCRATCH, f"{go}.obj")
        with open(obj_path, "wb") as f:
            f.write(zf.read(obj_name))
        parsed = conv.parse_obj(obj_path)
        rec = conv.quantize_mesh(parsed, go)
        if rec is None:
            print(f"  !! {pid}: quantize returned None")
            continue
        js = json.dumps(rec, separators=(",", ":"))
        with open(os.path.join(OUT_DIR, f"{go}.json"), "w") as f:
            f.write(js)
        total_json += len(js)
        # palette primary colour: row 0 col 0 of main-<pid>_palette.png
        pal_path = os.path.join(TEX_DIR, f"main-{go}_palette.png")
        pal_color = None
        if os.path.exists(pal_path):
            im = Image.open(pal_path).convert("RGBA")
            r, g, b, a = im.getpixel((0, 0))
            pal_color = [r, g, b]
        else:
            print(f"  !! {pid}: palette missing: {pal_path}")
        manifest[pid] = {
            "file": f"swords/{go}.json",
            "prefabGo": go,
            "grade": entry["grade"],
            "family": entry["family"],
            "viName": vi[f"sword.{pid}.name"],
            "koName": entry["displayName"],
            "bboxMin": rec["bboxMin"],
            "bboxMax": rec["bboxMax"],
            "verts": rec["verts"],
            "tris": rec["tris"],
            "paletteColor": pal_color,
            "paletteFile": f"main-{go}_palette.png",
            "reachable": True,
        }
    for pid in unreachable:
        entry = by_id[pid]
        manifest[pid] = {
            "file": None,
            "prefabGo": entry["prefab_go"],
            "grade": entry["grade"],
            "family": entry["family"],
            "viName": vi[f"sword.{pid}.name"],
            "koName": entry["displayName"],
            "reachable": False,
            "note": "TODO-RE: in catalogue with a resolvable prefab, but no "
                    "selection path outputs this id (ResolveId/ResolveMain/IdAt "
                    "never return it — BEHAVIOR.md §8.4 M7). Frontend falls "
                    "back to the base Blade if it is ever requested.",
        }
    with open(os.path.join(FRONTEND, "swords-manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    catalogue = {
        "source": "behavior.json sword_form_selection.evolutionCatalogue (117 entries) + ForgeSwordEvolutionSet (28 special lines)",
        "resolveIdRva": "0x25846E4",
        "reachableCount": len(reachable),
        "unreachableIds": unreachable,
        "entries": table,
        "specialLines": sfs["special_lines"],
        "note": "The JS resolver (scene3d.js resolveAppearanceId) mirrors "
                "ResolveId/StageOf/IdAt above. P0 swords have no special "
                "line, so only the ordinary ResolveId path runs in P0.",
    }
    with open(os.path.join(FRONTEND, "sword-catalogue.json"), "w") as f:
        json.dump(catalogue, f, ensure_ascii=False, indent=1)
    n_files = len([m for m in manifest.values() if m.get("file")])
    print(f"wrote {n_files} sword JSONs ({total_json/1048576:.1f} MB total) + swords-manifest.json + sword-catalogue.json")
    print(f"manifest ids: {len(manifest)} (reachable {len(reachable)}, unreachable {len(unreachable)})")

if __name__ == "__main__":
    main()
