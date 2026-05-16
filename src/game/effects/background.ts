export class BackgroundRenderer {
  private canvasWidth: number;
  private canvasHeight: number;
  private time: number = 0;
  private gridOffset: number = 0;
  private currentIntensity: number = 0;
  private waveOffset: number = 0;
  private ballDirection: number = 0; // -1, 0, or 1
  private waveFrozen: boolean = false;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  update(dt: number, intensity: number): void {
    this.time += dt;
    this.currentIntensity = intensity;
    this.gridOffset += dt * 20 * (0.5 + intensity * 0.5);
    if (this.gridOffset > 40) {
      this.gridOffset -= 40;
    }

    // Update wave offset based on ball direction
    if (this.ballDirection !== 0 && !this.waveFrozen) {
      this.waveOffset -= dt * 3 * this.ballDirection;
    }
  }

  setBallDirection(vx: number): void {
    const newDirection = Math.sign(vx);
    if (newDirection === 0) {
      this.waveFrozen = true;
    } else {
      this.ballDirection = newDirection;
      this.waveFrozen = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Dark base
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Grid lines
    const gridSize = 40;
    const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.time * 2));

    ctx.strokeStyle = `rgba(26, 26, 46, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(26, 26, 46, 0.5)';

    ctx.beginPath();

    // Vertical lines
    for (let x = this.gridOffset % gridSize; x < this.canvasWidth; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvasHeight);
    }

    // Horizontal lines
    for (let y = this.gridOffset % gridSize; y < this.canvasHeight; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasWidth, y);
    }

    ctx.stroke();

    // Sine wave in the middle
    const centerY = this.canvasHeight / 2;
    const waveAmplitude = 30 + 100 * this.currentIntensity;
    const waveFreq = 0.01;

    ctx.strokeStyle = `rgba(0, 240, 255, ${0.3 + this.currentIntensity * 0.4})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10 + this.currentIntensity * 15;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';

    ctx.beginPath();
    for (let x = 0; x < this.canvasWidth; x += 2) {
      const y = centerY + Math.sin(x * waveFreq + this.waveOffset) * waveAmplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }
}
