/**
 * IrrigationSchedulePanel - Manage watering schedules
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { WateringSchedule } from '../../core/irrigation';

export interface IrrigationSchedulePanelCallbacks {
  onClose: () => void;
  onScheduleUpdate?: (schedule: WateringSchedule) => void;
}

export class IrrigationSchedulePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: IrrigationSchedulePanelCallbacks;

  private panel: Rectangle | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: IrrigationSchedulePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('irrigationSchedulePanel');
    this.panel.width = '350px';
    this.panel.height = '400px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 45, 35, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.isVisible = false;
    this.panel.isPointerBlocker = true;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('scheduleStack');
    stack.width = '330px';
    stack.paddingTop = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    const title = new TextBlock('title');
    title.text = 'IRRIGATION SCHEDULE';
    title.color = '#7FFF7F';
    title.fontSize = 14;
    title.fontWeight = 'bold';
    title.height = '20px';
    stack.addControl(title);

    const info = new TextBlock('info');
    info.text = 'Default schedule: 5am-7am, 6pm-8pm';
    info.color = '#aaaaaa';
    info.fontSize = 11;
    info.height = '18px';
    stack.addControl(info);

    const closeBtn = Button.CreateSimpleButton('closeBtn', 'Close');
    closeBtn.height = '30px';
    closeBtn.onPointerUpObservable.add(() => this.callbacks.onClose());
    stack.addControl(closeBtn);
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

  public dispose(): void {
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
      this.panel.dispose();
    }
  }
}

