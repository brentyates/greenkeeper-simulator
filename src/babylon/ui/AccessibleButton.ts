import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { FocusManager, FocusableElement } from "./FocusManager";
import { UI_THEME } from './UITheme';

export interface AccessibleButtonOptions {
  /** Button label text */
  label: string;
  /** Button width (default: '180px') */
  width?: string;
  /** Button height (default: '45px') */
  height?: string;
  /** Background color (default: '#2a5a3a') */
  backgroundColor?: string;
  /** Border color (default: '#7FFF7F') */
  borderColor?: string;
  /** Text color (default: 'white') */
  textColor?: string;
  /** Font size (default: 14) */
  fontSize?: number;
  /** Corner radius (default: 8) */
  cornerRadius?: number;
  /** Callback when button is clicked/activated */
  onClick: () => void;
  /** Whether button is enabled (default: true) */
  isEnabled?: () => boolean;
  /** Focus group for keyboard navigation */
  focusGroup?: string;
}

/**
 * Creates an accessible button with keyboard, mouse, and touch support
 */
export class AccessibleButton {
  public control: Rectangle;
  private textBlock: TextBlock;
  private options: AccessibleButtonOptions;
  private isHovered: boolean = false;
  private isFocused: boolean = false;

  constructor(options: AccessibleButtonOptions) {
    this.options = {
      width: '180px',
      height: '45px',
      backgroundColor: '#2a5a3a',
      borderColor: '#7FFF7F',
      textColor: 'white',
      fontSize: 14,
      cornerRadius: 8,
      ...options
    };

    this.control = this.createButton();
    this.textBlock = this.createTextBlock();
    this.control.addControl(this.textBlock);
    this.setupInteractions();
  }

  private createButton(): Rectangle {
    const btn = new Rectangle(`btn_${this.options.label}`);
    btn.width = this.options.width!;
    btn.height = this.options.height!;
    btn.cornerRadius = this.options.cornerRadius!;
    btn.background = this.options.backgroundColor!;
    btn.color = this.options.borderColor!;
    btn.thickness = 2;
    return btn;
  }

  private createTextBlock(): TextBlock {
    const text = new TextBlock();
    text.text = this.options.label;
    text.color = this.options.textColor!;
    text.fontSize = this.options.fontSize!;
    text.fontFamily = 'Arial, sans-serif';
    text.isPointerBlocker = false;
    return text;
  }

  private setupInteractions(): void {
    // Mouse hover effects
    this.control.onPointerEnterObservable.add(() => {
      this.isHovered = true;
      this.updateAppearance();
    });

    this.control.onPointerOutObservable.add(() => {
      this.isHovered = false;
      this.updateAppearance();
    });

    // Mouse/touch click handler
    this.control.onPointerUpObservable.add(() => {
      const isEnabled = this.options.isEnabled?.() !== false;
      if (isEnabled) {
        this.options.onClick();
      }
    });

    // Touch-friendly: ensure tap works
    this.control.isPointerBlocker = true;
  }

  private updateAppearance(): void {
    const isEnabled = this.options.isEnabled?.() !== false;

    if (!isEnabled) {
      this.control.alpha = 0.5;
      this.control.background = this.options.backgroundColor!;
      return;
    }

    this.control.alpha = 1;

    if (this.isFocused || this.isHovered) {
      // Brighten background when hovered or focused
      this.control.background = this.lightenColor(this.options.backgroundColor!, 0.3);
      this.control.color = UI_THEME.colors.legacy.c_ffffff;
    } else {
      this.control.background = this.options.backgroundColor!;
      this.control.color = this.options.borderColor!;
    }
  }

  private lightenColor(color: string, amount: number): string {
    // Simple color lightening - parse hex colors
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const num = parseInt(hex, 16);
      const r = Math.min(255, ((num >> 16) & 0xff) + amount * 255);
      const g = Math.min(255, ((num >> 8) & 0xff) + amount * 255);
      const b = Math.min(255, (num & 0xff) + amount * 255);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    return color;
  }

  /**
   * Register this button with a FocusManager for keyboard navigation
   */
  public registerWithFocusManager(focusManager: FocusManager): void {
    const element: FocusableElement = {
      control: this.control,
      onActivate: this.options.onClick,
      onFocus: () => {
        this.isFocused = true;
        this.updateAppearance();
      },
      onBlur: () => {
        this.isFocused = false;
        this.updateAppearance();
      },
      isEnabled: this.options.isEnabled,
      group: this.options.focusGroup
    };

    focusManager.register(element);
  }

  /**
   * Update button label
   */
  public setLabel(label: string): void {
    this.textBlock.text = label;
  }

  /**
   * Get the underlying GUI control
   */
  public getControl(): Rectangle {
    return this.control;
  }

  /**
   * Dispose of the button
   */
  public dispose(): void {
    this.control.dispose();
  }
}

/**
 * Helper function to create an accessible button
 */
export function createAccessibleButton(
  options: AccessibleButtonOptions,
  focusManager?: FocusManager
): AccessibleButton {
  const button = new AccessibleButton(options);
  if (focusManager) {
    button.registerWithFocusManager(focusManager);
  }
  return button;
}
