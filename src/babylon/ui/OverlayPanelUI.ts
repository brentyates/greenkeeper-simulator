import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';

import { UIParent } from './UIParent';
import { createActionButton, createDockedPanel, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogActionBar } from './DialogBlueprint';
import { addVerticalSpacer } from './LayoutUtils';
import { UI_THEME } from './UITheme';

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
    const { panel, stack } = createDockedPanel(this.parent, {
      name: 'overlay',
      width: 220,
      height: 420,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_RIGHT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
      left: -10,
      top: 10,
      padding: 10,
    });

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
    createPopupHeader(parent, {
      title: 'IMAGE OVERLAY',
      titleColor: UI_THEME.colors.editor.buttonTextActive,
      width: 200,
      onClose: () => this.hide(),
    });
  }

  private createLoadButton(parent: StackPanel): void {
    const btn = createActionButton({
      id: 'loadImageBtn',
      label: 'Load Image',
      tone: 'primary',
      width: 180,
      height: 30,
      fontSize: 12,
      onClick: () => this.callbacks.onLoadImage(),
    });
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
    labelText.color = UI_THEME.colors.editor.buttonText;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.fontFamily = UI_THEME.typography.fontFamily;
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText, 0, 0);

    const minusBtn = createActionButton({
      id: `overlay_${label}_minus`,
      label: '-',
      tone: 'neutral',
      width: 26,
      height: 22,
      fontSize: 13,
      cornerRadius: 3,
      onClick: () => onChange(decrementDelta),
    });
    minusBtn.color = UI_THEME.colors.editor.buttonText;
    minusBtn.background = UI_THEME.colors.miscButton.neutralBase;
    row.addControl(minusBtn, 0, 1);

    const valueText = new TextBlock(`overlay_${label}_value`, initialValue);
    valueText.color = UI_THEME.colors.legacy.c_cceecc;
    valueText.fontSize = UI_THEME.typography.scale.s11;
    valueText.fontFamily = UI_THEME.typography.fontFamily;
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    row.addControl(valueText, 0, 2);

    const plusBtn = createActionButton({
      id: `overlay_${label}_plus`,
      label: '+',
      tone: 'neutral',
      width: 26,
      height: 22,
      fontSize: 13,
      cornerRadius: 3,
      onClick: () => onChange(incrementDelta),
    });
    plusBtn.color = UI_THEME.colors.editor.buttonText;
    plusBtn.background = UI_THEME.colors.miscButton.neutralBase;
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
      const btn = createActionButton({
        id: `overlay_${name}`,
        label,
        tone: 'neutral',
        width: 60,
        height: 24,
        fontSize: 10,
        cornerRadius: 3,
        onClick,
      });
      btn.color = UI_THEME.colors.editor.buttonText;
      btn.background = UI_THEME.colors.miscButton.neutralBase;
      btn.paddingLeft = '2px';
      btn.paddingRight = '2px';
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
    const { buttons } = addDialogActionBar(parent, {
      id: 'overlayActions',
      width: 200,
      height: 44,
      theme: 'neutral',
      actions: [
        { id: 'overlayToggleBtn', label: 'Toggle', tone: 'neutral', onClick: () => this.callbacks.onToggle(), fontSize: 11 },
        { id: 'overlayClearBtn', label: 'Clear', tone: 'danger', onClick: () => this.callbacks.onClear(), fontSize: 11 },
      ],
    });
    const toggleBtn = buttons[0];
    if (toggleBtn) {
      toggleBtn.color = UI_THEME.colors.editor.buttonText;
      toggleBtn.background = UI_THEME.colors.editor.buttonBase;
    }
  }

  private createSpacer(parent: StackPanel, height: number): void {
    addVerticalSpacer(parent, height, 'overlaySpacer');
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
