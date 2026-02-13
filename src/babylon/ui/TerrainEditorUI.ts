import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Slider } from '@babylonjs/gui/2D/controls/sliders/slider';

import { UIParent } from './UIParent';
import { createActionButton, createDockedPanel, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { UI_THEME } from './UITheme';
import { EditorTool, EditorMode, TopologyMode, InteractionMode, isSculptTool, isTerrainBrush } from '../../core/terrain-editor-logic';
import { degreesToRadians } from '../../core/transform-ops';
import { BUILT_IN_TEMPLATES } from '../../data/shape-templates';
import { TerrainType } from '../../core/terrain';

export type AxisConstraint = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';

export interface TerrainEditorUICallbacks {
  onToolSelect: (tool: EditorTool) => void;
  onModeChange: (mode: EditorMode) => void;
  onClose: () => void;
  onBrushSizeChange: (size: number) => void;
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
  onInteractionModeChange?: (mode: InteractionMode) => void;
  onRotateBy?: (ax: number, ay: number, az: number) => void;
  onTemplateSelect?: (templateName: string) => void;
  onStampSizeChange?: (size: number) => void;
}

export class TerrainEditorUI {
  private parent: UIParent;
  private callbacks: TerrainEditorUICallbacks;

  private panel: Rectangle | null = null;
  private toolButtons: Map<EditorTool, Rectangle> = new Map();
  private modeButtons: Map<EditorMode, Rectangle> = new Map();
  private axisButtons: Map<string, Rectangle> = new Map();
  // coordsText removed
  private brushSizeText: TextBlock | null = null;
  private brushSizeSlider: Slider | null = null;
  private brushStrengthText: TextBlock | null = null;
  private brushStrengthSlider: Slider | null = null;
  private selectionCountText: TextBlock | null = null;
  private stampSizeText: TextBlock | null = null;
  private stampSizeSlider: Slider | null = null;


  private activeTool: EditorTool = 'terrain_fairway';
  private activeMode: EditorMode = 'sculpt';
  private activeAxis: AxisConstraint = 'xz';
  private activeTopologyMode: TopologyMode = 'vertex';
  private topologyButtons: Map<TopologyMode, Rectangle> = new Map();

  private sculptToolsPanel: StackPanel | null = null;
  private paintToolsPanel: StackPanel | null = null;
  private activeInteractionMode: InteractionMode = 'brush';
  private interactionButtons: Map<InteractionMode, Rectangle> = new Map();
  private brushSizeContainer: StackPanel | null = null;
  private brushStrengthContainer: StackPanel | null = null;
  private interactionToggleContainer: StackPanel | null = null;
  private topologyToggleContainer: StackPanel | null = null;
  private selectionContainer: StackPanel | null = null;
  private transformContainer: StackPanel | null = null;
  private edgeActionsContainer: StackPanel | null = null;
  private rotationContainer: StackPanel | null = null;
  private stampToolsPanel: StackPanel | null = null;
  private activeTemplateName: string | null = null;
  private templateButtons: Map<string, Rectangle> = new Map();

  constructor(parent: UIParent, callbacks: TerrainEditorUICallbacks) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDockedPanel(this.parent, {
      name: 'terrainEditor',
      width: 360,
      height: 1,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
      left: 10,
      top: 10,
      padding: 12,
    });
    panel.adaptHeightToChildren = true;
    panel.height = '1px';
    stack.width = '316px';
    this.panel = panel;

    this.createHeader(stack);
    this.createModeToggle(stack);
    this.createInteractionModeToggle(stack);
    this.createSculptTools(stack);
    this.createTerrainBrushes(stack);
    this.createTopologyModeToggle(stack);
    this.createBrushSizeControl(stack);
    this.createBrushStrengthControl(stack);
    this.createSelectionSection(stack);
    this.createEdgeActionsSection(stack);
    this.createTransformSection(stack);
    this.createRotationSection(stack);
    this.createStampSection(stack);

    this.updateVisibility();
  }

  private createHeader(parent: StackPanel): void {
    createPopupHeader(parent, {
      title: 'TERRAIN EDITOR',
      titleColor: UI_THEME.colors.editor.buttonTextActive,
      width: 316,
      onClose: () => this.callbacks.onClose(),
    });
  }

  private createModeToggle(parent: StackPanel): void {
    const grid = new Grid('modeGrid');
    grid.height = '40px';
    grid.width = '316px';
    grid.paddingTop = '8px';
    grid.addColumnDefinition(1 / 3);
    grid.addColumnDefinition(1 / 3);
    grid.addColumnDefinition(1 / 3);
    parent.addControl(grid);

    const sculptBtn = this.createModeButton('sculpt', 'SCULPT');
    grid.addControl(sculptBtn, 0, 0);

    const paintBtn = this.createModeButton('paint', 'PAINT');
    grid.addControl(paintBtn, 0, 1);

    const stampBtn = this.createModeButton('stamp', 'STAMP');
    grid.addControl(stampBtn, 0, 2);

    this.updateModeButtonStyles();
  }

  private createInteractionModeToggle(parent: StackPanel): void {
    this.interactionToggleContainer = new StackPanel('interactionToggleContainer');
    this.interactionToggleContainer.width = '316px';
    parent.addControl(this.interactionToggleContainer);

    const grid = new Grid('interactionGrid');
    grid.height = '36px';
    grid.width = '316px';
    grid.paddingTop = '4px';
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    this.interactionToggleContainer.addControl(grid);

    const brushBtn = this.createInteractionButton('brush', 'BRUSH (B)');
    grid.addControl(brushBtn, 0, 0);

    const selectBtn = this.createInteractionButton('select', 'SELECT (S)');
    grid.addControl(selectBtn, 0, 1);

    this.updateInteractionButtonStyles();
  }

  private createInteractionButton(mode: InteractionMode, label: string): Rectangle {
    const container = new Rectangle(`interaction_${mode}`);
    container.width = '95%';
    container.height = '28px';
    container.cornerRadius = UI_THEME.radii.scale.r4;
    container.background = UI_THEME.colors.editor.buttonBase;
    container.color = UI_THEME.colors.editor.buttonBorder;
    container.thickness = 2;

    const text = new TextBlock();
    text.text = label;
    text.color = UI_THEME.colors.editor.buttonText;
    text.fontSize = UI_THEME.typography.scale.s11;
    text.fontWeight = 'bold';
    container.addControl(text);

    container.onPointerEnterObservable.add(() => {
      if (this.activeInteractionMode !== mode) {
        container.background = UI_THEME.colors.editor.buttonHover;
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeInteractionMode !== mode) {
        container.background = UI_THEME.colors.editor.buttonBase;
      }
    });

    container.onPointerUpObservable.add(() => {
      this.setInteractionMode(mode);
      this.callbacks.onInteractionModeChange?.(mode);
    });

    this.interactionButtons.set(mode, container);
    return container;
  }

  private updateInteractionButtonStyles(): void {
    for (const [mode, btn] of this.interactionButtons) {
      const text = btn.children[0] as TextBlock;
      if (mode === this.activeInteractionMode) {
        btn.background = UI_THEME.colors.editor.buttonActive;
        btn.color = UI_THEME.colors.editor.buttonTextActive;
        if (text) text.color = UI_THEME.colors.editor.buttonTextActive;
      } else {
        btn.background = UI_THEME.colors.editor.buttonBase;
        btn.color = UI_THEME.colors.editor.buttonBorder;
        if (text) text.color = UI_THEME.colors.editor.buttonText;
      }
    }
  }

  private createModeButton(mode: EditorMode, label: string): Rectangle {
    const container = new Rectangle(`mode_${mode}`);
    container.width = '95%';
    container.height = '32px';
    container.cornerRadius = UI_THEME.radii.scale.r4;
    container.background = UI_THEME.colors.editor.buttonBase;
    container.color = UI_THEME.colors.editor.buttonBorder;
    container.thickness = 2;

    const text = new TextBlock();
    text.text = label;
    text.color = UI_THEME.colors.editor.buttonText;
    text.fontSize = UI_THEME.typography.scale.s12;
    text.fontWeight = 'bold';
    container.addControl(text);

    container.onPointerEnterObservable.add(() => {
      if (this.activeMode !== mode) {
        container.background = UI_THEME.colors.editor.buttonHover;
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeMode !== mode) {
        container.background = UI_THEME.colors.editor.buttonBase;
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
    this.updateVisibility();

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
        btn.background = UI_THEME.colors.editor.buttonActive;
        btn.color = UI_THEME.colors.editor.buttonTextActive;
        if (text) text.color = UI_THEME.colors.editor.buttonTextActive;
      } else {
        btn.background = UI_THEME.colors.editor.buttonBase;
        btn.color = UI_THEME.colors.editor.buttonBorder;
        if (text) text.color = UI_THEME.colors.editor.buttonText;
      }
    }
  }

  private createSculptTools(parent: StackPanel): void {
    this.sculptToolsPanel = new StackPanel('sculptToolsPanel');
    this.sculptToolsPanel.width = '316px';
    parent.addControl(this.sculptToolsPanel);

    const sectionLabel = new TextBlock('sculptLabel');
    sectionLabel.text = 'SCULPT TOOLS';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
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
      { tool: 'raise', label: 'Raise', key: '1', color: UI_THEME.colors.editor.buttonTextActive },
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
    parent.addControl(this.paintToolsPanel);

    const sectionLabel = new TextBlock('terrainLabel');
    sectionLabel.text = 'TERRAIN TYPE';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
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
    container.cornerRadius = UI_THEME.radii.scale.r6;
    container.background = UI_THEME.colors.editor.buttonBase;
    container.color = UI_THEME.colors.editor.buttonBorder;
    container.thickness = 2;

    const stack = new StackPanel();
    stack.paddingTop = '4px';
    container.addControl(stack);

    const keyBadge = new TextBlock();
    keyBadge.text = keyHint;
    keyBadge.color = accentColor ?? '#6a9a7a';
    keyBadge.fontSize = UI_THEME.typography.scale.s10;
    keyBadge.height = '14px';
    keyBadge.fontWeight = 'bold';
    stack.addControl(keyBadge);

    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = UI_THEME.colors.legacy.c_ccddcc;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.height = '16px';
    stack.addControl(labelText);

    container.onPointerEnterObservable.add(() => {
      if (this.activeTool !== tool) {
        container.background = UI_THEME.colors.editor.buttonHover;
        container.color = UI_THEME.colors.legacy.c_5a8a6a;
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeTool !== tool) {
        container.background = UI_THEME.colors.editor.buttonBase;
        container.color = UI_THEME.colors.editor.buttonBorder;
      }
    });

    container.onPointerUpObservable.add(() => {
      this.callbacks.onToolSelect(tool);
    });

    this.toolButtons.set(tool, container);
    return container;
  }

  private createBrushSizeControl(parent: StackPanel): void {
    this.brushSizeContainer = new StackPanel('brushSizeContainer');
    this.brushSizeContainer.width = '316px';
    parent.addControl(this.brushSizeContainer);

    const header = new Grid();
    header.height = '24px';
    header.width = '316px';
    header.addColumnDefinition(0.5);
    header.addColumnDefinition(0.5);
    this.brushSizeContainer.addControl(header);

    const sectionLabel = new TextBlock('brushLabel');
    sectionLabel.text = 'BRUSH SIZE';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.addControl(sectionLabel, 0, 0);

    this.brushSizeText = new TextBlock('brushSizeText');
    this.brushSizeText.text = '1';
    this.brushSizeText.color = UI_THEME.colors.editor.buttonTextActive;
    this.brushSizeText.fontSize = UI_THEME.typography.scale.s12;
    this.brushSizeText.fontWeight = 'bold';
    this.brushSizeText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    header.addControl(this.brushSizeText, 0, 1);

    const slider = new Slider('brushSizeSlider');
    slider.minimum = 1;
    slider.maximum = 10;
    slider.step = 1;
    slider.value = 1;
    slider.isThumbClamped = true;
    slider.height = '20px';
    slider.width = '310px';
    slider.thumbWidth = 20;
    slider.color = UI_THEME.colors.legacy.c_3a6a4a;
    slider.background = UI_THEME.colors.editor.buttonBase;
    slider.onValueChangedObservable.add((value) => {
        const intVal = Math.round(value);
        if (this.brushSizeText) this.brushSizeText.text = intVal.toString();
        this.callbacks.onBrushSizeChange(intVal);
    });
    
    this.brushSizeSlider = slider;
    this.brushSizeContainer.addControl(slider);
  }

  // ... (keeping other methods or relying on context match for smaller chunks if possible, but replace_file_content needs contiguous block)
  // I will split this into chunks.


  private createBrushStrengthControl(parent: StackPanel): void {
    this.brushStrengthContainer = new StackPanel('brushStrengthContainer');
    this.brushStrengthContainer.width = '316px';
    parent.addControl(this.brushStrengthContainer);

    const header = new Grid();
    header.height = '24px';
    header.width = '316px';
    header.addColumnDefinition(0.5);
    header.addColumnDefinition(0.5);
    this.brushStrengthContainer.addControl(header);

    const sectionLabel = new TextBlock('strengthLabel');
    sectionLabel.text = 'BRUSH STRENGTH';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.addControl(sectionLabel, 0, 0);

    this.brushStrengthText = new TextBlock('brushStrengthText');
    this.brushStrengthText.text = '1.0';
    this.brushStrengthText.color = UI_THEME.colors.editor.buttonTextActive;
    this.brushStrengthText.fontSize = UI_THEME.typography.scale.s12;
    this.brushStrengthText.fontWeight = 'bold';
    this.brushStrengthText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    header.addControl(this.brushStrengthText, 0, 1);

    const slider = new Slider('brushStrengthSlider');
    slider.minimum = 0.1;
    slider.maximum = 1.0;
    slider.step = 0.1;
    slider.value = 1.0;
    slider.isThumbClamped = true;
    slider.height = '20px';
    slider.width = '310px';
    slider.thumbWidth = 20;
    slider.color = UI_THEME.colors.legacy.c_3a6a4a;
    slider.background = UI_THEME.colors.editor.buttonBase;
    slider.onValueChangedObservable.add((value) => {
       if (this.brushStrengthText) this.brushStrengthText.text = value.toFixed(1);
       this.callbacks.onBrushStrengthChange?.(value);
    });
    
    this.brushStrengthSlider = slider;
    this.brushStrengthContainer.addControl(slider);
  }

  private createTopologyModeToggle(parent: StackPanel): void {
    this.topologyToggleContainer = new StackPanel('topologyToggleContainer');
    this.topologyToggleContainer.width = '316px';
    parent.addControl(this.topologyToggleContainer);

    const sectionLabel = new TextBlock('topologyLabel');
    sectionLabel.text = 'TOPOLOGY MODE';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '4px';
    this.topologyToggleContainer.addControl(sectionLabel);

    const grid = new Grid('topologyGrid');
    grid.height = '32px';
    grid.width = '316px';
    grid.addColumnDefinition(0.33);
    grid.addColumnDefinition(0.33);
    grid.addColumnDefinition(0.33);
    this.topologyToggleContainer.addControl(grid);

    const vertexBtn = this.createTopologyButton('vertex', 'Vertex (V)', '#6a9a7a');
    grid.addControl(vertexBtn, 0, 0);

    const edgeBtn = this.createTopologyButton('edge', 'Edge (E)', '#00cccc');
    grid.addControl(edgeBtn, 0, 1);

    const faceBtn = this.createTopologyButton('face', 'Face', '#ffcc44');
    grid.addControl(faceBtn, 0, 2);

    this.updateTopologyModeStyles();
  }

  private createEdgeActionsSection(parent: StackPanel): void {
    this.edgeActionsContainer = new StackPanel('edgeActionsContainer');
    this.edgeActionsContainer.width = '316px';
    parent.addControl(this.edgeActionsContainer);

    const sectionLabel = new TextBlock('edgeActionsLabel');
    sectionLabel.text = 'EDGE ACTIONS';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '4px';
    this.edgeActionsContainer.addControl(sectionLabel);

    const grid = new Grid('edgeActionsGrid');
    grid.height = '32px';
    grid.width = '316px';
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    this.edgeActionsContainer.addControl(grid);

    const splitBtn = createActionButton({
      id: 'splitEdgeBtn',
      label: 'Split',
      tone: 'neutral',
      width: 140,
      height: 24,
      fontSize: 10,
      onClick: () => this.callbacks.onSplitEdge?.(),
    });
    splitBtn.color = UI_THEME.colors.editor.buttonText;
    splitBtn.background = UI_THEME.colors.editor.buttonBase;
    grid.addControl(splitBtn, 0, 0);

    const flipBtn = createActionButton({
      id: 'flipEdgeBtn',
      label: 'Flip',
      tone: 'neutral',
      width: 140,
      height: 24,
      fontSize: 10,
      onClick: () => this.callbacks.onFlipEdge?.(),
    });
    flipBtn.color = UI_THEME.colors.editor.buttonText;
    flipBtn.background = UI_THEME.colors.editor.buttonBase;
    grid.addControl(flipBtn, 0, 1);
  }

  private createTopologyButton(mode: TopologyMode, label: string, accentColor: string): Rectangle {
    const container = new Rectangle(`topology_${mode}`);
    container.width = '95%';
    container.height = '28px';
    container.cornerRadius = UI_THEME.radii.scale.r4;
    container.background = UI_THEME.colors.editor.buttonBase;
    container.color = UI_THEME.colors.editor.buttonBorder;
    container.thickness = 2;
    container.metadata = { accentColor };

    const text = new TextBlock();
    text.text = label;
    text.color = UI_THEME.colors.editor.buttonText;
    text.fontSize = UI_THEME.typography.scale.s11;
    text.fontWeight = 'bold';
    container.addControl(text);

    container.onPointerEnterObservable.add(() => {
      if (this.activeTopologyMode !== mode) {
        container.background = UI_THEME.colors.editor.buttonHover;
      }
    });

    container.onPointerOutObservable.add(() => {
      if (this.activeTopologyMode !== mode) {
        container.background = UI_THEME.colors.editor.buttonBase;
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
      const accent = btn.metadata?.accentColor ?? UI_THEME.colors.editor.buttonTextActive;

      if (mode === this.activeTopologyMode) {
        btn.background = UI_THEME.colors.editor.buttonActive;
        btn.color = accent;
        if (text) text.color = accent;
      } else {
        btn.background = UI_THEME.colors.editor.buttonBase;
        btn.color = UI_THEME.colors.editor.buttonBorder;
        if (text) text.color = UI_THEME.colors.editor.buttonText;
      }
    }

  }

  private createSelectionSection(parent: StackPanel): void {
    this.selectionContainer = new StackPanel('selectionContainer');
    this.selectionContainer.width = '316px';
    parent.addControl(this.selectionContainer);

    const grid = new Grid('selectionGrid');
    grid.height = '32px';
    grid.width = '316px';
    grid.paddingTop = '4px';
    grid.addColumnDefinition(0.7);
    grid.addColumnDefinition(0.3);
    this.selectionContainer.addControl(grid);

    this.selectionCountText = new TextBlock('selCountText');
    this.selectionCountText.text = '0 selected';
    this.selectionCountText.color = UI_THEME.colors.legacy.c_6a9a7a;
    this.selectionCountText.fontSize = UI_THEME.typography.scale.s12;
    this.selectionCountText.fontWeight = 'bold';
    this.selectionCountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(this.selectionCountText, 0, 0);

    const deleteBtn = createActionButton({
      id: 'deleteBtn',
      label: 'Delete',
      tone: 'danger',
      width: 80,
      height: 24,
      fontSize: 10,
      onClick: () => {
        if (this.activeTopologyMode === 'edge') {
          this.callbacks.onCollapseEdge?.();
        } else {
          this.callbacks.onDeleteVertex?.();
        }
      },
    });
    deleteBtn.color = UI_THEME.colors.text.danger;
    deleteBtn.background = UI_THEME.colors.editor.buttonBase;
    deleteBtn.onPointerEnterObservable.add(() => { deleteBtn.background = UI_THEME.colors.editor.buttonDangerHover; });
    deleteBtn.onPointerOutObservable.add(() => { deleteBtn.background = UI_THEME.colors.editor.buttonBase; });
    grid.addControl(deleteBtn, 0, 1);
  }
  private createTransformSection(parent: StackPanel): void {
    this.transformContainer = new StackPanel('transformContainer');
    this.transformContainer.width = '316px';
    parent.addControl(this.transformContainer);

    const sectionLabel = new TextBlock('constraintLabel');
    sectionLabel.text = 'MOVE AXIS';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '6px';
    this.transformContainer.addControl(sectionLabel);

    // Visual Axis Gizmo Container
    const gizmoHost = new Rectangle('gizmoHost');
    gizmoHost.height = '140px';
    gizmoHost.width = '316px';
    gizmoHost.thickness = 0;
    gizmoHost.background = 'transparent';
    this.transformContainer.addControl(gizmoHost);
    
    // Y Axis (Green, Up)
    this.createAxisRod(gizmoHost, 'y', '#44cc44', 0, -32, 6, 60, 0);
    this.createAxisLabel(gizmoHost, 'Y', '#44cc44', 0, -70);
    
    // X Axis (Red, Right)
    this.createAxisRod(gizmoHost, 'x', '#cc4444', 32, 0, 60, 6, 0);
    this.createAxisLabel(gizmoHost, 'X', '#cc4444', 70, 0);

    // Z Axis (Blue, Diagonal Top-Right for "Into Screen")
    // Rotation -45 deg points Top-Right
    // Offset calc: Center of 50px rod at angle -45
    // x = cos(-45)*28 = 19.8, y = sin(-45)*28 = -19.8
    this.createAxisRod(gizmoHost, 'z', '#4444cc', 20, -20, 50, 6, -Math.PI / 4);
    this.createAxisLabel(gizmoHost, 'Z', '#4444cc', 50, -50);

    // Center Hub
    const hub = new Rectangle('hub');
    hub.width = '12px';
    hub.height = '12px';
    hub.cornerRadius = UI_THEME.radii.scale.r6;
    hub.color = UI_THEME.colors.editor.buttonText;
    hub.background = UI_THEME.colors.editor.buttonText;
    hub.thickness = 0;
    gizmoHost.addControl(hub);

    this.updateAxisButtonStyles();
  }

  private createAxisLabel(parent: Rectangle, text: string, color: string, left: number, top: number): void {
      const label = new TextBlock();
      label.text = text;
      label.color = color; // dim if needed, but axis colors usually bright
      label.fontSize = UI_THEME.typography.scale.s12;
      label.fontWeight = 'bold';
      label.left = `${left}px`;
      label.top = `${top}px`;
      parent.addControl(label);
  }

  private createAxisRod(parent: Rectangle, axis: string, color: string, left: number, top: number, width: number, height: number, rotation: number): void {
      const container = new Rectangle(`axis_${axis}`);
      container.width = `${width}px`;
      container.height = `${height}px`;
      container.left = `${left}px`;
      container.top = `${top}px`;
      container.rotation = rotation;
      container.color = color; // Border
      container.background = UI_THEME.colors.editor.buttonBase; // Dim fill
      container.thickness = 2;
      container.cornerRadius = UI_THEME.radii.scale.r3;
      container.isPointerBlocker = true;
      container.metadata = { accentColor: color }; 

      container.onPointerEnterObservable.add(() => {
          const isActive = this.activeAxis.includes(axis);
          if (!isActive) {
              container.background = UI_THEME.colors.editor.buttonHover;
          }
      });
      container.onPointerOutObservable.add(() => {
          const isActive = this.activeAxis.includes(axis);
          if (!isActive) {
              container.background = UI_THEME.colors.editor.buttonBase;
          }
      });
      container.onPointerUpObservable.add((_info, state) => {
        const evt = (state as any).event as PointerEvent;
        const shift = evt?.shiftKey ?? false;
        
        // Use 'xyz' as default/all if needed
        let current = this.activeAxis;
        let newSet = new Set<string>(current.split(''));
        
        if (shift) {
            if (newSet.has(axis)) {
                newSet.delete(axis);
            } else {
                newSet.add(axis);
            }
        } else {
             newSet.clear();
             newSet.add(axis);
        }

        if (newSet.size === 0) {
            newSet.add('y'); // Default fallback
        }

        let chars = Array.from(newSet).sort().join('');
        // Validate against allowed union members
        if (chars === 'xy' || chars === 'xz' || chars === 'yz' || chars === 'xyz' || chars === 'x' || chars === 'y' || chars === 'z') {
             this.callbacks.onAxisChange?.(chars as AxisConstraint);
        }
      });

      this.axisButtons.set(axis, container);
      parent.addControl(container);
  }

  private updateAxisButtonStyles(): void {
    const current = this.activeAxis;
    this.axisButtons.forEach((btn, axis) => {
        const isActive = current.includes(axis);
        const accent = btn.metadata.accentColor;
        
        if (isActive) {
            btn.background = accent;
            // Label is now separate, no child text to update
        } else {
            btn.background = UI_THEME.colors.editor.buttonBase;
        }
    });
  }




  private createStampSection(parent: StackPanel): void {
    this.stampToolsPanel = new StackPanel('stampToolsPanel');
    this.stampToolsPanel.width = '316px';
    parent.addControl(this.stampToolsPanel);

    const sectionLabel = new TextBlock('stampLabel');
    sectionLabel.text = 'TEMPLATES';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '6px';
    this.stampToolsPanel.addControl(sectionLabel);

    const grid = new Grid('templateGrid');
    grid.width = '316px';
    const cols = 2;
    const rows = Math.ceil(BUILT_IN_TEMPLATES.length / cols);
    grid.height = `${rows * 36}px`;
    for (let c = 0; c < cols; c++) grid.addColumnDefinition(1 / cols);
    for (let r = 0; r < rows; r++) grid.addRowDefinition(1 / rows);
    this.stampToolsPanel.addControl(grid);

    for (let i = 0; i < BUILT_IN_TEMPLATES.length; i++) {
      const template = BUILT_IN_TEMPLATES[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      const btn = new Rectangle(`template_${template.name}`);
      btn.width = '95%';
      btn.height = '30px';
      btn.cornerRadius = UI_THEME.radii.chip;
      btn.background = UI_THEME.colors.editor.buttonBase;
      btn.color = UI_THEME.colors.editor.buttonBorder;
      btn.thickness = 2;

      const text = new TextBlock();
      text.text = template.name;
      text.color = UI_THEME.colors.editor.buttonSoftText;
      text.fontSize = UI_THEME.typography.scale.s11;
      btn.addControl(text);

      btn.onPointerEnterObservable.add(() => {
        if (this.activeTemplateName !== template.name) btn.background = UI_THEME.colors.editor.buttonHover;
      });
      btn.onPointerOutObservable.add(() => {
        if (this.activeTemplateName !== template.name) btn.background = UI_THEME.colors.editor.buttonBase;
      });
      btn.onPointerUpObservable.add(() => {
        this.activeTemplateName = template.name;
        this.updateTemplateButtonStyles();
        this.callbacks.onTemplateSelect?.(template.name);
      });

      this.templateButtons.set(template.name, btn);
      grid.addControl(btn, row, col);
    }

    const sizeHeader = new Grid('stampSizeHeader');
    sizeHeader.height = '24px';
    sizeHeader.width = '316px';
    sizeHeader.addColumnDefinition(0.5);
    sizeHeader.addColumnDefinition(0.5);
    this.stampToolsPanel.addControl(sizeHeader);

    const sizeLabel = new TextBlock('stampSizeLabel');
    sizeLabel.text = 'STAMP SIZE';
    sizeLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sizeLabel.fontSize = UI_THEME.typography.scale.s11;
    sizeLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sizeHeader.addControl(sizeLabel, 0, 0);

    this.stampSizeText = new TextBlock('stampSizeText');
    this.stampSizeText.text = '1';
    this.stampSizeText.color = UI_THEME.colors.editor.buttonTextActive;
    this.stampSizeText.fontSize = UI_THEME.typography.scale.s12;
    this.stampSizeText.fontWeight = 'bold';
    this.stampSizeText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    sizeHeader.addControl(this.stampSizeText, 0, 1);

    const sizeSlider = new Slider('stampSizeSlider');
    sizeSlider.minimum = 0.25;
    sizeSlider.maximum = 6;
    sizeSlider.step = 0.25;
    sizeSlider.value = 1;
    sizeSlider.isThumbClamped = true;
    sizeSlider.height = '20px';
    sizeSlider.width = '310px';
    sizeSlider.thumbWidth = 20;
    sizeSlider.color = UI_THEME.colors.legacy.c_3a6a4a;
    sizeSlider.background = UI_THEME.colors.editor.buttonBase;
    sizeSlider.onValueChangedObservable.add((value) => {
      const snapped = Math.round(value / 0.25) * 0.25;
      if (this.stampSizeText) this.stampSizeText.text = formatStampSize(snapped);
      this.callbacks.onStampSizeChange?.(snapped);
    });

    this.stampSizeSlider = sizeSlider;
    this.stampToolsPanel.addControl(sizeSlider);

  }

  private updateTemplateButtonStyles(): void {
    this.templateButtons.forEach((btn, name) => {
      if (name === this.activeTemplateName) {
        btn.background = UI_THEME.colors.editor.buttonSelected;
        btn.color = UI_THEME.colors.editor.buttonTextSelected;
      } else {
        btn.background = UI_THEME.colors.editor.buttonBase;
        btn.color = UI_THEME.colors.editor.buttonBorder;
      }
    });
  }


  private createRotationSection(parent: StackPanel): void {
    this.rotationContainer = new StackPanel('rotationContainer');
    this.rotationContainer.width = '316px';
    parent.addControl(this.rotationContainer);

    const sectionLabel = new TextBlock('rotationLabel');
    sectionLabel.text = 'ROTATE';
    sectionLabel.color = UI_THEME.colors.legacy.c_8aba9a;
    sectionLabel.fontSize = UI_THEME.typography.scale.s11;
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '6px';
    this.rotationContainer.addControl(sectionLabel);

    const axes: Array<{ label: string; color: string; getArgs: (rad: number) => [number, number, number] }> = [
      { label: 'X', color: '#cc4444', getArgs: (r) => [r, 0, 0] },
      { label: 'Y', color: '#44cc44', getArgs: (r) => [0, r, 0] },
      { label: 'Z', color: '#4444cc', getArgs: (r) => [0, 0, r] },
    ];

    for (const axis of axes) {
      const row = new StackPanel(`rotRow${axis.label}`);
      row.isVertical = false;
      row.height = '30px';
      row.width = '316px';
      this.rotationContainer.addControl(row);

      const label = new TextBlock();
      label.text = axis.label;
      label.color = axis.color;
      label.fontSize = UI_THEME.typography.scale.s12;
      label.fontWeight = 'bold';
      label.width = '30px';
      label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      row.addControl(label);

      const minusBtn = createActionButton({
        id: `rot${axis.label}Minus`,
        label: '-5',
        tone: 'neutral',
        width: 50,
        height: 26,
        fontSize: 11,
        onClick: () => {
          const [ax, ay, az] = axis.getArgs(degreesToRadians(-5));
          this.callbacks.onRotateBy?.(ax, ay, az);
        },
      });
      minusBtn.color = UI_THEME.colors.editor.buttonSoftText;
      minusBtn.background = UI_THEME.colors.editor.buttonHover;
      row.addControl(minusBtn);

      const plusBtn = createActionButton({
        id: `rot${axis.label}Plus`,
        label: '+5',
        tone: 'neutral',
        width: 50,
        height: 26,
        fontSize: 11,
        onClick: () => {
          const [ax, ay, az] = axis.getArgs(degreesToRadians(5));
          this.callbacks.onRotateBy?.(ax, ay, az);
        },
      });
      plusBtn.color = UI_THEME.colors.editor.buttonSoftText;
      plusBtn.background = UI_THEME.colors.editor.buttonHover;
      plusBtn.paddingLeft = '4px';
      row.addControl(plusBtn);
    }
  }
  private updateVisibility(): void {
    const mode = this.activeMode;
    const interaction = this.activeInteractionMode;
    const topology = this.activeTopologyMode;

    if (this.interactionToggleContainer) this.interactionToggleContainer.isVisible = (mode === 'sculpt');
    if (this.sculptToolsPanel) this.sculptToolsPanel.isVisible = (mode === 'sculpt' && interaction === 'brush');
    if (this.paintToolsPanel) this.paintToolsPanel.isVisible = (mode === 'paint');
    if (this.topologyToggleContainer) this.topologyToggleContainer.isVisible = (mode === 'sculpt');
    if (this.brushSizeContainer) this.brushSizeContainer.isVisible = ((mode === 'sculpt' && interaction === 'brush') || mode === 'paint');
    if (this.brushStrengthContainer) this.brushStrengthContainer.isVisible = (mode === 'sculpt' && interaction === 'brush');
    if (this.selectionContainer) this.selectionContainer.isVisible = (mode === 'sculpt' && interaction === 'select');
    if (this.transformContainer) this.transformContainer.isVisible = (mode === 'sculpt' && interaction === 'select');
    if (this.rotationContainer) this.rotationContainer.isVisible = (mode === 'sculpt' && interaction === 'select');
    if (this.edgeActionsContainer) this.edgeActionsContainer.isVisible = (mode === 'sculpt' && interaction === 'select' && topology === 'edge');
    if (this.stampToolsPanel) this.stampToolsPanel.isVisible = (mode === 'stamp');
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
        btn.background = UI_THEME.colors.editor.buttonActive;
        btn.color = UI_THEME.colors.editor.buttonTextActive;
      } else {
        btn.background = UI_THEME.colors.editor.buttonBase;
        btn.color = UI_THEME.colors.editor.buttonBorder;
      }
    }
    this.activeTool = tool;
  }

  public setActiveMode(mode: EditorMode): void {
    this.activeMode = mode;
    this.updateModeButtonStyles();
    this.updateVisibility();
    if (mode === 'stamp' && !this.activeTemplateName && BUILT_IN_TEMPLATES.length > 0) {
      this.activeTemplateName = BUILT_IN_TEMPLATES[0].name;
      this.updateTemplateButtonStyles();
      this.callbacks.onTemplateSelect?.(this.activeTemplateName);
    }
  }

  public setInteractionMode(mode: InteractionMode): void {
    this.activeInteractionMode = mode;
    this.updateInteractionButtonStyles();
    this.updateVisibility();
  }


  public setBrushSize(size: number): void {
    if (this.brushSizeText) {
      this.brushSizeText.text = size.toString();
      this.brushSizeText.metadata = size.toString();
    }
    if (this.brushSizeSlider) {
        // Prevent loop if value is already close (slider might be 2.00001)
        if (Math.abs(this.brushSizeSlider.value - size) > 0.1) {
            this.brushSizeSlider.value = size;
        }
    }
  }

  public setBrushStrength(strength: number): void {
    if (this.brushStrengthText) {
      this.brushStrengthText.text = strength.toFixed(1);
    }
    if (this.brushStrengthSlider) {
        if (Math.abs(this.brushStrengthSlider.value - strength) > 0.01) {
            this.brushStrengthSlider.value = strength;
        }
    }
  }

  public setStampSize(size: number): void {
    if (this.stampSizeText) {
      const text = formatStampSize(size);
      this.stampSizeText.text = text;
      this.stampSizeText.metadata = text;
    }
    if (this.stampSizeSlider) {
      if (Math.abs(this.stampSizeSlider.value - size) > 0.1) {
        this.stampSizeSlider.value = size;
      }
    }
  }

  public updateCoordinates(_x: number, _y: number, _elevation: number, _type: TerrainType): void {
  }

  public clearCoordinates(): void {
  }

  public setSelectionCount(count: number): void {
    if (this.selectionCountText) {
      this.selectionCountText.text = count === 1 ? '1 selected' : `${count} selected`;
      this.selectionCountText.color = count > 0 ? UI_THEME.colors.editor.buttonTextActive : '#6a9a7a';
    }
  }

  public setActiveAxis(axis: AxisConstraint): void {
    this.activeAxis = axis;
    this.updateAxisButtonStyles();
  }

  public updateVertexPosition(_x: number | null, _y: number | null, _z: number | null): void {
  }

  public clearVertexPosition(): void {
  }

  public setTopologyMode(mode: TopologyMode): void {
    this.activeTopologyMode = mode;
    this.updateTopologyModeStyles();
    this.updateVisibility();
  }

  public setActiveTopologyMode(mode: TopologyMode): void {
    this.activeTopologyMode = mode;
    this.updateTopologyModeStyles();
    this.updateVisibility();
  }


  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
    this.toolButtons.clear();
    this.modeButtons.clear();
    this.axisButtons.clear();
    this.interactionButtons.clear();
  }
}

function formatStampSize(size: number): string {
  const rounded = Math.round(size * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
