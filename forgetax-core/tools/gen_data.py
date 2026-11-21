#!/usr/bin/env python3
"""Generate src/data.rs from the extracted balance data.

Reads ~/workspace/forgetax-mobile/unity/textassets/Economy.txt (the
MOBILE 3.17.0 balance bible, extracted from the Soucean APK's
data.unity3d) and emits Rust constants: BREAK_CURVE (300 entries),
QUOTAS (24 entries), LEGACY_QUOTAS (21 entries) and the RELICS table
(119 items, structural/numeric fields only).

Clean-room note: only balance NUMBERS and structural keys (ids, families,
rarity/price/tier) are copied — these are game rules. Original Korean
name/desc TEXT is deliberately NOT emitted. Display names for the clone
must be written fresh (see relics.rs).

Usage: python3 tools/gen_data.py   (run from the clone/ directory)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CLONE = os.path.dirname(HERE)
ECONOMY = "/home/hatch/workspace/forgetax-mobile/unity/textassets/Economy.txt"
OUT = os.path.join(CLONE, "src", "data.rs")

FAMILY_MAP = {
    "success": "Success",
    "hold": "Hold",
    "damage": "Damage",
    "defense": "Defense",
    "consumable": "Consumable",
    "achievement": "Achievement",
    "frenzy": "Frenzy",
    "great": "Great",
    "mixed": "Mixed",
    "merchant": "Merchant",
    "break": "Break",
    "economy": "Economy",
    "value": "Value",
    "utility": "Utility",
    # Mastery families (original keys are Korean; mapped to English variants).
    "성채검": "Citadel",    # Citadel sword line
    "성검": "Holy",         # Holy sword line
    "톱니검": "Saw",        # Sawblade line
    "용아검": "Dragonfang",  # Dragonfang line
    "룬검": "Rune",         # Runeblade line
    "분열검": "Split",       # Splitblade line
    "세계수": "WorldTree",   # World Tree line
    "어류검": "Fish",        # Fishblade line
}


def f64_lit(v) -> str:
    v = float(v)
    if v == int(v):
        return f"{v:.1f}"
    return repr(v)


def bool_lit(v: bool) -> str:
    return "true" if v else "false"


def main() -> int:
    with open(ECONOMY, encoding="utf-8") as f:
        data = json.load(f)

    cfg = data["config"]
    curve = cfg["breakCurve"]
    quotas = cfg["quotas"]
    legacy_quotas = cfg["legacyQuotas"]
    items = data["items"]
    assert len(curve) == 300, f"breakCurve has {len(curve)} entries, expected 300"
    assert len(quotas) == 24, f"quotas has {len(quotas)} entries, expected 24"
    assert len(legacy_quotas) == 21, f"legacyQuotas has {len(legacy_quotas)} entries, expected 21"
    assert len(items) == 119, f"items has {len(items)} entries, expected 119"

    lines = []
    lines.append("// GENERATED — do not edit by hand. Run `python3 tools/gen_data.py`.")
    lines.append("// Source: ~/workspace/forgetax-mobile/unity/textassets/Economy.txt")
    lines.append("// (MOBILE 3.17.0 balance data, Soucean APK). Only numbers and")
    lines.append("// structural keys are reproduced here (game rules); original")
    lines.append("// name/desc text is NOT included.")
    lines.append("")
    lines.append("use crate::relics::{RelicDef, RelicFamily};")
    lines.append("")
    lines.append("/// Break probability by forge grade, grades 0..=299.")
    lines.append("/// Source: Economy.txt config.breakCurve (300 entries, MOBILE:")
    lines.append("/// plateaus 0.71 at 30-99, 0.81 at 100-199, 0.89 at 200-299).")
    lines.append("#[rustfmt::skip]")
    lines.append("pub const BREAK_CURVE: [f64; 300] = [")
    for i in range(0, 300, 10):
        chunk = ", ".join(f64_lit(v) for v in curve[i:i + 10])
        lines.append(f"    {chunk},")
    lines.append("];")
    lines.append("")
    lines.append("/// Tribute quota (gold) per contract round, rounds 1..=24.")
    lines.append("/// Source: Economy.txt config.quotas (identical to the PC original).")
    lines.append("#[rustfmt::skip]")
    lines.append("pub const QUOTAS: [u64; 24] = [")
    for i in range(0, 24, 8):
        chunk = ", ".join(str(v) for v in quotas[i:i + 8])
        lines.append(f"    {chunk},")
    lines.append("];")
    lines.append("")
    lines.append("/// Legacy 21-day tribute quotas (pre-2026-11-16 runs).")
    lines.append("/// Source: Economy.txt config.legacyQuotas. P0 uses the 24-round")
    lines.append("/// table; this is kept for the P1 legacy mode.")
    lines.append("#[rustfmt::skip]")
    lines.append("pub const LEGACY_QUOTAS: [u64; 21] = [")
    for i in range(0, 21, 8):
        chunk = ", ".join(str(v) for v in legacy_quotas[i:i + 8])
        lines.append(f"    {chunk},")
    lines.append("];")
    lines.append("")
    lines.append("/// All 119 items (relics + consumables + merchant goods). Field order")
    lines.append("/// matches `RelicDef` in relics.rs. `min_round` is the JSON `min` field")
    lines.append("/// (earliest round the item can appear: 2 = from round 2, 8 = mid wave,")
    lines.append("/// 16 = late wave). `max` is reproduced as-is; its meaning is")
    lines.append("/// unconfirmed (see README).")
    lines.append("#[rustfmt::skip]")
    lines.append("pub const RELICS: [RelicDef; 119] = [")
    for it in items:
        fam = FAMILY_MAP[it["family"]]
        lines.append(
            "    RelicDef { "
            f"id: \"{it['id']}\", "
            f"rarity: {it['rarity']}, "
            f"price: {it['price']}, "
            f"tier: {it['tier']}, "
            f"family: RelicFamily::{fam}, "
            f"group: \"{it['group']}\", "
            f"min_round: {it['min']}, "
            f"max: {it['max']}, "
            f"starter: {bool_lit(bool(it.get('starter')))}, "
            f"consumable: {bool_lit(bool(it.get('consumable')))}, "
            f"retired: {bool_lit(bool(it.get('retired')))} "
            "},"
        )
    lines.append("];")
    lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"wrote {OUT}: curve={len(curve)} quotas={len(quotas)} relics={len(items)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
