import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Image } from '@babylonjs/gui/2D/controls/image';
import { Scene } from '@babylonjs/core/scene';

import { UIParent } from './UIParent';
import { createPanelSection, createPopupHeader } from './PopupUtils';
import { addDialogActionBar, addDialogScrollBlock, addDialogSectionLabel } from './DialogBlueprint';
import { addVerticalSpacer, UI_SPACING } from './LayoutUtils';
import { UI_THEME } from './UITheme';
import { AssetPreviewRenderer } from '../assets/AssetPreviewRenderer';

import {
  getAssetCategories,
  getAssetsByCategory,
  getAssetDisplayName,
  AssetSpec,
  AssetId,
} from '../assets/AssetManifest';

export interface AssetBrowserCallbacks {
  onSelectAsset: (assetId: string) => void;
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
  private previewRenderer: AssetPreviewRenderer;
  private previewImages: Map<string, Image> = new Map();

  constructor(parent: UIParent, callbacks: AssetBrowserCallbacks, scene: Scene) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.previewRenderer = new AssetPreviewRenderer(scene.getEngine());

    this.container = new Rectangle('assetBrowserShell');
    this.container.width = '220px';
    this.container.height = '100%';
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.background = UI_THEME.colors.editor.buttonBase;
    this.container.color = UI_THEME.colors.editor.buttonBorder;
    this.container.thickness = 1;
    this.container.isVisible = false;

    this.buildUI();
    this.parent.addControl(this.container);
  }

  private buildUI(): void {
    const mainStack = new StackPanel('assetBrowserStack');
    mainStack.width = '100%';
    mainStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.addControl(mainStack);

    createPopupHeader(mainStack, {
      title: 'ASSET BROWSER',
      titleColor: UI_THEME.colors.editor.buttonTextActive,
      width: 200,
      onClose: () => this.hide(),
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
      width: 220,
      height: 90,
      theme: 'neutral',
      cornerRadius: 0,
      thickness: 0,
      paddingTop: 0,
      paddingBottom: 0,
      scroll: {
        name: 'catScroll',
        width: 220,
        height: 90,
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
    tabGrid.height = `${rows * 24}px`;

    for (let c = 0; c < cols; c++) tabGrid.addColumnDefinition(1 / cols);
    for (let r = 0; r < rows; r++) tabGrid.addRowDefinition(24, true);

    content.addControl(tabGrid);

    categories.forEach((cat, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const tab = new Rectangle(`catTab_${cat}`);
      tab.height = '22px';
      tab.cornerRadius = UI_THEME.radii.scale.r3;
      tab.thickness = 1;
      tab.color = UI_THEME.colors.editor.buttonBorder;
      tab.background = UI_THEME.colors.miscButton.neutralBase;
      tab.paddingLeft = '2px';
      tab.paddingRight = '2px';

      const label = new TextBlock();
      label.text = cat;
      label.color = UI_THEME.colors.editor.buttonText;
      label.fontSize = UI_THEME.typography.scale.s9;
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
      width: 220,
      height: 400,
      theme: 'neutral',
      cornerRadius: 0,
      thickness: 0,
      paddingTop: 0,
      paddingBottom: 0,
      scroll: {
        name: 'assetScroll',
        width: 220,
        height: 400,
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
      width: 220,
      height: 86,
      theme: 'green',
      paddingTop: 4,
      paddingBottom: 4,
    });
    this.actionPanel.isVisible = false;

    const actionStack = new StackPanel();
    actionStack.width = '208px';
    this.actionPanel.addControl(actionStack);

    addDialogSectionLabel(actionStack, {
      id: 'selectedLabel',
      text: 'Selected Asset',
      tone: 'success',
      fontSize: 11,
      height: 18,
    });
    addVerticalSpacer(actionStack, UI_SPACING.xs, 'assetActionGap');

    const { buttons } = addDialogActionBar(actionStack, {
      id: 'assetActions',
      width: 208,
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

    const assets = getAssetsByCategory(category);
    const cols = 2;
    const rows = Math.ceil(assets.length / cols);
    const rowHeight = 95;

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
      }).catch((err) => {
        console.warn(`[AssetBrowser] Preview failed for ${id}:`, err);
      });
    }
  }

  private createAssetCard(assetId: string, spec: AssetSpec): Rectangle {
    const card = new Rectangle(`assetCard_${assetId}`);
    card.height = '90px';
    card.cornerRadius = UI_THEME.radii.scale.r4;
    card.thickness = 1;
    card.color = UI_THEME.colors.editor.buttonBorder;
    card.background = UI_THEME.colors.miscButton.neutralBase;
    card.paddingLeft = '3px';
    card.paddingRight = '3px';
    card.paddingTop = '2px';
    card.paddingBottom = '2px';
    card.isPointerBlocker = true;

    const stack = new StackPanel();
    stack.paddingTop = '4px';
    stack.paddingLeft = '4px';
    card.addControl(stack);

    const previewImage = new Image(`assetPreview_${assetId}`);
    previewImage.width = '80px';
    previewImage.height = '60px';
    previewImage.stretch = Image.STRETCH_UNIFORM;
    previewImage.isPointerBlocker = false;
    stack.addControl(previewImage);
    this.previewImages.set(assetId, previewImage);

    const name = new TextBlock();
    name.text = getAssetDisplayName(assetId);
    name.color = 'white';
    name.fontSize = UI_THEME.typography.scale.s9;
    name.fontFamily = UI_THEME.typography.fontFamily;
    name.height = '16px';
    name.textWrapping = true;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(name);

    const dims = new TextBlock();
    dims.text = `${spec.footprint[0]}x${spec.footprint[1]}`;
    dims.color = UI_THEME.colors.legacy.c_88aa88;
    dims.fontSize = UI_THEME.typography.scale.s8;
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
    });

    return card;
  }

  public showActions(selected: boolean): void {
    if (this.actionPanel) {
      this.actionPanel.isVisible = selected;
    }
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
