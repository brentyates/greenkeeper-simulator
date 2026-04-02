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
import type { PlacedAsset } from '../../data/customCourseData';

export const HOLE_BUILDER_TOOLBAR_BOUNDS = {
  width: 352,
  height: 392,
  left: 10,
  top: 10,
};

export type HoleBuilderTool =
  | 'select'
  | 'tee_blue'
  | 'tee_white'
  | 'tee_red'
  | 'tee_gold'
  | 'pin'
  | 'delete';

export interface HoleBuilderToolbarCallbacks {
  onToolSelect: (tool: HoleBuilderTool | null) => void;
  onHoleNumberChange: (holeNumber: number) => void;
  onOpenTerrainEditor?: () => void;
  onOpenAssetBuilder?: () => void;
  onRotateSelected?: () => void;
  onClearSelection?: () => void;
  onClose: () => void;
}

export class HoleBuilderToolbar {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: HoleBuilderToolbarCallbacks;

  private panel: Rectangle | null = null;
  private activeTool: HoleBuilderTool | null = null;
  private activeHoleNumber = 1;
  private definedHoleNumbers: number[] = [];
  private holeNumberText: TextBlock | null = null;
  private holeMetricsText: TextBlock | null = null;
  private selectedAssetText: TextBlock | null = null;
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
    const normalized = this.clampHoleNumber(holeNumber);
    if (normalized === this.activeHoleNumber) return;
    this.activeHoleNumber = normalized;
    this.updateHoleNumberText();
    this.callbacks.onHoleNumberChange(this.activeHoleNumber);
  }

  public setHoleCatalog(holeNumbers: number[]): void {
    this.definedHoleNumbers = Array.from(
      new Set(
        holeNumbers
          .filter((holeNumber) => Number.isFinite(holeNumber) && holeNumber >= 1)
          .map((holeNumber) => Math.floor(holeNumber))
      )
    ).sort((a, b) => a - b);

    const clampedActiveHole = this.clampHoleNumber(this.activeHoleNumber);
    const holeChanged = clampedActiveHole !== this.activeHoleNumber;
    this.activeHoleNumber = clampedActiveHole;
    this.updateHoleNumberText();

    if (holeChanged) {
      this.callbacks.onHoleNumberChange(this.activeHoleNumber);
    }
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
      title: 'HOLE DESIGNER',
      titleColor: UI_THEME.colors.text.info,
      width: 328,
      onClose: () => this.callbacks.onClose(),
    });

    const toolHelp = new TextBlock('holeBuilderToolHelp');
    toolHelp.text = 'Each hole keeps one pin and one marker per tee set. Place again to move that slot, or use Select / Move to reposition it.';
    toolHelp.color = UI_THEME.colors.text.secondary;
    toolHelp.fontSize = UI_THEME.typography.scale.s10;
    toolHelp.height = '38px';
    toolHelp.textWrapping = true;
    stack.addControl(toolHelp);

    const switchRow = createHorizontalRow(stack, {
      name: 'holeBuilderSwitchRow',
      widthPx: 332,
      heightPx: 32,
    });
    const switchButtons = addUniformButtons(switchRow, {
      rowWidthPx: 332,
      rowHeightPx: 28,
      gapPx: UI_SPACING.xs,
      specs: [
        { id: 'holeSwitchTerrain', label: 'Open Terrain (T)', onClick: () => this.callbacks.onOpenTerrainEditor?.(), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeSwitchAssets', label: 'Open Assets (K)', onClick: () => this.callbacks.onOpenAssetBuilder?.(), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
      ],
    });
    switchButtons.forEach((button) => {
      if (button) {
        button.background = UI_THEME.colors.action.neutral.normal;
        button.color = UI_THEME.colors.text.secondary;
      }
    });

    addDialogSectionLabel(stack, {
      id: 'holeBuilderEditLabel',
      text: 'Edit',
      tone: 'info',
      fontSize: 11,
      height: 18,
    });

    const editRow = createHorizontalRow(stack, {
      name: 'holeBuilderEditRow',
      widthPx: 332,
      heightPx: 32,
    });
    const editButtons = addUniformButtons(editRow, {
      rowWidthPx: 332,
      rowHeightPx: 28,
      gapPx: UI_SPACING.xs,
      specs: [
        { id: 'holeTool_select', label: 'Select / Move', onClick: () => this.selectTool('select'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeTool_pin', label: 'Pin', onClick: () => this.selectTool('pin'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeTool_delete', label: 'Delete', onClick: () => this.selectTool('delete'), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
      ],
    });
    const selectButton = editButtons[0];
    if (selectButton) {
      this.toolButtons.set('select', selectButton);
      selectButton.metadata = { activeColor: '#2f6f60' };
    }
    const pinButton = editButtons[1];
    if (pinButton) {
      this.toolButtons.set('pin', pinButton);
      pinButton.metadata = { activeColor: '#2e6a5a' };
    }
    const deleteButton = editButtons[2];
    if (deleteButton) {
      this.toolButtons.set('delete', deleteButton);
      deleteButton.metadata = { activeColor: '#6a3535' };
    }

    addDialogSectionLabel(stack, {
      id: 'holeBuilderTeeLabel',
      text: 'Tee Sets',
      tone: 'info',
      fontSize: 11,
      height: 18,
    });

    const teeRow = createHorizontalRow(stack, {
      name: 'holeBuilderTeeRow',
      widthPx: 332,
      heightPx: 32,
    });
    const teeButtons = addUniformButtons(teeRow, {
      rowWidthPx: 332,
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
    this.updateHoleNumberText();
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

    const selectedCard = new Rectangle('holeBuilderSelectedCard');
    selectedCard.width = '332px';
    selectedCard.height = '62px';
    selectedCard.cornerRadius = UI_THEME.radii.section;
    selectedCard.thickness = 1;
    selectedCard.color = UI_THEME.colors.border.info;
    selectedCard.background = UI_THEME.colors.surfaces.panelInset;
    selectedCard.paddingTop = '6px';
    selectedCard.paddingBottom = '4px';
    selectedCard.paddingLeft = '8px';
    selectedCard.paddingRight = '8px';
    stack.addControl(selectedCard);

    this.selectedAssetText = new TextBlock('holeBuilderSelectedText');
    this.selectedAssetText.text = 'No marker selected. Use Select / Move, then drag a tee or pin to reposition it.';
    this.selectedAssetText.color = UI_THEME.colors.text.secondary;
    this.selectedAssetText.fontSize = UI_THEME.typography.scale.s10;
    this.selectedAssetText.textWrapping = true;
    this.selectedAssetText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    selectedCard.addControl(this.selectedAssetText);

    const selectionActions = createHorizontalRow(stack, {
      name: 'holeBuilderSelectionActions',
      widthPx: 332,
      heightPx: 32,
    });
    selectionActions.paddingTop = '4px';
    const selectionButtons = addUniformButtons(selectionActions, {
      rowWidthPx: 332,
      rowHeightPx: 28,
      gapPx: UI_SPACING.xs,
      specs: [
        { id: 'holeSelectionRotate', label: 'Rotate 90°', onClick: () => this.callbacks.onRotateSelected?.(), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
        { id: 'holeSelectionClear', label: 'Clear Selection', onClick: () => this.callbacks.onClearSelection?.(), background: '#2a3f35', hoverBackground: '#355244', fontSize: 11 },
      ],
    });
    selectionButtons.forEach((button) => {
      if (button) {
        button.background = UI_THEME.colors.action.neutral.normal;
        button.color = UI_THEME.colors.text.secondary;
      }
    });

    const hotkeyText = new TextBlock('holeBuilderHotkey');
    hotkeyText.text = 'J toggles the designer. Drag in Select / Move to reposition markers.';
    hotkeyText.color = UI_THEME.colors.text.info;
    hotkeyText.fontSize = UI_THEME.typography.scale.s10;
    hotkeyText.height = '28px';
    hotkeyText.textWrapping = true;
    hotkeyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hotkeyText.paddingTop = '6px';
    stack.addControl(hotkeyText);

    this.holeMetricsText = new TextBlock('holeBuilderMetrics');
    this.holeMetricsText.text = 'Hole 1: add one pin and at least one tee set to make the hole playable.';
    this.holeMetricsText.color = UI_THEME.colors.text.secondary;
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

  public setSelectedAsset(asset: PlacedAsset | null): void {
    if (!this.selectedAssetText) return;
    if (!asset) {
      this.selectedAssetText.text = 'No marker selected. Use Select / Move, then drag a tee or pin to reposition it.';
      return;
    }

    const feature = asset.gameplay?.holeFeature;
    const holeLabel = feature ? `Hole ${feature.holeNumber}` : 'Unassigned';
    const markerLabel =
      feature?.kind === 'pin_position'
        ? 'Pin'
        : feature?.teeSet
          ? `${feature.teeSet[0].toUpperCase()}${feature.teeSet.slice(1)} tee`
          : 'Tee';
    this.selectedAssetText.text =
      `${markerLabel} selected on ${holeLabel}.\n` +
      `Drag to move it. Rotate tees to line them up with the approach; pins stay fixed.`;
  }

  public setActiveTool(tool: HoleBuilderTool | null): void {
    this.activeTool = tool;
    this.callbacks.onToolSelect(tool);
    this.updateButtonStates();
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
      button.background = selected ? activeColor : UI_THEME.colors.action.neutral.normal;
      button.color = selected ? UI_THEME.colors.text.primary : UI_THEME.colors.text.secondary;
      button.thickness = selected ? 2 : 1;
    });
  }

  private clampHoleNumber(holeNumber: number): number {
    const normalized = Math.max(1, Math.floor(holeNumber));
    const maxSelectableHole = Math.max(1, this.getMaxDefinedHoleNumber() + 1);
    return Math.min(normalized, maxSelectableHole);
  }

  private getMaxDefinedHoleNumber(): number {
    return this.definedHoleNumbers.length > 0
      ? this.definedHoleNumbers[this.definedHoleNumbers.length - 1]
      : 0;
  }

  private updateHoleNumberText(): void {
    if (!this.holeNumberText) return;

    const maxDefinedHole = this.getMaxDefinedHoleNumber();
    if (this.definedHoleNumbers.includes(this.activeHoleNumber)) {
      this.holeNumberText.text = `Hole: ${this.activeHoleNumber}`;
      return;
    }

    if (this.activeHoleNumber === maxDefinedHole + 1) {
      this.holeNumberText.text = `New: ${this.activeHoleNumber}`;
      return;
    }

    this.holeNumberText.text = `Empty: ${this.activeHoleNumber}`;
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
