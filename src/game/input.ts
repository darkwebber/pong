export type InputMode = 'none' | 'keyboard' | 'touch' | 'mouse';

export interface InputResult {
  mode: InputMode;
  value: number;
}

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

/**
 * Manages player input from keyboard, mouse, and touch.
 * Keyboard takes priority when movement keys are held.
 * Mouse and touch are available on all screen sizes.
 */
export class InputManager {
  private canvas: HTMLCanvasElement;

  private _keysDown = new Set<string>();
  private _keysPressedThisFrame = new Set<string>();

  private _mouseY: number | null = null;
  private _mouseOver = false;

  private _touchY: number | null = null;
  private _touchActive = false;

  private _framePausePressed = false;
  private _frameActionPressed = false;

  private _lastMovementKey: string | null = null;
  private _konamiIndex = 0;
  private _konamiCompleted = false;

  private _boundOnMouseMove: ((e: MouseEvent) => void) | null = null;
  private _boundOnMouseEnter: ((e: MouseEvent) => void) | null = null;
  private _boundOnMouseLeave: (() => void) | null = null;
  private _boundOnTouchStart: (e: TouchEvent) => void;
  private _boundOnTouchMove: (e: TouchEvent) => void;
  private _boundOnTouchEnd: (e: TouchEvent) => void;
  private _boundOnKeyDown: (e: KeyboardEvent) => void;
  private _boundOnKeyUp: (e: KeyboardEvent) => void;
  private _boundOnBlur: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this._boundOnTouchStart = this._onTouchStart.bind(this);
    this._boundOnTouchMove = this._onTouchMove.bind(this);
    this._boundOnTouchEnd = this._onTouchEnd.bind(this);
    this._boundOnKeyDown = this._onKeyDown.bind(this);
    this._boundOnKeyUp = this._onKeyUp.bind(this);
    this._boundOnBlur = () => {
      this._keysDown.clear();
      this._lastMovementKey = null;
    };

    // Register mouse events on all screen sizes
    this._boundOnMouseMove = this._onMouseMove.bind(this);
    this._boundOnMouseEnter = this._onMouseEnter.bind(this);
    this._boundOnMouseLeave = this._onMouseLeave.bind(this);

    canvas.addEventListener('mousemove', this._boundOnMouseMove);
    canvas.addEventListener('mouseenter', this._boundOnMouseEnter);
    canvas.addEventListener('mouseleave', this._boundOnMouseLeave);

    canvas.addEventListener('touchstart', this._boundOnTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._boundOnTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._boundOnTouchEnd);
    canvas.addEventListener('touchcancel', this._boundOnTouchEnd);
    window.addEventListener('keydown', this._boundOnKeyDown);
    window.addEventListener('keyup', this._boundOnKeyUp);
    window.addEventListener('blur', this._boundOnBlur);
  }

  private _getNormalizedY(clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.height === 0) return 0.5;
    const y = clientY - rect.top;
    return Math.max(0, Math.min(1, y / rect.height));
  }

  private _onMouseMove(e: MouseEvent): void {
    this._mouseOver = true;
    this._mouseY = this._getNormalizedY(e.clientY);
  }

  private _onMouseEnter(e: MouseEvent): void {
    this._mouseOver = true;
    this._mouseY = this._getNormalizedY(e.clientY);
  }

  private _onMouseLeave(): void {
    this._mouseOver = false;
    this._mouseY = null;
  }

  private _onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this._touchActive = true;
    if (e.touches.length > 0) {
      this._touchY = this._getNormalizedY(e.touches[0].clientY);
    }
  }

  private _onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) {
      this._touchY = this._getNormalizedY(e.touches[0].clientY);
    }
  }

  private _onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 0) {
      this._touchActive = false;
      this._touchY = null;
    } else {
      this._touchY = this._getNormalizedY(e.touches[0].clientY);
    }
  }

  private _isMovementKey(key: string): boolean {
    return (
      key === 'w' ||
      key === 'W' ||
      key === 'ArrowUp' ||
      key === 's' ||
      key === 'S' ||
      key === 'ArrowDown'
    );
  }

  private _isPauseKey(key: string): boolean {
    return key === 'Escape' || key === 'p' || key === 'P';
  }

  private _isActionKey(key: string): boolean {
    return key === 'Enter' || key === ' ';
  }

  private _checkKonami(key: string): boolean {
    if (this._konamiCompleted) return false;

    if (key === KONAMI_SEQUENCE[this._konamiIndex]) {
      this._konamiIndex++;
      if (this._konamiIndex >= KONAMI_SEQUENCE.length) {
        this._konamiCompleted = true;
        return true;
      }
    } else {
      // Reset if wrong key, but check if this key starts the sequence
      if (key === KONAMI_SEQUENCE[0]) {
        this._konamiIndex = 1;
      } else {
        this._konamiIndex = 0;
      }
    }
    return false;
  }

  private _onKeyDown(e: KeyboardEvent): void {
    const key = e.key;

    if (this._isMovementKey(key) || this._isPauseKey(key) || this._isActionKey(key)) {
      e.preventDefault();
    }

    // Track last movement key for conflict resolution
    if (this._isMovementKey(key)) {
      this._lastMovementKey = key;
    }

    // Check konami code
    if (this._checkKonami(key)) {
      // Konami completed - the engine will check via wasKonamiPressed()
    }

    if (!this._keysDown.has(key)) {
      this._keysDown.add(key);
      this._keysPressedThisFrame.add(key);
    }
  }

  private _onKeyUp(e: KeyboardEvent): void {
    this._keysDown.delete(e.key);
  }

  /**
   * Returns player input state.
   * Keyboard ALWAYS wins when movement keys are held.
   * Touch takes priority over mouse when both are active.
   */
  getPlayerInput(): InputResult {
    const upKeys = ['w', 'W', 'ArrowUp'];
    const downKeys = ['s', 'S', 'ArrowDown'];

    const up = upKeys.some(k => this._keysDown.has(k));
    const down = downKeys.some(k => this._keysDown.has(k));

    // KEYBOARD WINS: always process keyboard if keys are held
    if (up || down) {
      // Both held: respect most recently pressed key
      if (up && down) {
        const lastIsUp = upKeys.includes(this._lastMovementKey ?? '');
        return { mode: 'keyboard', value: lastIsUp ? -1 : 1 };
      }
      return { mode: 'keyboard', value: up ? -1 : 1 };
    }

    // Touch input (direct control — all screens)
    if (this._touchActive && this._touchY !== null) {
      return { mode: 'touch', value: this._touchY };
    }

    // Mouse input (smooth control — all screens)
    if (this._mouseOver && this._mouseY !== null) {
      return { mode: 'mouse', value: this._mouseY };
    }

    return { mode: 'none', value: 0 };
  }

  wasPausePressed(): boolean {
    return this._framePausePressed;
  }

  wasActionPressed(): boolean {
    return this._frameActionPressed;
  }

  wasKonamiPressed(): boolean {
    if (this._konamiCompleted) {
      this._konamiCompleted = false; // Reset after reading
      return true;
    }
    return false;
  }

  update(): void {
    this._framePausePressed =
      this._keysPressedThisFrame.has('Escape') ||
      this._keysPressedThisFrame.has('p') ||
      this._keysPressedThisFrame.has('P');

    this._frameActionPressed =
      this._keysPressedThisFrame.has('Enter') ||
      this._keysPressedThisFrame.has(' ');

    this._keysPressedThisFrame.clear();
  }

  destroy(): void {
    if (this._boundOnMouseMove) {
      this.canvas.removeEventListener('mousemove', this._boundOnMouseMove);
      this.canvas.removeEventListener('mouseenter', this._boundOnMouseEnter!);
      this.canvas.removeEventListener('mouseleave', this._boundOnMouseLeave!);
    }
    this.canvas.removeEventListener('touchstart', this._boundOnTouchStart);
    this.canvas.removeEventListener('touchmove', this._boundOnTouchMove);
    this.canvas.removeEventListener('touchend', this._boundOnTouchEnd);
    this.canvas.removeEventListener('touchcancel', this._boundOnTouchEnd);
    window.removeEventListener('keydown', this._boundOnKeyDown);
    window.removeEventListener('keyup', this._boundOnKeyUp);
    window.removeEventListener('blur', this._boundOnBlur);
  }
}

export default InputManager;
