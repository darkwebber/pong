import {
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_GLOW,
  AI_PADDLE_GLOW,
  CANVAS_HEIGHT,
  PADDING,
} from '../constants.js';

export class Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  baseHeight: number;
  color: string;
  glowColor: string;
  speed: number;
  targetY: number;
  magnetActive: boolean;
  magnetTimer: number;
  expanded: boolean;
  expandTimer: number;
  private currentVelY: number = 0;
  private trail: Array<{ y: number; alpha: number }> = [];
  private moveDirection: number = 0; // -1, 0, 1 for keyboard input

  constructor(x: number, y: number, isPlayer: boolean) {
    this.x = x;
    this.y = y;
    this.width = PADDLE_WIDTH;
    this.height = PADDLE_HEIGHT;
    this.baseHeight = PADDLE_HEIGHT;
    this.color = '#ffffff';
    this.glowColor = isPlayer ? PADDLE_GLOW : AI_PADDLE_GLOW;
    this.speed = PADDLE_SPEED;
    this.targetY = y;
    this.magnetActive = false;
    this.magnetTimer = 0;
    this.expanded = false;
    this.expandTimer = 0;
  }

  setTargetY(normalizedY: number): void {
    const clamped = Math.max(0, Math.min(1, normalizedY));
    this.targetY = clamped * CANVAS_HEIGHT;
    this.moveDirection = 0;
  }

  /**
   * Set directional input for keyboard control.
   * direction: -1 (up), 0 (stop), 1 (down)
   */
  setMoveDirection(direction: number): void {
    const dir = Math.max(-1, Math.min(1, direction));
    if (dir !== 0) {
      this.moveDirection = dir;
      // Lock target to current position so paddle stays put when released
      this.targetY = this.y;
    } else {
      this.moveDirection = 0;
    }
  }

  updateTimers(dt: number): void {
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt * 1000;
      if (this.magnetTimer <= 0) {
        this.magnetActive = false;
        this.magnetTimer = 0;
      }
    }

    if (this.expandTimer > 0) {
      this.expandTimer -= dt * 1000;
      if (this.expandTimer <= 0) {
        this.expanded = false;
        this.height = this.baseHeight;
        this.expandTimer = 0;
      }
    }
  }

  updateMovement(dt: number, canvasHeight: number): void {
    let desiredVelY: number;

    if (this.moveDirection !== 0) {
      // Keyboard: move at max speed in held direction
      desiredVelY = this.moveDirection * this.speed;
    } else {
      // Follow mode (mouse / AI / touch): proportional toward target
      const diff = this.targetY - this.y;
      desiredVelY = Math.max(-this.speed, Math.min(this.speed, diff * 15));
    }

    // Smoothly accelerate toward desired velocity (prevents choppy starts/stops)
    const accel = 25; // reach desired speed in ~0.04s
    this.currentVelY += (desiredVelY - this.currentVelY) * accel * dt;

    // Move
    this.y += this.currentVelY * dt;

    // Trail when moving fast
    if (Math.abs(this.currentVelY) > 200) {
      this.trail.push({ y: this.y, alpha: 0.6 });
      if (this.trail.length > 5) {
        this.trail.shift();
      }
    }

    // Decay trail
    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].alpha -= dt * 3;
    }
    this.trail = this.trail.filter(t => t.alpha > 0);

    // Keep paddle within canvas bounds
    const halfHeight = this.height / 2;
    const minY = PADDING + halfHeight;
    const maxY = canvasHeight - PADDING - halfHeight;

    if (this.y < minY) {
      this.y = minY;
      if (this.currentVelY < 0) this.currentVelY = 0;
    } else if (this.y > maxY) {
      this.y = maxY;
      if (this.currentVelY > 0) this.currentVelY = 0;
    }
  }

  /**
   * Full update: timers + smooth movement toward target.
   * Used by all input modes.
   */
  update(dt: number, canvasHeight: number): void {
    this.updateTimers(dt);
    this.updateMovement(dt, canvasHeight);
  }

  /**
   * Direct absolute position (touch).
   * Sets the target and lets updateMovement handle the rest.
   */
  setPosition(normalizedY: number, canvasHeight: number): void {
    const clamped = Math.max(0, Math.min(1, normalizedY));
    this.targetY = clamped * canvasHeight;
    this.moveDirection = 0;
  }

  /**
   * Legacy API: keyboard incremental movement.
   * Now redirects to setMoveDirection.
   */
  moveBy(pixelDelta: number, _canvasHeight: number): void {
    this.setMoveDirection(Math.sign(pixelDelta));
  }

  render(ctx: CanvasRenderingContext2D, rainbowMode = false): void {
    ctx.save();

    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    const cornerRadius = 8;

    // Draw trail
    for (const trailPoint of this.trail) {
      ctx.globalAlpha = trailPoint.alpha * 0.3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = rainbowMode ? this._getRainbowColor() : this.glowColor;
      ctx.fillStyle = rainbowMode ? this._getRainbowColor() : this.glowColor;
      ctx.fillRect(
        this.x - halfWidth,
        trailPoint.y - halfHeight,
        this.width,
        this.height
      );
    }

    ctx.globalAlpha = 1;

    // Neon glow
    ctx.shadowBlur = this.magnetActive ? 40 : 25;
    ctx.shadowColor = rainbowMode ? this._getRainbowColor() : this.glowColor;
    ctx.fillStyle = this.color;

    // Draw rounded rectangle
    const x = this.x - halfWidth;
    const y = this.y - halfHeight;
    const w = this.width;
    const h = this.height;

    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + w - cornerRadius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + cornerRadius);
    ctx.lineTo(x + w, y + h - cornerRadius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - cornerRadius, y + h);
    ctx.lineTo(x + cornerRadius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
    ctx.closePath();
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = rainbowMode ? this._getRainbowColor() : this.glowColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();

    // Magnet indicator
    if (this.magnetActive) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = rainbowMode ? this._getRainbowColor() : this.glowColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = rainbowMode ? this._getRainbowColor() : this.glowColor;
      ctx.stroke();
    }

    ctx.restore();
  }

  private _getRainbowColor(): string {
    const hue = (performance.now() / 3) % 360;
    return `hsl(${hue}, 100%, 60%)`;
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
  }

  center(): number {
    return this.y;
  }

  top(): number {
    return this.y - this.height / 2;
  }

  bottom(): number {
    return this.y + this.height / 2;
  }

  expand(duration: number): void {
    this.expanded = true;
    this.height = this.baseHeight * 1.5;
    this.expandTimer = duration;
  }

  shrink(duration: number): void {
    this.expanded = true;
    this.height = this.baseHeight * 0.6;
    this.expandTimer = duration;
  }

  activateMagnet(duration: number): void {
    this.magnetActive = true;
    this.magnetTimer = duration;
  }
}
