import { TIME_DILATION_FACTOR } from '../constants.js';
import type { ScreenShake, TimeDilation } from '../types.js';

export class ScreenEffects {
  private shake: ScreenShake;
  private timeDilation: TimeDilation;
  private shakeOffset: { x: number; y: number };

  constructor() {
    this.shake = { intensity: 0, duration: 0, timer: 0 };
    this.timeDilation = { factor: 1, duration: 0, timer: 0 };
    this.shakeOffset = { x: 0, y: 0 };
  }

  triggerShake(intensity: number, duration: number): void {
    this.shake.intensity = intensity;
    this.shake.duration = duration;
    this.shake.timer = duration;
  }

  triggerTimeDilation(duration: number, factor: number = TIME_DILATION_FACTOR): void {
    this.timeDilation.factor = factor;
    this.timeDilation.duration = duration;
    this.timeDilation.timer = duration;
  }

  update(dt: number): void {
    const dtMs = dt * 1000;

    // Update shake
    if (this.shake.timer > 0) {
      this.shake.timer -= dtMs;
      if (this.shake.timer <= 0) {
        this.shake.timer = 0;
        this.shake.intensity = 0;
        this.shakeOffset = { x: 0, y: 0 };
      } else {
        const progress = this.shake.timer / this.shake.duration;
        const currentIntensity = this.shake.intensity * progress;
        this.shakeOffset.x = (Math.random() * 2 - 1) * currentIntensity;
        this.shakeOffset.y = (Math.random() * 2 - 1) * currentIntensity;
      }
    }

    // Update time dilation
    if (this.timeDilation.timer > 0) {
      this.timeDilation.timer -= dtMs;
      if (this.timeDilation.timer <= 0) {
        this.timeDilation.timer = 0;
      }
    }
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
  }

  getTimeScale(): number {
    return this.timeDilation.timer > 0 ? this.timeDilation.factor : 1;
  }

  getShakeOffset(): { x: number; y: number } {
    return { x: this.shakeOffset.x, y: this.shakeOffset.y };
  }

  isTimeDilated(): boolean {
    return this.timeDilation.timer > 0;
  }
}
