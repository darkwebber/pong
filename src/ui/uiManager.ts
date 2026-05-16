import type { Difficulty, GameSettings } from '../game/types.ts';
import { isTouchDevice } from '../game/input.ts';

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
  onScreenPause?: () => void;
  onPortraitButton?: (value: number) => void;
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
  private isPortrait = false;
  private gameplayActive = false;

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
  private howToPlayContent!: HTMLElement;
  private tutorialOverlay!: HTMLElement;
  private tutorialContent!: HTMLElement;
  private pauseButton!: HTMLElement;
  private portraitControls!: HTMLElement;

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
    this.createPauseButton();
    this.createPortraitControls();

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

    this.addListener(btn, 'click', () => {
      console.log('[UI] Button clicked:', text);
      onClick();
    });

    // Touch feedback for mobile: add/remove active class immediately
    // Note: No preventDefault() here - CSS touch-action: manipulation handles it
    // and preventDefault() can suppress click events on some mobile browsers
    if (isTouchDevice()) {
      this.addListener(btn, 'touchstart', () => {
        btn.classList.add('active');
      });
      this.addListener(btn, 'touchend', () => btn.classList.remove('active'));
      this.addListener(btn, 'touchcancel', () => btn.classList.remove('active'));
    }

    return btn;
  }

  private getControlHintText(): string {
    if (this.isPortrait) {
      return isTouchDevice()
        ? 'Use on-screen buttons or drag to move \u00B7 Tap \u23F8 to pause'
        : 'A/D or Arrow Left/Right to move \u00B7 ESC to pause';
    }
    return isTouchDevice()
      ? 'Touch and drag to move \u00A0\u00B7\u00A0 Tap \u23F8 to pause'
      : 'WASD / Arrow Keys to move \u00A0\u00B7\u00A0 ESC to pause';
  }

  private getTutorialMoveText(): string {
    if (this.isPortrait) {
      return isTouchDevice()
        ? 'Use the on-screen buttons or drag to move your paddle'
        : 'Use <strong>A/D</strong> or <strong>Arrow Left/Right</strong> to move your paddle left and right';
    }
    return isTouchDevice()
      ? 'Touch and drag to move your paddle'
      : 'Use <strong>WASD</strong> or <strong>Arrow Keys</strong> to move';
  }

  private getTutorialPositionText(): string {
    if (this.isPortrait) {
      return 'You are the <strong style="color:#00f0ff">CYAN</strong> paddle at the <strong>BOTTOM</strong>.';
    }
    return 'You are the <strong style="color:#00f0ff">CYAN</strong> paddle on the <strong>LEFT</strong>.';
  }

  setPortraitMode(portrait: boolean): void {
    this.isPortrait = portrait;
    this.updateHowToPlayText();
    this.updateTutorialText();
    this.updateControlHints();
    this.updatePortraitControlsVisibility();
  }

  private updatePortraitControlsVisibility(): void {
    const shouldShow = this.isPortrait && isTouchDevice() && this.gameplayActive;
    this.portraitControls.classList.toggle('visible', shouldShow);
    console.log('[UI] Portrait controls visibility:', shouldShow, '(portrait:', this.isPortrait, 'touch:', isTouchDevice(), 'gameplay:', this.gameplayActive, ')');
  }

  private showPortraitControls(): void {
    this.gameplayActive = true;
    this.updatePortraitControlsVisibility();
  }

  private hidePortraitControls(): void {
    this.gameplayActive = false;
    this.updatePortraitControlsVisibility();
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
    controlsHint.innerHTML = this.getControlHintText();

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
    pauseControls.innerHTML = this.getControlHintText();

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

    this.howToPlayContent = document.createElement('div');
    this.howToPlayContent.className = 'how-to-play-content';

    const btnBack = this.createButton('BACK', () => this.hideHowToPlay());

    this.howToPlayOverlay.append(title, this.howToPlayContent, btnBack);
    this.container.appendChild(this.howToPlayOverlay);

    // Initialize content
    this.updateHowToPlayText();
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

    this.tutorialContent = document.createElement('div');
    this.tutorialContent.className = 'how-to-play-content';

    const btnGotIt = this.createButton("GOT IT!", () => {
      this.events.onDismissTutorial();
      this.hideTutorial();
    });

    this.tutorialOverlay.append(title, this.tutorialContent, btnGotIt);
    this.container.appendChild(this.tutorialOverlay);

    // Initialize content
    this.updateTutorialText();
  }

  private createPauseButton(): void {
    this.pauseButton = document.createElement('button');
    this.pauseButton.className = 'pause-button';
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="4" width="4" height="16" rx="1"/>
        <rect x="14" y="4" width="4" height="16" rx="1"/>
      </svg>
    `;
    this.pauseButton.style.display = 'none';

    this.addListener(this.pauseButton, 'click', () => {
      console.log('[UI] Pause button clicked');
      this.events.onScreenPause?.();
    });

    // Touch feedback - no preventDefault to allow click events to fire
    if (isTouchDevice()) {
      this.addListener(this.pauseButton, 'touchstart', () => {
        this.pauseButton.classList.add('active');
      });
      this.addListener(this.pauseButton, 'touchend', () => {
        this.pauseButton.classList.remove('active');
      });
      this.addListener(this.pauseButton, 'touchcancel', () => {
        this.pauseButton.classList.remove('active');
      });
    }

    this.container.appendChild(this.pauseButton);
  }

  private createPortraitControls(): void {
    this.portraitControls = document.createElement('div');
    this.portraitControls.className = 'portrait-controls';

    const leftBtn = document.createElement('button');
    leftBtn.className = 'portrait-btn left-btn';
    leftBtn.setAttribute('aria-label', 'Move Left');
    leftBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
      </svg>
    `;

    const rightBtn = document.createElement('button');
    rightBtn.className = 'portrait-btn right-btn';
    rightBtn.setAttribute('aria-label', 'Move Right');
    rightBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
      </svg>
    `;

    this.portraitControls.append(leftBtn, rightBtn);
    this.container.appendChild(this.portraitControls);

    // Helper to handle button press
    const onPress = (btn: HTMLElement, value: number) => {
      console.log('[UI] Portrait button pressed:', value === -1 ? 'left' : 'right');
      btn.classList.add('pressed');
      this.events.onPortraitButton?.(value);
    };

    const onRelease = (btn: HTMLElement) => {
      btn.classList.remove('pressed');
      this.events.onPortraitButton?.(0);
    };

    // Touch events for left button
    this.addListener(leftBtn, 'touchstart', (e) => {
      e.preventDefault();
      onPress(leftBtn, -1);
    });
    this.addListener(leftBtn, 'touchend', () => onRelease(leftBtn));
    this.addListener(leftBtn, 'touchcancel', () => onRelease(leftBtn));

    // Touch events for right button
    this.addListener(rightBtn, 'touchstart', (e) => {
      e.preventDefault();
      onPress(rightBtn, 1);
    });
    this.addListener(rightBtn, 'touchend', () => onRelease(rightBtn));
    this.addListener(rightBtn, 'touchcancel', () => onRelease(rightBtn));

    console.log('[UI] Portrait controls created (side-mounted)');
  }

  private updateHowToPlayText(): void {
    if (!this.howToPlayContent) return;
    const controlsText = this.isPortrait
      ? `<p><strong>A/D</strong> or <strong>Arrow Left/Right</strong> to move your paddle left and right</p>
         <p><strong>On-screen buttons</strong> or <strong>Touch</strong> to move your paddle directly</p>
         <p><strong>ESC</strong> or <strong>P</strong> to pause the game</p>
         <p><strong>Enter</strong> or <strong>Space</strong> to confirm selections</p>`
      : `<p><strong>WASD</strong> or <strong>Arrow Keys</strong> to move your paddle up and down</p>
         <p><strong>Touch</strong> to move your paddle directly</p>
         <p><strong>ESC</strong> or <strong>P</strong> to pause the game</p>
         <p><strong>Enter</strong> or <strong>Space</strong> to confirm selections</p>`;

    this.howToPlayContent.innerHTML = `
      <div class="how-to-section">
        <h3>Goal</h3>
        <p>Hit the ball past the AI opponent. First to reach the target score wins!</p>
      </div>
      <div class="how-to-section">
        <h3>Controls</h3>
        ${controlsText}
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
  }

  private updateTutorialText(): void {
    if (!this.tutorialContent) return;
    this.tutorialContent.innerHTML = `
      <div class="how-to-section">
        <p style="font-size:1.1rem;text-align:center;margin-bottom:1rem">
          ${this.getTutorialPositionText()}
        </p>
        <p style="text-align:center;margin-bottom:1rem">
          ${this.getTutorialMoveText()}.
        </p>
        <p style="text-align:center">
          Collect glowing orbs for <strong>power-ups</strong>. First to target score wins!
        </p>
      </div>
    `;
  }

  private updateControlHints(): void {
    // Update main menu controls hint
    const mainMenuHint = this.mainMenu.querySelector('.menu-controls-hint');
    if (mainMenuHint) {
      mainMenuHint.innerHTML = this.getControlHintText();
    }
    // Update pause menu controls hint
    const pauseMenuHint = this.pauseMenu.querySelector('.pause-controls-hint');
    if (pauseMenuHint) {
      pauseMenuHint.innerHTML = this.getControlHintText();
    }
  }

  showHUD(): void {
    this.hud.style.display = 'flex';
    if (isTouchDevice()) {
      this.pauseButton.style.display = 'flex';
    }
    this.showPortraitControls();
  }

  hideHUD(): void {
    this.hud.style.display = 'none';
    this.pauseButton.style.display = 'none';
    this.hidePortraitControls();
  }

  // Show/hide menu screens
  showMenu(): void {
    this.hideAllOverlays();
    this.mainMenu.classList.remove('hidden');
    this.hideHUD();
    console.log('[UI] Show menu - portrait controls hidden');
  }

  hideMenu(): void {
    this.mainMenu.classList.add('hidden');
  }

  showPause(): void {
    this.hideAllOverlays();
    this.pauseMenu.classList.remove('hidden');
    this.hideHUD();
    console.log('[UI] Show pause - portrait controls hidden');
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
    this.hidePortraitControls();
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
    this.hidePortraitControls();
    console.log('[UI] Show settings - portrait controls hidden');
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
    this.hidePortraitControls();
    console.log('[UI] Show how to play - portrait controls hidden');
  }

  hideHowToPlay(): void {
    this.howToPlayOverlay.classList.add('hidden');
    this.showMenu();
  }

  showTutorial(): void {
    this.tutorialOverlay.style.display = 'flex';
    this.hidePortraitControls();
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
    this.pauseButton.remove();
    this.portraitControls.remove();
  }
}
