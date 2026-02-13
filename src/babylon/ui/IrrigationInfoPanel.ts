/**
 * IrrigationInfoPanel - Shows information about selected pipe or sprinkler
 */
import { UI_THEME } from './UITheme';

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { createActionButton, POPUP_COLORS } from './PopupUtils';
import { renderDialog } from './DialogRenderer';
import { buildIrrigationInfoNodes } from './schemas/IrrigationSchemas';

import { PipeTile, SprinklerHead } from '../../core/irrigation';

export const IRRIGATION_INFO_PANEL_BOUNDS = {
  width: 280,
  height: 350,
  right: 10,
  top: 10,
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
      title: 'IRRIGATION DETAILS',
      titleColor: '#b8f0d0',
      headerWidth: 250,
      onClose: () => this.callbacks.onClose(),
      nodes: buildIrrigationInfoNodes((parent) => this.renderInfoContent(parent)),
    });
    this.panel = rendered.panel;
  }

  private renderInfoContent(parent: StackPanel): void {
    this.contentHost = new StackPanel('irrigationInfoContent');
    this.contentHost.width = '250px';
    parent.addControl(this.contentHost);
  }

  public showPipeInfo(pipe: PipeTile): void {
    if (!this.contentHost || !this.panel) return;
    this.clearContent();

    const title = new TextBlock('title');
    title.text = `${pipe.pipeType.toUpperCase()} Pipe`;
    title.color = UI_THEME.colors.legacy.c_7fff7f;
    title.fontSize = UI_THEME.typography.scale.s14;
    title.fontWeight = 'bold';
    this.contentHost.addControl(title);

    const durability = new TextBlock('durability');
    durability.text = `Durability: ${pipe.durability.toFixed(0)}%`;
    durability.color = UI_THEME.colors.legacy.c_aaaaaa;
    durability.fontSize = UI_THEME.typography.scale.s12;
    this.contentHost.addControl(durability);

    const pressure = new TextBlock('pressure');
    pressure.text = `Pressure: ${pipe.pressureLevel.toFixed(0)}%`;
    pressure.color = pipe.pressureLevel >= 80 ? UI_THEME.colors.legacy.c_7fff7f : pipe.pressureLevel >= 40 ? UI_THEME.colors.legacy.c_ffdd88 : UI_THEME.colors.legacy.c_ff7f7f;
    pressure.fontSize = UI_THEME.typography.scale.s12;
    this.contentHost.addControl(pressure);

    if (pipe.isLeaking) {
      const leak = new TextBlock('leak');
      leak.text = '⚠️ LEAKING';
      leak.color = UI_THEME.colors.legacy.c_ff7f7f;
      leak.fontSize = UI_THEME.typography.scale.s12;
      this.contentHost.addControl(leak);

      if (this.callbacks.onRepair) {
        const repairBtn = createActionButton({
          id: 'repairBtn',
          label: 'Repair Leak',
          tone: 'warning',
          width: 244,
          height: 30,
          onClick: () => this.callbacks.onRepair!(pipe.gridX, pipe.gridY),
        });
        this.contentHost.addControl(repairBtn);
      }
    }

    this.panel.isVisible = true;
  }

  public showSprinklerInfo(head: SprinklerHead, pressureLevel: number = 0): void {
    if (!this.contentHost || !this.panel) return;
    this.clearContent();

    const title = new TextBlock('title');
    title.text = `${head.sprinklerType.toUpperCase()} Sprinkler`;
    title.color = UI_THEME.colors.legacy.c_7fff7f;
    title.fontSize = UI_THEME.typography.scale.s14;
    title.fontWeight = 'bold';
    this.contentHost.addControl(title);

    const status = new TextBlock('status');
    if (head.isActive && pressureLevel > 0) {
      status.text = 'Status: Active (Pumping)';
      status.color = UI_THEME.colors.legacy.c_7fff7f;
    } else if (head.isActive) {
      status.text = 'Status: Scheduled (No Pressure)';
      status.color = UI_THEME.colors.legacy.c_ffcc88;
    } else {
      status.text = 'Status: Inactive';
      status.color = UI_THEME.colors.legacy.c_aaaaaa;
    }
    status.fontSize = UI_THEME.typography.scale.s12;
    this.contentHost.addControl(status);

    const connected = new TextBlock('connected');
    connected.text = `Connected: ${head.connectedToPipe ? 'Yes' : 'No'}`;
    connected.color = head.connectedToPipe ? UI_THEME.colors.text.success : UI_THEME.colors.legacy.c_ffb4b4;
    connected.fontSize = UI_THEME.typography.scale.s12;
    this.contentHost.addControl(connected);

    const pressure = new TextBlock('pressure');
    pressure.text = `Pressure: ${pressureLevel.toFixed(0)}%`;
    pressure.color =
      pressureLevel >= 80
        ? UI_THEME.colors.legacy.c_7fff7f
        : pressureLevel >= 40
          ? UI_THEME.colors.legacy.c_ffdd88
          : pressureLevel > 0
            ? UI_THEME.colors.legacy.c_ffcc88
            : UI_THEME.colors.legacy.c_ffb4b4;
    pressure.fontSize = UI_THEME.typography.scale.s12;
    this.contentHost.addControl(pressure);

    if (!head.connectedToPipe) {
      const connectedHint = new TextBlock('connectedHint');
      connectedHint.text = 'Install a pipe on this tile to supply water pressure.';
      connectedHint.color = UI_THEME.colors.legacy.c_ffcc88;
      connectedHint.fontSize = UI_THEME.typography.scale.s10;
      connectedHint.height = '22px';
      connectedHint.textWrapping = true;
      this.contentHost.addControl(connectedHint);
    } else if (pressureLevel <= 0) {
      const pressureHint = new TextBlock('pressureHint');
      pressureHint.text = 'Pipe has no pressure. Connect this line to a water source.';
      pressureHint.color = UI_THEME.colors.legacy.c_ffcc88;
      pressureHint.fontSize = UI_THEME.typography.scale.s10;
      pressureHint.height = '22px';
      pressureHint.textWrapping = true;
      this.contentHost.addControl(pressureHint);
    }

    const coverage = new TextBlock('coverage');
    coverage.text = `Coverage: ${head.coverageTiles.length} tiles`;
    coverage.color = UI_THEME.colors.legacy.c_aaaaaa;
    coverage.fontSize = UI_THEME.typography.scale.s12;
    this.contentHost.addControl(coverage);

    const zone = new TextBlock('zone');
    zone.text = `Zone: ${head.schedule.zone}`;
    zone.color = UI_THEME.colors.legacy.c_aaaaaa;
    zone.fontSize = UI_THEME.typography.scale.s11;
    this.contentHost.addControl(zone);

    const schedule = new TextBlock('schedule');
    if (!head.schedule.enabled) {
      schedule.text = 'Schedule: Disabled';
    } else if (head.schedule.timeRanges.length > 0) {
      const windows = head.schedule.timeRanges
        .map((range) => `${formatClock(range.start)}-${formatClock(range.end)}`)
        .join(', ');
      schedule.text = `Schedule: ${windows}`;
    } else {
      schedule.text = 'Schedule: Enabled (no time windows set)';
    }
    schedule.color = head.schedule.enabled && head.schedule.timeRanges.length === 0 ? UI_THEME.colors.legacy.c_ffcc88 : UI_THEME.colors.legacy.c_88ccff;
    schedule.fontSize = UI_THEME.typography.scale.s11;
    schedule.textWrapping = true;
    schedule.height = '42px';
    this.contentHost.addControl(schedule);

    const skipRain = new TextBlock('skipRain');
    skipRain.text = `Skip rain: ${head.schedule.skipRain ? 'Yes' : 'No'}`;
    skipRain.color = UI_THEME.colors.legacy.c_88ccff;
    skipRain.fontSize = UI_THEME.typography.scale.s11;
    this.contentHost.addControl(skipRain);

    if (this.callbacks.onManageSchedule) {
      const scheduleBtn = createActionButton({
        id: 'scheduleBtn',
        label: 'Edit Schedule',
        tone: 'neutral',
        width: 244,
        height: 30,
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
}

function formatClock(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

