/**
 * IrrigationInfoPanel - Shows information about selected pipe or sprinkler
 */
import { UI_THEME } from './UITheme';

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { createActionButton, createPanelSection, POPUP_COLORS } from './PopupUtils';
import { renderDialog } from './DialogRenderer';
import { buildIrrigationInfoNodes } from './schemas/IrrigationSchemas';

import { PipeTile, SprinklerHead } from '../../core/irrigation';

export const IRRIGATION_INFO_PANEL_BOUNDS = {
  width: 340,
  height: 430,
  right: 12,
  top: 12,
};

export interface IrrigationInfoPanelCallbacks {
  onClose: () => void;
  onRepair?: (x: number, y: number) => void;
  onUpgrade?: (x: number, y: number) => void;
  onManageSchedule?: (headId: string) => void;
}

export class IrrigationInfoPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: IrrigationInfoPanelCallbacks;
  private panel: Rectangle | null = null;
  private contentHost: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: IrrigationInfoPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const rendered = renderDialog(this.advancedTexture, {
      name: 'irrigationInfo',
      shell: 'docked',
      width: IRRIGATION_INFO_PANEL_BOUNDS.width,
      height: IRRIGATION_INFO_PANEL_BOUNDS.height,
      padding: 12,
      colors: POPUP_COLORS.green,
      dock: {
        horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_RIGHT,
        verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
        left: -IRRIGATION_INFO_PANEL_BOUNDS.right,
        top: IRRIGATION_INFO_PANEL_BOUNDS.top,
      },
      title: 'NETWORK INSPECTOR',
      titleColor: UI_THEME.colors.text.info,
      headerWidth: 312,
      onClose: () => this.callbacks.onClose(),
      nodes: buildIrrigationInfoNodes((parent) => this.renderInfoContent(parent)),
    });
    this.panel = rendered.panel;
  }

  private renderInfoContent(parent: StackPanel): void {
    this.contentHost = new StackPanel('irrigationInfoContent');
    this.contentHost.width = '308px';
    parent.addControl(this.contentHost);
  }

  public showPipeInfo(pipe: PipeTile): void {
    if (!this.contentHost || !this.panel) return;
    this.clearContent();

    this.addHeadline(`${pipe.pipeType.toUpperCase()} PIPE`, pipe.isLeaking ? 'Fault detected on this line. Repair should be the next action.' : 'Line is stable. Use pressure and durability to decide whether it should be upgraded.');
    this.addSection('Condition', 84, (section) => {
      this.addMetricLine(section, 'Status', pipe.isLeaking ? 'Leaking' : 'Stable', pipe.isLeaking ? UI_THEME.colors.text.danger : UI_THEME.colors.text.success);
      this.addMetricLine(section, 'Pressure', `${pipe.pressureLevel.toFixed(0)}%`, getPressureColor(pipe.pressureLevel));
      this.addMetricLine(section, 'Durability', `${pipe.durability.toFixed(0)}%`, getDurabilityColor(pipe.durability));
    });
    this.addSection('Operator Read', 70, (section) => {
      const diagnosis = pipe.isLeaking
        ? 'This run is actively losing water. Fix the leak before adding more heads downstream.'
        : pipe.pressureLevel < 40
          ? 'Water is reaching this run, but pressure is weak. Check upstream supply before expanding coverage.'
          : 'This line is healthy enough to support nearby heads and future routing.';
      this.addBodyText(section, diagnosis, pipe.isLeaking ? UI_THEME.colors.legacy.c_ffcc88 : UI_THEME.colors.text.secondary, 38);
    });

    if (pipe.isLeaking && this.callbacks.onRepair) {
      const repairBtn = createActionButton({
        id: 'repairBtn',
        label: 'Dispatch Repair Crew',
        tone: 'warning',
        width: 300,
        height: 34,
        onClick: () => this.callbacks.onRepair!(pipe.gridX, pipe.gridY),
      });
      this.contentHost.addControl(repairBtn);
    }

    this.panel.isVisible = true;
  }

  public showSprinklerInfo(head: SprinklerHead, pressureLevel: number = 0): void {
    if (!this.contentHost || !this.panel) return;
    this.clearContent();

    const activityLabel = getSprinklerActivityLabel(head, pressureLevel);
    this.addHeadline(`${head.sprinklerType.toUpperCase()} HEAD`, activityLabel.text);
    this.addSection('Condition', 94, (section) => {
      this.addMetricLine(section, 'Network', head.connectedToPipe ? 'Connected' : 'Offline', head.connectedToPipe ? UI_THEME.colors.text.success : UI_THEME.colors.text.danger);
      this.addMetricLine(section, 'Pressure', `${pressureLevel.toFixed(0)}%`, getPressureColor(pressureLevel));
      this.addMetricLine(section, 'Coverage', `${head.coverageTiles.length} tiles`, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Zone', head.schedule.zone, UI_THEME.colors.text.info);
    });
    this.addSection('Program', 78, (section) => {
      const scheduleText = !head.schedule.enabled
        ? 'Program is disabled.'
        : head.schedule.timeRanges.length > 0
          ? `Runs ${head.schedule.timeRanges.map((range) => `${formatClock(range.start)}-${formatClock(range.end)}`).join(', ')}.`
          : 'Program is enabled but no watering windows are set.';
      this.addBodyText(section, scheduleText, head.schedule.enabled && head.schedule.timeRanges.length === 0 ? UI_THEME.colors.legacy.c_ffcc88 : UI_THEME.colors.text.secondary, 38);
      this.addMetricLine(section, 'Rain Skip', head.schedule.skipRain ? 'Enabled' : 'Disabled', UI_THEME.colors.text.info);
    });
    this.addSection('Recommended Action', 74, (section) => {
      const recommendation = !head.connectedToPipe
        ? 'Run pipe to this tile before adjusting the schedule.'
        : pressureLevel <= 0
          ? 'Restore pressure upstream. Scheduling alone will not make this head water.'
          : !head.schedule.enabled || head.schedule.timeRanges.length === 0
            ? 'Give this head a real watering window so it can contribute to coverage.'
            : 'This head is configured well. Use Inspect on neighboring heads to validate overlap and balance.';
      this.addBodyText(section, recommendation, UI_THEME.colors.legacy.c_ffcc88, 42);
    });

    if (this.callbacks.onManageSchedule) {
      const scheduleBtn = createActionButton({
        id: 'scheduleBtn',
        label: 'Open Watering Program',
        tone: 'neutral',
        width: 300,
        height: 34,
        onClick: () => this.callbacks.onManageSchedule?.(head.id),
      });
      this.contentHost.addControl(scheduleBtn);
    }

    this.panel.isVisible = true;
  }

  private clearContent(): void {
    if (!this.contentHost) return;
    const controls = this.contentHost.children.slice();
    for (const control of controls) {
      this.contentHost.removeControl(control);
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

  private addHeadline(titleText: string, description: string): void {
    if (!this.contentHost) return;

    const title = new TextBlock(`headline_${titleText}`);
    title.text = titleText;
    title.color = UI_THEME.colors.text.success;
    title.fontSize = UI_THEME.typography.scale.s16;
    title.fontWeight = 'bold';
    title.height = '22px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.contentHost.addControl(title);

    const descriptionText = new TextBlock(`headlineDesc_${titleText}`);
    descriptionText.text = description;
    descriptionText.color = UI_THEME.colors.text.secondary;
    descriptionText.fontSize = UI_THEME.typography.scale.s11;
    descriptionText.height = '34px';
    descriptionText.textWrapping = true;
    descriptionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.contentHost.addControl(descriptionText);
  }

  private addSection(titleText: string, height: number, render: (section: StackPanel) => void): void {
    if (!this.contentHost) return;

    const section = createPanelSection(this.contentHost, {
      name: `irrigationInfo_${titleText}`,
      width: 308,
      height,
      theme: 'green',
      background: 'rgba(24, 51, 40, 0.84)',
      borderColor: '#3f6a58',
      cornerRadius: 4,
      paddingTop: 4,
      paddingBottom: 4,
      marginTop: 6,
    });

    const stack = new StackPanel(`${titleText}_stack`);
    stack.width = '292px';
    section.addControl(stack);

    const label = new TextBlock(`${titleText}_label`);
    label.text = titleText.toUpperCase();
    label.color = UI_THEME.colors.text.info;
    label.fontSize = UI_THEME.typography.scale.s10;
    label.fontWeight = 'bold';
    label.height = '18px';
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(label);

    render(stack);
  }

  private addMetricLine(parent: StackPanel, label: string, value: string, valueColor: string): void {
    const row = new StackPanel(`${label}_row`);
    row.isVertical = false;
    row.height = '18px';
    parent.addControl(row);

    const labelText = new TextBlock(`${label}_label`);
    labelText.text = `${label}`;
    labelText.color = UI_THEME.colors.text.secondary;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.width = '110px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const valueText = new TextBlock(`${label}_value`);
    valueText.text = value;
    valueText.color = valueColor;
    valueText.fontSize = UI_THEME.typography.scale.s11;
    valueText.width = '176px';
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(valueText);
  }

  private addBodyText(parent: StackPanel, text: string, color: string, height: number): void {
    const body = new TextBlock(`body_${text.slice(0, 10)}`);
    body.text = text;
    body.color = color;
    body.fontSize = UI_THEME.typography.scale.s11;
    body.height = `${height}px`;
    body.textWrapping = true;
    body.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    parent.addControl(body);
  }
}

function formatClock(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function getPressureColor(pressureLevel: number): string {
  if (pressureLevel >= 80) return UI_THEME.colors.text.success;
  if (pressureLevel >= 40) return UI_THEME.colors.legacy.c_ffdd88;
  if (pressureLevel > 0) return UI_THEME.colors.legacy.c_ffcc88;
  return UI_THEME.colors.text.danger;
}

function getDurabilityColor(durability: number): string {
  if (durability >= 75) return UI_THEME.colors.text.success;
  if (durability >= 40) return UI_THEME.colors.legacy.c_ffdd88;
  return UI_THEME.colors.text.danger;
}

function getSprinklerActivityLabel(head: SprinklerHead, pressureLevel: number): { text: string } {
  if (head.isActive && pressureLevel > 0) {
    return { text: 'Head is currently pressurized and capable of watering.' };
  }
  if (head.isActive) {
    return { text: 'Head is scheduled, but the line has no usable pressure.' };
  }
  return { text: 'Head is idle. Review the controller program if this area should be watering.' };
}
