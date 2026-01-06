/**
 * IrrigationInfoPanel - Shows information about selected pipe or sprinkler
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { PipeTile, SprinklerHead } from '../../core/irrigation';

export interface IrrigationInfoPanelCallbacks {
  onClose: () => void;
  onRepair?: (x: number, y: number) => void;
  onUpgrade?: (x: number, y: number) => void;
}

export class IrrigationInfoPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: IrrigationInfoPanelCallbacks;

  private panel: Rectangle | null = null;
  private contentStack: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: IrrigationInfoPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('irrigationInfoPanel');
    this.panel.width = '280px';
    this.panel.height = '300px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 45, 35, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.left = '-10px';
    this.panel.top = '10px';
    this.panel.isVisible = false;
    this.panel.isPointerBlocker = true;
    this.advancedTexture.addControl(this.panel);

    this.contentStack = new StackPanel('infoStack');
    this.contentStack.width = '260px';
    this.contentStack.paddingTop = '12px';
    this.contentStack.paddingBottom = '12px';
    this.panel.addControl(this.contentStack);

    const closeBtn = Button.CreateSimpleButton('closeBtn', 'X');
    closeBtn.width = '28px';
    closeBtn.height = '28px';
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.onPointerUpObservable.add(() => this.callbacks.onClose());
    this.contentStack.addControl(closeBtn);
  }

  public showPipeInfo(pipe: PipeTile): void {
    if (!this.contentStack || !this.panel) return;

    this.clearContent();

    const title = new TextBlock('title');
    title.text = `${pipe.pipeType.toUpperCase()} Pipe`;
    title.color = '#7FFF7F';
    title.fontSize = 14;
    title.fontWeight = 'bold';
    this.contentStack.addControl(title);

    const durability = new TextBlock('durability');
    durability.text = `Durability: ${pipe.durability.toFixed(0)}%`;
    durability.color = '#aaaaaa';
    durability.fontSize = 12;
    this.contentStack.addControl(durability);

    const pressure = new TextBlock('pressure');
    pressure.text = `Pressure: ${pipe.pressureLevel.toFixed(0)}%`;
    pressure.color = pipe.pressureLevel >= 80 ? '#7FFF7F' : pipe.pressureLevel >= 40 ? '#FFFF7F' : '#FF7F7F';
    pressure.fontSize = 12;
    this.contentStack.addControl(pressure);

    if (pipe.isLeaking) {
      const leak = new TextBlock('leak');
      leak.text = '⚠️ LEAKING';
      leak.color = '#FF7F7F';
      leak.fontSize = 12;
      this.contentStack.addControl(leak);

      if (this.callbacks.onRepair) {
        const repairBtn = Button.CreateSimpleButton('repairBtn', 'Repair Leak');
        repairBtn.height = '30px';
        repairBtn.onPointerUpObservable.add(() => {
          this.callbacks.onRepair!(pipe.gridX, pipe.gridY);
        });
        this.contentStack.addControl(repairBtn);
      }
    }

    this.panel.isVisible = true;
  }

  public showSprinklerInfo(head: SprinklerHead): void {
    if (!this.contentStack || !this.panel) return;

    this.clearContent();

    const title = new TextBlock('title');
    title.text = `${head.sprinklerType.toUpperCase()} Sprinkler`;
    title.color = '#7FFF7F';
    title.fontSize = 14;
    title.fontWeight = 'bold';
    this.contentStack.addControl(title);

    const status = new TextBlock('status');
    status.text = head.isActive ? 'Status: Active' : 'Status: Inactive';
    status.color = head.isActive ? '#7FFF7F' : '#aaaaaa';
    status.fontSize = 12;
    this.contentStack.addControl(status);

    const coverage = new TextBlock('coverage');
    coverage.text = `Coverage: ${head.coverageTiles.length} tiles`;
    coverage.color = '#aaaaaa';
    coverage.fontSize = 12;
    this.contentStack.addControl(coverage);

    this.panel.isVisible = true;
  }

  private clearContent(): void {
    if (!this.contentStack) return;

    const controls = this.contentStack.children.slice();
    for (const control of controls) {
      if (control.name !== 'closeBtn') {
        this.contentStack.removeControl(control);
      }
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

