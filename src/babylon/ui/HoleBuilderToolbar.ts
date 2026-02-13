import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { createActionButton, createDockedPanel, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogSectionLabel } from './DialogBlueprint';
import { addUniformButtons, createHorizontalRow, UI_SPACING } from './LayoutUtils';
import { UI_THEME } from './UITheme';

export const HOLE_BUILDER_TOOLBAR_BOUNDS = {
  width: 320,
  height: 300,
  left: 10,
  top: 10,
};

export type HoleBuilderTool =
  | 'tee_blue'
  | 'tee_white'
  | 'tee_red'
  | 'tee_gold'
  | 'pin'
  | 'delete';

export interface HoleBuilderToolbarCallbacks {
  onToolSelect: (tool: HoleBuilderTool | null) => void;
  onHoleNumberChange: (holeNumber: number) => void;
  onClose: () => void;
}

export class HoleBuilderToolbar {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: HoleBuilderToolbarCallbacks;

  private panel: Rectangle | null = null;
  private activeTool: HoleBuilderTool | null = null;
  private activeHoleNumber = 1;
  private holeNumberText: TextBlock | null = null;
  private holeMetricsText: TextBlock | null = null;
  private toolButtons = new Map<HoleBuilderTool, Button>();

  constructor(
    advancedTexture: AdvancedDynamicTexture,
    callbacks: HoleBuilderToolbarCallbacks
  ) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  public getActiveHoleNumber(): number {
    return this.activeHoleNumber;
  }

  public setActiveHoleNumber(holeNumber: number): void {
    const normalized = Math.max(1, Math.floor(holeNumber));
    if (normalized === this.activeHoleNumber) return;
    this.activeHoleNumber = normalized;
    if (this.holeNumberText) {
      this.holeNumberText.text = `Hole: ${this.activeHoleNumber}`;
    }
    this.callbacks.onHoleNumberChange(this.activeHoleNumber);
  }

  public getActiveTool(): HoleBuilderTool | null {
    return this.activeTool;
  }

  public clearToolSelection(): void {
    this.activeTool = null;
    this.callbacks.onToolSelect(null);
    this.updateButtonStates();
  }

  private createPanel(): void {
    const { panel, stack } = createDockedPanel(this.advancedTexture, {
      name: 'holeBuilderToolbar',
      width: HOLE_BUILDER_TOOLBAR_BOUNDS.width,
      height: HOLE_BUILDER_TOOLBAR_BOUNDS.height,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
      left: HOLE_BUILDER_TOOLBAR_BOUNDS.left,
      top: HOLE_BUILDER_TOOLBAR_BOUNDS.top,
      padding: 10,
    });
    this.panel = panel;

    createPopupHeader(stack, {
      title: 'HOLE BUILDER',
      titleColor: '#aaddff',
      width: 296,
      onClose: () => this.callbacks.onClose(),
    });

    const toolHelp = new TextBlock('holeBuilderToolHelp');
    toolHelp.text = 'Select a tool, then click terrain to place or remove markers';
    toolHelp.color = UI_THEME.colors.legacy.c_9fb9c8;
    toolHelp.fontSize = UI_THEME.typography.scale.s10;
    toolHelp.height = '24px';
    toolHelp.textWrapping = true;
    stack.addControl(toolHelp);

    addDialogSectionLabel(stack, {
      id: 'holeBuilderTeeLabel',
      text: 'Tee Markers',
      tone: 'info',
      fontSize: 11,
      height: 18,
    });

    const teeRow = createHorizontalRow(stack, {
      name: 'holeBuilderTeeRow',
      widthPx: 300,
      heightPx: 30,
    });
    const teeButtons = addUniformButtons(teeRow, {
      rowWidthPx: 300,
      rowHeightPx: 28,
      gapPx: UI_SPACING.xs,
      specs: [
        { id: 'holeTool_tee_blue', label: 'Blue', onClick: () => this.selectTool('tee_blue'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeTool_tee_white', label: 'White', onClick: () => this.selectTool('tee_white'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeTool_tee_red', label: 'Red', onClick: () => this.selectTool('tee_red'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeTool_tee_gold', label: 'Gold', onClick: () => this.selectTool('tee_gold'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
      ],
    });
    const teeBlueButton = teeButtons[0];
    if (teeBlueButton) {
      this.toolButtons.set('tee_blue', teeBlueButton);
      teeBlueButton.metadata = { activeColor: '#366da8' };
    }
    const teeWhiteButton = teeButtons[1];
    if (teeWhiteButton) {
      this.toolButtons.set('tee_white', teeWhiteButton);
      teeWhiteButton.metadata = { activeColor: '#617080' };
    }
    const teeRedButton = teeButtons[2];
    if (teeRedButton) {
      this.toolButtons.set('tee_red', teeRedButton);
      teeRedButton.metadata = { activeColor: '#904545' };
    }
    const teeGoldButton = teeButtons[3];
    if (teeGoldButton) {
      this.toolButtons.set('tee_gold', teeGoldButton);
      teeGoldButton.metadata = { activeColor: '#8b7430' };
    }

    addDialogSectionLabel(stack, {
      id: 'holeBuilderOtherLabel',
      text: 'Pin / Edit',
      tone: 'info',
      fontSize: 11,
      height: 18,
    });

    const actionRow = createHorizontalRow(stack, {
      name: 'holeBuilderActionRow',
      widthPx: 300,
      heightPx: 30,
    });
    const actionButtons = addUniformButtons(actionRow, {
      rowWidthPx: 200,
      rowHeightPx: 28,
      gapPx: UI_SPACING.sm,
      specs: [
        { id: 'holeTool_pin', label: 'Pin', onClick: () => this.selectTool('pin'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeTool_delete', label: 'Delete', onClick: () => this.selectTool('delete'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
      ],
    });
    const pinButton = actionButtons[0];
    if (pinButton) {
      this.toolButtons.set('pin', pinButton);
      pinButton.metadata = { activeColor: '#2e6a5a' };
    }
    const deleteButton = actionButtons[1];
    if (deleteButton) {
      this.toolButtons.set('delete', deleteButton);
      deleteButton.metadata = { activeColor: '#6a3535' };
    }
    actionRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    const holeRow = new StackPanel('holeBuilderHoleRow');
    holeRow.isVertical = false;
    holeRow.height = '36px';
    holeRow.paddingTop = '6px';
    stack.addControl(holeRow);

    const minusBtn = createActionButton({
      id: 'holeBuilderMinus',
      label: '-',
      tone: 'neutral',
      width: 28,
      height: 26,
      onClick: () => this.setActiveHoleNumber(this.activeHoleNumber - 1),
    });
    minusBtn.background = UI_THEME.colors.miscButton.holeBuilderBg;
    minusBtn.color = UI_THEME.colors.miscButton.holeBuilderText;
    holeRow.addControl(minusBtn);

    this.holeNumberText = new TextBlock('holeBuilderHoleNumber');
    this.holeNumberText.text = `Hole: ${this.activeHoleNumber}`;
    this.holeNumberText.color = UI_THEME.colors.miscButton.holeBuilderText;
    this.holeNumberText.fontSize = UI_THEME.typography.scale.s12;
    this.holeNumberText.width = '90px';
    this.holeNumberText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    holeRow.addControl(this.holeNumberText);

    const plusBtn = createActionButton({
      id: 'holeBuilderPlus',
      label: '+',
      tone: 'neutral',
      width: 28,
      height: 26,
      onClick: () => this.setActiveHoleNumber(this.activeHoleNumber + 1),
    });
    plusBtn.background = UI_THEME.colors.miscButton.holeBuilderBg;
    plusBtn.color = UI_THEME.colors.miscButton.holeBuilderText;
    holeRow.addControl(plusBtn);

    const hotkeyText = new TextBlock('holeBuilderHotkey');
    hotkeyText.text = 'J: toggle builder';
    hotkeyText.color = UI_THEME.colors.legacy.c_7fa0b2;
    hotkeyText.fontSize = UI_THEME.typography.scale.s10;
    hotkeyText.height = '18px';
    hotkeyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hotkeyText.paddingTop = '6px';
    stack.addControl(hotkeyText);

    this.holeMetricsText = new TextBlock('holeBuilderMetrics');
    this.holeMetricsText.text = 'Hole 1: add tees and a pin to calculate distance + par.';
    this.holeMetricsText.color = UI_THEME.colors.legacy.c_d7e7f4;
    this.holeMetricsText.fontSize = UI_THEME.typography.scale.s10;
    this.holeMetricsText.height = '44px';
    this.holeMetricsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.holeMetricsText.textWrapping = true;
    this.holeMetricsText.paddingTop = '6px';
    stack.addControl(this.holeMetricsText);

    this.updateButtonStates();
  }

  public updateHoleMetrics(text: string): void {
    if (this.holeMetricsText) {
      this.holeMetricsText.text = text;
    }
  }

  private selectTool(tool: HoleBuilderTool): void {
    this.activeTool = this.activeTool === tool ? null : tool;
    this.callbacks.onToolSelect(this.activeTool);
    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    this.toolButtons.forEach((button, tool) => {
      const selected = this.activeTool === tool;
      const activeColor = (button.metadata as { activeColor: string }).activeColor;
      button.background = selected ? activeColor : '#2a3f35';
      button.color = selected ? '#f7fbff' : '#ffffff';
      button.thickness = selected ? 2 : 1;
    });
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
    }
  }

  public hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
  }

  public isVisible(): boolean {
    return this.panel?.isVisible ?? false;
  }

  public dispose(): void {
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
      this.panel.dispose();
    }
  }
}
