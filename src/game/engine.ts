import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDING,
  PADDLE_MARGIN,
  BALL_BASE_SPEED,
  BALL_MAX_SPEED,
  PADDLE_HEIGHT,
  PARTICLE_COUNT_HIT,
  PARTICLE_COUNT_SCORE,
  PADDLE_HIT_DEBOUNCE_MS,
  TIME_DILATION_FACTOR,
  TIME_DILATION_DURATION,
} from './constants.js';
import type { GameState, GameSettings, Difficulty } from './types.js';
import { DEFAULT_SETTINGS } from './types.js';
import { InputManager, isTouchDevice } from './input.js';
import { AudioEngine } from './audio.js';
import { Paddle } from './entities/paddle.js';
import { Ball } from './entities/ball.js';
import { AIController } from './entities/ai.js';
import { ParticleSystem } from './effects/particles.js';
import { BackgroundRenderer } from './effects/background.js';
import { ScreenEffects } from './effects/screenEffects.js';
import { PowerUpManager, type ActiveEffect } from './powerups.js';
import { UIManager, type UIEvents } from '../ui/uiManager.js';

export class Game {
  private canvas: HTMLCanvasElement;
  private uiLayer: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private uiManager: UIManager;
  private input: InputManager;
  private audio: AudioEngine;
  private particles: ParticleSystem;
  private background: BackgroundRenderer;
  private screenEffects: ScreenEffects;
  private powerUpManager: PowerUpManager;

  private playerPaddle: Paddle;
  private aiPaddle: Paddle;
  private balls: Ball[] = [];
  private mainBall: Ball;

  private aiController: AIController;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };

  private state: GameState = 'MENU';
  private playerScore = 0;
  private aiScore = 0;
  private rallyCount = 0;

  private countdownValue = 3;
  private countdownTimer = 0;

  private lastTime = 0;
  private animFrameId = 0;
  private audioInitialized = false;
  private showTutorialOnStart = false;
  private youLabelTimer = 0;
  private lastDt = 0.016;

  // Rainbow mode
  private rainbowMode = false;
  private rainbowHue = 0;

  // Near-miss detection
  private nearMissCooldown = 0;

  // Rally milestones
  private hyperModeActive = false;
  private milestoneAnnounced = false;

  // Pause dim overlay
  private pauseDimOverlay: HTMLElement | null = null;

  // Game over shatter
  private shatterActive = false;
  private shatterTimer = 0;
  private shatterPieces: { x: number; y: number; vx: number; vy: number; size: number; color: string }[] = [];

  // Orientation
  private isPortrait = false;

  constructor(canvas: HTMLCanvasElement, uiLayer: HTMLElement) {
    this.canvas = canvas;
    this.uiLayer = uiLayer;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    // Setup canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initialize modules
    this.input = new InputManager(canvas);
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem();
    this.background = new BackgroundRenderer(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.screenEffects = new ScreenEffects();
    this.powerUpManager = new PowerUpManager();
    this.powerUpManager.setParticleSystem(this.particles);

    // Create paddles
    this.playerPaddle = new Paddle(PADDLE_MARGIN, CANVAS_HEIGHT / 2, true);
    this.aiPaddle = new Paddle(CANVAS_WIDTH - PADDLE_MARGIN, CANVAS_HEIGHT / 2, false);

    // Create main ball
    this.mainBall = new Ball(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.balls.push(this.mainBall);

    // Create AI
    this.aiController = new AIController(this.settings.difficulty);

    // Create UI
    const uiEvents: UIEvents = {
      onStartGame: () => this.startGame(),
      onResumeGame: () => this.resumeGame(),
      onRestartGame: () => this.restartGame(),
      onMainMenu: () => this.goToMainMenu(),
      onOpenSettings: () => {},
      onCloseSettings: () => {},
      onDifficultyChange: (d) => this.setDifficulty(d),
      onSettingToggle: (key) => this.toggleSetting(key),
      onDismissTutorial: () => this.dismissTutorial(),
      onScreenPause: () => this.pauseGame(),
      onPortraitButton: (value) => this.input.setPortraitButton(value),
    };
    this.uiManager = new UIManager(uiLayer, uiEvents, this.settings);
    this.uiManager.showMenu();

    // Initialize portrait state for input and UI
    this.input.setPortraitMode(this.isPortrait);
    this.uiManager.setPortraitMode(this.isPortrait);
    this.uiLayer.classList.toggle('portrait-mode', this.isPortrait);

    // Load rainbow mode unlock state
    const rainbowUnlocked = localStorage.getItem('pong_rainbow_unlocked');
    if (rainbowUnlocked === 'true') {
      this.rainbowMode = true;
    }

    // Create pause dim overlay
    this.pauseDimOverlay = document.createElement('div');
    this.pauseDimOverlay.className = 'pause-dim-overlay';
    uiLayer.appendChild(this.pauseDimOverlay);
  }

  init(): void {
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  private resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const newPortrait = rect.width < rect.height;
    if (this.isPortrait !== newPortrait) {
      this.isPortrait = newPortrait;
      this.input?.setPortraitMode(this.isPortrait);
      this.uiManager?.setPortraitMode(this.isPortrait);
      this.uiLayer?.classList.toggle('portrait-mode', this.isPortrait);
    } else {
      this.isPortrait = newPortrait;
    }
  }

  private initAudio(): void {
    if (!this.audioInitialized) {
      this.audio.init();
      this.audioInitialized = true;
      if (this.settings.musicEnabled) {
        this.audio.startMusic();
      }
    }
  }

  // --- State Management ---

  private startGame(): void {
    this.initAudio();

    // Check if first-time tutorial should show
    const hasSeen = localStorage.getItem('pong_has_seen_tutorial');
    if (!hasSeen) {
      this.showTutorialOnStart = true;
    }

    this.resetMatch();
    this.state = 'COUNTDOWN';
    this.countdownValue = 3;
    this.countdownTimer = 0;
    this.uiManager.hideMenu();
    this.uiManager.hideGameOver();
    this.uiManager.hideSettings();
    this.uiManager.showHUD();
    this.uiManager.updateScore(0, 0);
    this.uiManager.updateRally(0, false);

    if (this.showTutorialOnStart) {
      this.uiManager.showTutorial();
      this.input.setEnabled(false);
    } else {
      this.uiManager.showCountdown(this.countdownValue);
      this.input.setEnabled(false);
    }
  }

  private dismissTutorial(): void {
    localStorage.setItem('pong_has_seen_tutorial', 'true');
    this.showTutorialOnStart = false;
    this.uiManager.hideTutorial();
    this.uiManager.showCountdown(this.countdownValue);
  }

  private restartGame(): void {
    this.playerScore = 0;
    this.aiScore = 0;
    this.rallyCount = 0;
    this.startGame();
  }

  private goToMainMenu(): void {
    this.state = 'MENU';
    this.resetMatch();
    this.uiManager.hidePause();
    this.uiManager.hideGameOver();
    this.uiManager.hideSettings();
    this.uiManager.showMenu();
  }

  private pauseGame(): void {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.input.setEnabled(false);
      this.uiManager.showPause();
      this.pauseDimOverlay?.classList.add('active');
      this.background.setBallDirection(0);
    }
  }

  private resumeGame(): void {
    if (this.state === 'PAUSED') {
      this.state = 'COUNTDOWN';
      this.countdownValue = 3;
      this.countdownTimer = 0;
      this.input.setEnabled(false);
      this.uiManager.hidePause();
      this.pauseDimOverlay?.classList.remove('active');
      this.uiManager.showCountdown(this.countdownValue);
    }
  }

  private resetMatch(): void {
    this.balls = [this.mainBall];
    this.mainBall.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.playerPaddle.y = CANVAS_HEIGHT / 2;
    this.aiPaddle.y = CANVAS_HEIGHT / 2;
    this.playerPaddle.height = PADDLE_HEIGHT;
    this.aiPaddle.height = PADDLE_HEIGHT;
    this.rallyCount = 0;
    this.hyperModeActive = false;
    this.milestoneAnnounced = false;
    this.shatterActive = false;
    this.shatterTimer = 0;
    this.shatterPieces = [];
    this.powerUpManager.reset();
    this.particles.clear();
  }

  private setDifficulty(d: Difficulty): void {
    this.settings.difficulty = d;
    this.aiController = new AIController(d);
  }

  private toggleSetting(key: keyof GameSettings): void {
    const current = this.settings[key];
    if (typeof current === 'boolean') {
      (this.settings as unknown as Record<string, boolean>)[key] = !current;
    }
    this.uiManager.syncSettings(this.settings);

    if (key === 'musicEnabled') {
      if (this.settings.musicEnabled) {
        this.audio.startMusic();
      } else {
        this.audio.stopMusic();
      }
    }
    if (key === 'soundEnabled') {
      this.audio.setMuted(!this.settings.soundEnabled);
    }
  }

  // --- Game Loop ---

  private gameLoop = (timestamp: number): void => {
    this.animFrameId = requestAnimationFrame(this.gameLoop);

    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap dt to prevent huge jumps
    dt = Math.min(dt, 0.05);
    this.lastDt = dt;

    this.input.update();

    // Check konami code
    if (this.input.wasKonamiPressed()) {
      this.rainbowMode = !this.rainbowMode;
      localStorage.setItem('pong_rainbow_unlocked', String(this.rainbowMode));
      if (this.settings.soundEnabled) {
        this.audio.playPowerUp('multiball'); // Use as unlock sound
      }
    }

    // Handle pause toggle
    if (this.input.wasPausePressed() && (this.state === 'PLAYING' || this.state === 'PAUSED')) {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      } else {
        this.resumeGame();
      }
    }

    if (this.state === 'PLAYING') {
      this.updatePlaying(dt);
    } else if (this.state === 'COUNTDOWN') {
      this.updateCountdown(dt);
    }

    this.render();
  };

  private updateCountdown(dt: number): void {
    this.countdownTimer += dt;

    // Freeze wave during countdown
    this.background.setBallDirection(0);

    if (this.countdownTimer >= 1) {
      this.countdownTimer -= 1;
      this.countdownValue--;

      if (this.countdownValue > 0) {
        this.uiManager.showCountdown(this.countdownValue);
      } else if (this.countdownValue === 0) {
        this.uiManager.showCountdown(0); // GO!
      } else {
        this.uiManager.hideCountdown();
        this.state = 'PLAYING';
        this.input.setEnabled(true);
        this.serveBall();
      }
    }
  }

  private serveBall(): void {
    const angle = (Math.random() - 0.5) * 0.5;
    const direction = Math.random() > 0.5 ? 1 : -1;
    this.mainBall.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.mainBall.launch(BALL_BASE_SPEED, angle, direction);
    this.rallyCount = 0;
    // Longer "YOU" label on mobile for better orientation
    this.youLabelTimer = isTouchDevice() ? 5 : 3;
  }

  private updatePlaying(dt: number): void {
    // Apply time scale from screen effects
    const timeScale = this.screenEffects.getTimeScale();
    const scaledDt = dt * timeScale;

    this.screenEffects.update(dt);

    // Update background intensity based on rally and ball speed
    const maxSpeed = Math.max(...this.balls.map(b => b.speed));
    const intensity = Math.min(1, (this.rallyCount / 10) * 0.5 + (maxSpeed / BALL_MAX_SPEED) * 0.5);
    this.background.update(dt, intensity);
    this.background.setBallDirection(this.mainBall.vx);

    // Player input
    const input = this.input.getPlayerInput();

    // Apply time warp power-up effect
    let playerSpeedMult = 1;
    let aiSpeedMult = 1;
    const activeEffects = this.powerUpManager.updateEffects(scaledDt);
    for (const effect of activeEffects) {
      if (effect.type === 'timewarp') {
        if (effect.target === 'player') {
          aiSpeedMult = 0.5;
        } else {
          playerSpeedMult = 0.5;
        }
      }
    }

    // --- Player paddle: unified input routing ---
    if (input.mode === 'keyboard') {
      this.playerPaddle.setMoveDirection(input.value);
    } else if (input.mode === 'touch') {
      this.playerPaddle.setPosition(input.value, CANVAS_HEIGHT);
    } else {
      this.playerPaddle.setMoveDirection(0);
    }

    // Always update paddle (timers + movement)
    this.playerPaddle.update(scaledDt * playerSpeedMult, CANVAS_HEIGHT);

    // --- AI control ---
    const aiTarget = this.aiController.update(
      scaledDt,
      this.aiPaddle.y,
      this.aiPaddle.speed,
      this.mainBall.x,
      this.mainBall.y,
      this.mainBall.vx,
      this.mainBall.vy,
      CANVAS_HEIGHT
    );
    this.aiPaddle.setTargetY(aiTarget);
    this.aiPaddle.update(scaledDt * aiSpeedMult, CANVAS_HEIGHT);

    // Update balls
    for (const ball of this.balls) {
      ball.setTimeScale(timeScale);
      ball.update(scaledDt);
    }

    // Update rainbow hue
    if (this.rainbowMode) {
      this.rainbowHue = (this.rainbowHue + scaledDt * 60) % 360;
      const rainbowColor = `hsl(${this.rainbowHue}, 100%, 60%)`;
      this.playerPaddle.glowColor = rainbowColor;
      this.mainBall.setRainbowMode(true, this.rainbowHue);
    } else {
      this.playerPaddle.glowColor = '#00f0ff';
      this.mainBall.setRainbowMode(false, 0);
    }

    // Near-miss detection (only for main ball)
    if (this.nearMissCooldown > 0) {
      this.nearMissCooldown -= scaledDt;
    }
    if (this.nearMissCooldown <= 0) {
      this.checkNearMiss();
    }

    // Handle collisions and scoring for each ball
    const ballsToRemove: number[] = [];
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const scored = this.handleBallCollisions(ball, i === 0, scaledDt);
      if (scored && i > 0) {
        // Extra balls just disappear on score
        ballsToRemove.push(i);
      }
    }
    // Remove extra balls that scored (in reverse order)
    for (let i = ballsToRemove.length - 1; i >= 0; i--) {
      this.balls.splice(ballsToRemove[i], 1);
    }

    // Check if any ball went out of bounds
    const outBalls: number[] = [];
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const scorer = this.checkBallOutOfBounds(ball);
      if (scorer) {
        if (i === 0) {
          // Main ball scored
          this.handleScore(scorer);
          return; // handleScore resets everything, so stop updating
        } else {
          // Extra ball went out - remove it
          outBalls.push(i);
        }
      }
    }
    for (let i = outBalls.length - 1; i >= 0; i--) {
      this.balls.splice(outBalls[i], 1);
    }

    // Power-ups
    if (this.settings.powerUpsEnabled) {
      const spawned = this.powerUpManager.update(
        dt,
        true,
        this.mainBall.x,
        this.mainBall.y
      );
      if (spawned && this.settings.soundEnabled) {
        // Optional: subtle spawn sound could be added here
      }

      // Check power-up collisions with all balls
      for (const ball of this.balls) {
        const collected = this.powerUpManager.checkCollision(
          ball.x,
          ball.y,
          ball.radius,
          this.playerPaddle.x,
          this.aiPaddle.x,
          ball.vx
        );
        if (collected) {
          this.applyPowerUp(collected);
          if (this.settings.soundEnabled) {
            this.audio.playPowerUp(collected.type);
          }
        }
      }
    }

    // Update particles
    this.particles.update(scaledDt);

    // Update UI
    this.uiManager.updateScore(this.playerScore, this.aiScore);
    this.uiManager.updateRally(this.rallyCount, true);

    // Hyper mode visual effects
    if (this.hyperModeActive && this.settings.particlesEnabled) {
      this.particles.emitRainbow(this.mainBall.x, this.mainBall.y, 2, 200);
    }

    // Decrement YOU label timer (consistent with game time)
    if (this.youLabelTimer > 0) {
      this.youLabelTimer -= scaledDt;
    }
  }

  private handleBallCollisions(ball: Ball, isMainBall: boolean, dt: number): boolean {
    // Paddle collisions
    const playerBounds = this.playerPaddle.getBounds();
    const aiBounds = this.aiPaddle.getBounds();

    const now = performance.now();

    // Swept collision: where was the ball last frame?
    const prevBallX = ball.x - ball.vx * dt;

    // Player paddle collision
    if (
      ball.vx < 0 &&
      ball.canHitPaddle(now, PADDLE_HIT_DEBOUNCE_MS) &&
      // Ball is now inside or past the paddle face
      ball.x - ball.radius <= playerBounds.x + playerBounds.width &&
      // Ball was on the right side of the paddle face last frame (swept test)
      prevBallX - ball.radius >= playerBounds.x + playerBounds.width &&
      // Vertical overlap
      ball.y + ball.radius >= playerBounds.y &&
      ball.y - ball.radius <= playerBounds.y + playerBounds.height
    ) {
      ball.x = playerBounds.x + playerBounds.width + ball.radius + 2;
      ball.recordPaddleHit(now);
      this.reflectBallOffPaddle(ball, this.playerPaddle, 1);
      if (isMainBall) this.onRallyHit(ball, -1);
      return false;
    }

    // AI paddle collision
    if (
      ball.vx > 0 &&
      ball.canHitPaddle(now, PADDLE_HIT_DEBOUNCE_MS) &&
      // Ball is now inside or past the paddle face
      ball.x + ball.radius >= aiBounds.x &&
      // Ball was on the left side of the paddle face last frame (swept test)
      prevBallX + ball.radius <= aiBounds.x &&
      // Vertical overlap
      ball.y + ball.radius >= aiBounds.y &&
      ball.y - ball.radius <= aiBounds.y + aiBounds.height
    ) {
      ball.x = aiBounds.x - ball.radius - 2;
      ball.recordPaddleHit(now);
      this.reflectBallOffPaddle(ball, this.aiPaddle, -1);
      if (isMainBall) this.onRallyHit(ball, 1);
      return false;
    }

    // Wall bounces (top/bottom) are handled in Ball.update()
    // Emit particles and sound when ball actually bounces
    if (ball.wallBounced) {
      if (this.settings.soundEnabled) {
        this.audio.playWallBounce();
      }
      if (this.settings.particlesEnabled) {
        this.particles.emit(
          ball.x,
          ball.y < CANVAS_HEIGHT / 2 ? PADDING : CANVAS_HEIGHT - PADDING,
          8,
          '#ffffff',
          '#8888ff',
          100,
          Math.PI / 2
        );
      }
    }

    return false;
  }

  private reflectBallOffPaddle(ball: Ball, paddle: Paddle, direction: number): void {
    // Calculate relative hit position (-1 to 1, where 0 is center)
    const relativeHit = (ball.y - paddle.center()) / (paddle.height / 2);
    const clampedHit = Math.max(-1, Math.min(1, relativeHit));

    // Angle based on hit position (max 60 degrees)
    const maxAngle = Math.PI / 3;
    const angle = clampedHit * maxAngle;

    // Increase speed
    ball.increaseSpeed();

    // Set new velocity
    const newVx = Math.cos(angle) * ball.speed * direction;
    const newVy = Math.sin(angle) * ball.speed;
    ball.vx = newVx;
    ball.vy = newVy;

    // Add spin based on hit position (edge hits = more spin)
    const spinAmount = clampedHit * 150;
    ball.addSpin(spinAmount);

    // Squash and stretch on impact
    ball.triggerSquash();

    // Magnet effect: if paddle has magnet active, briefly stick the ball
    if (paddle.magnetActive) {
      ball.vx *= 0.3;
      ball.vy *= 0.3;
      paddle.magnetActive = false;
      paddle.magnetTimer = 0;
    }

    // Visual effects
    if (this.settings.particlesEnabled) {
      this.particles.emit(
        ball.x,
        ball.y,
        PARTICLE_COUNT_HIT,
        paddle.glowColor,
        paddle.glowColor,
        200 + ball.speed * 0.3,
        Math.PI
      );
    }

    if (this.settings.screenShakeEnabled && ball.speed > 800) {
      this.screenEffects.triggerShake(6, 120);
    }

    if (this.settings.timeDilationEnabled && ball.speed > 1000) {
      this.screenEffects.triggerTimeDilation(TIME_DILATION_DURATION, TIME_DILATION_FACTOR);
    }

    // Audio
    if (this.settings.soundEnabled) {
      const speedNorm = Math.min(1, ball.speed / BALL_MAX_SPEED);
      const pan = (ball.x / CANVAS_WIDTH) * 2 - 1;
      this.audio.playHit(speedNorm, pan);
    }
  }

  private checkNearMiss(): void {
    const ball = this.mainBall;
    const playerBounds = this.playerPaddle.getBounds();
    const aiBounds = this.aiPaddle.getBounds();

    // Check if ball just passed a paddle vertically (within 30px of edge)
    const nearMissThreshold = 30;

    // Player side near miss
    if (ball.vx < 0 && ball.x > playerBounds.x + playerBounds.width) {
      const distToEdge = ball.x - (playerBounds.x + playerBounds.width);
      if (distToEdge < nearMissThreshold && distToEdge > 0) {
        const paddleTop = playerBounds.y;
        const paddleBottom = playerBounds.y + playerBounds.height;
        if (ball.y < paddleTop - 10 || ball.y > paddleBottom + 10) {
          // Ball is passing close to paddle edge
          if (this.settings.soundEnabled) {
            this.audio.playWallBounce(); // Reuse as near-miss whoosh
          }
          this.nearMissCooldown = 0.5;
        }
      }
    }

    // AI side near miss
    if (ball.vx > 0 && ball.x < aiBounds.x) {
      const distToEdge = aiBounds.x - ball.x;
      if (distToEdge < nearMissThreshold && distToEdge > 0) {
        const paddleTop = aiBounds.y;
        const paddleBottom = aiBounds.y + aiBounds.height;
        if (ball.y < paddleTop - 10 || ball.y > paddleBottom + 10) {
          if (this.settings.soundEnabled) {
            this.audio.playWallBounce(); // Reuse as near-miss whoosh
          }
          this.nearMissCooldown = 0.5;
        }
      }
    }
  }

  private onRallyHit(ball: Ball, _direction: number): void {
    this.rallyCount++;

    // Rally milestone: 100+ rally → Hyper Mode
    if (this.rallyCount >= 100 && !this.milestoneAnnounced) {
      this.milestoneAnnounced = true;
      this.hyperModeActive = true;
      if (this.settings.soundEnabled) {
        this.audio.playPowerUp('multiball'); // Milestone sound
      }
      if (this.settings.particlesEnabled) {
        this.particles.emitRainbow(ball.x, ball.y, 50, 400);
      }
      this.screenEffects.triggerShake(10, 500);
    }

    // Update rally milestone animation
    if (this.rallyCount === 10 || this.rallyCount === 25 || this.rallyCount === 50) {
      // Trigger milestone pulse in UI
      const rallyEl = document.querySelector('.rally-counter');
      if (rallyEl) {
        rallyEl.classList.remove('milestone');
        void (rallyEl as HTMLElement).offsetHeight;
        rallyEl.classList.add('milestone');
      }
    }

    // Intense rally effects
    if (this.rallyCount >= 5 && this.settings.screenShakeEnabled) {
      this.screenEffects.triggerShake(4, 100);
    }
    if (this.rallyCount >= 8 && this.settings.timeDilationEnabled) {
      this.screenEffects.triggerTimeDilation(TIME_DILATION_DURATION, TIME_DILATION_FACTOR);
    }
  }

  private checkBallOutOfBounds(ball: Ball): 'player' | 'ai' | null {
    if (ball.x + ball.radius < 0) {
      return 'ai';
    }
    if (ball.x - ball.radius > CANVAS_WIDTH) {
      return 'player';
    }
    return null;
  }

  private handleScore(winner: 'player' | 'ai'): void {
    if (winner === 'player') {
      this.playerScore++;
    } else {
      this.aiScore++;
    }

    // Audio
    if (this.settings.soundEnabled) {
      this.audio.playScore(winner === 'player');
    }

    // Visual effects
    if (this.settings.particlesEnabled) {
      const x = winner === 'player' ? CANVAS_WIDTH * 0.75 : CANVAS_WIDTH * 0.25;
      this.particles.emit(
        x,
        CANVAS_HEIGHT / 2,
        PARTICLE_COUNT_SCORE,
        winner === 'player' ? '#00f0ff' : '#ff00aa',
        winner === 'player' ? '#00f0ff' : '#ff00aa',
        300,
        Math.PI * 2
      );
    }

    if (this.settings.screenShakeEnabled) {
      this.screenEffects.triggerShake(15, 300);
    }

    // Update score with flash
    this.uiManager.updateScore(this.playerScore, this.aiScore, winner);

    // Reset rally
    this.rallyCount = 0;
    this.hyperModeActive = false;
    this.milestoneAnnounced = false;

    // Check game over
    if (this.playerScore >= this.settings.targetScore || this.aiScore >= this.settings.targetScore) {
      this.state = 'GAME_OVER';
      this.input.setEnabled(false);
      this.initShatterEffect();
      this.uiManager.showGameOver(winner, this.playerScore, this.aiScore);
      return;
    }

    // Reset for next round
    this.balls = [this.mainBall];
    this.mainBall.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.playerPaddle.y = CANVAS_HEIGHT / 2;
    this.aiPaddle.y = CANVAS_HEIGHT / 2;
    this.powerUpManager.reset();

    // Freeze wave until ball is served
    this.background.setBallDirection(0);

    // Start countdown for next serve
    this.state = 'COUNTDOWN';
    this.countdownValue = 3;
    this.countdownTimer = 0;
    this.uiManager.showCountdown(this.countdownValue);
  }

  private initShatterEffect(): void {
    this.shatterActive = true;
    this.shatterTimer = 2;
    this.shatterPieces = [];

    // Create shatter pieces from the ball
    const pieceCount = 30;
    for (let i = 0; i < pieceCount; i++) {
      const angle = (Math.PI * 2 * i) / pieceCount;
      const speed = 200 + Math.random() * 300;
      this.shatterPieces.push({
        x: this.mainBall.x,
        y: this.mainBall.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: this.rainbowMode
          ? `hsl(${Math.random() * 360}, 100%, 60%)`
          : i % 2 === 0 ? '#00f0ff' : '#ff00aa',
      });
    }
  }

  private applyPowerUp(effect: ActiveEffect): void {
    const targetPaddle = effect.target === 'player' ? this.playerPaddle : this.aiPaddle;
    const opponentPaddle = effect.target === 'player' ? this.aiPaddle : this.playerPaddle;

    switch (effect.type) {
      case 'expand':
        targetPaddle.expand(effect.duration);
        break;
      case 'shrink':
        opponentPaddle.shrink(effect.duration);
        break;
      case 'multiball':
        this.spawnMultiBall();
        break;
      case 'magnet':
        targetPaddle.activateMagnet(effect.duration);
        break;
      case 'timewarp':
        // Effect is handled in updatePlaying via activeEffects
        break;
    }

    this.uiManager.showPowerUpIndicator(effect.target, effect.type, effect.duration);
  }

  private spawnMultiBall(): void {
    const count = 2;
    for (let i = 0; i < count; i++) {
      const ball = new Ball(this.mainBall.x, this.mainBall.y);
      const angle = (Math.random() - 0.5) * 1.2;
      const dir = Math.random() > 0.5 ? 1 : -1;
      ball.launch(this.mainBall.speed * 0.9, angle, dir);
      this.balls.push(ball);
    }
  }

  // --- Rendering ---

  private render(): void {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Apply orientation-aware transform
    ctx.save();
    if (this.isPortrait) {
      const scale = Math.min(rect.width / CANVAS_HEIGHT, rect.height / CANVAS_WIDTH);
      ctx.translate(rect.width / 2, rect.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(scale, scale);
      ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
    } else {
      const scaleX = rect.width / CANVAS_WIDTH;
      const scaleY = rect.height / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (rect.width - CANVAS_WIDTH * scale) / 2;
      const offsetY = (rect.height - CANVAS_HEIGHT * scale) / 2;
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
    }

    // Apply screen effects (shake)
    this.screenEffects.apply(ctx);

    // Background
    this.background.render(ctx);

    // Center line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.restore();

    // Power-up
    this.powerUpManager.render(ctx);

    // Paddles
    this.playerPaddle.render(ctx);
    this.aiPaddle.render(ctx);

    // Touch target indicator (mobile visual feedback)
    const inputResult = this.input.getPlayerInput();
    if (inputResult.mode === 'touch') {
      const indicator = this.input.getTouchIndicator();
      if (indicator.active) {
        const targetY = indicator.y * CANVAS_HEIGHT;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        if (this.isPortrait) {
          ctx.moveTo(PADDING + 10, targetY);
          ctx.lineTo(CANVAS_WIDTH * 0.35, targetY);
        } else {
          ctx.moveTo(PADDING + 10, targetY);
          ctx.lineTo(CANVAS_WIDTH * 0.25, targetY);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f0ff';
        ctx.beginPath();
        ctx.arc(PADDING + 10, targetY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // "YOU" label on player paddle (first 3 seconds of each round)
    if (this.youLabelTimer > 0) {
      const alpha = Math.min(1, this.youLabelTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "bold 16px 'Orbitron', monospace";
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';
      if (this.isPortrait) {
        ctx.save();
        ctx.rotate(Math.PI / 2);
        ctx.fillText('YOU', this.playerPaddle.x, this.playerPaddle.top() - 10);
        ctx.restore();
      } else {
        ctx.fillText('YOU', this.playerPaddle.x, this.playerPaddle.top() - 10);
      }
      ctx.restore();
    }

    // Balls
    for (const ball of this.balls) {
      ball.render(ctx);
    }

    // Shatter pieces
    if (this.shatterActive) {
      this.renderShatter(ctx, this.lastDt);
    }

    // Particles
    if (this.settings.particlesEnabled) {
      this.particles.render(ctx);
    }

    ctx.restore();

    // CRT effect (rendered in screen space, not game space)
    if (this.settings.crtEnabled) {
      this.renderCRT(ctx, rect);
    }
  }

  private renderShatter(ctx: CanvasRenderingContext2D, dt: number): void {
    if (this.shatterTimer <= 0) {
      this.shatterActive = false;
      return;
    }

    this.shatterTimer -= dt;
    const alpha = Math.max(0, this.shatterTimer / 2);

    for (const piece of this.shatterPieces) {
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.vy += 500 * dt; // Gravity

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = piece.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = piece.color;
      ctx.beginPath();
      ctx.arc(piece.x, piece.y, piece.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderCRT(ctx: CanvasRenderingContext2D, rect: DOMRect): void {
    ctx.save();

    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    const scanlineHeight = 4;
    for (let y = 0; y < rect.height; y += scanlineHeight * 2) {
      ctx.fillRect(0, y, rect.width, scanlineHeight);
    }

    // Vignette
    const gradient = ctx.createRadialGradient(
      rect.width / 2, rect.height / 2, rect.height * 0.3,
      rect.width / 2, rect.height / 2, rect.height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Chromatic aberration at edges (more visible)
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.06)';
    ctx.fillRect(-3, 0, rect.width, rect.height);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';
    ctx.fillRect(3, 0, rect.width, rect.height);

    ctx.restore();
  }

  destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.destroy();
    this.uiManager.destroy();
    this.audio.stopMusic();
  }
}
