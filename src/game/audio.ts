import {
  AUDIO_MASTER_VOLUME,
  HIT_BASE_FREQ,
  SCORE_FREQ,
} from './constants.js';
import type { PowerUpType } from './types.js';

const ARPEGGIO_NOTES = [146.83, 174.61, 220, 293.66, 220, 174.61, 146.83, 110];
const ARPEGGIO_INTERVAL = 0.22;
const PAD_FILTER_FREQ = 350;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = AUDIO_MASTER_VOLUME;
  private muted = false;

  private musicOscillators: OscillatorNode[] = [];
  private musicGain: GainNode | null = null;
  private padOsc: AudioBufferSourceNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private musicIntervalId: ReturnType<typeof setInterval> | null = null;
  private arpeggioIndex = 0;
  private musicIntensity = 0;

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

  setMusicIntensity(level: number): void {
    this.musicIntensity = Math.max(0, Math.min(1, level));
    if (this.musicGain && this.ctx) {
      const baseVol = 0.8;
      const boostedVol = 1.0;
      const target = baseVol + (boostedVol - baseVol) * this.musicIntensity;
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.5);
    }
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

    const freq = HIT_BASE_FREQ * (0.5 + speed * 1.5);

    // Main tone (sine)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.frequency.setValueAtTime(freq, t);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);

    osc.connect(panner);
    panner.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.15);

    // Transient click layer (square wave, very short)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    const clickPan = ctx.createStereoPanner();

    clickOsc.frequency.setValueAtTime(freq * 1.5, t);
    clickOsc.type = 'square';

    clickGain.gain.setValueAtTime(0, t);
    clickGain.gain.linearRampToValueAtTime(0.15, t + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    clickPan.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);

    clickOsc.connect(clickPan);
    clickPan.connect(clickGain);
    clickGain.connect(master);

    clickOsc.start(t);
    clickOsc.stop(t + 0.05);
  }

  playWallBounce(): void {
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

    const freqs = [SCORE_FREQ, SCORE_FREQ * 1.5];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      if (isPlayer) {
        osc.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.3);
      } else {
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
    const vol = Math.min(0.3, 0.1 + count * 0.02);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
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

  playPowerUp(type: PowerUpType): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    switch (type) {
      case 'expand': {
        // Warm rising sawtooth
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(300, t + 0.25);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.35);
        // Add sine harmonic for warmth
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(300, t);
        osc2.frequency.linearRampToValueAtTime(600, t + 0.25);
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc2.connect(gain2);
        gain2.connect(master);
        osc2.start(t);
        osc2.stop(t + 0.35);
        break;
      }
      case 'shrink': {
        // Sharp falling square wave
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      }
      case 'multiball': {
        // Bright triangle arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const start = t + i * 0.06;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
          osc.connect(gain);
          gain.connect(master);
          osc.start(start);
          osc.stop(start + 0.25);
        });
        break;
      }
      case 'magnet': {
        // Metallic ring
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.25);
        // Harmonic
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1760;
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.12, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc2.connect(gain2);
        gain2.connect(master);
        osc2.start(t);
        osc2.stop(t + 0.2);
        break;
      }
      case 'timewarp': {
        // Reversed-sounding swoosh with delay tail
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.45);
        // Delay tail
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.1;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.3;
        const delayGain = ctx.createGain();
        delayGain.gain.setValueAtTime(0.15, t);
        delayGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(master);
        gain.connect(delay);
        break;
      }
    }
  }

  playMilestoneSound(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

    // Bright ascending arpeggio for milestones/unlocks
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + i * 0.07;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  playVictoryFanfare(): void {
    const { ctx, master } = this.ensureContext();
    const t = ctx.currentTime;

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

    // Force resume in case context is still suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;

    this.musicGain = ctx.createGain();
    const baseVol = 0.8;
    this.musicGain.gain.setValueAtTime(baseVol, t);
    this.musicGain.connect(master);

    // Pad: filtered noise for atmosphere
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = PAD_FILTER_FREQ;
    this.padFilter.Q.value = 1;

    this.padGain = ctx.createGain();
    this.padGain.gain.setValueAtTime(0.3, t);

    const duration = 2;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.padOsc = ctx.createBufferSource();
    this.padOsc.buffer = buffer;
    this.padOsc.loop = true;
    this.padOsc.connect(this.padFilter);
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.musicGain);
    this.padOsc.start(t);

    // Arpeggio sequencer
    this.arpeggioIndex = 0;
    this.musicIntervalId = setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      const noteIdx = this.arpeggioIndex % ARPEGGIO_NOTES.length;
      const freq = ARPEGGIO_NOTES[noteIdx];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + ARPEGGIO_INTERVAL * 0.9);

      osc.connect(gain);
      gain.connect(this.musicGain!);

      osc.start(now);
      osc.stop(now + ARPEGGIO_INTERVAL);

      // Intensity: add octave layer during high rallies
      if (this.musicIntensity > 0.5) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = freq * 2;
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + ARPEGGIO_INTERVAL * 0.7);
        osc2.connect(gain2);
        gain2.connect(this.musicGain!);
        osc2.start(now);
        osc2.stop(now + ARPEGGIO_INTERVAL * 0.8);
      }

      this.arpeggioIndex++;
    }, ARPEGGIO_INTERVAL * 1000);
  }

  stopMusic(): void {
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }

    // Fade out pad
    if (this.padGain) {
      this.padGain.gain.cancelScheduledValues(t);
      this.padGain.gain.setValueAtTime(this.padGain.gain.value, t);
      this.padGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    }

    if (this.padOsc) {
      this.padOsc.stop(t + 0.35);
      this.padOsc = null;
    }
    this.padFilter = null;
    this.padGain = null;

    // Fade out music gain
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
      this.musicGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    }

    this.musicOscillators.forEach((osc) => {
      osc.stop(t + 0.35);
    });
    this.musicOscillators = [];

    setTimeout(() => {
      if (this.musicGain) {
        this.musicGain.disconnect();
        this.musicGain = null;
      }
    }, 400);
  }
}

export default AudioEngine;
