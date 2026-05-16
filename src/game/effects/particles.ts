import type { Particle } from '../types.js';
import { PARTICLE_COUNT_POWERUP, PARTICLE_MAX_COUNT } from '../constants.js';

export class ParticleSystem {
  private particles: Particle[] = [];

  emit(
    x: number,
    y: number,
    count: number,
    color: string,
    glow: string,
    speed: number = 300,
    spread: number = Math.PI * 2,
  ): void {
    // If we'd exceed max, trim oldest particles first
    const projected = this.particles.length + count;
    if (projected > PARTICLE_MAX_COUNT) {
      const removeCount = Math.ceil((projected - PARTICLE_MAX_COUNT) * 1.2);
      this.particles.splice(0, removeCount);
    }

    const halfSpread = spread / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * spread - halfSpread;
      const vel = speed * (0.5 + Math.random() * 0.5);
      const maxLife = 0.3 + Math.random() * 0.4;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: maxLife,
        maxLife,
        size: 2 + Math.random() * 3,
        color,
        glow,
      });
    }
  }

  emitTrail(x: number, y: number, color: string, glow: string): void {
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      const maxLife = 0.2 + Math.random() * 0.3;

      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 1 + Math.random() * 2,
        color,
        glow,
      });
    }
  }

  emitPowerUp(x: number, y: number, color: string, glow: string): void {
    for (let i = 0; i < PARTICLE_COUNT_POWERUP; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 50 + Math.random() * 100;
      const maxLife = 0.5 + Math.random() * 0.5;

      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 1.5 + Math.random() * 2.5,
        color,
        glow,
      });
    }
  }

  update(dt: number): void {
    const friction = Math.max(0, 1 - 1.2 * dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 50 * dt;
      p.vx *= friction;
      p.vy *= friction;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Phase 1: Draw glow as larger, semi-transparent circles (no shadowBlur)
    // We batch by glow color to minimize state changes
    const colorGroups = new Map<string, Particle[]>();
    for (const p of this.particles) {
      const group = colorGroups.get(p.glow);
      if (group) {
        group.push(p);
      } else {
        colorGroups.set(p.glow, [p]);
      }
    }

    for (const [glowColor, group] of colorGroups) {
      ctx.fillStyle = glowColor;
      for (const p of group) {
        const lifeRatio = Math.max(0, p.life / p.maxLife);
        const alpha = lifeRatio * 0.35;
        const radius = p.size * 3.5;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Phase 2: Draw solid cores on top
    for (const p of this.particles) {
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      const alpha = lifeRatio;
      const radius = p.size * (0.5 + 0.5 * lifeRatio);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  emitRainbow(
    x: number,
    y: number,
    count: number,
    speed: number = 300,
    spread: number = Math.PI * 2,
  ): void {
    const halfSpread = spread / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * spread - halfSpread;
      const vel = speed * (0.5 + Math.random() * 0.5);
      const maxLife = 0.3 + Math.random() * 0.4;
      const hue = Math.random() * 360;
      const color = `hsl(${hue}, 100%, 60%)`;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: maxLife,
        maxLife,
        size: 2 + Math.random() * 3,
        color,
        glow: color,
      });
    }
  }

  clear(): void {
    this.particles = [];
  }
}
