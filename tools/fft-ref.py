#!/usr/bin/env python3
"""FFT reference analysis for the ForgeTax sound rebuild (F-4).
Reads the ORIGINAL 101 WAVs (reference only — never shipped) and prints
the spectral fingerprints the WebAudio synth must match:
duration / RMS / peak / centroid / band energies / top partials.
Usage: python3 fft-ref.py [wav ...]  (default: the 8 key triggers)
"""
import sys, wave
import numpy as np

WAVDIR = "/home/hatch/workspace/forgetax-mobile/unity/audio_wav"
DEFAULT = [
    "3455_basic_swing.wav", "3434_GreatStrike.wav", "3476_SwordBreak.wav",
    "3407_TributeBell.wav", "3452_FeverOverdrive.wav", "432_Hearth_crackle_loop.wav",
    "3404_SwordSet.wav", "3411_SwordFeed.wav", "3402_impact_heavy_tail.wav",
]

BANDS = [(0, 200), (200, 1000), (1000, 4000), (4000, 8000), (8000, 22050)]

def load(path):
    w = wave.open(path)
    n = w.getnframes()
    sr = w.getframerate()
    raw = w.readframes(n)
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    return x, sr

def top_partials(x, sr, n=8, lo=20):
    # Hann window, full-file FFT, peak-pick with local-max + min distance
    win = np.hanning(len(x))
    spec = np.abs(np.fft.rfft(x * win))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    mag = spec / spec.max() if spec.max() > 0 else spec
    idx = np.argsort(mag)[::-1]
    picked = []
    for i in idx:
        f = freqs[i]
        if f < lo or mag[i] < 0.03:
            break
        if all(abs(f - p[0]) > 60 for p in picked):
            picked.append((float(f), float(mag[i])))
        if len(picked) >= n:
            break
    return picked

def analyze(name):
    x, sr = load(f"{WAVDIR}/{name}")
    dur = len(x) / sr
    rms = float(np.sqrt(np.mean(x ** 2)))
    peak = float(np.max(np.abs(x)))
    # centroid (magnitude-weighted, full file)
    win = np.hanning(len(x))
    spec = np.abs(np.fft.rfft(x * win))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    cent = float(np.sum(freqs * spec) / np.sum(spec)) if spec.sum() > 0 else 0.0
    total_e = float(np.sum(spec ** 2))
    bands = []
    for lo, hi in BANDS:
        m = (freqs >= lo) & (freqs < hi)
        bands.append(float(np.sum(spec[m] ** 2)) / total_e if total_e > 0 else 0.0)
    # decay: RMS in 100ms windows (first 8)
    win_n = int(sr * 0.1)
    decays = []
    for k in range(min(8, len(x) // win_n)):
        seg = x[k * win_n:(k + 1) * win_n]
        decays.append(float(np.sqrt(np.mean(seg ** 2))))
    print(f"== {name} ==  dur={dur:.2f}s rms={rms:.4f} peak={peak:.3f} centroid={cent:.0f}Hz")
    print(f"   bands <200Hz:{bands[0]*100:.0f}% 200-1k:{bands[1]*100:.0f}% 1-4k:{bands[2]*100:.0f}% 4-8k:{bands[3]*100:.0f}% >8k:{bands[4]*100:.0f}%")
    print("   top partials (Hz, rel): " + ", ".join(f"{f:.0f}({a:.2f})" for f, a in top_partials(x, sr)))
    print("   rms/100ms: " + " ".join(f"{v:.3f}" for v in decays))

for name in (sys.argv[1:] or DEFAULT):
    try:
        analyze(name)
    except Exception as e:
        print(f"!! {name}: {e}")
