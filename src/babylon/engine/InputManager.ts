import { Scene } from '@babylonjs/core/scene';
import { KeyboardEventTypes } from '@babylonjs/core/Events/keyboardEvents';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type EquipmentSlot = 1 | 2 | 3;

export interface InputCallbacks {
  onMove?: (direction: Direction) => void;
  onEquipmentSelect?: (slot: EquipmentSlot) => void;
  onEquipmentToggle?: () => void;
  onRefill?: () => void;
  onOverlayCycle?: () => void;
  onPause?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onDebugReload?: () => void;
  onDebugExport?: () => void;
  onDebugScreenshot?: () => void;
  onClick?: (screenX: number, screenY: number) => void;
}

export class InputManager {
  private scene: Scene;
  private callbacks: InputCallbacks = {};
  private keysDown: Set<string> = new Set();
  private enabled: boolean = true;

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupKeyboardInput();
    this.setupMouseInput();
  }

  public setCallbacks(callbacks: InputCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isKeyDown(key: string): boolean {
    return this.keysDown.has(key.toLowerCase());
  }

  private setupKeyboardInput(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (!this.enabled) return;

      const key = kbInfo.event.key.toLowerCase();

      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        if (this.keysDown.has(key)) return;
        this.keysDown.add(key);
        this.handleKeyDown(kbInfo.event);
      } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
        this.keysDown.delete(key);
      }
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (key === 'arrowup' || key === 'w') {
      this.callbacks.onMove?.('up');
    } else if (key === 'arrowdown' || key === 's') {
      this.callbacks.onMove?.('down');
    } else if (key === 'arrowleft' || key === 'a') {
      this.callbacks.onMove?.('left');
    } else if (key === 'arrowright' || key === 'd') {
      this.callbacks.onMove?.('right');
    }

    else if (key === '1') {
      this.callbacks.onEquipmentSelect?.(1);
    } else if (key === '2') {
      this.callbacks.onEquipmentSelect?.(2);
    } else if (key === '3') {
      this.callbacks.onEquipmentSelect?.(3);
    }

    else if (key === ' ') {
      event.preventDefault();
      this.callbacks.onEquipmentToggle?.();
    } else if (key === 'e') {
      this.callbacks.onRefill?.();
    } else if (key === 'tab') {
      event.preventDefault();
      this.callbacks.onOverlayCycle?.();
    } else if (key === 'p' || key === 'escape') {
      this.callbacks.onPause?.();
    }

    else if (key === '[') {
      this.callbacks.onZoomOut?.();
    } else if (key === ']') {
      this.callbacks.onZoomIn?.();
    }

    else if (key === 'f5') {
      event.preventDefault();
      this.callbacks.onDebugReload?.();
    } else if (key === 'f6') {
      event.preventDefault();
      this.callbacks.onDebugExport?.();
    } else if (key === 'f12') {
      this.callbacks.onDebugScreenshot?.();
    }
  }

  private setupMouseInput(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.enabled) return;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pickResult = pointerInfo.pickInfo;
        if (pickResult && pickResult.hit) {
          this.callbacks.onClick?.(
            pointerInfo.event.clientX,
            pointerInfo.event.clientY
          );
        }
      }
    });
  }

  public dispose(): void {
    this.keysDown.clear();
    this.callbacks = {};
  }
}
