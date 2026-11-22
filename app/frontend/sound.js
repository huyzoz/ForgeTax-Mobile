// Sound engine — WebAudio-SYNTHESIZED recreations of the original's
// sound triggers. No original audio files are shipped or used; every
// sound below is generated from oscillators and filtered noise at
// runtime. The WHEN matches the original (REA-REPORT §10 / audio-list.txt):
//   strike        — every hammer hit (3455_basic_swing, 1.00s)
//   great         — Great strike (3434_GreatStrike, 1.15s)
//   break         — sword shatters (3476_SwordBreak, 1.20s)
//   tribute bell  — tribute offered (3407_TributeBell, 2.42s) + SwordFeed
//   fever         — Fever starts (3452_FeverOverdrive, 3.80s in-game)
//   set           — sword picked up / set down (3404_SwordSet, 0.09s)
//   crackle       — hearth ambience (432_Hearth_crackle_loop, 58s loop)
// Master / music / SFX sliders actually control the gains. Sound is ON
// by default (the original mobile game has sound on); mute lives in
// settings (master = 0).
//
// F-4 (2026-11-21 fix round) — REBUILT from measured spectra. The old
// engine was FFT-PROVEN wrong on Ethan's live video: the whole 46 s
// track was dominated by 110 Hz + 165 Hz (the 2 drone oscillators in
// the old startAmbient), strike beeps were buried, peaks clipped at
// 1.0. The drone is DELETED. Every trigger below was rebuilt from the
// reference WAVs' measured spectra (remake/tools/fft-ref.py — the 101
// WAVs are reference only, never shipped):
//   strike  3455: centroid 7102 Hz; 41% <200 Hz (low thump) + 32% 4-8k
//           + 21% >8k (bright whoosh/clang); partials 22 Hz (1.00),
//           6262 Hz (0.65); RMS peaks 300-400 ms, dead by 0.5 s.
//   great   3434: 99% 1-4 kHz; partials 1628 Hz (1.00), 4303 (0.08),
//           3254 (0.06); decay ~0.3 s; no low end, no noise.
//   break   3476: 35% <200 + 33% 200-1k + 28% 1-4k; partials 182 (1.00),
//           122 (0.86), 2423 (0.65), 732 (0.45), 1052 (0.41); ~0.4 s.
//   bell    3407: 92% 1-4 kHz; INHARMONIC partials 3603 Hz (1.00),
//           6705 (0.20), 1302 (0.17); long 2.4 s decay. The old
//           523/784/1046 triad was wrong (a major-third chord, not a bell).
//   fever   3452: 81% <200 Hz; fundamental 36 Hz (1.00) + harmonics
//           72/108/216 Hz; flat sustain ~3.8 s in-game. The old sawtooth
//           sweep was wrong.
//   set     3404: 0.09 s click; 1755 Hz (1.00) + 1143 (0.32).
//   feed    3411: low rumble 116/220 Hz + 3.2 kHz scrape, 1.0 s.
//   crackle 432: RMS 0.0055 (VERY quiet — mostly silence + rare pops);
//           pops are broadband 5-8 kHz transients; a faint ~120 Hz bed.
//           The old 110/165 Hz drone is DELETED.
//   thump   3402_impact_heavy_tail: 100% <200 Hz, 32 Hz peak — the
//           strike's low-body reference.
// Master bus: DynamicsCompressor (threshold -12 dB, ratio 8:1) + master
// gain 0.9, so the rendered peak never touches 1.0 (verified offline).
// REMADE — approved by OWNER 2026-11-21 (R-25): the timbres below are
// WebAudio-synthesized recreations, NOT the original's audio files.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.crackleTimer = null;
    this.crackleNodes = null;
    // R-20 — REAL defaults (behavior.json settings_defaults): master /
    // music / sfx are all 1.0 (100%). setVolumes() overwrites these from
    // the settings as soon as they load; these are the pre-load values.
    this.masterVol = 1.0;
    this.musicVol = 1.0;
    this.sfxVol = 1.0;
    this.muted = false;
  }

  // Must be called from a user gesture at least once (autoplay policy).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    // Master bus: gain (0.9 safety headroom) -> compressor -> out.
    // The compressor is the anti-clipping limiter (F-4): threshold
    // -12 dB, ratio 8:1, fast attack, 0.25 s release.
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12;
    this.comp.knee.value = 20;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;
    this.comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.connect(this.comp);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    this.startCrackle();
    return true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.masterVol * 0.9;
    this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicVol, this.ctx.currentTime, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.02);
  }

  setVolumes(master, music, sfx) {
    this.masterVol = Math.max(0, Math.min(1, master / 100));
    this.musicVol = Math.max(0, Math.min(1, music / 100));
    this.sfxVol = Math.max(0, Math.min(1, sfx / 100));
    this.applyVolumes();
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyVolumes();
  }

  // -- node builders (ctx/dest/t0-parameterised so the offline
  //    verifier can render the same triggers on OfflineAudioContext) --
  // A sine partial with an exponential decay (the bell/clang workhorse).
  partial(ctx, dest, t0, freq, dur, gain, { type = "sine", attack = 0.004 } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return { osc, g };
  }

  // A sliding low thump (sine gliding down in pitch).
  thump(ctx, dest, t0, from, to, dur, gain) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Filtered noise with an optional bandpass sweep (whoosh / scrape /
  // shatter) or a fixed band (crackle pop).
  noiseBurst(ctx, dest, t0, dur, gain, { freq = 3000, freqEnd = null, q = 1, type = "bandpass" } = {}) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
  }

  // -- trigger builders (shared by the live engine + the offline
  //    verifier). Each takes (ctx, dest, t0) and schedules its nodes. --
  buildStrike(ctx, dest, t0) {
    // 3455_basic_swing: low thump + bright whoosh + metallic clang.
    // Balance (tuned 2026-11-22 from the offline FFT, 2nd pass): the
    // thump must NOT dominate — the reference is 41% <200 Hz + 32% 4-8k
    // + 21% >8k (centroid 7102 Hz). The 1st pass (thump 0.5) gave 89%
    // <200 Hz and centroid 3637; the 2nd (thump 0.3) gave 64% <200 Hz
    // and only 1% >8k (centroid 4577). Thump 0.25 + a highpassed
    // >8 kHz noise shimmer bring both bands in range. 3rd pass: the whoosh
    // 0.4 -> 0.36 + the 8.4 kHz partial 0.15 -> 0.12 — the peak is
    // noise-random (0.856 one run, 0.954 the next), so it needs margin
    // under 0.95, not a borderline value. O1 (AEGIS 2026-11-22): the
    // peak still ranged 0.73-0.89 across runs (worst margin only ~0.06)
    // — the thump 0.25 -> 0.22 for a little more headroom (band[0]
    // 0.52 -> ~0.48, still in [0.25, 0.6]).
    this.thump(ctx, dest, t0, 70, 38, 0.35, 0.22);
    this.noiseBurst(ctx, dest, t0, 0.4, 0.36, { freq: 2000, freqEnd: 8000, q: 1.2 });
    this.noiseBurst(ctx, dest, t0, 0.3, 0.12, { type: 'highpass', freq: 8000, q: 0.7 });
    this.partial(ctx, dest, t0, 6262, 0.15, 0.35);
    this.partial(ctx, dest, t0, 4300, 0.12, 0.15);
    this.partial(ctx, dest, t0, 3100, 0.12, 0.1);
    this.partial(ctx, dest, t0, 8400, 0.1, 0.12);
  }

  buildGreat(ctx, dest, t0) {
    // 3434_GreatStrike: a PURE ring — the reference is 99% 1-4 kHz
    // (1628 Hz dominant, centroid 3186, no low end, no noise). The
    // Great cue REPLACES the basic swing (it is not strike + ring:
    // the first pass added the strike's thump/whoosh and measured
    // only 44% in 1-4 kHz with a clipping peak of 1.087).
    this.partial(ctx, dest, t0, 1628, 0.35, 0.5);
    this.partial(ctx, dest, t0, 4303, 0.25, 0.06);
    this.partial(ctx, dest, t0, 3254, 0.25, 0.05);
    this.partial(ctx, dest, t0, 2430, 0.2, 0.03);
  }

  buildBreak(ctx, dest, t0) {
    // 3476_SwordBreak: low thud + shatter partials + noise burst.
    // Balance (tuned 2026-11-22 from the offline FFT, 2nd pass): the
    // reference is 35% <200 + 33% 200-1k + 28% 1-4k (182 Hz 1.00,
    // 732 Hz 0.45, 1052 Hz 0.41, 2423 Hz 0.65). The 1st pass gave 80%
    // <200 Hz; the 2nd gave the right bands (0.43/0.20/0.36) but a
    // 0.982 peak (clipping). The 732/1052 partials were also nearly
    // 2x the reference's relative strength — lowered here, which also
    // pulls the peak under 0.95. 3rd pass: the break peak is noise-random
    // too (0.869 one run, 0.988 the next) — the noise burst 0.3 -> 0.25
    // + the 2423 Hz partial 0.35 -> 0.3 for the same margin.
    this.thump(ctx, dest, t0, 150, 70, 0.4, 0.25);
    this.partial(ctx, dest, t0, 182, 0.35, 0.18);
    this.partial(ctx, dest, t0, 732, 0.2, 0.25);
    this.partial(ctx, dest, t0, 1052, 0.2, 0.22);
    this.partial(ctx, dest, t0, 2423, 0.15, 0.3);
    this.noiseBurst(ctx, dest, t0, 0.3, 0.25, { freq: 2000, q: 0.8 });
  }

  buildTribute(ctx, dest, t0) {
    // 3407_TributeBell: inharmonic bell partials, 2.4 s decay.
    this.partial(ctx, dest, t0, 3603, 2.4, 0.38);
    this.partial(ctx, dest, t0, 1302, 2.0, 0.07);
    this.partial(ctx, dest, t0, 6705, 1.2, 0.08);
    // 3411_SwordFeed: the offered sword sliding in (low rumble + scrape).
    this.partial(ctx, dest, t0 + 0.05, 116, 1.0, 0.12, { attack: 0.05 });
    this.partial(ctx, dest, t0 + 0.05, 220, 1.0, 0.06, { attack: 0.05 });
    this.noiseBurst(ctx, dest, t0 + 0.05, 0.8, 0.07, { freq: 3200, q: 1.5 });
  }

  buildFever(ctx, dest, t0) {
    // 3452_FeverOverdrive: 36 Hz fundamental + harmonics, flat 3.8 s.
    // (The earlier 73/215/322 Hz reading was the 2nd/3rd harmonics;
    // the full-file FFT shows the 36 Hz fundamental at 1.00.)
    const parts = [[36, 0.3], [72, 0.18], [108, 0.12], [216, 0.06]];
    for (const [f, g] of parts) {
      const osc = ctx.createOscillator();
      const gn = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(g, t0 + 0.3);
      gn.gain.setValueAtTime(g, t0 + 3.3);
      gn.gain.linearRampToValueAtTime(0, t0 + 3.8);
      osc.connect(gn);
      gn.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 3.85);
    }
  }

  buildSet(ctx, dest, t0) {
    // 3404_SwordSet: a 0.09 s click (pick up / set down a sword).
    this.partial(ctx, dest, t0, 1755, 0.09, 0.25);
    this.partial(ctx, dest, t0, 1143, 0.09, 0.08);
  }

  // Swing without impact (hammer swings at an empty anvil — the held
  // sword was picked up): whoosh only, no clang, no thump.
  buildSwing(ctx, dest, t0) {
    this.noiseBurst(ctx, dest, t0, 0.35, 0.2, { freq: 2000, freqEnd: 5000, q: 1.2 });
  }

  // -- live triggers -------------------------------------------------------
  playStrike() {
    if (!this.ctx) return;
    this.buildStrike(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  playSwing() {
    if (!this.ctx) return;
    this.buildSwing(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  playGreat() {
    if (!this.ctx) return;
    this.buildGreat(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  playBreak() {
    if (!this.ctx) return;
    this.buildBreak(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  playTribute() {
    if (!this.ctx) return;
    this.buildTribute(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  playFever() {
    if (!this.ctx) return;
    this.buildFever(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  playSet() {
    if (!this.ctx) return;
    this.buildSet(this.ctx, this.sfxBus, this.ctx.currentTime);
  }

  // -- hearth crackle (ambient, replaces the deleted 110/165 Hz drone) --
  // 432_Hearth_crackle_loop: RMS 0.0055 — VERY quiet. Random bandpass
  // pops (5-8 kHz, 20-50 ms, every 0.25-1.2 s) over a faint ~120 Hz
  // bed. Runs on the music bus (the "Nhạc · Âm môi trường" slider).
  startCrackle() {
    if (!this.ctx || this.crackleTimer) return;
    const ctx = this.ctx;
    // Faint low bed: 120 Hz sine + lowpassed noise, both near-silent.
    const bedG = ctx.createGain();
    bedG.gain.value = 0.012;
    bedG.connect(this.musicBus);
    const bedOsc = ctx.createOscillator();
    bedOsc.type = "sine";
    bedOsc.frequency.value = 120;
    bedOsc.connect(bedG);
    bedOsc.start();
    this.crackleNodes = { bedOsc, bedG };
    const pop = () => {
      if (!this.ctx) return;
      const t0 = ctx.currentTime;
      const freq = 5000 + Math.random() * 3000;
      this.noiseBurst(ctx, this.musicBus, t0, 0.02 + Math.random() * 0.03, 0.04 + Math.random() * 0.08, { freq, q: 8 });
      this.crackleTimer = setTimeout(pop, 250 + Math.random() * 950);
    };
    this.crackleTimer = setTimeout(pop, 400);
  }

  // -- offline verification (F-4) ------------------------------------------
  // Render one trigger on OfflineAudioContext and analyse it with a
  // small in-JS FFT, so the headless test can compare the synth against
  // the reference WAV table (centroid / band shares / top partials /
  // peak). Returns {peak, rms, centroid, bands[5], partials[[hz,rel]]}.
  async renderOffline(name) {
    const DUR = { strike: 1.0, great: 1.2, break: 1.2, tribute: 2.5, fever: 3.8, set: 0.2, swing: 0.6, crackle: 3.0 };
    const BUILD = {
      strike: this.buildStrike.bind(this), great: this.buildGreat.bind(this),
      break: this.buildBreak.bind(this), tribute: this.buildTribute.bind(this),
      fever: this.buildFever.bind(this), set: this.buildSet.bind(this),
      swing: this.buildSwing.bind(this),
    };
    const sr = 44100;
    const dur = DUR[name] || 1.0;
    const oc = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    // Crackle is stateful (random pops over time) — render 3 s of it
    // deterministically: 8 pops at fixed times/frequencies.
    if (name === "crackle") {
      const bed = oc.createOscillator();
      const bedG = oc.createGain();
      bed.type = "sine";
      bed.frequency.value = 120;
      bedG.gain.value = 0.012;
      bed.connect(bedG);
      bedG.connect(oc.destination);
      bed.start(0);
      bed.stop(dur);
      let seed = 12345;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 8; i++) {
        const t0 = 0.2 + i * 0.32 + rnd() * 0.1;
        this.noiseBurst(oc, oc.destination, t0, 0.03, 0.08, { freq: 5000 + rnd() * 3000, q: 8 });
      }
    } else {
      const build = BUILD[name];
      if (!build) throw new Error("unknown trigger " + name);
      build(oc, oc.destination, 0);
    }
    const buf = await oc.startRendering();
    return SoundEngine.analyseBuffer(buf);
  }

  // Small radix-2 FFT (2048 pt) over 4 windows; returns the spectral
  // fingerprint in the same shape as remake/tools/fft-ref.py.
  static analyseBuffer(buf) {
    const x = buf.getChannelData(0);
    const sr = buf.sampleRate;
    let peak = 0, sumSq = 0;
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > peak) peak = a;
      sumSq += x[i] * x[i];
    }
    const rms = Math.sqrt(sumSq / x.length);
    const N = 2048;
    const spec = new Float64Array(N / 2);
    const wins = [0, 0.25, 0.5, 0.75];
    for (const w of wins) {
      const off = Math.floor(x.length * w);
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const v = off + i < x.length ? x[off + i] : 0;
        const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        re[i] = v * hann;
      }
      SoundEngine.fft(re, im);
      for (let k = 0; k < N / 2; k++) spec[k] += Math.hypot(re[k], im[k]);
    }
    const freqs = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) freqs[k] = (k * sr) / N;
    let tot = 0, wsum = 0;
    for (let k = 0; k < N / 2; k++) { tot += spec[k] * spec[k]; wsum += freqs[k] * spec[k]; }
    const centroid = tot > 0 ? wsum / spec.reduce((a, b) => a + b, 0) : 0;
    const bands = [[0, 200], [200, 1000], [1000, 4000], [4000, 8000], [8000, 22050]].map(([lo, hi]) => {
      let e = 0;
      for (let k = 0; k < N / 2; k++) if (freqs[k] >= lo && freqs[k] < hi) e += spec[k] * spec[k];
      return tot > 0 ? e / tot : 0;
    });
    const order = [...Array(N / 2).keys()].sort((a, b) => spec[b] - spec[a]);
    const partials = [];
    const maxMag = spec[order[0]] || 1;
    for (const k of order) {
      const f = freqs[k];
      if (f < 20 || spec[k] / maxMag < 0.03) break;
      if (partials.every(([pf]) => Math.abs(f - pf) > 60)) partials.push([Math.round(f), +(spec[k] / maxMag).toFixed(2)]);
      if (partials.length >= 8) break;
    }
    return { peak: +peak.toFixed(3), rms: +rms.toFixed(4), centroid: Math.round(centroid), bands: bands.map((b) => +b.toFixed(2)), partials };
  }

  static fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cwr = 1, cwi = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cwr - im[i + k + len / 2] * cwi;
          const vi = re[i + k + len / 2] * cwi + im[i + k + len / 2] * cwr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nwr = cwr * wr - cwi * wi;
          cwi = cwr * wi + cwi * wr;
          cwr = nwr;
        }
      }
    }
  }
}

const sound = new SoundEngine();
