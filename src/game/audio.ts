import {
  AUDIO_MASTER_VOLUME,
  HIT_BASE_FREQ,
  SCORE_FREQ,
  POWERUP_FREQ,
} from './constants.js';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = AUDIO_MASTER_VOLUME;
  private muted = false;

  private musicOscillators: OscillatorNode[] = [];
  private musicGain: GainNode | null = null;

  constructor() {}

  init(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.updateMasterGain();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore resume errors (e.g., no user gesture yet)
      });
    }
  }

  private ensureContext(): { ctx: AudioContext; master: GainNode } {
    if (!this.ctx || !this.masterGain) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore resume errors
      });
    }
    return { ctx: this.ctx, master: this.masterGain };
  }

  private updateMasterGain(): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.volume,
        this.masterGain.context.currentTime
      );
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.updateMasterGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateMasterGain();
  }

  // --- UI Sounds ---

  playHover(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 2000;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  playClick(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 800;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // --- Game Sounds ---

  playHit(speed: number, pan: number): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    // Scale frequency with speed (220 Hz – 1100 Hz)
    const freq = HIT_BASE_FREQ * (0.5 + speed * 1.5);
    osc.frequency.setValueAtTime(freq, t);
    osc.type = 'sine';

    // Short envelope: attack 0.01s, decay 0.1s
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    // Pan (-1 to 1)
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);

    osc.connect(panner);
    panner.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playWallBounce(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    // Generate a short burst of white noise
    const duration = 0.1;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Low-pass filter for a "thud" character
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    noise.start(t);
    noise.stop(t + 0.15);
  }

  playNearMiss(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    const duration = 0.1;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Doppler effect: filter sweeps from high to low
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    noise.start(t);
    noise.stop(t + 0.15);
  }

  playScore(isPlayer: boolean): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    // Two oscillators for richness (root + perfect fifth)
    const freqs = [SCORE_FREQ, SCORE_FREQ * 1.5];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      if (isPlayer) {
        // Ascending chime
        osc.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.3);
      } else {
        // Descending chime
        osc.frequency.exponentialRampToValueAtTime(f * 0.75, t + 0.3);
      }

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02 + i * 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(master);

      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  playRallyTone(count: number): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    const baseFreq = 440;
    const freq = baseFreq * (1 + count * 0.1);
    const volume = Math.min(0.3, 0.1 + count * 0.02);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  playCountdown(number: number): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    if (number <= 0) {
      // GO! - ascending major triad
      const notes = [440, 554, 659];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const start = t + i * 0.08;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.connect(gain);
        gain.connect(master);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } else {
      const freqs = [330, 440, 550];
      const freq = freqs[Math.min(number - 1, 2)] || 330;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

      osc.connect(gain);
      gain.connect(master);

      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  playPowerUp(_type: string): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    // Quick arpeggio (triangle wave for sparkle)
    const notes = [
      POWERUP_FREQ,
      POWERUP_FREQ * 1.25,
      POWERUP_FREQ * 1.5,
      POWERUP_FREQ * 2,
    ];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const start = t + i * 0.05;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.3);
    });

    // Reverb-like tail via feedback delay
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.08;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;

    const delayGain = ctx.createGain();
    delayGain.gain.setValueAtTime(0.2, t);
    delayGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(master);

    // Feed the delay line with a short impulse
    const impulse = ctx.createOscillator();
    const impulseGain = ctx.createGain();

    impulse.type = 'sine';
    impulse.frequency.value = POWERUP_FREQ * 2;

    impulseGain.gain.setValueAtTime(0, t);
    impulseGain.gain.linearRampToValueAtTime(0.3, t + 0.01);
    impulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    impulse.connect(impulseGain);
    impulseGain.connect(delay);

    impulse.start(t);
    impulse.stop(t + 0.15);
  }

  playVictoryFanfare(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    // Ascending major chord fanfare
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = t + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  startMusic(): void {
    if (this.musicOscillators.length > 0) return;

    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.05, t); // Very quiet drone
    this.musicGain.connect(master);

    // Subtle low-frequency drone with slight detune for beating
    const freqs = [55, 82.5, 110];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f + (Math.random() * 2 - 1);
      osc.connect(this.musicGain!);
      osc.start(t);
      this.musicOscillators.push(osc);
    });
  }

  stopMusic(): void {
    if (!this.ctx || this.musicOscillators.length === 0) return;

    const t = this.ctx.currentTime;

    // Smooth fade-out
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
      this.musicGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    }

    this.musicOscillators.forEach((osc) => {
      osc.stop(t + 0.25);
    });
    this.musicOscillators = [];

    // Disconnect the music gain node after the fade completes
    setTimeout(() => {
      if (this.musicGain) {
        this.musicGain.disconnect();
        this.musicGain = null;
      }
    }, 300);
  }
}

export default AudioEngine;
