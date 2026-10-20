export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  aiming = false;
  firing = false;
  /** Wheel notches this frame: negative = scroll up. */
  wheel = 0;
  locked = false;
  private pressed = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'ControlLeft' || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.firing = this.aiming = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('mousedown', (e) => {
      if (e.button === 2) this.aiming = true;
      if (e.button === 0 && this.locked) {
        this.firing = true;
        this.pressed.add('Mouse0');
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2) this.aiming = false;
      if (e.button === 0) this.firing = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.canvas; });
  }

  lock(): void {
    this.canvas.requestPointerLock();
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key went down. */
  hit(code: string): boolean {
    return this.pressed.has(code);
  }

  endFrame(): void {
    this.mouseDX = this.mouseDY = 0;
    this.wheel = 0;
    this.pressed.clear();
  }
}
