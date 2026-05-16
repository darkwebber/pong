import type { PowerUp, PowerUpType } from './types.js';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  POWERUP_SPAWN_INTERVAL_MIN,
  POWERUP_SPAWN_INTERVAL_MAX,
  POWERUP_RADIUS,
  POWERUP_DURATION,
  POWERUP_COLORS,
} from './constants.js';
import { ParticleSystem } from './effects/particles.js';

export interface PowerUpSpawn {
  type: PowerUpType;
  x: number;
  y: number;
}

export interface ActiveEffect {
  type: PowerUpType;
  target: 'player' | 'ai';
  timer: number;
  duration: number;
}

const POWERUP_ICONS: Record<PowerUpType, string> = {
  expand: 'E',
  shrink: 'S',
  multiball: 'M',
  magnet: 'G',
  timewarp: 'T',
};

const MAGNET_DURATION = 3000;
const BALL_AVOID_RADIUS = 200;
const FLOAT_AMPLITUDE = 5;
const FLOAT_SPEED = 2;
const PULSE_SPEED = 3;
const PULSE_AMOUNT = 0.1;

export class PowerUpManager {
  private spawned: PowerUp | null = null;
  private spawnTimer = 0;
  private nextSpawnInterval = 0;
  private activeEffects: ActiveEffect[] = [];
  private floatTime = 0;
  private prevBallX: number | null = null;
  private particleSystem: ParticleSystem | null = null;

  constructor() {
    this.reset();
  }

  /** Store a reference to the game's particle system for collection bursts. */
  setParticleSystem(ps: ParticleSystem): void {
    this.particleSystem = ps;
  }

  /**
   * Update spawn timer and floating animation.
   * @returns PowerUpSpawn if a new power-up was spawned this frame.
   */
  update(dt: number, enabled: boolean, ballX: number, ballY: number): PowerUpSpawn | null {
    // Track ball position so we can infer direction during collision checks
    this.prevBallX = ballX;

    // Advance spawn timer only when no power-up is on screen and power-ups are enabled
    if (!this.spawned && enabled) {
      this.spawnTimer += dt * 1000;
    }

    // Advance floating animation for the orb
    if (this.spawned) {
      this.floatTime += dt;
    }

    // Spawn a new power-up when the timer exceeds the random interval
    if (!this.spawned && enabled && this.spawnTimer >= this.nextSpawnInterval) {
      const powerUp = this.spawn(ballX, ballY);
      this.spawned = powerUp;
      this.spawnTimer = 0;
      this.nextSpawnInterval = this.randomSpawnInterval();
      return {
        type: powerUp.type,
        x: powerUp.x,
        y: powerUp.y,
      };
    }

    return null;
  }

  /**
   * Check collision between a ball and the spawned power-up.
   * @param ballVelX Optional ball velocity X for reliable direction detection.
   * @returns ActiveEffect if collected, null otherwise.
   */
  checkCollision(
    ballX: number,
    ballY: number,
    ballRadius: number,
    playerPaddleX: number,
    aiPaddleX: number,
    ballVelX?: number,
  ): ActiveEffect | null {
    if (!this.spawned) return null;

    const dx = ballX - this.spawned.x;
    const dy = ballY - this.spawned.y;
    const distSq = dx * dx + dy * dy;
    const radiusSum = ballRadius + this.spawned.radius;

    if (distSq < radiusSum * radiusSum) {
      // Determine target: leftward movement -> player, rightward -> ai
      let target: 'player' | 'ai';
      if (ballVelX !== undefined) {
        target = ballVelX < 0 ? 'player' : 'ai';
      } else if (this.prevBallX !== null && ballX !== this.prevBallX) {
        target = ballX < this.prevBallX ? 'player' : 'ai';
      } else {
        // Fallback: whichever paddle the ball is closer to is treated as the "collector"
        const distToPlayer = Math.abs(ballX - playerPaddleX);
        const distToAi = Math.abs(ballX - aiPaddleX);
        target = distToPlayer < distToAi ? 'player' : 'ai';
      }

      // Determine effect duration
      let duration: number;
      if (this.spawned.type === 'magnet') {
        duration = MAGNET_DURATION;
      } else if (this.spawned.type === 'multiball') {
        duration = 0;
      } else {
        duration = POWERUP_DURATION;
      }

      const effect: ActiveEffect = {
        type: this.spawned.type,
        target,
        timer: duration,
        duration,
      };

      this.activeEffects.push(effect);

      // Trigger particle burst on collection
      if (this.particleSystem) {
        this.particleSystem.emitPowerUp(
          this.spawned.x,
          this.spawned.y,
          this.spawned.color,
          this.spawned.glowColor,
        );
      }

      this.spawned = null;
      return effect;
    }

    return null;
  }

  /**
   * Spawn a power-up at a random position, avoiding the area near the ball.
   */
  spawn(ballX: number, ballY: number): PowerUp {
    const types: PowerUpType[] = ['expand', 'shrink', 'multiball', 'magnet', 'timewarp'];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = POWERUP_COLORS[type];

    let x: number;
    let y: number;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      x = CANVAS_WIDTH * 0.25 + Math.random() * CANVAS_WIDTH * 0.5;
      y = CANVAS_HEIGHT * 0.15 + Math.random() * CANVAS_HEIGHT * 0.7;
      attempts++;
    } while (attempts < maxAttempts && this.distanceTo(x, y, ballX, ballY) < BALL_AVOID_RADIUS);

    return {
      type,
      x,
      y,
      radius: POWERUP_RADIUS,
      color: colors.color,
      glowColor: colors.glow,
      duration: type === 'magnet' ? MAGNET_DURATION : POWERUP_DURATION,
      active: true,
      target: null,
    };
  }

  /**
   * Update active effect timers and remove expired effects.
   * @returns A shallow copy of the currently active effects.
   */
  updateEffects(dt: number): ActiveEffect[] {
    const dtMs = dt * 1000;
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.timer -= dtMs;
      if (effect.timer <= 0) {
        this.activeEffects.splice(i, 1);
      }
    }
    return this.activeEffects.slice();
  }

  /** Get the currently spawned power-up (if any). */
  getSpawned(): PowerUp | null {
    return this.spawned;
  }

  /** Render the spawned power-up orb with floating animation and glow. */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.spawned) return;

    const floatOffset = Math.sin(this.floatTime * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    const pulse = 1 + Math.sin(this.floatTime * PULSE_SPEED) * PULSE_AMOUNT;
    const x = this.spawned.x;
    const y = this.spawned.y + floatOffset;
    const radius = this.spawned.radius * pulse;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Outer glow ring
    ctx.shadowBlur = 30;
    ctx.shadowColor = this.spawned.glowColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.spawned.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.fill();

    // Icon letter
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(radius)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_ICONS[this.spawned.type], x, y);

    ctx.restore();
  }

  /** Clear all state: despawn orb, reset timers, and remove active effects. */
  reset(): void {
    this.spawned = null;
    this.spawnTimer = 0;
    this.nextSpawnInterval = this.randomSpawnInterval();
    this.activeEffects = [];
    this.floatTime = 0;
    this.prevBallX = null;
  }

  private randomSpawnInterval(): number {
    return (
      POWERUP_SPAWN_INTERVAL_MIN +
      Math.random() * (POWERUP_SPAWN_INTERVAL_MAX - POWERUP_SPAWN_INTERVAL_MIN)
    );
  }

  private distanceTo(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
