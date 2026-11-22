#!/usr/bin/env python3
"""Pixel-measure the furnace core + held blade, like AEGIS did (PIL).
Usage: python3 measure-shots.py <furnace.png> <held.png>
Prints mean / max brightness of the furnace mouth centre and the held blade.
"""
import sys
from PIL import Image

def brightness(px):
    return 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]

def measure_furnace(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    # Mouth centre: the shot is 1280x720, furnace facing, mouth ~ (640, 280).
    cx, cy = int(w * 0.5), int(h * 0.39)
    region = [im.getpixel((x, y)) for y in range(cy - 25, cy + 25)
              for x in range(cx - 60, cx + 60)]
    b = [brightness(p) for p in region]
    mx = max(b)
    mean = sum(b) / len(b)
    centre = im.getpixel((cx, cy))
    print(f"FURNACE {path}: size {w}x{h}, centre ({cx},{cy}) RGB {centre} "
          f"brightness {brightness(centre):.1f}, region mean {mean:.1f}, max {mx:.1f}")
    # Also the brightest 3x3 block in the central band (y 180-380, x 480-800).
    best = (0, None)
    for y in range(180, 380, 5):
        for x in range(480, 800, 5):
            bb = brightness(im.getpixel((x, y)))
            if bb > best[0]:
                best = (bb, (x, y))
    print(f"  brightest central pixel: {best[0]:.1f} at {best[1]}")

def measure_held(path):
    """Measure the HELD BLADE itself, not the whole quadrant.

    AEGIS round 5 caught a method error in the first version of this
    script: it sampled the whole bottom-right quadrant, whose bright
    pixels are mostly the white ledger paper + instrument board (only
    0.2% of the >=60 pixels were on the blade), so p90=80.2 measured
    the ledger, not the blade. The held sword is a child of the camera,
    so its screen position is FIXED (tip ~(1262,140) -> guard
    ~(1010,465) in a 1280x720 frame, FOV 69 free view after walking).
    Sample along that diagonal, +/-6 px — AEGIS's method.
    """
    im = Image.open(path).convert("RGB")
    w, h = im.size
    tip, guard = (1262, 140), (1010, 465)
    n = 200
    vals = []
    for i in range(n + 1):
        t = i / n
        x = int(tip[0] + (guard[0] - tip[0]) * t)
        y = int(tip[1] + (guard[1] - tip[1]) * t)
        for dx in (-6, 0, 6):
            for dy in (-6, 0, 6):
                xx, yy = min(max(x + dx, 0), w - 1), min(max(y + dy, 0), h - 1)
                vals.append(brightness(im.getpixel((xx, yy))))
    vals.sort()
    m = len(vals)
    print(f"HELD-BLADE {path}: size {w}x{h}, diagonal tip{tip}->guard{guard}, "
          f"n={m}, median {vals[m//2]:.1f}, p75 {vals[int(m*0.75)]:.1f}, "
          f"p90 {vals[int(m*0.9)]:.1f}, p95 {vals[int(m*0.95)]:.1f}, max {vals[-1]:.1f}")

if __name__ == "__main__":
    for p in sys.argv[1:]:
        if "furnace" in p or "diag" in p:
            measure_furnace(p)
        else:
            measure_held(p)
