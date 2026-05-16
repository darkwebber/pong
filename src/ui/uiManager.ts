import type { Difficulty, GameSettings } from '../game/types.ts';

export interface UIEvents {
  onStartGame: () => void;
  onResumeGame: () => void;
  onRestartGame: () => void;
  onMainMenu: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onSettingToggle: (key: keyof GameSettings) => void;
  onDismissTutorial: () => void;
}

type ListenerEntry = {
  element: EventTarget;
  type: string;
  handler: EventListener;
};

export class UIManager {
  private container: HTMLElement;
  private events: UIEvents;
  private settings: GameSettings;

  private hud!: HTMLElement;
  private scorePlayer!: HTMLElement;
  private scoreAI!: HTMLElement;
  private rallyCounter!: HTMLElement;
  private rallyCount!: HTMLElement;
  private playerPowerUp!: HTMLElement;
  private aiPowerUp!: HTMLElement;

  private mainMenu!: HTMLElement;
  private pauseMenu!: HTMLElement;
  private gameOverMenu!: HTMLElement;
  private gameOverTitle!: HTMLElement;
  private gameOverScore!: HTMLElement;
  private countdownOverlay!: HTMLElement;
  private countdownNumber!: HTMLElement;
  private settingsPanel!: HTMLElement;
  private howToPlayOverlay!: HTMLElement;
  private tutorialOverlay!: HTMLElement;

  private difficultySelect!: HTMLSelectElement;
  private targetScoreSelect!: HTMLSelectElement;
  private toggleMap: Map<keyof GameSettings, HTMLElement>;
  private powerUpTimeouts: Map<'player' | 'ai', ReturnType<typeof setTimeout>>;
  private listeners: ListenerEntry[];

  constructor(container: HTMLElement, events: UIEvents, settings: GameSettings) {
    this.container = container;
    this.events = events;
    this.settings = settings;
    this.toggleMap = new Map();
    this.powerUpTimeouts = new Map();
    this.listeners = [];

    this.createHUD();
    this.createMainMenu();
    this.createPauseMenu();
    this.createGameOverMenu();
    this.createCountdown();
    this.createSettingsPanel();
    this.createHowToPlay();
    this.createTutorial();

    this.syncSettings(settings);
  }

  private addListener(element: EventTarget, type: string, handler: EventListener): void {
    element.addEventListener(type, handler);
    this.listeners.push({ element, type, handler });
  }

  private hideAllOverlays(): void {
    this.mainMenu.classList.add('hidden');
    this.pauseMenu.classList.add('hidden');
    this.gameOverMenu.classList.add('hidden');
    this.countdownOverlay.style.display = 'none';
    this.settingsPanel.style.display = 'none';
    this.howToPlayOverlay.classList.add('hidden');
    this.tutorialOverlay.style.display = 'none';
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'neon-button';

    const span = document.createElement('span');
    span.textContent = text;
    btn.appendChild(span);

    this.addListener(btn, 'click', () => onClick());
    return btn;
  }

  private createSelectRow(label: string, select: HTMLElement): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const lbl = document.createElement('div');
    lbl.className = 'setting-label';
    lbl.textContent = label;

    row.append(lbl, select);
    return row;
  }

  private createToggle(key: keyof GameSettings, label: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const lbl = document.createElement('div');
    lbl.className = 'setting-label';
    lbl.textContent = label;

    const toggle = document.createElement('div');
    toggle.className = 'toggle-switch';

    this.toggleMap.set(key, toggle);

    this.addListener(toggle, 'click', () => {
      const isActive = toggle.classList.contains('active');
      toggle.classList.toggle('active', !isActive);

      const settingsRecord = this.settings as unknown as Record<keyof GameSettings, unknown>;
      settingsRecord[key] = !isActive;

      this.events.onSettingToggle(key);
    });

    row.append(lbl, toggle);
    return row;
  }

  private createDifficultySelect(): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'neon-select';

    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    for (const diff of difficulties) {
      const option = document.createElement('option');
      option.value = diff;
      option.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
      select.appendChild(option);
    }

    this.addListener(select, 'change', () => {
      const value = select.value as Difficulty;
      this.settings.difficulty = value;
      this.events.onDifficultyChange(value);
    });

    return select;
  }

  private createTargetScoreSelect(): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'neon-select';

    const scores = [3, 5, 7, 11];
    for (const score of scores) {
      const option = document.createElement('option');
      option.value = String(score);
      option.textContent = String(score);
      select.appendChild(option);
    }

    this.addListener(select, 'change', () => {
      const value = Number(select.value);
      this.settings.targetScore = value;
      this.events.onSettingToggle('targetScore');
    });

    return select;
  }

  private createHUD(): void {
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.style.display = 'none';

    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'score-display';

    this.scorePlayer = document.createElement('div');
    this.scorePlayer.className = 'score-player neon-text';
    this.scorePlayer.textContent = '0';

    const divider = document.createElement('div');
    divider.className = 'score-divider';
    divider.textContent = '—';

    this.scoreAI = document.createElement('div');
    this.scoreAI.className = 'score-ai neon-text';
    this.scoreAI.textContent = '0';

    scoreDisplay.append(this.scorePlayer, divider, this.scoreAI);

    this.rallyCounter = document.createElement('div');
    this.rallyCounter.className = 'rally-counter';

    const rallyLabel = document.createElement('div');
    rallyLabel.textContent = 'RALLY';

    this.rallyCount = document.createElement('div');
    this.rallyCount.className = 'rally-count';
    this.rallyCount.textContent = '0';

    this.rallyCounter.append(rallyLabel, this.rallyCount);

    this.playerPowerUp = document.createElement('div');
    this.playerPowerUp.className = 'powerup-indicator player';
    this.playerPowerUp.style.display = 'none';

    this.aiPowerUp = document.createElement('div');
    this.aiPowerUp.className = 'powerup-indicator ai';
    this.aiPowerUp.style.display = 'none';

    this.hud.append(this.playerPowerUp, this.aiPowerUp);
    this.hud.appendChild(scoreDisplay);
    this.hud.appendChild(this.rallyCounter);
    this.container.appendChild(this.hud);
  }

  private createMainMenu(): void {
    this.mainMenu = document.createElement('div');
    this.mainMenu.className = 'menu-overlay hidden';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'NEON PONG';

    const subtitle = document.createElement('div');
    subtitle.className = 'menu-subtitle';
    subtitle.textContent = 'A Game of Light and Speed';

    const controlsHint = document.createElement('div');
    controlsHint.className = 'menu-controls-hint';
    controlsHint.innerHTML = 'WASD / Arrows / Mouse to move &nbsp;&middot;&nbsp; ESC to pause';

    const btnStart = this.createButton('START GAME', () => this.events.onStartGame());
    const btnHowTo = this.createButton('HOW TO PLAY', () => this.showHowToPlay());
    btnHowTo.classList.add('yellow');
    const btnSettings = this.createButton('SETTINGS', () => {
      this.events.onOpenSettings();
      this.showSettings();
    });

    this.mainMenu.append(title, subtitle, controlsHint, btnStart, btnHowTo, btnSettings);
    this.container.appendChild(this.mainMenu);
  }

  private createPauseMenu(): void {
    this.pauseMenu = document.createElement('div');
    this.pauseMenu.className = 'menu-overlay hidden';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'PAUSED';

    const btnResume = this.createButton('RESUME', () => this.events.onResumeGame());
    const btnRestart = this.createButton('RESTART', () => this.events.onRestartGame());
    const btnSettings = this.createButton('SETTINGS', () => {
      this.events.onOpenSettings();
      this.showSettings();
    });
    const btnMainMenu = this.createButton('MAIN MENU', () => this.events.onMainMenu());

    const pauseControls = document.createElement('div');
    pauseControls.className = 'pause-controls-hint';
    pauseControls.innerHTML = 'WASD / Arrows / Mouse to move &nbsp;&middot;&nbsp; ESC to pause';

    this.pauseMenu.append(title, btnResume, btnRestart, btnSettings, btnMainMenu, pauseControls);
    this.container.appendChild(this.pauseMenu);
  }

  private createGameOverMenu(): void {
    this.gameOverMenu = document.createElement('div');
    this.gameOverMenu.className = 'menu-overlay hidden';

    this.gameOverTitle = document.createElement('div');
    this.gameOverTitle.className = 'menu-title';

    this.gameOverScore = document.createElement('div');
    this.gameOverScore.className = 'menu-subtitle';

    const btnPlayAgain = this.createButton('PLAY AGAIN', () => this.events.onRestartGame());
    const btnMainMenu = this.createButton('MAIN MENU', () => this.events.onMainMenu());

    this.gameOverMenu.append(this.gameOverTitle, this.gameOverScore, btnPlayAgain, btnMainMenu);
    this.container.appendChild(this.gameOverMenu);
  }

  private createCountdown(): void {
    this.countdownOverlay = document.createElement('div');
    this.countdownOverlay.className = 'countdown-overlay';
    this.countdownOverlay.style.display = 'none';

    this.countdownNumber = document.createElement('div');
    this.countdownNumber.className = 'countdown-number';

    this.countdownOverlay.appendChild(this.countdownNumber);
    this.container.appendChild(this.countdownOverlay);
  }

  private createSettingsPanel(): void {
    this.settingsPanel = document.createElement('div');
    this.settingsPanel.className = 'settings-panel';
    this.settingsPanel.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'settings-title';
    title.textContent = 'SETTINGS';

    this.difficultySelect = this.createDifficultySelect();
    const difficultyRow = this.createSelectRow('Difficulty', this.difficultySelect);

    this.targetScoreSelect = this.createTargetScoreSelect();
    const targetScoreRow = this.createSelectRow('Target Score', this.targetScoreSelect);

    const soundToggle = this.createToggle('soundEnabled', 'Sound');
    const musicToggle = this.createToggle('musicEnabled', 'Music');
    const particlesToggle = this.createToggle('particlesEnabled', 'Particles');
    const screenShakeToggle = this.createToggle('screenShakeEnabled', 'Screen Shake');
    const timeDilationToggle = this.createToggle('timeDilationEnabled', 'Time Dilation');
    const powerUpsToggle = this.createToggle('powerUpsEnabled', 'Power-ups');
    const crtToggle = this.createToggle('crtEnabled', 'CRT Effect');

    const btnBack = this.createButton('BACK', () => {
      this.events.onCloseSettings();
      this.hideSettings();
    });

    this.settingsPanel.append(
      title,
      difficultyRow,
      soundToggle,
      musicToggle,
      particlesToggle,
      screenShakeToggle,
      timeDilationToggle,
      powerUpsToggle,
      crtToggle,
      targetScoreRow,
      btnBack
    );
    this.container.appendChild(this.settingsPanel);
  }

  private createHowToPlay(): void {
    this.howToPlayOverlay = document.createElement('div');
    this.howToPlayOverlay.className = 'menu-overlay hidden';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.style.fontSize = 'clamp(1.8rem, 5vw, 3rem)';
    title.textContent = 'HOW TO PLAY';

    const content = document.createElement('div');
    content.className = 'how-to-play-content';
    content.innerHTML = `
      <div class="how-to-section">
        <h3>Goal</h3>
        <p>Hit the ball past the AI opponent. First to reach the target score wins!</p>
      </div>
      <div class="how-to-section">
        <h3>Controls</h3>
        <p><strong>WASD</strong> or <strong>Arrow Keys</strong> to move your paddle up and down</p>
        <p><strong>Mouse</strong> or <strong>Touch</strong> to move your paddle directly</p>
        <p><strong>ESC</strong> or <strong>P</strong> to pause the game</p>
        <p><strong>Enter</strong> or <strong>Space</strong> to confirm selections</p>
      </div>
      <div class="how-to-section">
        <h3>Power-ups</h3>
        <div class="powerup-list">
          <div class="powerup-item"><span class="powerup-dot" style="background:#00ff88;box-shadow:0 0 8px #00ff88">E</span> <strong>Expand</strong> — Grow your paddle</div>
          <div class="powerup-item"><span class="powerup-dot" style="background:#ff4444;box-shadow:0 0 8px #ff4444">S</span> <strong>Shrink</strong> — Shrink opponent's paddle</div>
          <div class="powerup-item"><span class="powerup-dot" style="background:#ffee00;box-shadow:0 0 8px #ffee00">M</span> <strong>Multiball</strong> — Split into 3 balls</div>
          <div class="powerup-item"><span class="powerup-dot" style="background:#aa66ff;box-shadow:0 0 8px #aa66ff">G</span> <strong>Magnet</strong> — Ball sticks to your paddle</div>
          <div class="powerup-item"><span class="powerup-dot" style="background:#00ccff;box-shadow:0 0 8px #00ccff">T</span> <strong>Time Warp</strong> — Slow opponent's paddle</div>
        </div>
      </div>
    `;

    const btnBack = this.createButton('BACK', () => this.hideHowToPlay());

    this.howToPlayOverlay.append(title, content, btnBack);
    this.container.appendChild(this.howToPlayOverlay);
  }

  private createTutorial(): void {
    this.tutorialOverlay = document.createElement('div');
    this.tutorialOverlay.className = 'menu-overlay tutorial-overlay';
    this.tutorialOverlay.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.style.fontSize = 'clamp(1.8rem, 5vw, 3rem)';
    title.style.color = '#00f0ff';
    title.textContent = 'WELCOME!';

    const content = document.createElement('div');
    content.className = 'how-to-play-content';
    content.innerHTML = `
      <div class="how-to-section">
        <p style="font-size:1.1rem;text-align:center;margin-bottom:1rem">
          You are the <strong style="color:#00f0ff">CYAN</strong> paddle on the <strong>LEFT</strong>.
        </p>
        <p style="text-align:center;margin-bottom:1rem">
          Use <strong>WASD</strong>, <strong>Arrow Keys</strong>, or <strong>Mouse</strong> to move.
        </p>
        <p style="text-align:center">
          Collect glowing orbs for <strong>power-ups</strong>. First to target score wins!
        </p>
      </div>
    `;

    const btnGotIt = this.createButton("GOT IT!", () => {
      this.events.onDismissTutorial();
      this.hideTutorial();
    });

    this.tutorialOverlay.append(title, content, btnGotIt);
    this.container.appendChild(this.tutorialOverlay);
  }

  showHUD(): void {
    this.hud.style.display = 'flex';
  }

  hideHUD(): void {
    this.hud.style.display = 'none';
  }

  // Show/hide menu screens
  showMenu(): void {
    this.hideAllOverlays();
    this.mainMenu.classList.remove('hidden');
    this.hideHUD();
  }

  hideMenu(): void {
    this.mainMenu.classList.add('hidden');
  }

  showPause(): void {
    this.hideAllOverlays();
    this.pauseMenu.classList.remove('hidden');
    this.hideHUD();
  }

  hidePause(): void {
    this.pauseMenu.classList.add('hidden');
    this.showHUD();
  }

  showGameOver(winner: 'player' | 'ai', playerScore: number, aiScore: number): void {
    this.hideAllOverlays();
    if (winner === 'player' && aiScore === 0) {
      this.gameOverTitle.textContent = 'FLAWLESS VICTORY';
      this.gameOverTitle.classList.add('flawless-title');
      this.showFlawlessVictory();
    } else {
      this.gameOverTitle.textContent = winner === 'player' ? 'YOU WIN!' : 'AI WINS!';
      this.gameOverTitle.classList.remove('flawless-title');
    }
    this.gameOverScore.textContent = `Final Score: ${playerScore} — ${aiScore}`;
    this.gameOverMenu.classList.remove('hidden');
    this.hideHUD();
  }

  hideGameOver(): void {
    this.gameOverMenu.classList.add('hidden');
    this.gameOverTitle.classList.remove('flawless-title');
  }

  showCountdown(number: number): void {
    this.countdownOverlay.style.display = 'flex';
    this.countdownNumber.textContent = number <= 0 ? 'GO!' : String(number);

    // Restart CSS animation
    this.countdownNumber.style.animation = 'none';
    void this.countdownNumber.offsetHeight;
    this.countdownNumber.style.animation = '';
  }

  hideCountdown(): void {
    this.countdownOverlay.style.display = 'none';
  }

  showSettings(): void {
    this.settingsPanel.style.display = 'block';
    this.settingsPanel.classList.add('slide-in');
    this.settingsPanel.classList.remove('slide-out');
  }

  hideSettings(): void {
    this.settingsPanel.classList.add('slide-out');
    this.settingsPanel.classList.remove('slide-in');
    // Delay hiding to allow animation to complete
    setTimeout(() => {
      if (this.settingsPanel.classList.contains('slide-out')) {
        this.settingsPanel.style.display = 'none';
      }
    }, 300);
  }

  showHowToPlay(): void {
    this.hideAllOverlays();
    this.howToPlayOverlay.classList.remove('hidden');
  }

  hideHowToPlay(): void {
    this.howToPlayOverlay.classList.add('hidden');
    this.showMenu();
  }

  showTutorial(): void {
    this.tutorialOverlay.style.display = 'flex';
  }

  hideTutorial(): void {
    this.tutorialOverlay.style.display = 'none';
  }

  // Update HUD
  updateScore(playerScore: number, aiScore: number, scorer?: 'player' | 'ai'): void {
    this.scorePlayer.textContent = String(playerScore);
    this.scoreAI.textContent = String(aiScore);

    if (scorer) {
      const target = scorer === 'player' ? this.scorePlayer : this.scoreAI;
      target.classList.remove('score-flash');
      void target.offsetHeight; // Trigger reflow
      target.classList.add('score-flash');
    }
  }

  showFlawlessVictory(): void {
    const overlay = document.createElement('div');
    overlay.className = 'flawless-overlay';

    const text = document.createElement('div');
    text.className = 'flawless-text';
    text.textContent = 'FLAWLESS VICTORY';

    overlay.appendChild(text);
    this.container.appendChild(overlay);

    // Remove after animation
    setTimeout(() => {
      overlay.remove();
    }, 3000);
  }

  updateRally(count: number, visible: boolean): void {
    this.rallyCount.textContent = String(count);
    this.rallyCounter.classList.toggle('visible', visible && count > 2);
  }

  showPowerUpIndicator(target: 'player' | 'ai', type: string, duration: number): void {
    const indicator = target === 'player' ? this.playerPowerUp : this.aiPowerUp;
    indicator.textContent = type.toUpperCase();
    indicator.style.display = 'block';

    const existing = this.powerUpTimeouts.get(target);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      this.hidePowerUpIndicator(target);
    }, duration);

    this.powerUpTimeouts.set(target, timeout);
  }

  hidePowerUpIndicator(target: 'player' | 'ai'): void {
    const indicator = target === 'player' ? this.playerPowerUp : this.aiPowerUp;
    indicator.style.display = 'none';

    const existing = this.powerUpTimeouts.get(target);
    if (existing) {
      clearTimeout(existing);
      this.powerUpTimeouts.delete(target);
    }
  }

  // Update settings UI to match current settings
  syncSettings(newSettings: GameSettings): void {
    Object.assign(this.settings, newSettings);

    this.difficultySelect.value = this.settings.difficulty;
    this.targetScoreSelect.value = String(this.settings.targetScore);

    for (const [key, toggle] of this.toggleMap) {
      const value = this.settings[key];
      toggle.classList.toggle('active', typeof value === 'boolean' && value);
    }
  }

  // Clean up DOM elements
  destroy(): void {
    for (const { element, type, handler } of this.listeners) {
      element.removeEventListener(type, handler);
    }
    this.listeners = [];

    for (const timeout of this.powerUpTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.powerUpTimeouts.clear();

    this.hud.remove();
    this.mainMenu.remove();
    this.pauseMenu.remove();
    this.gameOverMenu.remove();
    this.countdownOverlay.remove();
    this.settingsPanel.remove();
    this.howToPlayOverlay.remove();
    this.tutorialOverlay.remove();
  }
}
