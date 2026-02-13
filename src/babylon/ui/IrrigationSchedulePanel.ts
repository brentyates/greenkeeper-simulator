/**
 * IrrigationSchedulePanel - Manage watering schedules
 */
import { UI_THEME } from './UITheme';

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { POPUP_COLORS } from './PopupUtils';
import { renderDialog } from './DialogRenderer';
import { buildIrrigationScheduleNodes } from './schemas/IrrigationSchemas';

import { SprinklerHead, WateringSchedule } from '../../core/irrigation';

export const IRRIGATION_SCHEDULE_PANEL_BOUNDS = {
  width: 350,
  height: 400,
};

export interface IrrigationSchedulePanelCallbacks {
  onClose: () => void;
  onScheduleUpdate?: (headId: string, schedule: WateringSchedule) => void;
}

export class IrrigationSchedulePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: IrrigationSchedulePanelCallbacks;

  private panel: Rectangle | null = null;
  private targetText: TextBlock | null = null;
  private saveStateText: TextBlock | null = null;
  private enabledText: TextBlock | null = null;
  private skipRainText: TextBlock | null = null;
  private windowsText: TextBlock | null = null;
  private saveBtn: Button | null = null;
  private editingHeadId: string | null = null;
  private currentSchedule: WateringSchedule = {
    enabled: true,
    timeRanges: [
      { start: 5 * 60, end: 7 * 60 },
      { start: 18 * 60, end: 20 * 60 },
    ],
    skipRain: false,
    zone: 'default',
  };
  private savedSchedule: WateringSchedule | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: IrrigationSchedulePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const rendered = renderDialog(this.advancedTexture, {
      name: 'irrigationSchedule',
      shell: 'direct',
      width: IRRIGATION_SCHEDULE_PANEL_BOUNDS.width,
      height: IRRIGATION_SCHEDULE_PANEL_BOUNDS.height,
      colors: POPUP_COLORS.green,
      padding: 12,
      title: 'IRRIGATION SCHEDULE',
      titleColor: UI_THEME.colors.text.success,
      headerWidth: 330,
      onClose: () => this.callbacks.onClose(),
      nodes: buildIrrigationScheduleNodes({
        onToggleEnabled: () => {
          this.currentSchedule = {
            ...this.currentSchedule,
            enabled: !this.currentSchedule.enabled,
          };
          this.refreshTexts();
        },
        onToggleRainSkip: () => {
          this.currentSchedule = {
            ...this.currentSchedule,
            skipRain: !this.currentSchedule.skipRain,
          };
          this.refreshTexts();
        },
        onPresetDawn: () => this.applyPreset('dawn'),
        onPresetEvening: () => this.applyPreset('evening'),
        onPresetDual: () => this.applyPreset('dual'),
        onPresetOff: () => this.applyPreset('off'),
        onClearWindows: () => {
          this.currentSchedule = {
            ...this.currentSchedule,
            timeRanges: [],
          };
          this.refreshTexts();
        },
        onSave: () => {
          if (!this.editingHeadId) {
            this.refreshTexts();
            return;
          }
          if (!this.hasUnsavedChanges()) {
            this.refreshTexts();
            return;
          }
          if (this.callbacks.onScheduleUpdate) {
            this.callbacks.onScheduleUpdate(this.editingHeadId, {
              ...this.currentSchedule,
              timeRanges: [...this.currentSchedule.timeRanges],
            });
          }
          this.savedSchedule = cloneSchedule(this.currentSchedule);
          this.refreshTexts();
        },
        onClose: () => this.callbacks.onClose(),
      }),
    });
    this.panel = rendered.panel;
    this.targetText = rendered.controls.texts.get('target') ?? null;
    this.saveStateText = rendered.controls.texts.get('saveState') ?? null;
    this.enabledText = rendered.controls.texts.get('enabled') ?? null;
    this.skipRainText = rendered.controls.texts.get('skipRain') ?? null;
    this.windowsText = rendered.controls.texts.get('windows') ?? null;
    const actionRow = rendered.controls.rows.get('actions');
    this.saveBtn = (actionRow?.children[0] as Button | undefined) ?? null;

    this.refreshTexts();
  }

  private applyPreset(preset: 'dawn' | 'evening' | 'dual' | 'off'): void {
    if (preset === 'dawn') {
      this.currentSchedule = {
        ...this.currentSchedule,
        enabled: true,
        timeRanges: [{ start: 5 * 60, end: 7 * 60 }],
      };
    } else if (preset === 'evening') {
      this.currentSchedule = {
        ...this.currentSchedule,
        enabled: true,
        timeRanges: [{ start: 18 * 60, end: 20 * 60 }],
      };
    } else if (preset === 'dual') {
      this.currentSchedule = {
        ...this.currentSchedule,
        enabled: true,
        timeRanges: [
          { start: 5 * 60, end: 7 * 60 },
          { start: 18 * 60, end: 20 * 60 },
        ],
      };
    } else {
      this.currentSchedule = {
        ...this.currentSchedule,
        enabled: false,
      };
    }

    this.refreshTexts();
  }

  private refreshTexts(): void {
    if (!this.enabledText || !this.skipRainText || !this.windowsText) return;

    this.enabledText.text = `Enabled: ${this.currentSchedule.enabled ? 'Yes' : 'No'}`;
    this.enabledText.color = this.currentSchedule.enabled ? UI_THEME.colors.text.success : UI_THEME.colors.legacy.c_ffb4b4;

    this.skipRainText.text = `Skip rain: ${this.currentSchedule.skipRain ? 'Yes' : 'No'}`;

    if (this.currentSchedule.timeRanges.length === 0) {
      this.windowsText.text = 'Windows: none';
      this.windowsText.color = UI_THEME.colors.legacy.c_ffcc88;
    } else {
      this.windowsText.text = `Windows: ${this.currentSchedule.timeRanges
        .map((range) => `${formatClock(range.start)}-${formatClock(range.end)}`)
        .join(', ')}`;
      this.windowsText.color = UI_THEME.colors.legacy.c_dddddd;
    }

    const hasTarget = this.editingHeadId !== null;
    const isDirty = this.hasUnsavedChanges();
    if (this.saveBtn) {
      this.saveBtn.isEnabled = hasTarget && isDirty;
      this.saveBtn.alpha = this.saveBtn.isEnabled ? 1 : 0.55;
      this.saveBtn.background = this.saveBtn.isEnabled ? UI_THEME.colors.legacy.c_3a6a4a : UI_THEME.colors.legacy.c_3a5a4a;
    }

    if (this.saveStateText) {
      if (!hasTarget) {
        this.saveStateText.text = 'Select a sprinkler to edit';
        this.saveStateText.color = UI_THEME.colors.legacy.c_aaaaaa;
      } else if (isDirty) {
        this.saveStateText.text = 'Unsaved changes';
        this.saveStateText.color = UI_THEME.colors.legacy.c_ffcc88;
      } else {
        this.saveStateText.text = 'No pending changes';
        this.saveStateText.color = UI_THEME.colors.legacy.c_88ff88;
      }
    }
  }

  public showForSprinkler(head: SprinklerHead): void {
    this.editingHeadId = head.id;
    this.currentSchedule = cloneSchedule({
      enabled: head.schedule.enabled,
      timeRanges: head.schedule.timeRanges.map((range) => ({ ...range })),
      skipRain: head.schedule.skipRain,
      zone: head.schedule.zone,
    });
    this.savedSchedule = cloneSchedule(this.currentSchedule);
    if (this.targetText) {
      this.targetText.text = `Editing ${head.sprinklerType.toUpperCase()} @ (${head.gridX}, ${head.gridY})`;
    }
    this.refreshTexts();
    this.show();
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

  private hasUnsavedChanges(): boolean {
    if (!this.savedSchedule) return false;
    return !schedulesEqual(this.currentSchedule, this.savedSchedule);
  }
}

function formatClock(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function cloneSchedule(schedule: WateringSchedule): WateringSchedule {
  return {
    ...schedule,
    timeRanges: schedule.timeRanges.map((range) => ({ ...range })),
  };
}

function schedulesEqual(a: WateringSchedule, b: WateringSchedule): boolean {
  if (a.enabled !== b.enabled || a.skipRain !== b.skipRain || a.zone !== b.zone) {
    return false;
  }
  if (a.timeRanges.length !== b.timeRanges.length) {
    return false;
  }
  for (let i = 0; i < a.timeRanges.length; i++) {
    const ar = a.timeRanges[i];
    const br = b.timeRanges[i];
    if (ar.start !== br.start || ar.end !== br.end) {
      return false;
    }
  }
  return true;
}
