import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { EditorTool } from '../../core/terrain-editor-logic';
import { TerrainType, getTerrainDisplayName } from '../../core/terrain';

export interface TerrainEditorUICallbacks {
  onToolSelect: (tool: EditorTool) => void;
  onClose: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBrushSizeChange: (delta: number) => void;
}

export class TerrainEditorUI {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: TerrainEditorUICallbacks;

  private panel: Rectangle | null = null;
  private toolButtons: Map<EditorTool, Rectangle> = new Map();
  private undoButton: Button | null = null;
  private redoButton: Button | null = null;
  private coordsText: TextBlock | null = null;
  private brushSizeText: TextBlock | null = null;

  private activeTool: EditorTool = 'raise';

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: TerrainEditorUICallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('terrainEditorPanel');
    this.panel.width = '340px';
    this.panel.height = '380px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 45, 35, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.left = '10px';
    this.panel.top = '10px';
    this.panel.isVisible = false;
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 10;
    this.panel.shadowOffsetX = 3;
    this.panel.shadowOffsetY = 3;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('editorStack');
    stack.paddingTop = '12px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    this.createHeader(stack);
    this.createElevationTools(stack);
    this.createTerrainBrushes(stack);
    this.createBrushSizeControl(stack);
    this.createActionButtons(stack);
    this.createStatusBar(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.height = '36px';
    headerContainer.width = '316px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer);

    const title = new TextBlock('editorTitle');
    title.text = 'TERRAIN EDITOR';
    title.color = '#7FFF7F';
    title.fontSize = 14;
    title.fontFamily = 'Arial, sans-serif';
    title.fontWeight = 'bold';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.left = '0px';
    headerContainer.addControl(title);

    const closeBtn = Button.CreateSimpleButton('closeBtn', 'X');
    closeBtn.width = '28px';
    closeBtn.height = '28px';
    closeBtn.color = '#ff8888';
    closeBtn.background = '#4a2a2a';
    closeBtn.cornerRadius = 4;
    closeBtn.thickness = 1;
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.onPointerUpObservable.add(() => this.callbacks.onClose());
    closeBtn.onPointerEnterObservable.add(() => { closeBtn.background = '#6a3a3a'; });
    closeBtn.onPointerOutObservable.add(() => { closeBtn.background = '#4a2a2a'; });
    headerContainer.addControl(closeBtn);

    const divider = new Rectangle('divider1');
    divider.height = '1px';
    divider.width = '316px';
    divider.background = '#3a5a4a';
    divider.thickness = 0;
    divider.paddingTop = '8px';
    parent.addControl(divider);
  }

  private createElevationTools(parent: StackPanel): void {
    const sectionLabel = new TextBlock('elevLabel');
    sectionLabel.text = 'ELEVATION';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '28px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '12px';
    parent.addControl(sectionLabel);

    const grid = new Grid('elevGrid');
    grid.height = '55px';
    grid.width = '316px';
    grid.addColumnDefinition(0.25);
    grid.addColumnDefinition(0.25);
    grid.addColumnDefinition(0.25);
    grid.addColumnDefinition(0.25);
    parent.addControl(grid);

    const tools: { tool: EditorTool; label: string; key: string }[] = [
      { tool: 'raise', label: 'Raise', key: '1' },
      { tool: 'lower', label: 'Lower', key: '2' },
      { tool: 'flatten', label: 'Flat', key: '3' },
      { tool: 'smooth', label: 'Smooth', key: '4' },
    ];

    tools.forEach((t, i) => {
      const btn = this.createToolButton(t.tool, t.label, t.key);
      grid.addControl(btn, 0, i);
    });
  }

  private createTerrainBrushes(parent: StackPanel): void {
    const sectionLabel = new TextBlock('terrainLabel');
    sectionLabel.text = 'TERRAIN TYPE';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '28px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    parent.addControl(sectionLabel);

    const grid = new Grid('terrainGrid');
    grid.height = '55px';
    grid.width = '316px';
    grid.addColumnDefinition(0.2);
    grid.addColumnDefinition(0.2);
    grid.addColumnDefinition(0.2);
    grid.addColumnDefinition(0.2);
    grid.addColumnDefinition(0.2);
    parent.addControl(grid);

    const brushes: { tool: EditorTool; label: string; key: string; color: string }[] = [
      { tool: 'terrain_fairway', label: 'Fairway', key: 'Q', color: '#5a9a5a' },
      { tool: 'terrain_rough', label: 'Rough', key: 'W', color: '#4a7a4a' },
      { tool: 'terrain_green', label: 'Green', key: 'E', color: '#4aca5a' },
      { tool: 'terrain_bunker', label: 'Bunker', key: 'R', color: '#c4a44a' },
      { tool: 'terrain_water', label: 'Water', key: 'F', color: '#4a7aca' },
    ];

    brushes.forEach((b, i) => {
      const btn = this.createToolButton(b.tool, b.label, b.key, b.color);
      grid.addControl(btn, 0, i);
    });
  }

  private createToolButton(tool: EditorTool, label: string, keyHint: string, accentColor?: string): Rectangle {
    const container = new Rectangle(`btn_${tool}`);
    container.width = '95%';
    container.height = '50px';
    container.cornerRadius = 6;
    container.background = '#1a3a2a';
    container.color = '#3a5a4a';
    container.thickness = 2;

    const stack = new StackPanel();
    stack.paddingTop = '4px';
    container.addControl(stack);

    const keyBadge = new TextBlock();
    keyBadge.text = keyHint;
    keyBadge.color = accentColor ?? '#6a9a7a';
    keyBadge.fontSize = 10;
    keyBadge.height = '14px';
    keyBadge.fontWeight = 'bold';
    stack.addControl(keyBadge);

    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = '#ccddcc';
    labelText.fontSize = 11;
    labelText.height = '16px';
    stack.addControl(labelText);

    container.onPointerEnterObservable.add(() => {
      if (this.activeTool !== tool) {
        container.background = '#2a4a3a';
        container.color = '#5a8a6a';
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeTool !== tool) {
        container.background = '#1a3a2a';
        container.color = '#3a5a4a';
      }
    });

    container.onPointerUpObservable.add(() => {
      this.callbacks.onToolSelect(tool);
    });

    this.toolButtons.set(tool, container);
    return container;
  }

  private createBrushSizeControl(parent: StackPanel): void {
    const sectionLabel = new TextBlock('brushLabel');
    sectionLabel.text = 'BRUSH SIZE';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '28px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    parent.addControl(sectionLabel);

    const grid = new Grid('brushGrid');
    grid.height = '36px';
    grid.width = '316px';
    grid.addColumnDefinition(0.3);
    grid.addColumnDefinition(0.4);
    grid.addColumnDefinition(0.3);
    parent.addControl(grid);

    const minusBtn = Button.CreateSimpleButton('brushMinus', '-');
    minusBtn.width = '40px';
    minusBtn.height = '32px';
    minusBtn.color = '#aaccaa';
    minusBtn.fontSize = 18;
    minusBtn.fontWeight = 'bold';
    minusBtn.background = '#1a3a2a';
    minusBtn.cornerRadius = 4;
    minusBtn.thickness = 1;
    minusBtn.onPointerUpObservable.add(() => this.callbacks.onBrushSizeChange(-1));
    minusBtn.onPointerEnterObservable.add(() => { minusBtn.background = '#2a4a3a'; });
    minusBtn.onPointerOutObservable.add(() => { minusBtn.background = '#1a3a2a'; });
    grid.addControl(minusBtn, 0, 0);

    this.brushSizeText = new TextBlock('brushSizeText');
    this.brushSizeText.text = '1';
    this.brushSizeText.color = '#7FFF7F';
    this.brushSizeText.fontSize = 18;
    this.brushSizeText.fontWeight = 'bold';
    grid.addControl(this.brushSizeText, 0, 1);

    const plusBtn = Button.CreateSimpleButton('brushPlus', '+');
    plusBtn.width = '40px';
    plusBtn.height = '32px';
    plusBtn.color = '#aaccaa';
    plusBtn.fontSize = 18;
    plusBtn.fontWeight = 'bold';
    plusBtn.background = '#1a3a2a';
    plusBtn.cornerRadius = 4;
    plusBtn.thickness = 1;
    plusBtn.onPointerUpObservable.add(() => this.callbacks.onBrushSizeChange(1));
    plusBtn.onPointerEnterObservable.add(() => { plusBtn.background = '#2a4a3a'; });
    plusBtn.onPointerOutObservable.add(() => { plusBtn.background = '#1a3a2a'; });
    grid.addControl(plusBtn, 0, 2);
  }

  private createActionButtons(parent: StackPanel): void {
    const divider = new Rectangle('divider2');
    divider.height = '1px';
    divider.width = '316px';
    divider.background = '#3a5a4a';
    divider.thickness = 0;
    divider.paddingTop = '12px';
    parent.addControl(divider);

    const grid = new Grid('actionGrid');
    grid.height = '44px';
    grid.width = '316px';
    grid.paddingTop = '12px';
    grid.addColumnDefinition(0.3);
    grid.addColumnDefinition(0.3);
    grid.addColumnDefinition(0.4);
    parent.addControl(grid);

    this.undoButton = Button.CreateSimpleButton('undoBtn', 'Undo');
    this.undoButton.width = '68px';
    this.undoButton.height = '32px';
    this.undoButton.color = '#aaccaa';
    this.undoButton.fontSize = 12;
    this.undoButton.background = '#1a3a2a';
    this.undoButton.cornerRadius = 4;
    this.undoButton.thickness = 1;
    this.undoButton.onPointerUpObservable.add(() => this.callbacks.onUndo());
    this.undoButton.onPointerEnterObservable.add(() => { if (this.undoButton) this.undoButton.background = '#2a4a3a'; });
    this.undoButton.onPointerOutObservable.add(() => { if (this.undoButton) this.undoButton.background = '#1a3a2a'; });
    grid.addControl(this.undoButton, 0, 0);

    this.redoButton = Button.CreateSimpleButton('redoBtn', 'Redo');
    this.redoButton.width = '68px';
    this.redoButton.height = '32px';
    this.redoButton.color = '#aaccaa';
    this.redoButton.fontSize = 12;
    this.redoButton.background = '#1a3a2a';
    this.redoButton.cornerRadius = 4;
    this.redoButton.thickness = 1;
    this.redoButton.onPointerUpObservable.add(() => this.callbacks.onRedo());
    this.redoButton.onPointerEnterObservable.add(() => { if (this.redoButton) this.redoButton.background = '#2a4a3a'; });
    this.redoButton.onPointerOutObservable.add(() => { if (this.redoButton) this.redoButton.background = '#1a3a2a'; });
    grid.addControl(this.redoButton, 0, 1);

    const exportBtn = Button.CreateSimpleButton('exportBtn', 'Export');
    exportBtn.width = '90px';
    exportBtn.height = '32px';
    exportBtn.color = '#ccffcc';
    exportBtn.fontSize = 12;
    exportBtn.fontWeight = 'bold';
    exportBtn.background = '#2a5a3a';
    exportBtn.cornerRadius = 4;
    exportBtn.thickness = 1;
    exportBtn.onPointerUpObservable.add(() => this.callbacks.onExport());
    exportBtn.onPointerEnterObservable.add(() => { exportBtn.background = '#3a6a4a'; });
    exportBtn.onPointerOutObservable.add(() => { exportBtn.background = '#2a5a3a'; });
    grid.addControl(exportBtn, 0, 2);
  }

  private createStatusBar(parent: StackPanel): void {
    const container = new Rectangle('statusContainer');
    container.height = '36px';
    container.width = '316px';
    container.background = '#0a1a10';
    container.cornerRadius = 4;
    container.thickness = 0;
    container.paddingTop = '12px';
    parent.addControl(container);

    this.coordsText = new TextBlock('coordsText');
    this.coordsText.text = 'Press T to toggle editor';
    this.coordsText.color = '#6a9a7a';
    this.coordsText.fontSize = 12;
    this.coordsText.fontFamily = 'monospace';
    container.addControl(this.coordsText);
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

  public setActiveTool(tool: EditorTool): void {
    for (const [t, btn] of this.toolButtons) {
      if (t === tool) {
        btn.background = '#2a6a4a';
        btn.color = '#7FFF7F';
      } else {
        btn.background = '#1a3a2a';
        btn.color = '#3a5a4a';
      }
    }
    this.activeTool = tool;
  }

  public setUndoEnabled(enabled: boolean): void {
    if (this.undoButton) {
      this.undoButton.alpha = enabled ? 1.0 : 0.4;
      this.undoButton.isEnabled = enabled;
    }
  }

  public setRedoEnabled(enabled: boolean): void {
    if (this.redoButton) {
      this.redoButton.alpha = enabled ? 1.0 : 0.4;
      this.redoButton.isEnabled = enabled;
    }
  }

  public setBrushSize(size: number): void {
    if (this.brushSizeText) {
      this.brushSizeText.text = size.toString();
    }
  }

  public updateCoordinates(x: number, y: number, elevation: number, type: TerrainType): void {
    if (this.coordsText) {
      this.coordsText.text = `(${x}, ${y})  Elev: ${elevation}  ${getTerrainDisplayName(type)}`;
    }
  }

  public clearCoordinates(): void {
    if (this.coordsText) {
      this.coordsText.text = 'Hover over terrain';
    }
  }

  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
    this.toolButtons.clear();
  }
}
