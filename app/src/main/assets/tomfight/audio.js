// TOM FIGHT - Web Audio API Sound & Music Synthesizer Engine
class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.isMuted = false;
    this.musicPlaying = false;
    this.musicInterval = null;
    this.musicStep = 0;
    
    // Volume levels (0.0 to 1.0)
    this.masterVolume = 0.8;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.45;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  setVolumes(master, sfx, music) {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.ctx) {
      if (!this.isMuted && this.masterGain) this.masterGain.gain.setValueAtTime(master, this.ctx.currentTime);
      if (this.sfxGain) this.sfxGain.gain.setValueAtTime(sfx, this.ctx.currentTime);
      if (this.musicGain) this.musicGain.gain.setValueAtTime(music, this.ctx.currentTime);
    }
  }

  // SFX: Punch
  playPunch() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // Low swoosh tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Punch impact snap noise
    this.playNoise(0.06, 0.4, 400);
  }

  // SFX: Kick
  playKick() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);

    this.playNoise(0.09, 0.5, 300);
  }

  // SFX: Hit Impact - Specific punch, kick, block, special audio feedback
  playPunchImpact(isCrit = false) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Low-mid punch thump (solid fist impact into torso)
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = isCrit ? "triangle" : "sine";
    thump.frequency.setValueAtTime(isCrit ? 260 : 220, now);
    thump.frequency.exponentialRampToValueAtTime(50, now + (isCrit ? 0.14 : 0.09));
    thumpGain.gain.setValueAtTime(isCrit ? 0.85 : 0.65, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.14 : 0.09));
    thump.connect(thumpGain);
    thumpGain.connect(this.sfxGain);
    thump.start(now);
    thump.stop(now + (isCrit ? 0.14 : 0.09));

    // Layer 2: Meaty skin crack / punch snap (bandpass noise burst)
    this.playNoise(isCrit ? 0.09 : 0.05, isCrit ? 0.75 : 0.5, 1600, "bandpass", 2.2);

    // Layer 3 (If Critical): Aggressive distorted crunch
    if (isCrit) {
      const crunch = this.ctx.createOscillator();
      const crunchGain = this.ctx.createGain();
      crunch.type = "sawtooth";
      crunch.frequency.setValueAtTime(320, now);
      crunch.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      crunchGain.gain.setValueAtTime(0.4, now);
      crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      crunch.connect(crunchGain);
      crunchGain.connect(this.sfxGain);
      crunch.start(now);
      crunch.stop(now + 0.12);
    }

    if (navigator.vibrate) {
      navigator.vibrate(isCrit ? [35, 20, 55] : 30);
    }
  }

  // SPECIFIC HIT IMPACT: Kick
  // Bone-thumping heavy sub-bass thud + wider noise pop + heavy resonance
  playKickImpact(isCrit = false) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Heavy Sub-Bass Kick Drop
    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kickOsc.type = "triangle";
    kickOsc.frequency.setValueAtTime(isCrit ? 190 : 160, now);
    kickOsc.frequency.exponentialRampToValueAtTime(isCrit ? 28 : 36, now + (isCrit ? 0.22 : 0.16));
    kickGain.gain.setValueAtTime(isCrit ? 0.95 : 0.8, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.22 : 0.16));
    kickOsc.connect(kickGain);
    kickGain.connect(this.sfxGain);
    kickOsc.start(now);
    kickOsc.stop(now + (isCrit ? 0.22 : 0.16));

    // Layer 2: Heavy Body Thud Noise (low-frequency punch)
    this.playNoise(isCrit ? 0.15 : 0.10, isCrit ? 0.8 : 0.6, 550, "lowpass");

    // Layer 3: High-frequency boot strike slap
    this.playNoise(0.04, 0.45, 2200, "bandpass", 1.8);

    if (navigator.vibrate) {
      navigator.vibrate(isCrit ? [50, 30, 80] : 45);
    }
  }

  // SPECIFIC HIT IMPACT: Block
  // Sharp metallic guard clang / shield deflection ping with rapid resonant decay
  playBlockImpact() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Dual detuned square-wave metallic ping
    const freqs = [620, 890];
    freqs.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.35, now + 0.1);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
    });

    // Layer 2: Metallic Spark Deflection Noise (High-pitched ping)
    this.playNoise(0.05, 0.5, 2800, "highpass");

    if (navigator.vibrate) navigator.vibrate([25, 15]);
  }

  // SPECIFIC HIT IMPACT: Special (Dragon Blast Detonation)
  // Devastating explosive shockwave, sub-bass seismic drop & mystic sizzle
  playSpecialImpact(isCrit = true) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Layer 1: Seismic Sub-Bass Drop (Deep ground tremor)
    const seismic = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    seismic.type = "sine";
    seismic.frequency.setValueAtTime(110, now);
    seismic.frequency.exponentialRampToValueAtTime(22, now + 0.45);
    sGain.gain.setValueAtTime(1.0, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    seismic.connect(sGain);
    sGain.connect(this.sfxGain);
    seismic.start(now);
    seismic.stop(now + 0.45);

    // Layer 2: Mystic Energy Sawtooth Sizzle
    const sizzle = this.ctx.createOscillator();
    const sizzleGain = this.ctx.createGain();
    sizzle.type = "sawtooth";
    sizzle.frequency.setValueAtTime(750, now);
    sizzle.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    sizzleGain.gain.setValueAtTime(0.5, now);
    sizzleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    sizzle.connect(sizzleGain);
    sizzleGain.connect(this.sfxGain);
    sizzle.start(now);
    sizzle.stop(now + 0.3);

    // Layer 3: Roaring Shockwave Noise Burst
    this.playNoise(0.35, 0.9, 1200, "lowpass");

    if (navigator.vibrate) {
      navigator.vibrate([60, 40, 100, 50, 140]);
    }
  }

  // Unified Hit Impact Router: punch, kick, block, special
  playHitImpact(attackType = "punch", isCrit = false, isBlocked = false) {
    if (isBlocked) {
      this.playBlockImpact();
    } else if (attackType === "special") {
      this.playSpecialImpact(isCrit);
    } else if (attackType === "kick") {
      this.playKickImpact(isCrit);
    } else {
      this.playPunchImpact(isCrit);
    }
  }

  // SFX: Hit Impact (Backwards-compatible wrapper)
  playHit(isCrit = false, attackType = "punch") {
    this.playHitImpact(attackType, isCrit, false);
  }

  // SFX: Block Clank
  playBlock() {
    this.playBlockImpact();
  }

  // SFX: Camera Shutter (Photo Mode)
  playShutter() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // First mechanical click (shutter opening)
    this.playTone(1800, "square", 0.02, 0.45, 600);
    this.playNoise(0.025, 0.35, 3200, "bandpass", 4);
    
    // Second click (shutter curtain release 50ms later)
    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      this.playTone(1200, "triangle", 0.03, 0.5, 400);
      this.playNoise(0.035, 0.4, 2400, "bandpass", 3);
    }, 50);
  }

  // SFX: Dodge Dash
  playDodge() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // SFX: Jump
  playJump() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.14);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // SFX: Special Attack (Dragon Shockwave)
  playSpecial() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Rising charge
    const charge = this.ctx.createOscillator();
    const chargeGain = this.ctx.createGain();
    charge.type = "sawtooth";
    charge.frequency.setValueAtTime(120, now);
    charge.frequency.linearRampToValueAtTime(700, now + 0.25);
    chargeGain.gain.setValueAtTime(0.4, now);
    chargeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    charge.connect(chargeGain);
    chargeGain.connect(this.sfxGain);
    charge.start(now);
    charge.stop(now + 0.25);

    // Deep explosion burst
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(120, now + 0.25);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.7);
    boomGain.gain.setValueAtTime(0.9, now + 0.25);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    boom.connect(boomGain);
    boomGain.connect(this.sfxGain);
    boom.start(now + 0.25);
    boom.stop(now + 0.7);

    setTimeout(() => {
      this.playNoise(0.4, 0.8, 400);
      if (navigator.vibrate) navigator.vibrate([80, 50, 120]);
    }, 250);
  }

  // SFX: Coin Collected
  playCoin() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const playTone = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(987.77, now, 0.1); // B5
    playTone(1318.51, now + 0.08, 0.25); // E6
  }

  // SFX: Mission Complete Fanfare
  playMissionComplete() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554, 659, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (idx === 3 ? 0.5 : 0.2));
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + (idx === 3 ? 0.5 : 0.2));
    });
  }

  // SFX: Defeat
  playDefeat() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [330, 311, 293, 261];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  // Helper: Filtered White Noise Generator (Hits, Clangs & Explosions)
  playNoise(duration, volume, cutoff = 1000, filterType = "lowpass", q = 1.0) {
    if (!this.ctx || this.isMuted) return;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
    if (q > 1) filter.Q.setValueAtTime(q, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  // Dynamic Procedural Background Music (Punchy Cyber Action Beat)
  startMusic() {
    if (this.musicPlaying) return;
    this.ensureContext();
    this.musicPlaying = true;
    this.musicStep = 0;

    // 124 BPM -> 16th note step = 60 / (124 * 4) = 0.121s
    const stepTime = 120; // ms
    const bassNotes = [110, 110, 130.81, 110, 146.83, 130.81, 110, 98]; // A2, C3, D3, G2
    const leadNotes = [440, 523.25, 659.25, 587.33, 523.25, 659.25, 783.99, 659.25];

    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const step = this.musicStep % 16;

      // 1. Kick on steps 0, 4, 8, 12
      if (step % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kick.frequency.setValueAtTime(140, now);
        kick.frequency.exponentialRampToValueAtTime(35, now + 0.1);
        kickGain.gain.setValueAtTime(0.6 * this.musicVolume, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        kick.connect(kickGain);
        kickGain.connect(this.musicGain);
        kick.start(now);
        kick.stop(now + 0.1);
      }

      // 2. Snare / Clap on steps 4, 12
      if (step === 4 || step === 12) {
        this.playSnare(now);
      }

      // 3. Hi-hat on every odd step
      if (step % 2 === 1) {
        this.playHiHat(now);
      }

      // 4. Bassline
      const bIdx = Math.floor(step / 2) % bassNotes.length;
      if (step % 2 === 0) {
        const bass = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bass.type = "sawtooth";
        bass.frequency.setValueAtTime(bassNotes[bIdx], now);
        bGain.gain.setValueAtTime(0.22 * this.musicVolume, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        bass.connect(bGain);
        bGain.connect(this.musicGain);
        bass.start(now);
        bass.stop(now + 0.18);
      }

      // 5. Synth Arp
      if (step % 4 === 2) {
        const lead = this.ctx.createOscillator();
        const lGain = this.ctx.createGain();
        lead.type = "triangle";
        lead.frequency.setValueAtTime(leadNotes[Math.floor(this.musicStep / 4) % leadNotes.length], now);
        lGain.gain.setValueAtTime(0.18 * this.musicVolume, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        lead.connect(lGain);
        lGain.connect(this.musicGain);
        lead.start(now);
        lead.stop(now + 0.15);
      }

      this.musicStep++;
    }, stepTime);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  playSnare(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
    gain.gain.setValueAtTime(0.3 * this.musicVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  playHiHat(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(3200, time);
    gain.gain.setValueAtTime(0.08 * this.musicVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.04);
  }
}

window.AudioManager = AudioManager;
