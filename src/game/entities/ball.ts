import {
  BALL_RADIUS,
  BALL_MAX_SPEED,
  BALL_SPEED_INCREMENT,
  BALL_GLOW,
  CANVAS_HEIGHT,
  PADDING,
  TRAIL_LENGTH,
  TRAIL_DECAY,
  SPIN_FACTOR,
  MAX_SPIN,
  FRICTION,
} from '../constants.js';

export class Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  spin: number;
  color: string;
  glowColor: string;
  trail: Array<{ x: number; y: number; alpha: number }>;
  squashX: number;
  squashY: number;
  private timeScale: number;
  private baseSpeed: number;
  wallBounced = false;
  lastPaddleHitTime = 0;
  private rainbowMode = false;
  private rainbowHue = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = BALL_RADIUS;
    this.speed = 0;
    this.spin = 0;
    this.color = '#ffffff';
    this.glowColor = BALL_GLOW;
    this.trail = [];
    this.squashX = 1;
    this.squashY = 1;
    this.timeScale = 1;
    this.baseSpeed = 0;
  }

  reset(x: number, y: number, _direction: number = 1): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.spin = 0;
    this.trail = [];
    this.squashX = 1;
    this.squashY = 1;
    this.baseSpeed = 0;
  }

  launch(speed: number, angle: number = 0, direction: number = 1): void {
    this.speed = speed;
    this.baseSpeed = speed;
    this.vx = Math.cos(angle) * speed * direction;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number): void {
    const scaledDt = dt * this.timeScale;

    // Apply spin to trajectory
    this.vy += this.spin * SPIN_FACTOR * scaledDt;

    // Clamp spin
    this.spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, this.spin));

    // Apply friction to spin (frame-rate independent)
    this.spin *= Math.pow(FRICTION, scaledDt * 60);

    // Move
    this.x += this.vx * scaledDt;
    this.y += this.vy * scaledDt;

    // Update speed from velocity components
    this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

    // Wall bounces (top/bottom)
    this.wallBounced = false;
    if (this.y - this.radius < PADDING) {
      this.y = PADDING + this.radius;
      this.vy = Math.abs(this.vy);
      this.triggerSquash();
      this.wallBounced = true;
    } else if (this.y + this.radius > CANVAS_HEIGHT - PADDING) {
      this.y = CANVAS_HEIGHT - PADDING - this.radius;
      this.vy = -Math.abs(this.vy);
      this.triggerSquash();
      this.wallBounced = true;
    }

    // Update trail
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.shift();
    }

    // Decay trail alpha (frame-rate independent)
    const decay = Math.pow(TRAIL_DECAY, scaledDt * 60);
    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].alpha *= decay;
    }

    // Recover squash
    this.squashX += (1 - this.squashX) * 8 * scaledDt;
    this.squashY += (1 - this.squashY) * 8 * scaledDt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Get speed-based aura color
    const auraColor = this.rainbowMode ? `hsl(${this.rainbowHue}, 100%, 60%)` : this._getSpeedAuraColor();
    const glowSize = this.rainbowMode ? 30 : 20 + (this.speed / BALL_MAX_SPEED) * 20;

    // Draw trail
    if (this.trail.length > 1) {
      for (let i = 0; i < this.trail.length; i++) {
        const point = this.trail[i];
        const alpha = point.alpha * 0.4;
        const size = this.radius * (0.25 + 0.6 * (i / this.trail.length));
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        if (this.rainbowMode) {
          ctx.fillStyle = `hsla(${(this.rainbowHue + i * 20) % 360}, 100%, 60%, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
        }
        ctx.fill();
      }
    }

    // Draw ball with glow
    ctx.shadowBlur = glowSize;
    ctx.shadowColor = auraColor;
    ctx.fillStyle = this.color;

    ctx.translate(this.x, this.y);
    ctx.scale(this.squashX, this.squashY);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = auraColor;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private _getSpeedAuraColor(): string {
    const ratio = this.speed / BALL_MAX_SPEED;
    if (ratio < 0.25) return '#ffffff';
    if (ratio < 0.5) return '#00f0ff'; // Cyan
    if (ratio < 0.75) return '#ff00aa'; // Magenta
    return '#ffee00'; // Gold
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      width: this.radius * 2,
      height: this.radius * 2,
    };
  }

  addSpin(spinAmount: number): void {
    this.spin += spinAmount;
    this.spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, this.spin));
  }

  increaseSpeed(): void {
    if (this.baseSpeed < BALL_MAX_SPEED) {
      this.baseSpeed = Math.min(BALL_MAX_SPEED, this.baseSpeed + BALL_SPEED_INCREMENT);
      // Recalculate velocity components to maintain direction
      const currentAngle = Math.atan2(this.vy, this.vx);
      this.vx = Math.cos(currentAngle) * this.baseSpeed * Math.sign(this.vx || 1);
      this.vy = Math.sin(currentAngle) * this.baseSpeed;
      this.speed = this.baseSpeed;
    }
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  setRainbowMode(enabled: boolean, hue: number): void {
    this.rainbowMode = enabled;
    this.rainbowHue = hue;
  }

  canHitPaddle(now: number, debounceMs: number): boolean {
    return now - this.lastPaddleHitTime > debounceMs;
  }

  recordPaddleHit(now: number): void {
    this.lastPaddleHitTime = now;
  }

  triggerSquash(): void {
    const velocityMag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const squashIntensity = Math.min(0.4, velocityMag / 3000);

    if (Math.abs(this.vy) > Math.abs(this.vx)) {
      // Vertical impact
      this.squashX = 1 + squashIntensity;
      this.squashY = 1 - squashIntensity;
    } else {
      // Horizontal impact
      this.squashX = 1 - squashIntensity;
      this.squashY = 1 + squashIntensity;
    }
  }
}
