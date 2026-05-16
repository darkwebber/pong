// Canvas & World
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const PADDING = 20;

// Paddles
export const PADDLE_WIDTH = 20;
export const PADDLE_HEIGHT = 140;
export const PADDLE_SPEED = 700; // pixels per second
export const PADDLE_MARGIN = 60;
export const PADDLE_GLOW = '#00f0ff';
export const AI_PADDLE_GLOW = '#ff00aa';

// Ball
export const BALL_RADIUS = 12;
export const BALL_BASE_SPEED = 550;
export const BALL_MAX_SPEED = 1600;
export const BALL_SPEED_INCREMENT = 35;
export const BALL_GLOW = '#ffffff';

// Physics
export const FRICTION = 0.98;
export const SPIN_FACTOR = 0.3;
export const MAX_SPIN = 300;

// AI
export const AI_EASY_SPEED = 500;
export const AI_MEDIUM_SPEED = 700;
export const AI_HARD_SPEED = 950;
export const AI_EASY_REACTION = 0.35;
export const AI_MEDIUM_REACTION = 0.15;
export const AI_HARD_REACTION = 0.05;
export const AI_EASY_ERROR = 60;
export const AI_MEDIUM_ERROR = 25;
export const AI_HARD_ERROR = 5;

// Power-ups
export const POWERUP_SPAWN_INTERVAL_MIN = 8000;
export const POWERUP_SPAWN_INTERVAL_MAX = 15000;
export const POWERUP_RADIUS = 22;
export const POWERUP_DURATION = 6000;
export const POWERUP_COLORS: Record<string, { color: string; glow: string }> = {
  expand: { color: '#00ff88', glow: '#00ff88' },
  shrink: { color: '#ff4444', glow: '#ff4444' },
  multiball: { color: '#ffee00', glow: '#ffee00' },
  magnet: { color: '#aa66ff', glow: '#aa66ff' },
  timewarp: { color: '#00ccff', glow: '#00ccff' },
};

// Visual Effects
export const TRAIL_LENGTH = 18;
export const TRAIL_DECAY = 0.85;
export const PARTICLE_COUNT_HIT = 12;
export const PARTICLE_COUNT_SCORE = 30;
export const PARTICLE_COUNT_POWERUP = 20;
export const PARTICLE_MAX_COUNT = 150;
export const SCREEN_SHAKE_DECAY = 0.9;
export const TIME_DILATION_FACTOR = 0.5;
export const TIME_DILATION_DURATION = 150;
export const PADDLE_HIT_DEBOUNCE_MS = 40;

// CRT Effect
export const CRT_SCANLINE_SPACING = 4;
export const CRT_SCANLINE_OPACITY = 0.08;
export const CRT_VIGNETTE_INNER = 0.3;
export const CRT_VIGNETTE_OUTER = 0.8;
export const CRT_VIGNETTE_OPACITY = 0.4;

// Audio
export const AUDIO_MASTER_VOLUME = 0.4;
export const HIT_BASE_FREQ = 440;
export const SCORE_FREQ = 880;
export const POWERUP_FREQ = 660;
