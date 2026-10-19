export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  aiming = false;
  locked = false;
  private pressed = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'ControlLeft' || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('mousedown', (e) => { if (e.button === 2) this.aiming = true; });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.aiming = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
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
    this.pressed.clear();
  }
}
