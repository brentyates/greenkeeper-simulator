import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { UIParent } from './UIParent';

export interface OverlayPanelCallbacks {
  onLoadImage: () => void;
  onOpacityChange: (opacity: number) => void;
  onScaleChange: (scale: number) => void;
  onOffsetXChange: (offsetX: number) => void;
  onOffsetZChange: (offsetZ: number) => void;
  onFlipX: () => void;
  onFlipY: () => void;
  onRotate: () => void;
  onToggle: () => void;
  onClear: () => void;
}

export class OverlayPanelUI {
  private parent: UIParent;
  private callbacks: OverlayPanelCallbacks;
  private panel: Rectangle;

  private opacityValue = 50;
  private scaleValue = 1.0;
  private offsetXValue = 0;
  private offsetZValue = 0;
  private flipX = false;
  private flipY = false;
  private rotationSteps = 0;

  private opacityText: TextBlock | null = null;
  private scaleText: TextBlock | null = null;
  private offsetXText: TextBlock | null = null;
  private offsetZText: TextBlock | null = null;
  private flipXText: TextBlock | null = null;
  private flipYText: TextBlock | null = null;
  private rotationText: TextBlock | null = null;

  constructor(parent: UIParent, callbacks: OverlayPanelCallbacks) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.panel = this.createPanel();
  }

  private createPanel(): Rectangle {
    const panel = new Rectangle('overlayPanel');
    panel.width = '220px';
    panel.height = '420px';
    panel.cornerRadius = 8;
    panel.color = '#5a9a6a';
    panel.thickness = 2;
    panel.background = 'rgba(20, 45, 35, 0.95)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = '-10px';
    panel.top = '10px';
    panel.isVisible = false;
    panel.isPointerBlocker = true;
    panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    panel.shadowBlur = 10;
    panel.shadowOffsetX = 3;
    panel.shadowOffsetY = 3;
    this.parent.addControl(panel);

    const stack = new StackPanel('overlayStack');
    stack.width = '200px';
    stack.paddingTop = '10px';
    stack.paddingBottom = '10px';
    panel.addControl(stack);

    this.createHeader(stack);
    this.createLoadButton(stack);
    this.createSpacer(stack, 8);
    this.opacityText = this.createAdjustRow(stack, 'Opacity', `${this.opacityValue}%`, -5, 5, (delta) => {
      this.opacityValue = Math.max(0, Math.min(100, this.opacityValue + delta));
      this.opacityText!.text = `${this.opacityValue}%`;
      this.callbacks.onOpacityChange(this.opacityValue);
    });
    this.scaleText = this.createAdjustRow(stack, 'Scale', `${this.scaleValue.toFixed(1)}x`, -0.5, 0.5, (delta) => {
      this.scaleValue = Math.max(0.1, this.scaleValue + delta);
      this.scaleText!.text = `${this.scaleValue.toFixed(1)}x`;
      this.callbacks.onScaleChange(this.scaleValue);
    });
    this.offsetXText = this.createAdjustRow(stack, 'Offset X', `${this.offsetXValue.toFixed(0)}`, -1, 1, (delta) => {
      this.offsetXValue += delta;
      this.offsetXText!.text = `${this.offsetXValue.toFixed(0)}`;
      this.callbacks.onOffsetXChange(this.offsetXValue);
    });
    this.offsetZText = this.createAdjustRow(stack, 'Offset Z', `${this.offsetZValue.toFixed(0)}`, -1, 1, (delta) => {
      this.offsetZValue += delta;
      this.offsetZText!.text = `${this.offsetZValue.toFixed(0)}`;
      this.callbacks.onOffsetZChange(this.offsetZValue);
    });
    this.createSpacer(stack, 8);
    this.createOrientationControls(stack);
    this.createSpacer(stack, 8);
    this.createActionButtons(stack);

    return panel;
  }

  private createHeader(parent: StackPanel): void {
    const header = new TextBlock('overlayHeader', 'IMAGE OVERLAY');
    header.color = '#7FFF7F';
    header.fontSize = 13;
    header.fontFamily = 'Arial, sans-serif';
    header.height = '24px';
    header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    parent.addControl(header);
  }

  private createLoadButton(parent: StackPanel): void {
    const btn = Button.CreateSimpleButton('loadImageBtn', 'Load Image');
    btn.width = '180px';
    btn.height = '30px';
    btn.color = '#7FFF7F';
    btn.background = '#2a5a3a';
    btn.cornerRadius = 4;
    btn.fontSize = 12;
    btn.fontFamily = 'Arial, sans-serif';
    btn.onPointerUpObservable.add(() => this.callbacks.onLoadImage());
    parent.addControl(btn);
  }

  private createAdjustRow(
    parent: StackPanel,
    label: string,
    initialValue: string,
    decrementDelta: number,
    incrementDelta: number,
    onChange: (delta: number) => void
  ): TextBlock {
    const row = new Grid(`overlay_${label}_row`);
    row.width = '200px';
    row.height = '28px';
    row.addColumnDefinition(70, true);
    row.addColumnDefinition(30, true);
    row.addColumnDefinition(1);
    row.addColumnDefinition(30, true);
    parent.addControl(row);

    const labelText = new TextBlock(`overlay_${label}_label`, label);
    labelText.color = '#aaccaa';
    labelText.fontSize = 11;
    labelText.fontFamily = 'Arial, sans-serif';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText, 0, 0);

    const minusBtn = Button.CreateSimpleButton(`overlay_${label}_minus`, '-');
    minusBtn.width = '26px';
    minusBtn.height = '22px';
    minusBtn.color = '#aaccaa';
    minusBtn.background = '#1a2a20';
    minusBtn.cornerRadius = 3;
    minusBtn.fontSize = 13;
    minusBtn.fontFamily = 'Arial, sans-serif';
    minusBtn.onPointerUpObservable.add(() => onChange(decrementDelta));
    row.addControl(minusBtn, 0, 1);

    const valueText = new TextBlock(`overlay_${label}_value`, initialValue);
    valueText.color = '#cceecc';
    valueText.fontSize = 11;
    valueText.fontFamily = 'Arial, sans-serif';
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    row.addControl(valueText, 0, 2);

    const plusBtn = Button.CreateSimpleButton(`overlay_${label}_plus`, '+');
    plusBtn.width = '26px';
    plusBtn.height = '22px';
    plusBtn.color = '#aaccaa';
    plusBtn.background = '#1a2a20';
    plusBtn.cornerRadius = 3;
    plusBtn.fontSize = 13;
    plusBtn.fontFamily = 'Arial, sans-serif';
    plusBtn.onPointerUpObservable.add(() => onChange(incrementDelta));
    row.addControl(plusBtn, 0, 3);

    return valueText;
  }

  private createOrientationControls(parent: StackPanel): void {
    const ROTATION_LABELS = ['0°', '90°', '180°', '270°'];

    const row = new StackPanel('overlayOrientation');
    row.isVertical = false;
    row.width = '200px';
    row.height = '28px';
    parent.addControl(row);

    const makeToggle = (name: string, label: string, onClick: () => void): TextBlock => {
      const btn = Button.CreateSimpleButton(`overlay_${name}`, label);
      btn.width = '60px';
      btn.height = '24px';
      btn.color = '#aaccaa';
      btn.background = '#1a2a20';
      btn.cornerRadius = 3;
      btn.fontSize = 10;
      btn.fontFamily = 'Arial, sans-serif';
      btn.paddingLeft = '2px';
      btn.paddingRight = '2px';
      btn.onPointerUpObservable.add(onClick);
      row.addControl(btn);
      const textControl = btn.children[0] as TextBlock;
      return textControl;
    };

    this.flipXText = makeToggle('flipX', 'Flip X', () => {
      this.flipX = !this.flipX;
      this.flipXText!.text = this.flipX ? 'Flip X ✓' : 'Flip X';
      this.callbacks.onFlipX();
    });

    this.flipYText = makeToggle('flipY', 'Flip Y', () => {
      this.flipY = !this.flipY;
      this.flipYText!.text = this.flipY ? 'Flip Y ✓' : 'Flip Y';
      this.callbacks.onFlipY();
    });

    this.rotationText = makeToggle('rotate', 'Rot 0°', () => {
      this.rotationSteps = (this.rotationSteps + 1) % 4;
      this.rotationText!.text = `Rot ${ROTATION_LABELS[this.rotationSteps]}`;
      this.callbacks.onRotate();
    });
  }

  private createActionButtons(parent: StackPanel): void {
    const row = new StackPanel('overlayActions');
    row.isVertical = false;
    row.width = '200px';
    row.height = '30px';
    parent.addControl(row);

    const toggleBtn = Button.CreateSimpleButton('overlayToggleBtn', 'Toggle');
    toggleBtn.width = '90px';
    toggleBtn.height = '28px';
    toggleBtn.color = '#aaccaa';
    toggleBtn.background = '#1a3a2a';
    toggleBtn.cornerRadius = 4;
    toggleBtn.fontSize = 11;
    toggleBtn.fontFamily = 'Arial, sans-serif';
    toggleBtn.paddingRight = '4px';
    toggleBtn.onPointerUpObservable.add(() => this.callbacks.onToggle());
    row.addControl(toggleBtn);

    const clearBtn = Button.CreateSimpleButton('overlayClearBtn', 'Clear');
    clearBtn.width = '90px';
    clearBtn.height = '28px';
    clearBtn.color = '#ffaaaa';
    clearBtn.background = '#3a1a1a';
    clearBtn.cornerRadius = 4;
    clearBtn.fontSize = 11;
    clearBtn.fontFamily = 'Arial, sans-serif';
    clearBtn.paddingLeft = '4px';
    clearBtn.onPointerUpObservable.add(() => this.callbacks.onClear());
    row.addControl(clearBtn);
  }

  private createSpacer(parent: StackPanel, height: number): void {
    const spacer = new Rectangle();
    spacer.width = '1px';
    spacer.height = `${height}px`;
    spacer.thickness = 0;
    spacer.background = 'transparent';
    parent.addControl(spacer);
  }

  public show(): void {
    this.panel.isVisible = true;
  }

  public hide(): void {
    this.panel.isVisible = false;
  }

  public isVisible(): boolean {
    return this.panel.isVisible;
  }

  public setOpacity(value: number): void {
    this.opacityValue = value;
    if (this.opacityText) this.opacityText.text = `${value}%`;
  }

  public setScale(value: number): void {
    this.scaleValue = value;
    if (this.scaleText) this.scaleText.text = `${value.toFixed(1)}x`;
  }

  public setOffsetX(value: number): void {
    this.offsetXValue = value;
    if (this.offsetXText) this.offsetXText.text = `${value.toFixed(0)}`;
  }

  public setOffsetZ(value: number): void {
    this.offsetZValue = value;
    if (this.offsetZText) this.offsetZText.text = `${value.toFixed(0)}`;
  }

  public resetControls(): void {
    this.setOpacity(50);
    this.setScale(1.0);
    this.setOffsetX(0);
    this.setOffsetZ(0);
    this.flipX = false;
    this.flipY = false;
    this.rotationSteps = 0;
    if (this.flipXText) this.flipXText.text = 'Flip X';
    if (this.flipYText) this.flipYText.text = 'Flip Y';
    if (this.rotationText) this.rotationText.text = 'Rot 0°';
  }

  public dispose(): void {
    this.panel.dispose();
  }
}
