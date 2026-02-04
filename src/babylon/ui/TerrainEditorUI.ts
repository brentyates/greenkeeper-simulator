import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { EditorTool, EditorMode, TopologyMode, isSculptTool, isTerrainBrush } from '../../core/terrain-editor-logic';
import { TerrainType, getTerrainDisplayName } from '../../core/terrain';

export type AxisConstraint = 'x' | 'y' | 'z' | 'xz' | 'all';

export interface TerrainEditorUICallbacks {
  onToolSelect: (tool: EditorTool) => void;
  onModeChange: (mode: EditorMode) => void;
  onClose: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBrushSizeChange: (delta: number) => void;
  onBrushStrengthChange?: (strength: number) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onAxisChange?: (axis: AxisConstraint) => void;
  onMoveBy?: (dx: number, dy: number, dz: number) => void;
  onTopologyModeChange?: (mode: TopologyMode) => void;
  onDeleteVertex?: () => void;
  onSplitEdge?: () => void;
  onFlipEdge?: () => void;
  onCollapseEdge?: () => void;
}

export class TerrainEditorUI {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: TerrainEditorUICallbacks;

  private panel: Rectangle | null = null;
  private toolButtons: Map<EditorTool, Rectangle> = new Map();
  private modeButtons: Map<EditorMode, Rectangle> = new Map();
  private axisButtons: Map<AxisConstraint, Rectangle> = new Map();
  private undoButton: Button | null = null;
  private redoButton: Button | null = null;
  private coordsText: TextBlock | null = null;
  private brushSizeText: TextBlock | null = null;
  private brushStrengthText: TextBlock | null = null;
  private selectionCountText: TextBlock | null = null;
  private vertexPosText: TextBlock | null = null;

  private activeTool: EditorTool = 'terrain_fairway';
  private activeMode: EditorMode = 'sculpt';
  private activeAxis: AxisConstraint = 'xz';
  private activeTopologyMode: TopologyMode = 'vertex';
  private topologyButtons: Map<TopologyMode, Rectangle> = new Map();
  private topologyStatusText: TextBlock | null = null;
  private sculptToolsPanel: StackPanel | null = null;
  private paintToolsPanel: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: TerrainEditorUICallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('terrainEditorPanel');
    this.panel.width = '360px';
    this.panel.height = '720px';
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
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 10;
    this.panel.shadowOffsetX = 3;
    this.panel.shadowOffsetY = 3;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('editorStack');
    stack.width = '316px';
    stack.paddingTop = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    this.createHeader(stack);
    this.createModeToggle(stack);
    this.createSculptTools(stack);
    this.createTerrainBrushes(stack);
    this.createBrushSizeControl(stack);
    this.createBrushStrengthControl(stack);
    this.createTopologySection(stack);
    this.createSelectionSection(stack);
    this.createTransformSection(stack);
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

  private createModeToggle(parent: StackPanel): void {
    const grid = new Grid('modeGrid');
    grid.height = '40px';
    grid.width = '316px';
    grid.paddingTop = '8px';
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    parent.addControl(grid);

    const sculptBtn = this.createModeButton('sculpt', 'SCULPT');
    grid.addControl(sculptBtn, 0, 0);

    const paintBtn = this.createModeButton('paint', 'PAINT');
    grid.addControl(paintBtn, 0, 1);

    this.updateModeButtonStyles();
  }

  private createModeButton(mode: EditorMode, label: string): Rectangle {
    const container = new Rectangle(`mode_${mode}`);
    container.width = '95%';
    container.height = '32px';
    container.cornerRadius = 4;
    container.background = '#1a3a2a';
    container.color = '#3a5a4a';
    container.thickness = 2;

    const text = new TextBlock();
    text.text = label;
    text.color = '#aaccaa';
    text.fontSize = 12;
    text.fontWeight = 'bold';
    container.addControl(text);

    container.onPointerEnterObservable.add(() => {
      if (this.activeMode !== mode) {
        container.background = '#2a4a3a';
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeMode !== mode) {
        container.background = '#1a3a2a';
      }
    });

    container.onPointerUpObservable.add(() => {
      this.setMode(mode);
      this.callbacks.onModeChange(mode);
    });

    this.modeButtons.set(mode, container);
    return container;
  }

  public setMode(mode: EditorMode): void {
    this.activeMode = mode;
    this.updateModeButtonStyles();
    
    if (this.sculptToolsPanel) this.sculptToolsPanel.isVisible = (mode === 'sculpt');
    if (this.paintToolsPanel) this.paintToolsPanel.isVisible = (mode === 'paint');
    
    // Auto-select first tool in mode if current tool is incompatible
    if (mode === 'sculpt' && !isSculptTool(this.activeTool)) {
      this.callbacks.onToolSelect('raise');
    } else if (mode === 'paint' && !isTerrainBrush(this.activeTool)) {
      this.callbacks.onToolSelect('terrain_fairway');
    }
  }

  private updateModeButtonStyles(): void {
    for (const [mode, btn] of this.modeButtons) {
      const text = btn.children[0] as TextBlock;
      if (mode === this.activeMode) {
        btn.background = '#2a6a4a';
        btn.color = '#7FFF7F';
        if (text) text.color = '#7FFF7F';
      } else {
        btn.background = '#1a3a2a';
        btn.color = '#3a5a4a';
        if (text) text.color = '#aaccaa';
      }
    }
  }

  private createSculptTools(parent: StackPanel): void {
    this.sculptToolsPanel = new StackPanel('sculptToolsPanel');
    this.sculptToolsPanel.width = '316px';
    this.sculptToolsPanel.isVisible = (this.activeMode === 'sculpt');
    parent.addControl(this.sculptToolsPanel);

    const sectionLabel = new TextBlock('sculptLabel');
    sectionLabel.text = 'SCULPT TOOLS';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '28px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    this.sculptToolsPanel.addControl(sectionLabel);

    const grid = new Grid('sculptGrid');
    grid.height = '55px';
    grid.width = '316px';
    grid.addColumnDefinition(1 / 4);
    grid.addColumnDefinition(1 / 4);
    grid.addColumnDefinition(1 / 4);
    grid.addColumnDefinition(1 / 4);
    this.sculptToolsPanel.addControl(grid);

    const tools: { tool: EditorTool; label: string; key: string; color: string }[] = [
      { tool: 'raise', label: 'Raise', key: '1', color: '#7FFF7F' },
      { tool: 'lower', label: 'Lower', key: '2', color: '#FF7F7F' },
      { tool: 'smooth', label: 'Smooth', key: '3', color: '#7F7FFF' },
      { tool: 'flatten', label: 'Flatten', key: '4', color: '#FFFF7F' },
    ];

    tools.forEach((t, i) => {
      const btn = this.createToolButton(t.tool, t.label, t.key, t.color);
      grid.addControl(btn, 0, i);
    });
  }

  private createTerrainBrushes(parent: StackPanel): void {
    this.paintToolsPanel = new StackPanel('paintToolsPanel');
    this.paintToolsPanel.width = '316px';
    this.paintToolsPanel.isVisible = (this.activeMode === 'paint');
    parent.addControl(this.paintToolsPanel);

    const sectionLabel = new TextBlock('terrainLabel');
    sectionLabel.text = 'TERRAIN TYPE';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '28px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    this.paintToolsPanel.addControl(sectionLabel);

    const grid = new Grid('terrainGrid');
    grid.height = '55px';
    grid.width = '316px';
    grid.addColumnDefinition(1 / 6);
    grid.addColumnDefinition(1 / 6);
    grid.addColumnDefinition(1 / 6);
    grid.addColumnDefinition(1 / 6);
    grid.addColumnDefinition(1 / 6);
    grid.addColumnDefinition(1 / 6);
    this.paintToolsPanel.addControl(grid);

    const brushes: { tool: EditorTool; label: string; key: string; color: string }[] = [
      { tool: 'terrain_fairway', label: 'Fairway', key: 'Q', color: '#5a9a5a' },
      { tool: 'terrain_rough', label: 'Rough', key: 'W', color: '#4a7a4a' },
      { tool: 'terrain_green', label: 'Green', key: 'E', color: '#4aca5a' },
      { tool: 'terrain_bunker', label: 'Bunker', key: 'R', color: '#c4a44a' },
      { tool: 'terrain_water', label: 'Water', key: 'F', color: '#4a7aca' },
      { tool: 'terrain_tee', label: 'Tee', key: 'T', color: '#7a9a7a' },
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

  private createBrushStrengthControl(parent: StackPanel): void {
    const sectionLabel = new TextBlock('strengthLabel');
    sectionLabel.text = 'BRUSH STRENGTH';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '28px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    parent.addControl(sectionLabel);

    const grid = new Grid('strengthGrid');
    grid.height = '36px';
    grid.width = '316px';
    grid.addColumnDefinition(0.3);
    grid.addColumnDefinition(0.4);
    grid.addColumnDefinition(0.3);
    parent.addControl(grid);

    const minusBtn = Button.CreateSimpleButton('strengthMinus', '-');
    minusBtn.width = '40px';
    minusBtn.height = '32px';
    minusBtn.color = '#aaccaa';
    minusBtn.fontSize = 18;
    minusBtn.fontWeight = 'bold';
    minusBtn.background = '#1a3a2a';
    minusBtn.cornerRadius = 4;
    minusBtn.thickness = 1;
    minusBtn.onPointerUpObservable.add(() => {
        const current = parseFloat(this.brushStrengthText?.text ?? "1.0");
        this.callbacks.onBrushStrengthChange?.(Math.max(0.1, current - 0.1));
    });
    minusBtn.onPointerEnterObservable.add(() => { minusBtn.background = '#2a4a3a'; });
    minusBtn.onPointerOutObservable.add(() => { minusBtn.background = '#1a3a2a'; });
    grid.addControl(minusBtn, 0, 0);

    this.brushStrengthText = new TextBlock('brushStrengthText');
    this.brushStrengthText.text = '1.0';
    this.brushStrengthText.color = '#7FFF7F';
    this.brushStrengthText.fontSize = 18;
    this.brushStrengthText.fontWeight = 'bold';
    grid.addControl(this.brushStrengthText, 0, 1);

    const plusBtn = Button.CreateSimpleButton('strengthPlus', '+');
    plusBtn.width = '40px';
    plusBtn.height = '32px';
    plusBtn.color = '#aaccaa';
    plusBtn.fontSize = 18;
    plusBtn.fontWeight = 'bold';
    plusBtn.background = '#1a3a2a';
    plusBtn.cornerRadius = 4;
    plusBtn.thickness = 1;
    plusBtn.onPointerUpObservable.add(() => {
        const current = parseFloat(this.brushStrengthText?.text ?? "1.0");
        this.callbacks.onBrushStrengthChange?.(Math.min(5.0, current + 0.1));
    });
    plusBtn.onPointerEnterObservable.add(() => { plusBtn.background = '#2a4a3a'; });
    plusBtn.onPointerOutObservable.add(() => { plusBtn.background = '#1a3a2a'; });
    grid.addControl(plusBtn, 0, 2);
  }

  private createTopologySection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('topologyLabel');
    sectionLabel.text = 'TOPOLOGY MODE';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '4px';
    parent.addControl(sectionLabel);

    const grid = new Grid('topologyGrid');
    grid.height = '64px';
    grid.width = '316px';
    grid.addRowDefinition(0.5);
    grid.addRowDefinition(0.5);
    grid.addColumnDefinition(0.33);
    grid.addColumnDefinition(0.33);
    grid.addColumnDefinition(0.33);
    parent.addControl(grid);

    // Row 1: Topology Modes
    const vertexBtn = this.createTopologyButton('vertex', 'Vertex (V)', '#6a9a7a');
    grid.addControl(vertexBtn, 0, 0);

    const edgeBtn = this.createTopologyButton('edge', 'Edge (E)', '#00cccc');
    grid.addControl(edgeBtn, 0, 1);

    const faceBtn = this.createTopologyButton('face', 'Face', '#ffcc44');
    grid.addControl(faceBtn, 0, 2);

    // Row 2: Topology Actions
    const splitBtn = Button.CreateSimpleButton('splitEdgeBtn', 'Split');
    splitBtn.width = '90%';
    splitBtn.height = '24px';
    splitBtn.color = '#aaccaa';
    splitBtn.fontSize = 10;
    splitBtn.background = '#1a3a2a';
    splitBtn.cornerRadius = 4;
    splitBtn.thickness = 1;
    splitBtn.onPointerUpObservable.add(() => this.callbacks.onSplitEdge?.());
    grid.addControl(splitBtn, 1, 0);

    const flipBtn = Button.CreateSimpleButton('flipEdgeBtn', 'Flip');
    flipBtn.width = '90%';
    flipBtn.height = '24px';
    flipBtn.color = '#aaccaa';
    flipBtn.fontSize = 10;
    flipBtn.background = '#1a3a2a';
    flipBtn.cornerRadius = 4;
    flipBtn.thickness = 1;
    flipBtn.onPointerUpObservable.add(() => this.callbacks.onFlipEdge?.());
    grid.addControl(flipBtn, 1, 1);

    const deleteBtn = Button.CreateSimpleButton('deleteVertexBtn', 'Delete');
    deleteBtn.width = '90%';
    deleteBtn.height = '24px';
    deleteBtn.color = '#ff8888';
    deleteBtn.fontSize = 10;
    deleteBtn.background = '#1a3a2a';
    deleteBtn.cornerRadius = 4;
    deleteBtn.thickness = 1;
    deleteBtn.onPointerUpObservable.add(() => {
        if (this.activeTopologyMode === 'edge') {
            this.callbacks.onCollapseEdge?.();
        } else {
            this.callbacks.onDeleteVertex?.();
        }
    });
    grid.addControl(deleteBtn, 1, 2);

    this.topologyStatusText = new TextBlock('topologyStatus');
    this.topologyStatusText.text = 'Vertex Mode';
    this.topologyStatusText.color = '#6a9a7a';
    this.topologyStatusText.fontSize = 10;
    this.topologyStatusText.height = '18px';
    this.topologyStatusText.paddingTop = '2px';
    parent.addControl(this.topologyStatusText);
    
    this.updateTopologyModeStyles();
  }

  private createTopologyButton(mode: TopologyMode, label: string, accentColor: string): Rectangle {
    const container = new Rectangle(`topology_${mode}`);
    container.width = '95%';
    container.height = '28px';
    container.cornerRadius = 4;
    container.background = '#1a3a2a';
    container.color = '#3a5a4a';
    container.thickness = 2;
    container.metadata = { accentColor };

    const text = new TextBlock();
    text.text = label;
    text.color = '#aaccaa';
    text.fontSize = 11;
    text.fontWeight = 'bold';
    container.addControl(text);

    container.onPointerEnterObservable.add(() => {
      if (this.activeTopologyMode !== mode) {
        container.background = '#2a4a3a';
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeTopologyMode !== mode) {
        container.background = '#1a3a2a';
      }
    });

    container.onPointerUpObservable.add(() => {
      this.callbacks.onTopologyModeChange?.(mode);
    });

    this.topologyButtons.set(mode, container);
    return container;
  }

  private updateTopologyModeStyles(): void {
    for (const [mode, btn] of this.topologyButtons) {
      const text = btn.children[0] as TextBlock;
      const accent = btn.metadata?.accentColor ?? '#7FFF7F';

      if (mode === this.activeTopologyMode) {
        btn.background = '#2a6a4a';
        btn.color = accent;
        if (text) text.color = accent;
      } else {
        btn.background = '#1a3a2a';
        btn.color = '#3a5a4a';
        if (text) text.color = '#aaccaa';
      }
    }

    if (this.topologyStatusText) {
       let status = 'Vertex Mode';
       if (this.activeTopologyMode === 'edge') status = 'Click edge to select (Shift+Click to toggle)';
       if (this.activeTopologyMode === 'face') status = 'Click face to select (Shift+Click to toggle)';
       this.topologyStatusText.text = status;
       
       const activeBtn = this.topologyButtons.get(this.activeTopologyMode);
       this.topologyStatusText.color = activeBtn?.metadata?.accentColor ?? '#6a9a7a';
    }
  }

  private createSelectionSection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('selectionLabel');
    sectionLabel.text = 'SELECTION';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '4px';
    parent.addControl(sectionLabel);

    const grid = new Grid('selectionGrid');
    grid.height = '36px';
    grid.width = '316px';
    grid.addColumnDefinition(0.35);
    grid.addColumnDefinition(0.35);
    grid.addColumnDefinition(0.3);
    parent.addControl(grid);

    const selectAllBtn = Button.CreateSimpleButton('selectAllBtn', 'Select All');
    selectAllBtn.width = '90%';
    selectAllBtn.height = '28px';
    selectAllBtn.color = '#aaccaa';
    selectAllBtn.fontSize = 11;
    selectAllBtn.background = '#1a3a2a';
    selectAllBtn.cornerRadius = 4;
    selectAllBtn.thickness = 1;
    selectAllBtn.onPointerUpObservable.add(() => this.callbacks.onSelectAll?.());
    selectAllBtn.onPointerEnterObservable.add(() => { selectAllBtn.background = '#2a4a3a'; });
    selectAllBtn.onPointerOutObservable.add(() => { selectAllBtn.background = '#1a3a2a'; });
    grid.addControl(selectAllBtn, 0, 0);

    const deselectBtn = Button.CreateSimpleButton('deselectBtn', 'Deselect');
    deselectBtn.width = '90%';
    deselectBtn.height = '28px';
    deselectBtn.color = '#aaccaa';
    deselectBtn.fontSize = 11;
    deselectBtn.background = '#1a3a2a';
    deselectBtn.cornerRadius = 4;
    deselectBtn.thickness = 1;
    deselectBtn.onPointerUpObservable.add(() => this.callbacks.onDeselectAll?.());
    deselectBtn.onPointerEnterObservable.add(() => { deselectBtn.background = '#2a4a3a'; });
    deselectBtn.onPointerOutObservable.add(() => { deselectBtn.background = '#1a3a2a'; });
    grid.addControl(deselectBtn, 0, 1);

    this.selectionCountText = new TextBlock('selCountText');
    this.selectionCountText.text = '0 sel';
    this.selectionCountText.color = '#7FFF7F';
    this.selectionCountText.fontSize = 12;
    this.selectionCountText.fontWeight = 'bold';
    grid.addControl(this.selectionCountText, 0, 2);
  }

  private createTransformSection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('constraintLabel');
    sectionLabel.text = 'MOVEMENT CONSTRAINT';
    sectionLabel.color = '#8aba9a';
    sectionLabel.fontSize = 11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '6px';
    parent.addControl(sectionLabel);

    const axisGrid = new Grid('axisGrid');
    axisGrid.height = '32px';
    axisGrid.width = '316px';
    axisGrid.addColumnDefinition(0.25);
    axisGrid.addColumnDefinition(0.25);
    axisGrid.addColumnDefinition(0.25);
    axisGrid.addColumnDefinition(0.25);
    parent.addControl(axisGrid);

    // User-friendly labels instead of X/Y/Z
    const axes: { axis: AxisConstraint; label: string; color: string }[] = [
      { axis: 'y', label: 'Elev', color: '#44cc44' },      // Green for vertical
      { axis: 'x', label: 'E/W', color: '#cc4444' },       // Red for X axis
      { axis: 'z', label: 'N/S', color: '#4444cc' },       // Blue for Z axis
      { axis: 'xz', label: 'Horiz', color: '#cccc44' },    // Yellow for horizontal plane
    ];

    axes.forEach((a, i) => {
      const btn = this.createAxisButton(a.axis, a.label, a.color);
      axisGrid.addControl(btn, 0, i);
    });

    this.updateAxisButtonStyles();

    // Quick movement buttons
    this.createMovementButtons(parent);

    this.vertexPosText = new TextBlock('vertexPosText');
    this.vertexPosText.text = 'No selection';
    this.vertexPosText.color = '#aaccaa';
    this.vertexPosText.fontSize = 11;
    this.vertexPosText.height = '24px';
    this.vertexPosText.paddingTop = '4px';
    parent.addControl(this.vertexPosText);
  }

  private createMovementButtons(parent: StackPanel): void {
    const moveLabel = new TextBlock('moveLabel');
    moveLabel.text = 'QUICK MOVE';
    moveLabel.color = '#8aba9a';
    moveLabel.fontSize = 11;
    moveLabel.height = '24px';
    moveLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    moveLabel.paddingTop = '6px';
    parent.addControl(moveLabel);

    const moveGrid = new Grid('moveGrid');
    moveGrid.height = '70px';
    moveGrid.width = '316px';
    moveGrid.addRowDefinition(0.5);
    moveGrid.addRowDefinition(0.5);
    moveGrid.addColumnDefinition(0.25);
    moveGrid.addColumnDefinition(0.25);
    moveGrid.addColumnDefinition(0.25);
    moveGrid.addColumnDefinition(0.25);
    parent.addControl(moveGrid);

    // Row 1: Raise, North, Lower
    const raiseBtn = this.createMoveButton('Raise', '#44cc44', () => this.callbacks.onMoveBy?.(0, 1, 0));
    moveGrid.addControl(raiseBtn, 0, 0);

    const northBtn = this.createMoveButton('North', '#4444cc', () => this.callbacks.onMoveBy?.(0, 0, -1));
    moveGrid.addControl(northBtn, 0, 1);

    const lowerBtn = this.createMoveButton('Lower', '#44cc44', () => this.callbacks.onMoveBy?.(0, -1, 0));
    moveGrid.addControl(lowerBtn, 0, 2);

    // Placeholder for symmetry
    const emptySpace = new Rectangle('emptySpace');
    emptySpace.thickness = 0;
    emptySpace.background = 'transparent';
    moveGrid.addControl(emptySpace, 0, 3);

    // Row 2: West, South, East
    const westBtn = this.createMoveButton('West', '#cc4444', () => this.callbacks.onMoveBy?.(-1, 0, 0));
    moveGrid.addControl(westBtn, 1, 0);

    const southBtn = this.createMoveButton('South', '#4444cc', () => this.callbacks.onMoveBy?.(0, 0, 1));
    moveGrid.addControl(southBtn, 1, 1);

    const eastBtn = this.createMoveButton('East', '#cc4444', () => this.callbacks.onMoveBy?.(1, 0, 0));
    moveGrid.addControl(eastBtn, 1, 2);
  }

  private createMoveButton(label: string, accentColor: string, onClick: () => void): Button {
    const btn = Button.CreateSimpleButton(`move_${label}`, label);
    btn.width = '90%';
    btn.height = '28px';
    btn.color = accentColor;
    btn.fontSize = 10;
    btn.fontWeight = 'bold';
    btn.background = '#1a3a2a';
    btn.cornerRadius = 4;
    btn.thickness = 1;
    btn.onPointerUpObservable.add(onClick);
    btn.onPointerEnterObservable.add(() => { btn.background = '#2a4a3a'; });
    btn.onPointerOutObservable.add(() => { btn.background = '#1a3a2a'; });
    return btn;
  }

  private createAxisButton(axis: AxisConstraint, label: string, accentColor?: string): Rectangle {
    const container = new Rectangle(`axis_${axis}`);
    container.width = '90%';
    container.height = '28px';
    container.cornerRadius = 4;
    container.background = '#1a3a2a';
    container.color = '#3a5a4a';
    container.thickness = 2;
    container.metadata = { accentColor: accentColor ?? '#aaccaa' };

    const text = new TextBlock();
    text.text = label;
    text.color = accentColor ?? '#aaccaa';
    text.fontSize = 11;
    text.fontWeight = 'bold';
    container.addControl(text);

    container.onPointerEnterObservable.add(() => {
      if (this.activeAxis !== axis) {
        container.background = '#2a4a3a';
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeAxis !== axis) {
        container.background = '#1a3a2a';
      }
    });

    container.onPointerUpObservable.add(() => {
      this.callbacks.onAxisChange?.(axis);
    });

    this.axisButtons.set(axis, container);
    return container;
  }

  private updateAxisButtonStyles(): void {
    for (const [axis, btn] of this.axisButtons) {
      const text = btn.children[0] as TextBlock;
      if (axis === this.activeAxis) {
        btn.background = '#2a6a4a';
        btn.color = '#7FFF7F';
        if (text) text.color = '#7FFF7F';
      } else {
        btn.background = '#1a3a2a';
        btn.color = '#3a5a4a';
        if (text) text.color = '#aaccaa';
      }
    }
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

  public setActiveMode(mode: EditorMode): void {
    this.activeMode = mode;
    this.updateModeButtonStyles();
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

  public setBrushStrength(strength: number): void {
    if (this.brushStrengthText) {
      this.brushStrengthText.text = strength.toFixed(1);
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

  public setSelectionCount(count: number): void {
    if (this.selectionCountText) {
      this.selectionCountText.text = count === 1 ? '1 sel' : `${count} sel`;
      this.selectionCountText.color = count > 0 ? '#7FFF7F' : '#6a9a7a';
    }
  }

  public setActiveAxis(axis: AxisConstraint): void {
    this.activeAxis = axis;
    this.updateAxisButtonStyles();
  }

  public updateVertexPosition(x: number | null, y: number | null, z: number | null): void {
    if (this.vertexPosText) {
      if (x === null && y === null && z === null) {
        this.vertexPosText.text = 'No selection';
      } else {
        // User-friendly labels: E/W for X, Elev for Y, N/S for Z
        const ewStr = x !== null ? x.toFixed(2) : '-';
        const elevStr = y !== null ? y.toFixed(2) : '-';
        const nsStr = z !== null ? z.toFixed(2) : '-';
        this.vertexPosText.text = `E/W: ${ewStr}  Elev: ${elevStr}  N/S: ${nsStr}`;
      }
    }
  }

  public clearVertexPosition(): void {
    if (this.vertexPosText) {
      this.vertexPosText.text = 'No selection';
    }
  }

  public setTopologyMode(mode: TopologyMode): void {
    this.activeTopologyMode = mode;
    this.updateTopologyModeStyles();
  }

  public setActiveTopologyMode(mode: TopologyMode): void {
    this.activeTopologyMode = mode;
    this.updateTopologyModeStyles();
  }


  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
    this.toolButtons.clear();
    this.modeButtons.clear();
    this.axisButtons.clear();
  }
}
