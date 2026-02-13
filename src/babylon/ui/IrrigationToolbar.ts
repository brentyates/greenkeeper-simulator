/**
 * IrrigationToolbar - UI for placing pipes and sprinkler heads
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { createDockedPanel, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogSectionLabel } from './DialogBlueprint';
import { addUniformButtons, addVerticalSpacer, createHorizontalRow, UI_SPACING } from './LayoutUtils';
import { UI_THEME } from './UITheme';

import {
  PipeType,
  SprinklerType,
  PIPE_CONFIGS,
  SPRINKLER_CONFIGS,
} from '../../core/irrigation';

export const IRRIGATION_TOOLBAR_BOUNDS = {
  width: 300,
  height: 290,
  left: 10,
  top: 10,
};

export interface IrrigationToolbarCallbacks {
  onToolSelect: (tool: 'pipe' | 'sprinkler' | 'delete' | 'info' | null) => void;
  onPipeTypeSelect: (type: PipeType) => void;
  onSprinklerTypeSelect: (type: SprinklerType) => void;
  onClose: () => void;
}

export class IrrigationToolbar {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: IrrigationToolbarCallbacks;

  private panel: Rectangle | null = null;
  private activeTool: 'pipe' | 'sprinkler' | 'delete' | 'info' | null = null;
  private selectedPipeType: PipeType = 'pvc';
  private selectedSprinklerType: SprinklerType = 'fixed';
  private pipeBtn: Button | null = null;
  private sprinklerBtn: Button | null = null;
  private deleteBtn: Button | null = null;
  private infoBtn: Button | null = null;
  private pvcBtn: Button | null = null;
  private metalBtn: Button | null = null;
  private industrialBtn: Button | null = null;
  private fixedBtn: Button | null = null;
  private rotaryBtn: Button | null = null;
  private impactBtn: Button | null = null;
  private precisionBtn: Button | null = null;
  private pipeTypeRow: StackPanel | null = null;
  private sprinklerTypeRow: StackPanel | null = null;
  private toolSummaryText: TextBlock | null = null;
  private toolHintText: TextBlock | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: IrrigationToolbarCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDockedPanel(this.advancedTexture, {
      name: 'irrigationToolbar',
      width: IRRIGATION_TOOLBAR_BOUNDS.width,
      height: IRRIGATION_TOOLBAR_BOUNDS.height,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
      left: IRRIGATION_TOOLBAR_BOUNDS.left,
      top: IRRIGATION_TOOLBAR_BOUNDS.top,
      padding: 12,
    });
    this.panel = panel;

    createPopupHeader(stack, {
      title: 'IRRIGATION CONTROL',
      titleColor: '#b8f0d0',
      width: 276,
      onClose: () => this.callbacks.onClose(),
    });

    const subtitle = new TextBlock('toolbarSubtitle');
    subtitle.text = 'Select a tool, then click terrain';
    subtitle.color = UI_THEME.colors.legacy.c_87b8a0;
    subtitle.fontSize = UI_THEME.typography.scale.s10;
    subtitle.height = '16px';
    subtitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(subtitle);

    addVerticalSpacer(stack, UI_SPACING.xs, 'irrigationToolbarTitleGap');
    const toolRow = createHorizontalRow(stack, {
      name: 'toolRow',
      widthPx: 276,
      heightPx: 30,
    });
    const [pipeBtn, sprinklerBtn, deleteBtn, infoBtn] = addUniformButtons(toolRow, {
      rowWidthPx: 276,
      rowHeightPx: 30,
      gapPx: UI_SPACING.xs,
      specs: [
        {
          id: 'pipeBtn',
          label: 'Pipe',
          onClick: () => {
            this.activeTool = this.activeTool === 'pipe' ? null : 'pipe';
            this.callbacks.onToolSelect(this.activeTool);
            this.updateButtonStates();
          },
          fontSize: 11,
          background: '#223e34',
          hoverBackground: '#2c5447',
        },
        {
          id: 'sprinklerBtn',
          label: 'Sprink',
          onClick: () => {
            this.activeTool = this.activeTool === 'sprinkler' ? null : 'sprinkler';
            this.callbacks.onToolSelect(this.activeTool);
            this.updateButtonStates();
          },
          fontSize: 11,
          background: '#223e34',
          hoverBackground: '#2c5447',
        },
        {
          id: 'deleteBtn',
          label: 'Delete',
          onClick: () => {
            this.activeTool = this.activeTool === 'delete' ? null : 'delete';
            this.callbacks.onToolSelect(this.activeTool);
            this.updateButtonStates();
          },
          fontSize: 11,
          background: '#223e34',
          hoverBackground: '#2c5447',
        },
        {
          id: 'infoBtn',
          label: 'Info',
          onClick: () => {
            this.activeTool = this.activeTool === 'info' ? null : 'info';
            this.callbacks.onToolSelect(this.activeTool);
            this.updateButtonStates();
          },
          fontSize: 11,
          background: '#223e34',
          hoverBackground: '#2c5447',
        },
      ],
    });
    this.pipeBtn = pipeBtn ?? null;
    this.sprinklerBtn = sprinklerBtn ?? null;
    this.deleteBtn = deleteBtn ?? null;
    this.infoBtn = infoBtn ?? null;

    this.toolSummaryText = new TextBlock('toolSummary');
    const summaryContainer = createPanelSection(stack, {
      name: 'irrigationSummaryContainer',
      width: 276,
      height: 48,
      theme: 'green',
      cornerRadius: 4,
      background: 'rgba(24, 51, 40, 0.85)',
      borderColor: '#3f6a58',
      paddingTop: 4,
      paddingBottom: 4,
    });

    const summaryStack = new StackPanel('irrigationSummaryStack');
    summaryStack.width = '264px';
    summaryContainer.addControl(summaryStack);

    this.toolSummaryText.color = UI_THEME.colors.legacy.c_b6deef;
    this.toolSummaryText.fontSize = UI_THEME.typography.scale.s11;
    this.toolSummaryText.height = '20px';
    this.toolSummaryText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    summaryStack.addControl(this.toolSummaryText);

    this.toolHintText = new TextBlock('toolHint');
    this.toolHintText.color = UI_THEME.colors.legacy.c_95a89e;
    this.toolHintText.fontSize = UI_THEME.typography.scale.s10;
    this.toolHintText.height = '18px';
    this.toolHintText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    summaryStack.addControl(this.toolHintText);
    addVerticalSpacer(stack, UI_SPACING.sm, 'irrigationToolbarSummaryGap');

    addDialogSectionLabel(stack, {
      id: 'pipeLabel',
      text: 'Pipe Type',
      tone: 'info',
      fontSize: 10,
      fontWeight: 'bold',
      height: 18,
    });

    this.pipeTypeRow = createHorizontalRow(stack, {
      name: 'pipeTypeRow',
      widthPx: 276,
      heightPx: 26,
    });
    const [pvcBtn, metalBtn, industrialBtn] = addUniformButtons(this.pipeTypeRow, {
      rowWidthPx: 276,
      rowHeightPx: 26,
      gapPx: UI_SPACING.sm,
      specs: [
        {
          id: 'pvcBtn',
          label: 'PVC',
          onClick: () => {
            this.selectedPipeType = 'pvc';
            this.callbacks.onPipeTypeSelect(this.selectedPipeType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
        {
          id: 'metalBtn',
          label: 'Metal',
          onClick: () => {
            this.selectedPipeType = 'metal';
            this.callbacks.onPipeTypeSelect(this.selectedPipeType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
        {
          id: 'industrialBtn',
          label: 'Industrial',
          onClick: () => {
            this.selectedPipeType = 'industrial';
            this.callbacks.onPipeTypeSelect(this.selectedPipeType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
      ],
    });
    this.pvcBtn = pvcBtn ?? null;
    this.metalBtn = metalBtn ?? null;
    this.industrialBtn = industrialBtn ?? null;

    addDialogSectionLabel(stack, {
      id: 'sprinklerLabel',
      text: 'Sprinkler Type',
      tone: 'info',
      fontSize: 10,
      fontWeight: 'bold',
      height: 18,
    });

    this.sprinklerTypeRow = createHorizontalRow(stack, {
      name: 'sprinklerTypeRow',
      widthPx: 276,
      heightPx: 26,
    });
    const [fixedBtn, rotaryBtn, impactBtn, precisionBtn] = addUniformButtons(this.sprinklerTypeRow, {
      rowWidthPx: 276,
      rowHeightPx: 26,
      gapPx: UI_SPACING.xs,
      specs: [
        {
          id: 'fixedBtn',
          label: 'Fixed',
          onClick: () => {
            this.selectedSprinklerType = 'fixed';
            this.callbacks.onSprinklerTypeSelect(this.selectedSprinklerType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
        {
          id: 'rotaryBtn',
          label: 'Rotary',
          onClick: () => {
            this.selectedSprinklerType = 'rotary';
            this.callbacks.onSprinklerTypeSelect(this.selectedSprinklerType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
        {
          id: 'impactBtn',
          label: 'Impact',
          onClick: () => {
            this.selectedSprinklerType = 'impact';
            this.callbacks.onSprinklerTypeSelect(this.selectedSprinklerType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
        {
          id: 'precisionBtn',
          label: 'Precision',
          onClick: () => {
            this.selectedSprinklerType = 'precision';
            this.callbacks.onSprinklerTypeSelect(this.selectedSprinklerType);
            this.updateButtonStates();
          },
          fontSize: 10,
          background: '#263a47',
          hoverBackground: '#315066',
        },
      ],
    });
    this.fixedBtn = fixedBtn ?? null;
    this.rotaryBtn = rotaryBtn ?? null;
    this.impactBtn = impactBtn ?? null;
    this.precisionBtn = precisionBtn ?? null;

    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    const setToolStyle = (
      button: Button | null,
      selected: boolean,
      selectedBackground: string = '#2f8f66'
    ): void => {
      if (!button) return;
      button.background = selected ? selectedBackground : '#223e34';
      button.color = selected ? '#f4fffa' : '#d4e7dd';
      button.thickness = selected ? 2 : 1;
      button.cornerRadius = UI_THEME.radii.chip;
    };
    const setTypeStyle = (button: Button | null, selected: boolean): void => {
      if (!button) return;
      button.background = selected ? '#2f7fa1' : '#263a47';
      button.color = selected ? '#ecf8ff' : '#c7d8e2';
      button.thickness = selected ? 2 : 1;
      button.cornerRadius = UI_THEME.radii.chip;
    };

    setToolStyle(this.pipeBtn, this.activeTool === 'pipe', '#2f8f66');
    setToolStyle(this.sprinklerBtn, this.activeTool === 'sprinkler', '#3b7fd0');
    setToolStyle(this.deleteBtn, this.activeTool === 'delete', '#a14a4a');
    setToolStyle(this.infoBtn, this.activeTool === 'info', '#5378a8');

    setTypeStyle(this.pvcBtn, this.selectedPipeType === 'pvc');
    setTypeStyle(this.metalBtn, this.selectedPipeType === 'metal');
    setTypeStyle(this.industrialBtn, this.selectedPipeType === 'industrial');
    setTypeStyle(this.fixedBtn, this.selectedSprinklerType === 'fixed');
    setTypeStyle(this.rotaryBtn, this.selectedSprinklerType === 'rotary');
    setTypeStyle(this.impactBtn, this.selectedSprinklerType === 'impact');
    setTypeStyle(this.precisionBtn, this.selectedSprinklerType === 'precision');

    if (this.pipeTypeRow) {
      this.pipeTypeRow.isVisible = this.activeTool === 'pipe' || this.activeTool === null;
    }
    if (this.sprinklerTypeRow) {
      this.sprinklerTypeRow.isVisible =
        this.activeTool === 'sprinkler' || this.activeTool === null;
    }

    if (this.toolSummaryText && this.toolHintText) {
      if (this.activeTool === 'pipe') {
        const cost = PIPE_CONFIGS[this.selectedPipeType].cost;
        this.toolSummaryText.text = `Pipe: ${this.selectedPipeType.toUpperCase()} ($${cost}/tile)`;
        this.toolHintText.text = 'Click terrain to place pipe';
      } else if (this.activeTool === 'sprinkler') {
        const baseCost = SPRINKLER_CONFIGS[this.selectedSprinklerType].cost;
        const installCost = baseCost + 20;
        this.toolSummaryText.text =
          `Sprinkler: ${this.selectedSprinklerType.toUpperCase()} ($${installCost} install)`;
        this.toolHintText.text = 'Click terrain to place sprinkler';
      } else if (this.activeTool === 'delete') {
        this.toolSummaryText.text = 'Delete mode';
        this.toolHintText.text = 'Click pipe or sprinkler to remove';
      } else if (this.activeTool === 'info') {
        this.toolSummaryText.text = 'Info mode';
        this.toolHintText.text = 'Click pipe or sprinkler for details';
      } else {
        this.toolSummaryText.text = 'No irrigation tool selected';
        this.toolHintText.text = 'Choose Pipe, Sprinkler, Delete, or Info';
      }
    }
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
    }
  }

  public resetToolSelection(): void {
    this.activeTool = null;
    this.updateButtonStates();
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
