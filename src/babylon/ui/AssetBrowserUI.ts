import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Image } from '@babylonjs/gui/2D/controls/image';
import { Scene } from '@babylonjs/core/scene';

import { UIParent } from './UIParent';
import { createPanelSection, createPopupHeader, createDockedPanel, POPUP_COLORS } from './PopupUtils';
import { addDialogActionBar, addDialogScrollBlock, addDialogSectionLabel } from './DialogBlueprint';
import { addUniformButtons, addVerticalSpacer, createHorizontalRow, UI_SPACING } from './LayoutUtils';
import { UI_THEME } from './UITheme';
import { AssetPreviewRenderer } from '../assets/AssetPreviewRenderer';

import {
  getAssetCategories,
  getAssetsByCategory,
  getAssetDisplayName,
  AssetSpec,
  AssetId,
} from '../assets/AssetManifest';

export const ASSET_BROWSER_BOUNDS = {
  width: 312,
  height: 710,
  right: 10,
  top: 10,
};

export interface AssetBrowserCallbacks {
  onSelectAsset: (assetId: string) => void;
  onOpenTerrainEditor?: () => void;
  onOpenHoleBuilder?: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onExitPlaceMode: () => void;
}

export class AssetBrowserUI {
  private parent: UIParent;
  private callbacks: AssetBrowserCallbacks;
  private container: Rectangle;
  private categoryTabs: Map<string, Rectangle> = new Map();
  private assetGrid: Grid | null = null;
  private scrollViewer: ScrollViewer | null = null;
  private activeCategory: string = '';
  private selectedAssetId: string = '';
  private actionPanel: Rectangle | null = null;
  private selectionNameText: TextBlock | null = null;
  private selectionHintText: TextBlock | null = null;
  private previewRenderer: AssetPreviewRenderer;
  private previewImages: Map<string, Image> = new Map();
  private assetCards: Map<string, Rectangle> = new Map();

  constructor(parent: UIParent, callbacks: AssetBrowserCallbacks, scene: Scene) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.previewRenderer = new AssetPreviewRenderer(scene.getEngine());

    const { panel, stack } = createDockedPanel(this.parent, {
      name: 'assetBrowser',
      width: ASSET_BROWSER_BOUNDS.width,
      height: ASSET_BROWSER_BOUNDS.height,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_RIGHT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
      padding: 12,
      left: -ASSET_BROWSER_BOUNDS.right,
      top: ASSET_BROWSER_BOUNDS.top,
    });
    this.container = panel;
    this.container.isVisible = false;

    this.buildUI(stack);
  }

  private buildUI(mainStack: StackPanel): void {
    createPopupHeader(mainStack, {
      title: 'COURSE ASSETS',
      titleColor: UI_THEME.colors.editor.buttonTextActive,
      width: 286,
      onClose: () => {
        this.callbacks.onExitPlaceMode();
        this.clearSelectionContext();
        this.hide();
      },
    });

    const intro = new TextBlock('assetBrowserIntro');
    intro.text = 'Pick a category, choose a prop, then place it on the course. Asset mode should feel like dressing a real venue, not filling a palette.';
    intro.color = UI_THEME.colors.text.secondary;
    intro.fontSize = UI_THEME.typography.scale.s10;
    intro.height = '40px';
    intro.textWrapping = true;
    intro.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    mainStack.addControl(intro);

    const switchRow = createHorizontalRow(mainStack, { name: 'assetSwitchRow', widthPx: 286, heightPx: 32 });
    switchRow.paddingTop = '4px';
    addUniformButtons(switchRow, {
      rowWidthPx: 286,
      rowHeightPx: 28,
      gapPx: UI_SPACING.xs,
      specs: [
        { id: 'assetSwitchTerrain', label: 'Terrain (T)', onClick: () => this.callbacks.onOpenTerrainEditor?.(), fontSize: 11 },
        { id: 'assetSwitchHoles', label: 'Holes (J)', onClick: () => this.callbacks.onOpenHoleBuilder?.(), fontSize: 11 },
      ],
    });

    this.buildCategoryTabs(mainStack);
    this.buildAssetScroll(mainStack);
    this.buildActionPanel(mainStack);

    const categories = getAssetCategories();
    if (categories.length > 0) {
      this.selectCategory(categories[0]);
    }
  }

  private buildCategoryTabs(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'assetCategoryBlock',
      width: 286,
      height: 114,
      theme: 'neutral',
      cornerRadius: 0,
      thickness: 0,
      paddingTop: 0,
      paddingBottom: 0,
      scroll: {
        name: 'catScroll',
        width: 286,
        height: 114,
        contentName: 'catScrollContent',
        contentWidth: '100%',
        options: {
          barColor: '#4a8a5a',
          barBackground: UI_THEME.colors.editor.buttonBase,
        },
      },
    });

    const tabGrid = new Grid('catGrid');
    tabGrid.width = '100%';

    const categories = getAssetCategories();
    const cols = 2;
    const rows = Math.ceil(categories.length / cols);
    tabGrid.height = `${rows * 32}px`;

    for (let c = 0; c < cols; c++) tabGrid.addColumnDefinition(1 / cols);
    for (let r = 0; r < rows; r++) tabGrid.addRowDefinition(24, true);

    content.addControl(tabGrid);

    categories.forEach((cat, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const tab = new Rectangle(`catTab_${cat}`);
      tab.height = '28px';
      tab.cornerRadius = UI_THEME.radii.scale.r4;
      tab.thickness = 1;
      tab.color = UI_THEME.colors.editor.buttonBorder;
      tab.background = UI_THEME.colors.miscButton.neutralBase;
      tab.paddingLeft = '2px';
      tab.paddingRight = '2px';

      const label = new TextBlock();
      label.text = cat;
      label.color = UI_THEME.colors.editor.buttonText;
      label.fontSize = UI_THEME.typography.scale.s10;
      label.fontFamily = UI_THEME.typography.fontFamily;
      label.isPointerBlocker = false;
      tab.addControl(label);

      tab.isPointerBlocker = true;
      tab.onPointerUpObservable.add(() => this.selectCategory(cat));

      tab.onPointerEnterObservable.add(() => {
        if (this.activeCategory !== cat) tab.background = UI_THEME.colors.editor.buttonHover;
      });
      tab.onPointerOutObservable.add(() => {
        if (this.activeCategory !== cat) tab.background = UI_THEME.colors.miscButton.neutralBase;
      });

      tabGrid.addControl(tab, row, col);
      this.categoryTabs.set(cat, tab);
    });
  }

  private buildAssetScroll(parent: StackPanel): void {
    const { scrollViewer } = addDialogScrollBlock(parent, {
      id: 'assetListBlock',
      width: 286,
      height: 430,
      theme: 'neutral',
      cornerRadius: 0,
      thickness: 0,
      paddingTop: 0,
      paddingBottom: 0,
      scroll: {
        name: 'assetScroll',
        width: 286,
        height: 430,
        contentName: 'assetScrollContent',
        contentWidth: '100%',
        options: {
          barColor: '#4a8a5a',
          barBackground: UI_THEME.colors.editor.buttonBase,
        },
      },
    });
    this.scrollViewer = scrollViewer;
  }

  private buildActionPanel(parent: StackPanel): void {
    this.actionPanel = createPanelSection(parent, {
      name: 'assetActionBlock',
      width: 286,
      height: 132,
      theme: 'green',
      paddingTop: 4,
      paddingBottom: 4,
    });
    this.actionPanel.isVisible = false;

    const actionStack = new StackPanel();
    actionStack.width = '258px';
    this.actionPanel.addControl(actionStack);

    addDialogSectionLabel(actionStack, {
      id: 'selectedLabel',
      text: 'Placement Context',
      tone: 'success',
      fontSize: 11,
      height: 18,
    });
    addVerticalSpacer(actionStack, UI_SPACING.xs, 'assetActionGap');

    this.selectionNameText = new TextBlock('assetSelectionName');
    this.selectionNameText.text = 'No asset selected';
    this.selectionNameText.color = UI_THEME.colors.text.primary;
    this.selectionNameText.fontSize = UI_THEME.typography.scale.s12;
    this.selectionNameText.fontWeight = 'bold';
    this.selectionNameText.height = '18px';
    this.selectionNameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    actionStack.addControl(this.selectionNameText);

    this.selectionHintText = new TextBlock('assetSelectionHint');
    this.selectionHintText.text = 'Select an asset card to enter placement mode.';
    this.selectionHintText.color = UI_THEME.colors.text.secondary;
    this.selectionHintText.fontSize = UI_THEME.typography.scale.s10;
    this.selectionHintText.height = '28px';
    this.selectionHintText.textWrapping = true;
    this.selectionHintText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    actionStack.addControl(this.selectionHintText);

    const { buttons } = addDialogActionBar(actionStack, {
      id: 'assetActions',
      width: 258,
      height: 44,
      theme: 'neutral',
      paddingTop: 2,
      paddingBottom: 2,
      actions: [
        { id: 'assetRotateBtn', label: 'Rotate', tone: 'neutral', onClick: () => this.callbacks.onRotate(), fontSize: 11 },
        { id: 'assetDeleteBtn', label: 'Delete', tone: 'danger', onClick: () => this.callbacks.onDelete(), fontSize: 11 },
        { id: 'assetCancelBtn', label: 'Cancel', tone: 'neutral', onClick: () => this.callbacks.onExitPlaceMode(), fontSize: 11 },
      ],
    });
    const rotateButton = buttons[0];
    if (rotateButton) rotateButton.background = UI_THEME.colors.miscButton.mutedGreen;
    const cancelButton = buttons[2];
    if (cancelButton) cancelButton.background = UI_THEME.colors.miscButton.mutedBlue;
  }

  private selectCategory(category: string): void {
    if (this.activeCategory) {
      const prevTab = this.categoryTabs.get(this.activeCategory);
      if (prevTab) {
        prevTab.background = UI_THEME.colors.miscButton.neutralBase;
        prevTab.color = UI_THEME.colors.editor.buttonBorder;
      }
    }

    this.activeCategory = category;
    const tab = this.categoryTabs.get(category);
    if (tab) {
      tab.background = UI_THEME.colors.miscButton.customPlay;
      tab.color = UI_THEME.colors.editor.buttonTextActive;
    }

    this.populateAssets(category);
  }

  private populateAssets(category: string): void {
    if (!this.scrollViewer) return;

    if (this.assetGrid) {
      this.scrollViewer.removeControl(this.assetGrid);
      this.assetGrid.dispose();
    }

    this.previewImages.clear();
    this.assetCards.clear();

    const assets = getAssetsByCategory(category);
    const cols = 2;
    const rows = Math.ceil(assets.length / cols);
    const rowHeight = 124;

    this.assetGrid = new Grid('assetGrid');
    this.assetGrid.width = '100%';
    this.assetGrid.height = `${Math.max(rows * rowHeight, 100)}px`;

    for (let c = 0; c < cols; c++) this.assetGrid.addColumnDefinition(1 / cols);
    for (let r = 0; r < rows; r++) this.assetGrid.addRowDefinition(rowHeight, true);

    this.scrollViewer.addControl(this.assetGrid);

    assets.forEach((asset, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const card = this.createAssetCard(asset.id, asset.spec);
      this.assetGrid!.addControl(card, row, col);
    });

    this.generatePreviews(assets.map(a => a.id));
  }

  private generatePreviews(assetIds: string[]): void {
    for (const id of assetIds) {
      this.previewRenderer.renderPreview(id as AssetId).then((dataUrl) => {
        const img = this.previewImages.get(id);
        if (img) {
          img.source = dataUrl;
        }
      }).catch(() => {

      });
    }
  }

  private createAssetCard(assetId: string, spec: AssetSpec): Rectangle {
    const card = new Rectangle(`assetCard_${assetId}`);
    card.height = '118px';
    card.cornerRadius = UI_THEME.radii.scale.r5;
    card.thickness = 2;
    card.color = UI_THEME.colors.editor.buttonBorder;
    card.background = UI_THEME.colors.miscButton.neutralBase;
    card.paddingLeft = '4px';
    card.paddingRight = '4px';
    card.paddingTop = '4px';
    card.paddingBottom = '4px';
    card.isPointerBlocker = true;

    const stack = new StackPanel();
    stack.paddingTop = '4px';
    stack.paddingLeft = '6px';
    stack.paddingRight = '6px';
    card.addControl(stack);

    const previewImage = new Image(`assetPreview_${assetId}`);
    previewImage.width = '108px';
    previewImage.height = '72px';
    previewImage.stretch = Image.STRETCH_UNIFORM;
    previewImage.isPointerBlocker = false;
    stack.addControl(previewImage);
    this.previewImages.set(assetId, previewImage);

    const name = new TextBlock();
    name.text = getAssetDisplayName(assetId);
    name.color = UI_THEME.colors.text.primary;
    name.fontSize = UI_THEME.typography.scale.s10;
    name.fontFamily = UI_THEME.typography.fontFamily;
    name.height = '20px';
    name.textWrapping = true;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(name);

    const dims = new TextBlock();
    dims.text = `${spec.footprint[0]}x${spec.footprint[1]} footprint`;
    dims.color = UI_THEME.colors.legacy.c_88aa88;
    dims.fontSize = UI_THEME.typography.scale.s9;
    dims.fontFamily = UI_THEME.typography.fontFamily;
    dims.height = '14px';
    dims.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(dims);

    card.onPointerEnterObservable.add(() => {
      if (this.selectedAssetId !== assetId) card.background = UI_THEME.colors.editor.buttonHover;
    });
    card.onPointerOutObservable.add(() => {
      if (this.selectedAssetId !== assetId) card.background = UI_THEME.colors.miscButton.neutralBase;
    });

    card.onPointerUpObservable.add(() => {
      this.selectedAssetId = assetId;
      this.callbacks.onSelectAsset(assetId);
      this.updateSelectionState(assetId);
    });

    this.assetCards.set(assetId, card);
    return card;
  }

  public showActions(selected: boolean): void {
    if (this.actionPanel) {
      this.actionPanel.isVisible = selected;
    }
  }

  public setSelectionContext(name: string, hint: string, showActions: boolean = true): void {
    if (this.selectionNameText) {
      this.selectionNameText.text = name;
    }
    if (this.selectionHintText) {
      this.selectionHintText.text = hint;
    }
    this.showActions(showActions);
  }

  public clearSelectionContext(): void {
    if (this.selectionNameText) {
      this.selectionNameText.text = 'No asset selected';
    }
    if (this.selectionHintText) {
      this.selectionHintText.text = 'Select an asset card to enter placement mode.';
    }
    this.showActions(false);
  }

  private updateSelectionState(assetId: string): void {
    this.assetCards.forEach((card, id) => {
      const selected = id === assetId;
      card.background = selected ? UI_THEME.colors.launch.cardSelected : UI_THEME.colors.miscButton.neutralBase;
      card.color = selected ? UI_THEME.colors.launch.selectedBorder : UI_THEME.colors.editor.buttonBorder;
      card.thickness = selected ? 2 : 1;
    });

    if (this.selectionNameText) {
      this.selectionNameText.text = getAssetDisplayName(assetId);
    }
    if (this.selectionHintText) {
      this.selectionHintText.text = 'Placement mode is active. Click on the course to place, Rotate to pivot, or Cancel to leave the current pick.';
    }
    this.showActions(true);
  }

  public show(): void {
    this.container.isVisible = true;
  }

  public hide(): void {
    this.container.isVisible = false;
  }

  public isVisible(): boolean {
    return this.container.isVisible;
  }


  public dispose(): void {
    this.previewRenderer.dispose();
    this.container.dispose();
  }
}
