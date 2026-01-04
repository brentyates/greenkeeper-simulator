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
  onEmployeePanel?: () => void;
  onResearchPanel?: () => void;
  onTeeSheetPanel?: () => void;
  onMarketingPanel?: () => void;
  onEquipmentStore?: () => void;
  onAmenityPanel?: () => void;
  onWalkOnQueuePanel?: () => void;
  onDragStart?: (screenX: number, screenY: number) => void;
  onDrag?: (screenX: number, screenY: number) => void;
  onDragEnd?: () => void;
  onPinchZoom?: (delta: number) => void;
  onSwipe?: (direction: Direction) => void;
  isInputBlocked?: () => boolean;
}

export class InputManager {
  private scene: Scene;
  private callbacks: InputCallbacks = {};
  private keysDown: Set<string> = new Set();
  private enabled: boolean = true;
  private isDragging: boolean = false;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;

  // Touch input support
  private touchStartPos: { x: number; y: number } | null = null;
  private touchStartTime: number = 0;
  private initialPinchDistance: number = 0;
  private lastPinchDistance: number = 0;
  private readonly SWIPE_THRESHOLD = 50; // pixels
  private readonly TAP_TIME_THRESHOLD = 300; // ms

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupKeyboardInput();
    this.setupMouseInput();
    this.setupTouchInput();
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
    } else if (key === "h") {
      this.callbacks.onEmployeePanel?.();
    } else if (key === "y") {
      this.callbacks.onResearchPanel?.();
    } else if (key === "g") {
      this.callbacks.onTeeSheetPanel?.();
    } else if (key === "k") {
      this.callbacks.onMarketingPanel?.();
    } else if (key === "b") {
      this.callbacks.onEquipmentStore?.();
    } else if (key === "u") {
      this.callbacks.onAmenityPanel?.();
    } else if (key === "o") {
      this.callbacks.onWalkOnQueuePanel?.();
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
      if (this.callbacks.isInputBlocked?.()) return;
      event.preventDefault();
      if (event.deltaY > 0) {
        this.callbacks.onZoomOut?.();
      } else if (event.deltaY < 0) {
        this.callbacks.onZoomIn?.();
      }
    };
    this.scene.getEngine().getRenderingCanvas()?.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  private setupTouchInput(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    // Touch start
    canvas.addEventListener('touchstart', (event: TouchEvent) => {
      if (!this.enabled) return;

      if (event.touches.length === 1) {
        // Single touch - could be tap or swipe
        const touch = event.touches[0];
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchStartTime = Date.now();
        this.callbacks.onDragStart?.(touch.clientX, touch.clientY);
      } else if (event.touches.length === 2) {
        // Two-finger pinch
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        this.lastPinchDistance = this.initialPinchDistance;
        this.touchStartPos = null; // Cancel swipe detection
      }
    }, { passive: true });

    // Touch move
    canvas.addEventListener('touchmove', (event: TouchEvent) => {
      if (!this.enabled) return;

      if (event.touches.length === 1 && this.touchStartPos) {
        // Single touch drag
        const touch = event.touches[0];
        this.callbacks.onDrag?.(touch.clientX, touch.clientY);
        this.callbacks.onMouseMove?.(touch.clientX, touch.clientY);
      } else if (event.touches.length === 2) {
        // Pinch zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (this.lastPinchDistance > 0) {
          const delta = distance - this.lastPinchDistance;
          // Normalize delta for zoom callback
          const normalizedDelta = delta / 10;
          this.callbacks.onPinchZoom?.(normalizedDelta);

          // Also call zoom callbacks
          if (delta > 0) {
            this.callbacks.onZoomIn?.();
          } else if (delta < 0) {
            this.callbacks.onZoomOut?.();
          }
        }

        this.lastPinchDistance = distance;
      }
    }, { passive: true });

    // Touch end
    canvas.addEventListener('touchend', (event: TouchEvent) => {
      if (!this.enabled) return;

      if (event.changedTouches.length === 1 && this.touchStartPos) {
        const touch = event.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;
        const timeDiff = Date.now() - this.touchStartTime;

        const dx = endX - this.touchStartPos.x;
        const dy = endY - this.touchStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if it was a tap (short time, minimal movement)
        if (timeDiff < this.TAP_TIME_THRESHOLD && distance < 10) {
          this.callbacks.onClick?.(endX, endY);
        }
        // Check if it was a swipe (significant movement)
        else if (distance > this.SWIPE_THRESHOLD) {
          const direction = this.getSwipeDirection(dx, dy);
          if (direction) {
            this.callbacks.onSwipe?.(direction);
            // Also trigger move callback for swipe-to-move
            this.callbacks.onMove?.(direction);
          }
        }

        this.callbacks.onDragEnd?.();
      }

      // Reset touch state
      if (event.touches.length === 0) {
        this.touchStartPos = null;
        this.initialPinchDistance = 0;
        this.lastPinchDistance = 0;
      }
    }, { passive: true });

    // Touch cancel
    canvas.addEventListener('touchcancel', () => {
      this.touchStartPos = null;
      this.initialPinchDistance = 0;
      this.lastPinchDistance = 0;
      this.callbacks.onDragEnd?.();
    }, { passive: true });
  }

  /**
   * Determine swipe direction from touch delta
   */
  private getSwipeDirection(dx: number, dy: number): Direction | null {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Determine primary direction
    if (absDx > absDy) {
      // Horizontal swipe
      return dx > 0 ? 'right' : 'left';
    } else if (absDy > 0) {
      // Vertical swipe
      return dy > 0 ? 'down' : 'up';
    }

    return null;
  }

  public dispose(): void {
    this.keysDown.clear();
    this.callbacks = {};
    if (this.wheelHandler) {
      this.scene.getEngine().getRenderingCanvas()?.removeEventListener("wheel", this.wheelHandler);
      this.wheelHandler = null;
    }
    // Note: Touch event listeners will be cleaned up when canvas is destroyed
  }
}
