export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'COUNTDOWN' | 'GAME_OVER';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type PowerUpType = 'expand' | 'shrink' | 'multiball' | 'magnet' | 'timewarp';

export interface GameSettings {
  difficulty: Difficulty;
  soundEnabled: boolean;
  musicEnabled: boolean;
  particlesEnabled: boolean;
  screenShakeEnabled: boolean;
  timeDilationEnabled: boolean;
  powerUpsEnabled: boolean;
  crtEnabled: boolean;
  targetScore: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'medium',
  soundEnabled: true,
  musicEnabled: false,
  particlesEnabled: true,
  screenShakeEnabled: true,
  timeDilationEnabled: true,
  powerUpsEnabled: true,
  crtEnabled: false,
  targetScore: 7,
};

export interface PowerUp {
  type: PowerUpType;
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  duration: number;
  active: boolean;
  target: 'player' | 'ai' | null;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow: string;
}

export interface ScreenShake {
  intensity: number;
  duration: number;
  timer: number;
}

export interface TimeDilation {
  factor: number;
  duration: number;
  timer: number;
}
