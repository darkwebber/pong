import {
  AI_EASY_SPEED,
  AI_MEDIUM_SPEED,
  AI_HARD_SPEED,
  AI_EASY_REACTION,
  AI_MEDIUM_REACTION,
  AI_HARD_REACTION,
  AI_EASY_ERROR,
  AI_MEDIUM_ERROR,
  AI_HARD_ERROR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PADDLE_MARGIN,
  PADDING,
} from '../constants.js';
import type { Difficulty } from '../types.js';

export class AIController {
  private speed: number;
  private reactionDelay: number;
  private errorMargin: number;
  private reactionTimer: number = 0;
  private targetY: number = CANVAS_HEIGHT / 2;
  private currentError: number = 0;
  private errorTimer: number = 0;

  constructor(difficulty: Difficulty) {

    switch (difficulty) {
      case 'easy':
        this.speed = AI_EASY_SPEED;
        this.reactionDelay = AI_EASY_REACTION;
        this.errorMargin = AI_EASY_ERROR;
        break;
      case 'hard':
        this.speed = AI_HARD_SPEED;
        this.reactionDelay = AI_HARD_REACTION;
        this.errorMargin = AI_HARD_ERROR;
        break;
      case 'medium':
      default:
        this.speed = AI_MEDIUM_SPEED;
        this.reactionDelay = AI_MEDIUM_REACTION;
        this.errorMargin = AI_MEDIUM_ERROR;
        break;
    }

    this.targetY = CANVAS_HEIGHT / 2;
  }

  update(
    dt: number,
    paddleY: number,
    _paddleSpeed: number,
    ballX: number,
    ballY: number,
    ballVX: number,
    ballVY: number,
    canvasHeight: number
  ): number {
    // Determine AI side (right side)
    const aiSideX = CANVAS_WIDTH - PADDLE_MARGIN;
    const isBallMovingTowardAI = ballVX > 0;

    if (!isBallMovingTowardAI) {
      // Ball moving away: return to center at a decent speed
      const returnSpeed = this.speed * 0.6;
      const centerY = canvasHeight / 2;
      const diff = centerY - paddleY;
      const moveAmount = Math.max(-returnSpeed * dt, Math.min(returnSpeed * dt, diff));
      const newY = paddleY + moveAmount;
      return Math.max(0, Math.min(1, newY / canvasHeight));
    }

    // Update reaction timer
    this.reactionTimer -= dt;

    // Update error independently of reaction timing so the AI doesn't stay locked
    // on a single wrong aim for too long.
    this.errorTimer -= dt;
    if (this.errorTimer <= 0) {
      this.errorTimer = 0.5 + Math.random() * 1.0; // Change error every 0.5-1.5s
      this.currentError = (Math.random() * 2 - 1) * this.errorMargin;
    }

    if (this.reactionTimer <= 0) {
      this.reactionTimer = this.reactionDelay;

      // Predict ball trajectory
      const predictedY = this.predictBallY(ballX, ballY, ballVX, ballVY, aiSideX, canvasHeight);
      this.targetY = predictedY + this.currentError;
    }

    // Return the target position directly.
    // The paddle's own movement system handles speed limiting and smoothing.
    return Math.max(0, Math.min(1, this.targetY / canvasHeight));
  }

  private predictBallY(
    ballX: number,
    ballY: number,
    ballVX: number,
    ballVY: number,
    targetX: number,
    canvasHeight: number
  ): number {
    if (ballVX === 0) return ballY;

    let simX = ballX;
    let simY = ballY;
    let simVX = ballVX;
    let simVY = ballVY;

    // Use actual wall boundaries (with padding)
    const topWall = PADDING;
    const bottomWall = canvasHeight - PADDING;

    // Simple prediction with bounces
    const maxIterations = 10;
    for (let i = 0; i < maxIterations; i++) {
      if (simVX === 0) break;

      const timeToTarget = (targetX - simX) / simVX;

      if (timeToTarget <= 0) {
        // Ball already past the AI — track its current position
        return Math.max(topWall, Math.min(bottomWall, ballY));
      }

      const futureY = simY + simVY * timeToTarget;

      // Check if it hits a wall before reaching target
      if (futureY < topWall || futureY > bottomWall) {
        // Calculate time to wall hit
        const wallY = futureY < topWall ? topWall : bottomWall;
        const timeToWall = (wallY - simY) / simVY;

        if (timeToWall > 0 && timeToWall < timeToTarget) {
          // Bounce
          simX = simX + simVX * timeToWall;
          simY = wallY;
          simVY = -simVY;
          continue;
        }
      }

      return Math.max(topWall, Math.min(bottomWall, futureY));
    }

    return Math.max(topWall, Math.min(bottomWall, simY));
  }
}
