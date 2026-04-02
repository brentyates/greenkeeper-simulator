import { Scene } from "@babylonjs/core/scene";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";

import { Direction } from "../../core/movement";

export type { Direction };

export type AxisConstraint = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';

export interface InputCallbacks {
  onOverlayCycle?: () => void;
  onPause?: () => void;
  onMute?: () => void;
  onTimeSpeedUp?: () => void;
  onTimeSlowDown?: () => void;
  onCameraRotate?: (delta: number) => void;
  onCameraTilt?: (delta: number) => void;
  onCameraReset?: () => void;
  onZoom?: (delta: number) => void;
  onDebugReload?: () => void;
  onDebugExport?: () => void;
  onDebugScreenshot?: () => void;
  onClick?: (screenX: number, screenY: number, shiftKey?: boolean) => void;
  onEditorToggle?: () => void;
  onEditorBrushSelect?: (brush: string) => void;
  onEditorBrushSizeChange?: (delta: number) => void;
  onEditorBrushStrengthChange?: (delta: number) => void;
  onMouseMove?: (screenX: number, screenY: number) => void;
  onEmployeePanel?: () => void;
  onResearchPanel?: () => void;
  onTeeSheetPanel?: () => void;
  onIrrigationPanel?: () => void;
  onHoleBuilderPanel?: () => void;
  onAssetBuilderPanel?: () => void;
  onEquipmentStore?: () => void;
  onAmenityPanel?: () => void;
  onCourseLayoutPanel?: () => void;
  onDragStart?: (screenX: number, screenY: number, shiftKey?: boolean) => void;
  onDrag?: (screenX: number, screenY: number) => void;
  onDragEnd?: () => void;
  onPinchZoom?: (delta: number) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onAxisConstraint?: (axis: AxisConstraint) => void;
  onEdgeModeToggle?: () => void;
  onDeleteVertex?: () => void;
  onSubdivideEdge?: () => void;
  onFlipEdge?: () => void;
  onFaceModeToggle?: () => void;
  isInputBlocked?: (x: number, y: number) => boolean;
  isEditorActive?: () => boolean;
  isEdgeModeActive?: () => boolean;
  isFaceModeActive?: () => boolean;
  onSelectModeToggle?: () => void;
  onBrushModeToggle?: () => void;
}

export class InputManager {
  private scene: Scene;
  private callbacks: InputCallbacks = {};
  private keysDown: Set<string> = new Set();
  private enabled: boolean = true;
  private isDragging: boolean = false;
  private dragStartPos: { x: number; y: number } | null = null;
  private dragMoved: boolean = false;
  private dragShiftKey: boolean = false;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private readonly DRAG_THRESHOLD = 6;

  // Touch input support
  private touchStartPos: { x: number; y: number } | null = null;
  private touchStartTime: number = 0;
  private initialPinchDistance: number = 0;
  private lastPinchDistance: number = 0;
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

    if (key === "arrowdown" || key === "s") {
      if (key === "s" && this.callbacks.isEditorActive?.()) {
        this.callbacks.onSelectModeToggle?.();
      }
    } else if (key === "e") {
      if (this.callbacks.isEditorActive?.()) {
        this.callbacks.onEdgeModeToggle?.();
      }
    } else if (key === "delete" || key === "backspace") {
      if (this.callbacks.isEditorActive?.()) {
        event.preventDefault?.();
        this.callbacks.onDeleteVertex?.();
      }
    } else if (key === "enter") {
      if (this.callbacks.isEdgeModeActive?.()) {
        event.preventDefault?.();
        this.callbacks.onSubdivideEdge?.();
      }
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
      if (this.callbacks.isEditorActive?.()) {
        this.callbacks.onEditorBrushSizeChange?.(-1);
      } else {
        this.callbacks.onZoom?.(50);
      }
    } else if (key === "]") {
      if (this.callbacks.isEditorActive?.()) {
        this.callbacks.onEditorBrushSizeChange?.(1);
      } else {
        this.callbacks.onZoom?.(-50);
      }
    } else if (key === "pageup") {
      this.callbacks.onZoom?.(80);
    } else if (key === "pagedown") {
      this.callbacks.onZoom?.(-80);
    } else if (key === "home") {
      event.preventDefault?.();
      this.callbacks.onCameraRotate?.(-Math.PI / 4);
    } else if (key === "end") {
      event.preventDefault?.();
      this.callbacks.onCameraRotate?.(Math.PI / 4);
    } else if (key === "insert") {
      event.preventDefault?.();
      this.callbacks.onCameraTilt?.(-Math.PI / 18);
    } else if (key === "{") {
      if (this.callbacks.isEditorActive?.()) {
        this.callbacks.onEditorBrushStrengthChange?.(-0.1);
      }
    } else if (key === "delete" && !this.callbacks.isEditorActive?.()) {
      event.preventDefault?.();
      this.callbacks.onCameraTilt?.(Math.PI / 18);
    } else if (key === "\\") {
      event.preventDefault?.();
      this.callbacks.onCameraReset?.();
    } else if (key === "}") {
      if (this.callbacks.isEditorActive?.()) {
        this.callbacks.onEditorBrushStrengthChange?.(0.1);
      }
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
      if (this.callbacks.isEditorActive?.()) {
        const shift = (event as KeyboardEvent).shiftKey;
        if (shift && this.callbacks.isEdgeModeActive?.()) {
            this.callbacks.onFlipEdge?.();
        } else {
            this.callbacks.onFaceModeToggle?.();
        }
      } else {
        this.callbacks.onEditorBrushSelect?.("terrain_water");
      }
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
    } else if (key === "i") {
      if (!this.callbacks.isEditorActive?.()) {
        this.callbacks.onIrrigationPanel?.();
      }
    } else if (key === "j") {
      if (!this.callbacks.isEditorActive?.()) {
        this.callbacks.onHoleBuilderPanel?.();
      }
    } else if (key === "k") {
      if (!this.callbacks.isEditorActive?.()) {
        this.callbacks.onAssetBuilderPanel?.();
      }
    } else if (key === "b") {
      if (this.callbacks.isEditorActive?.()) {
        this.callbacks.onBrushModeToggle?.();
      } else {
        this.callbacks.onEquipmentStore?.();
      }
    } else if (key === "u") {
      this.callbacks.onAmenityPanel?.();
    } else if (key === "l") {
      this.callbacks.onCourseLayoutPanel?.();
    } else if (key === "x" && this.callbacks.isEditorActive?.()) {
      this.callbacks.onAxisConstraint?.('x');
    } else if (key === "c" && this.callbacks.isEditorActive?.()) {
      this.callbacks.onAxisConstraint?.('y');
    } else if (key === "z" && this.callbacks.isEditorActive?.() && !(event as KeyboardEvent).ctrlKey && !(event as KeyboardEvent).metaKey) {
      this.callbacks.onAxisConstraint?.('z');
    } else if (key === "v" && this.callbacks.isEditorActive?.()) {
      this.callbacks.onAxisConstraint?.('xz');
    }
  }

  private setupMouseInput(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.enabled) return;

      const x = pointerInfo.event.clientX;
      const y = pointerInfo.event.clientY;
      const inputBlocked = this.callbacks.isInputBlocked?.(x, y) ?? false;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (inputBlocked) return;
        this.isDragging = true;
        this.dragStartPos = { x, y };
        this.dragMoved = false;
        this.dragShiftKey = (pointerInfo.event as PointerEvent).shiftKey;
        this.callbacks.onDragStart?.(x, y, this.dragShiftKey);
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        if (this.isDragging) {
          if (!inputBlocked && !this.dragMoved) {
            this.callbacks.onClick?.(x, y, this.dragShiftKey);
          }
          this.isDragging = false;
          this.dragStartPos = null;
          this.dragMoved = false;
          this.callbacks.onDragEnd?.();
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        if (inputBlocked) return;
        this.callbacks.onMouseMove?.(x, y);
        if (this.isDragging) {
          if (this.dragStartPos && !this.dragMoved) {
            const dx = x - this.dragStartPos.x;
            const dy = y - this.dragStartPos.y;
            if (this.getDistance(dx, dy) >= this.DRAG_THRESHOLD) {
              this.dragMoved = true;
            }
          }
          if (this.dragMoved) {
            this.callbacks.onDrag?.(x, y);
          }
        }
      }
    });

    this.wheelHandler = (event: WheelEvent) => {
      if (!this.enabled) return;
      if (this.callbacks.isInputBlocked?.(event.clientX, event.clientY)) return;
      event.preventDefault();
      if (event.deltaY !== 0) {
        this.callbacks.onZoom?.(event.deltaY);
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
      event.preventDefault();

      if (event.touches.length === 1) {
        // Single touch - could be tap or swipe
        const touch = event.touches[0];
        if (this.callbacks.isInputBlocked?.(touch.clientX, touch.clientY)) {
          this.touchStartPos = null;
          return;
        }
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchStartTime = Date.now();
        this.callbacks.onDragStart?.(touch.clientX, touch.clientY, false);
      } else if (event.touches.length === 2) {
        // Two-finger pinch
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        if (
          this.callbacks.isInputBlocked?.(touch1.clientX, touch1.clientY) ||
          this.callbacks.isInputBlocked?.(touch2.clientX, touch2.clientY)
        ) {
          this.touchStartPos = null;
          return;
        }
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        this.initialPinchDistance = this.getDistance(dx, dy);
        this.lastPinchDistance = this.initialPinchDistance;
        this.touchStartPos = null; // Cancel swipe detection
      }
    }, { passive: false });

    // Touch move
    canvas.addEventListener('touchmove', (event: TouchEvent) => {
      if (!this.enabled) return;
      event.preventDefault();

      if (event.touches.length === 1 && this.touchStartPos) {
        // Single touch drag
        const touch = event.touches[0];
        if (this.callbacks.isInputBlocked?.(touch.clientX, touch.clientY)) return;
        this.callbacks.onDrag?.(touch.clientX, touch.clientY);
        this.callbacks.onMouseMove?.(touch.clientX, touch.clientY);
      } else if (event.touches.length === 2) {
        // Pinch zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        if (
          this.callbacks.isInputBlocked?.(touch1.clientX, touch1.clientY) ||
          this.callbacks.isInputBlocked?.(touch2.clientX, touch2.clientY)
        ) {
          return;
        }
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        const distance = this.getDistance(dx, dy);

        if (this.lastPinchDistance > 0) {
          const delta = distance - this.lastPinchDistance;
          const normalizedDelta = delta / 10;
          this.callbacks.onPinchZoom?.(normalizedDelta);
          if (delta !== 0) {
            this.callbacks.onZoom?.(-delta);
          }
        }

        this.lastPinchDistance = distance;
      }
    }, { passive: false });

    // Touch end
    canvas.addEventListener('touchend', (event: TouchEvent) => {
      if (!this.enabled) return;
      event.preventDefault();

      if (event.changedTouches.length === 1 && this.touchStartPos) {
        const touch = event.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;
        if (!this.callbacks.isInputBlocked?.(endX, endY)) {
          const timeDiff = Date.now() - this.touchStartTime;

          const dx = endX - this.touchStartPos.x;
          const dy = endY - this.touchStartPos.y;
          const distance = this.getDistance(dx, dy);

          // Check if it was a tap (short time, minimal movement)
          if (timeDiff < this.TAP_TIME_THRESHOLD && distance < 10) {
            this.callbacks.onClick?.(endX, endY);
          }
          // Swipe detection (no longer used for player movement)
        }

        this.callbacks.onDragEnd?.();
      }

      // Reset touch state
      if (event.touches.length === 0) {
        this.touchStartPos = null;
        this.initialPinchDistance = 0;
        this.lastPinchDistance = 0;
      }
    }, { passive: false });

    // Touch cancel
    canvas.addEventListener('touchcancel', (event: TouchEvent) => {
      event.preventDefault();
      this.touchStartPos = null;
      this.initialPinchDistance = 0;
      this.lastPinchDistance = 0;
      this.callbacks.onDragEnd?.();
    }, { passive: false });
  }

  private getDistance(dx: number, dy: number): number {
    return Math.sqrt(dx * dx + dy * dy);
  }

  public isDirectionKeyHeld(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    switch (direction) {
      case 'up': return this.isKeyDown('arrowup') || this.isKeyDown('w');
      case 'down': return this.isKeyDown('arrowdown') || this.isKeyDown('s');
      case 'left': return this.isKeyDown('arrowleft') || this.isKeyDown('a');
      case 'right': return this.isKeyDown('arrowright') || this.isKeyDown('d');
    }
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
