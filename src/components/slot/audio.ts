export class SlotAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  muted = false;

  unlock() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC({ latencyHint: "interactive" });
        const master = ctx.createGain();
        const sfx = ctx.createGain();
        const music = ctx.createGain();
        master.gain.value = 0.7;
        sfx.gain.value = 0.85;
        music.gain.value = 0.22;
        sfx.connect(master);
        music.connect(master);
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.sfx = sfx;
        this.music = music;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.startDrone();
    } catch {
      /* Preview iframes can block audio. Game still plays. */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx!.currentTime, 0.03);
    }
  }

  private startDrone() {
    if (!this.ctx || !this.music || this.drone) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc2.type = "triangle";
    osc.frequency.value = 55;
    osc2.frequency.value = 82.5;
    g.gain.value = 0.12;
    osc.connect(g);
    osc2.connect(g);
    g.connect(this.music);
    osc.start();
    osc2.start();
    this.drone = osc;
    this.droneGain = g;
  }

  private env(gain: GainNode, peak: number, attack: number, decay: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(freq: number, dur: number, type: OscillatorType, peak: number) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * (0.97 + Math.random() * 0.06);
    osc.connect(g);
    g.connect(this.sfx);
    this.env(g, peak, 0.01, dur);
    osc.start();
    osc.stop(this.ctx.currentTime + dur + 0.05);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noise(dur: number, peak: number, from = 800, to = 200) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = buf;
    filter.type = "lowpass";
    filter.frequency.value = from;
    filter.frequency.exponentialRampToValueAtTime(to, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    this.env(g, peak, 0.005, dur);
    src.start();
    src.stop(this.ctx.currentTime + dur + 0.02);
  }

  click() {
    this.tone(880, 0.06, "square", 0.05);
  }

  spin() {
    this.noise(0.62, 0.22, 1700, 140);
    this.tone(96, 0.5, "sine", 0.16);
    this.tone(58, 0.7, "triangle", 0.1);
  }

  land() {
    this.tone(196 + Math.random() * 36, 0.09, "triangle", 0.1);
    this.tone(90, 0.08, "sine", 0.06);
  }

  explode() {
    this.noise(0.16, 0.28, 1800, 220);
    this.tone(90, 0.18, "sine", 0.16);
  }

  charge() {
    this.tone(520, 0.12, "sine", 0.1);
    this.tone(780, 0.14, "triangle", 0.06);
  }

  win() {
    this.tone(392, 0.16, "sine", 0.1);
    this.tone(523, 0.2, "sine", 0.08);
  }

  bigWin(tier: "big" | "mega" | "epic" | "rift" = "big") {
    const lines: Record<typeof tier, number[]> = {
      big: [261, 329, 392, 523],
      mega: [196, 247, 329, 392, 523, 659],
      epic: [130, 196, 247, 330, 392, 523, 659, 784],
      rift: [82, 123, 164, 247, 330, 392, 523, 659, 784, 988],
    };
    const seq = lines[tier];
    const step = tier === "rift" ? 70 : tier === "epic" ? 85 : 95;
    seq.forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.32 + i * 0.02, i < 2 ? "sine" : "triangle", 0.1 + i * 0.012), i * step);
    });
    if (tier === "mega" || tier === "epic" || tier === "rift") {
      this.noise(tier === "rift" ? 0.9 : 0.4, 0.22, 240, 40);
      this.tone(48, 0.7, "sine", 0.18);
    }
  }

  countTick(tier: "big" | "mega" | "epic" | "rift", t: number) {
    const base = tier === "rift" ? 620 : tier === "epic" ? 540 : 480;
    this.tone(base + t * 420, 0.05, "square", 0.035 + t * 0.03);
  }

  winLand(tier: "big" | "mega" | "epic" | "rift") {
    this.noise(tier === "rift" ? 0.55 : 0.28, 0.3, 900, 70);
    this.tone(65, 0.45, "sine", 0.22);
    this.tone(196, 0.28, "triangle", 0.12);
    if (tier === "epic" || tier === "rift") {
      this.tone(784, 0.4, "sine", 0.1);
      this.tone(1174, 0.5, "triangle", 0.06);
    }
  }

  bonus() {
    [220, 277, 330, 440].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.22, "sine", 0.12), i * 110);
    });
  }

  eclipse() {
    this.noise(0.4, 0.22, 600, 80);
    this.tone(48, 0.5, "sine", 0.2);
  }
}

export const audio = new SlotAudio();
