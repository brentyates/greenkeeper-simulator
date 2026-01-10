/**
 * IrrigationToolbar - UI for placing pipes and sprinkler heads
 */

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { PipeType, SprinklerType } from '../../core/irrigation';

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

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: IrrigationToolbarCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('irrigationToolbarPanel');
    this.panel.width = '300px';
    this.panel.height = '200px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 45, 35, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.left = '10px';
    this.panel.top = '10px';
    this.panel.isVisible = false;
    this.panel.isPointerBlocker = true;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('toolbarStack');
    stack.width = '280px';
    stack.paddingTop = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    const title = new TextBlock('toolbarTitle');
    title.text = 'IRRIGATION TOOLBAR';
    title.color = '#7FFF7F';
    title.fontSize = 14;
    title.fontWeight = 'bold';
    title.height = '20px';
    stack.addControl(title);

    const toolRow = new StackPanel('toolRow');
    toolRow.isVertical = false;
    toolRow.height = '40px';
    stack.addControl(toolRow);

    const pipeBtn = Button.CreateSimpleButton('pipeBtn', 'Pipe');
    pipeBtn.width = '60px';
    pipeBtn.height = '30px';
    pipeBtn.onPointerUpObservable.add(() => {
      this.activeTool = this.activeTool === 'pipe' ? null : 'pipe';
      this.callbacks.onToolSelect(this.activeTool);
      this.updateButtonStates();
    });
    toolRow.addControl(pipeBtn);

    const sprinklerBtn = Button.CreateSimpleButton('sprinklerBtn', 'Sprinkler');
    sprinklerBtn.width = '70px';
    sprinklerBtn.height = '30px';
    sprinklerBtn.onPointerUpObservable.add(() => {
      this.activeTool = this.activeTool === 'sprinkler' ? null : 'sprinkler';
      this.callbacks.onToolSelect(this.activeTool);
      this.updateButtonStates();
    });
    toolRow.addControl(sprinklerBtn);

    const deleteBtn = Button.CreateSimpleButton('deleteBtn', 'Delete');
    deleteBtn.width = '60px';
    deleteBtn.height = '30px';
    deleteBtn.onPointerUpObservable.add(() => {
      this.activeTool = this.activeTool === 'delete' ? null : 'delete';
      this.callbacks.onToolSelect(this.activeTool);
      this.updateButtonStates();
    });
    toolRow.addControl(deleteBtn);

    const closeBtn = Button.CreateSimpleButton('closeBtn', 'X');
    closeBtn.width = '30px';
    closeBtn.height = '30px';
    closeBtn.onPointerUpObservable.add(() => this.callbacks.onClose());
    toolRow.addControl(closeBtn);

    const pipeTypeRow = new StackPanel('pipeTypeRow');
    pipeTypeRow.isVertical = false;
    pipeTypeRow.height = '30px';
    stack.addControl(pipeTypeRow);

    const pvcBtn = Button.CreateSimpleButton('pvcBtn', 'PVC');
    pvcBtn.width = '50px';
    pvcBtn.height = '25px';
    pvcBtn.onPointerUpObservable.add(() => {
      this.selectedPipeType = 'pvc';
      this.callbacks.onPipeTypeSelect(this.selectedPipeType);
    });
    pipeTypeRow.addControl(pvcBtn);

    const metalBtn = Button.CreateSimpleButton('metalBtn', 'Metal');
    metalBtn.width = '60px';
    metalBtn.height = '25px';
    metalBtn.onPointerUpObservable.add(() => {
      this.selectedPipeType = 'metal';
      this.callbacks.onPipeTypeSelect(this.selectedPipeType);
    });
    pipeTypeRow.addControl(metalBtn);

    const industrialBtn = Button.CreateSimpleButton('industrialBtn', 'Industrial');
    industrialBtn.width = '80px';
    industrialBtn.height = '25px';
    industrialBtn.onPointerUpObservable.add(() => {
      this.selectedPipeType = 'industrial';
      this.callbacks.onPipeTypeSelect(this.selectedPipeType);
    });
    pipeTypeRow.addControl(industrialBtn);

    const sprinklerTypeRow = new StackPanel('sprinklerTypeRow');
    sprinklerTypeRow.isVertical = false;
    sprinklerTypeRow.height = '30px';
    stack.addControl(sprinklerTypeRow);

    const fixedBtn = Button.CreateSimpleButton('fixedBtn', 'Fixed');
    fixedBtn.width = '50px';
    fixedBtn.height = '25px';
    fixedBtn.onPointerUpObservable.add(() => {
      this.selectedSprinklerType = 'fixed';
      this.callbacks.onSprinklerTypeSelect(this.selectedSprinklerType);
    });
    sprinklerTypeRow.addControl(fixedBtn);

    const rotaryBtn = Button.CreateSimpleButton('rotaryBtn', 'Rotary');
    rotaryBtn.width = '60px';
    rotaryBtn.height = '25px';
    rotaryBtn.onPointerUpObservable.add(() => {
      this.selectedSprinklerType = 'rotary';
      this.callbacks.onSprinklerTypeSelect(this.selectedSprinklerType);
    });
    sprinklerTypeRow.addControl(rotaryBtn);
  }

  private updateButtonStates(): void {
    // Button state updates would go here
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

