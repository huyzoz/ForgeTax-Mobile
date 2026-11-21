// Sound engine — WebAudio-SYNTHESIZED recreations of the original's
// sound triggers. No original audio files are shipped or used; every
// sound below is generated from oscillators and filtered noise at
// runtime. The WHEN matches the original (REA-REPORT §10 / audio-list.txt):
//   strike        — every hammer hit (3455_basic_swing, 1.00s)
//   great         — Great strike (3434_GreatStrike, 1.15s)
//   break         — sword shatters (3476_SwordBreak, 1.20s)
//   tribute bell  — tribute offered (3407_TributeBell, 2.42s)
//   fever         — Fever starts (3452_FeverOverdrive, 3.80s)
//   coin          — gold paid (coin/tribute sfx)
// Master / music / SFX sliders actually control the gains. Sound is ON
// by default (the original mobile game has sound on); mute lives in
// settings (master = 0).

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.ambient = null;
    this.masterVol = 0.8;
    this.musicVol = 0.6;
    this.sfxVol = 0.9;
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
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    this.startAmbient();
    return true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.masterVol;
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

  // -- helpers -------------------------------------------------------------
  tone(freq, dur, { type = "sine", gain = 0.3, attack = 0.005, bus = null, slideTo = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, { freq = 3000, q = 1, gain = 0.3, type = "bandpass" } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
  }

  // -- triggers (same WHEN as the original) --------------------------------
  // Hammer hit: bright metallic clang (triangle partials + noise tick).
  playStrike() {
    if (!this.ctx) return;
    this.tone(740, 0.16, { type: "triangle", gain: 0.32 });
    this.tone(2130, 0.10, { type: "triangle", gain: 0.14 });
    this.noise(0.06, { freq: 4200, gain: 0.18 });
  }

  // Great strike: the clang plus a high bell ring.
  playGreat() {
    if (!this.ctx) return;
    this.playStrike();
    this.tone(3150, 0.5, { type: "sine", gain: 0.22 });
    this.tone(4720, 0.35, { type: "sine", gain: 0.10 });
  }

  // Sword shatters: low thud + noise shatter.
  playBreak() {
    if (!this.ctx) return;
    this.tone(95, 0.35, { type: "sine", gain: 0.5, slideTo: 45 });
    this.noise(0.35, { freq: 1200, gain: 0.4 });
    this.noise(0.2, { freq: 3800, gain: 0.2 });
  }

  // Tribute bell: warm bell partials, long decay.
  playTribute() {
    if (!this.ctx) return;
    this.tone(523, 1.2, { type: "sine", gain: 0.28 });
    this.tone(784, 1.0, { type: "sine", gain: 0.18 });
    this.tone(1046, 0.7, { type: "sine", gain: 0.10 });
  }

  // Fever starts: rising sweep + shimmer.
  playFever() {
    if (!this.ctx) return;
    this.tone(180, 0.5, { type: "sawtooth", gain: 0.12, slideTo: 720 });
    this.tone(360, 0.5, { type: "triangle", gain: 0.14, slideTo: 1440 });
    this.noise(0.4, { freq: 2500, gain: 0.12 });
  }

  // Coin: short bright ping.
  playCoin() {
    if (!this.ctx) return;
    this.tone(1760, 0.09, { type: "sine", gain: 0.22 });
    this.tone(2640, 0.07, { type: "sine", gain: 0.10 });
  }

  // Ambient music: a quiet low drone (two detuned triangles + slow LFO).
  // Recreated mood only — no original music is used.
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const t0 = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.musicBus);
    const o1 = this.ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = 110;
    const o2 = this.ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 165.4;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o1.connect(g);
    o2.connect(g);
    o1.start(t0);
    o2.start(t0);
    lfo.start(t0);
    this.ambient = { o1, o2, lfo, g };
  }
}

const sound = new SoundEngine();
