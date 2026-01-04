import { Scene } from "@babylonjs/core/scene";
import { KeyboardEventTypes, KeyboardInfo } from "@babylonjs/core/Events/keyboardEvents";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Vector2WithInfo } from "@babylonjs/gui/2D/math2D";

/**
 * Represents a focusable UI element with keyboard and accessibility support
 */
export interface FocusableElement {
  /** The Babylon.js GUI control */
  control: Control;
  /** Callback when activated (Enter/Space or click) */
  onActivate: () => void;
  /** Optional callback when focused */
  onFocus?: () => void;
  /** Optional callback when blurred */
  onBlur?: () => void;
  /** Whether the element is currently enabled */
  isEnabled?: () => boolean;
  /** Group identifier for navigation (e.g., 'menu', 'panel') */
  group?: string;
}

interface RegisteredElement extends FocusableElement {
  clickObserver: Observer<Vector2WithInfo> | null;
}

/**
 * FocusManager handles keyboard navigation and focus management for UI elements
 * Supports Tab, Arrow keys, Enter/Space activation, and visual focus indicators
 */
export class FocusManager {
  private scene: Scene;
  private elements: RegisteredElement[] = [];
  private currentFocusIndex: number = -1;
  private enabled: boolean = false;
  private currentGroup: string | null = null;
  private keyboardObserver: Observer<KeyboardInfo> | null = null;


  constructor(scene: Scene) {
    this.scene = scene;
    this.setupKeyboardHandling();
  }

  /**
   * Register a focusable element
   */
  public register(element: FocusableElement): void {
    const clickObserver = element.control.onPointerClickObservable.add(() => {
      if (element.isEnabled?.() !== false) {
        element.onActivate();
      }
    });

    this.elements.push({
      ...element,
      clickObserver
    });
  }

  /**
   * Unregister a focusable element
   */
  public unregister(control: Control): void {
    const index = this.elements.findIndex(el => el.control === control);
    if (index !== -1) {
      if (this.currentFocusIndex === index) {
        this.clearFocus();
      }
      const element = this.elements[index];
      if (element.clickObserver) {
        element.control.onPointerClickObservable.remove(element.clickObserver);
      }
      this.elements.splice(index, 1);
      if (this.currentFocusIndex > index) {
        this.currentFocusIndex--;
      }
    }
  }

  /**
   * Clear all registered elements
   */
  public clear(): void {
    this.clearFocus();
    for (const element of this.elements) {
      if (element.clickObserver) {
        element.control.onPointerClickObservable.remove(element.clickObserver);
      }
    }
    this.elements = [];
    this.currentFocusIndex = -1;
    this.currentGroup = null;
  }

  /**
   * Enable focus management for a specific group
   */
  public enableForGroup(group: string, initialFocusIndex: number = 0): void {
    this.enabled = true;
    this.currentGroup = group;
    const groupElements = this.getGroupElements();
    if (groupElements.length > 0) {
      this.setFocus(Math.min(initialFocusIndex, groupElements.length - 1));
    }
  }

  /**
   * Disable focus management
   */
  public disable(): void {
    this.enabled = false;
    this.clearFocus();
    this.currentGroup = null;
  }

  /**
   * Check if focus management is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get elements in the current group
   */
  private getGroupElements(): RegisteredElement[] {
    if (!this.currentGroup) {
      return this.elements;
    }
    return this.elements.filter(el =>
      el.group === this.currentGroup && el.control.isVisible && el.isEnabled?.() !== false
    );
  }

  /**
   * Get global index from group-relative index
   */
  private getGlobalIndex(groupIndex: number): number {
    const groupElements = this.getGroupElements();
    if (groupIndex < 0 || groupIndex >= groupElements.length) {
      return -1;
    }
    return this.elements.indexOf(groupElements[groupIndex]);
  }

  /**
   * Get group-relative index from global index
   */
  private getGroupIndex(globalIndex: number): number {
    if (globalIndex < 0 || globalIndex >= this.elements.length) {
      return -1;
    }
    const element = this.elements[globalIndex];
    const groupElements = this.getGroupElements();
    return groupElements.indexOf(element);
  }

  /**
   * Set focus to a specific element
   */
  private setFocus(groupIndex: number): void {
    const globalIndex = this.getGlobalIndex(groupIndex);
    if (globalIndex === -1) return;

    // Clear previous focus
    if (this.currentFocusIndex !== -1 && this.currentFocusIndex !== globalIndex) {
      const prevElement = this.elements[this.currentFocusIndex];
      prevElement.onBlur?.();
    }

    this.currentFocusIndex = globalIndex;
    const element = this.elements[globalIndex];

    // Call focus callback
    element.onFocus?.();

    // Show visual focus indicator
    this.showFocusIndicator(element.control);
  }

  /**
   * Clear current focus
   */
  private clearFocus(): void {
    if (this.currentFocusIndex !== -1) {
      const element = this.elements[this.currentFocusIndex];
      element.onBlur?.();
      this.currentFocusIndex = -1;
    }
    this.hideFocusIndicator();
  }

  /**
   * Move focus to next element
   */
  private focusNext(): void {
    const groupElements = this.getGroupElements();
    if (groupElements.length === 0) return;

    const currentGroupIndex = this.getGroupIndex(this.currentFocusIndex);
    const nextIndex = currentGroupIndex === -1 ? 0 : (currentGroupIndex + 1) % groupElements.length;
    this.setFocus(nextIndex);
  }

  /**
   * Move focus to previous element
   */
  private focusPrevious(): void {
    const groupElements = this.getGroupElements();
    if (groupElements.length === 0) return;

    const currentGroupIndex = this.getGroupIndex(this.currentFocusIndex);
    const prevIndex = currentGroupIndex === -1
      ? groupElements.length - 1
      : (currentGroupIndex - 1 + groupElements.length) % groupElements.length;
    this.setFocus(prevIndex);
  }

  /**
   * Activate the currently focused element
   */
  private activateFocused(): void {
    if (this.currentFocusIndex !== -1) {
      const element = this.elements[this.currentFocusIndex];
      if (element.isEnabled?.() !== false) {
        element.onActivate();
      }
    }
  }

  /**
   * Show visual focus indicator around a control
   * Note: Visual indicator is disabled - AccessibleButton handles its own focus styling
   */
  private showFocusIndicator(_control: Control): void {
    // Focus indicator disabled - AccessibleButton already changes appearance on focus
    // The overlay rectangle doesn't work well with StackPanels which layout children linearly
  }

  /**
   * Hide visual focus indicator
   */
  private hideFocusIndicator(): void {
    // No-op - focus indicator disabled
  }

  /**
   * Set up keyboard event handling
   */
  private setupKeyboardHandling(): void {
    this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
      if (!this.enabled) return;

      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        const key = kbInfo.event.key.toLowerCase();

        switch (key) {
          case 'tab':
            kbInfo.event.preventDefault();
            if (kbInfo.event.shiftKey) {
              this.focusPrevious();
            } else {
              this.focusNext();
            }
            break;

          case 'arrowdown':
          case 'arrowright':
            kbInfo.event.preventDefault();
            this.focusNext();
            break;

          case 'arrowup':
          case 'arrowleft':
            kbInfo.event.preventDefault();
            this.focusPrevious();
            break;

          case 'enter':
          case ' ':
            kbInfo.event.preventDefault();
            this.activateFocused();
            break;
        }
      }
    });
  }

  /**
   * Manually focus a specific control
   */
  public focusControl(control: Control): void {
    const index = this.elements.findIndex(el => el.control === control);
    if (index !== -1) {
      const groupIndex = this.getGroupIndex(index);
      if (groupIndex !== -1) {
        this.setFocus(groupIndex);
      }
    }
  }

  /**
   * Get the currently focused control
   */
  public getFocusedControl(): Control | null {
    if (this.currentFocusIndex === -1) return null;
    return this.elements[this.currentFocusIndex].control;
  }

  /**
   * Dispose of the focus manager
   */
  public dispose(): void {
    this.clear();
    if (this.keyboardObserver) {
      this.scene.onKeyboardObservable.remove(this.keyboardObserver);
      this.keyboardObserver = null;
    }
  }
}
