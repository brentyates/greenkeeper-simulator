import { Scene } from "@babylonjs/core/scene";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";

import { Direction } from "../../core/movement";

export type { Direction };
export type EquipmentSlot = 1 | 2 | 3;

export interface InputCallbacks {
  onMove?: (direction: Direction) => void;
  onEquipmentSelect?: (slot: EquipmentSlot) => void;
  onEquipmentToggle?: () => void;
  onRefill?: () => void;
  onOverlayCycle?: () => void;
  onPause?: () => void;
  onMute?: () => void;
  onTimeSpeedUp?: () => void;
  onTimeSlowDown?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onDebugReload?: () => void;
  onDebugExport?: () => void;
  onDebugScreenshot?: () => void;
  onClick?: (screenX: number, screenY: number) => void;
  onEditorToggle?: () => void;
  onEditorToolSelect?: (tool: number) => void;
  onEditorBrushSelect?: (brush: string) => void;
  onEditorBrushSizeChange?: (delta: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onMouseMove?: (screenX: number, screenY: number) => void;
  onDragStart?: (screenX: number, screenY: number) => void;
  onDrag?: (screenX: number, screenY: number) => void;
  onDragEnd?: () => void;
}

export class InputManager {
  private scene: Scene;
  private callbacks: InputCallbacks = {};
  private keysDown: Set<string> = new Set();
  private enabled: boolean = true;
  private isDragging: boolean = false;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;

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
        this.handleKeyDownWithModifiers(kbInfo.event as KeyboardEvent);
        if (this.keysDown.has(key)) return;
        this.keysDown.add(key);
        this.handleKeyDown(kbInfo.event);
      } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
        this.keysDown.delete(key);
      }
    });
  }

  private handleKeyDown(event: {
    key: string;
    preventDefault?: () => void;
  }): void {
    const key = event.key.toLowerCase();

    if (key === "arrowup" || key === "w") {
      this.callbacks.onMove?.("up");
    } else if (key === "arrowdown" || key === "s") {
      this.callbacks.onMove?.("down");
    } else if (key === "arrowleft" || key === "a") {
      this.callbacks.onMove?.("left");
    } else if (key === "arrowright" || key === "d") {
      this.callbacks.onMove?.("right");
    } else if (key === "1") {
      this.callbacks.onEquipmentSelect?.(1);
    } else if (key === "2") {
      this.callbacks.onEquipmentSelect?.(2);
    } else if (key === "3") {
      this.callbacks.onEquipmentSelect?.(3);
    } else if (key === " ") {
      event.preventDefault?.();
      this.callbacks.onEquipmentToggle?.();
    } else if (key === "e") {
      this.callbacks.onRefill?.();
    } else if (key === "tab") {
      event.preventDefault?.();
      this.callbacks.onOverlayCycle?.();
    } else if (key === "p" || key === "escape") {
      this.callbacks.onPause?.();
    } else if (key === "m") {
      this.callbacks.onMute?.();
    } else if (key === "+" || key === "=") {
      this.callbacks.onTimeSpeedUp?.();
    } else if (key === "-" || key === "_") {
      this.callbacks.onTimeSlowDown?.();
    } else if (key === "[") {
      this.callbacks.onZoomOut?.();
    } else if (key === "]") {
      this.callbacks.onZoomIn?.();
    } else if (key === "f5") {
      event.preventDefault?.();
      this.callbacks.onDebugReload?.();
    } else if (key === "f6") {
      event.preventDefault?.();
      this.callbacks.onDebugExport?.();
    } else if (key === "f12") {
      this.callbacks.onDebugScreenshot?.();
    } else if (key === "t") {
      this.callbacks.onEditorToggle?.();
    } else if (key === "q") {
      this.callbacks.onEditorBrushSelect?.("terrain_fairway");
    } else if (key === "r") {
      this.callbacks.onEditorBrushSelect?.("terrain_bunker");
    } else if (key === "f") {
      this.callbacks.onEditorBrushSelect?.("terrain_water");
    } else if (key === ",") {
      this.callbacks.onEditorBrushSizeChange?.(-1);
    } else if (key === ".") {
      this.callbacks.onEditorBrushSizeChange?.(1);
    }
  }

  private handleKeyDownWithModifiers(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (event.ctrlKey || event.metaKey) {
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          this.callbacks.onRedo?.();
        } else {
          this.callbacks.onUndo?.();
        }
      } else if (key === "y") {
        event.preventDefault();
        this.callbacks.onRedo?.();
      }
    }
  }

  private setupMouseInput(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.enabled) return;

      const x = pointerInfo.event.clientX;
      const y = pointerInfo.event.clientY;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        this.isDragging = true;
        this.callbacks.onClick?.(x, y);
        this.callbacks.onDragStart?.(x, y);
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        if (this.isDragging) {
          this.isDragging = false;
          this.callbacks.onDragEnd?.();
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        this.callbacks.onMouseMove?.(x, y);
        if (this.isDragging) {
          this.callbacks.onDrag?.(x, y);
        }
      }
    });

    this.wheelHandler = (event: WheelEvent) => {
      if (!this.enabled) return;
      event.preventDefault();
      if (event.deltaY > 0) {
        this.callbacks.onZoomOut?.();
      } else if (event.deltaY < 0) {
        this.callbacks.onZoomIn?.();
      }
    };
    this.scene.getEngine().getRenderingCanvas()?.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  public dispose(): void {
    this.keysDown.clear();
    this.callbacks = {};
    if (this.wheelHandler) {
      this.scene.getEngine().getRenderingCanvas()?.removeEventListener("wheel", this.wheelHandler);
      this.wheelHandler = null;
    }
  }
}
