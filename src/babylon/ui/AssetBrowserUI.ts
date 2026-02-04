import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Image } from '@babylonjs/gui/2D/controls/image';
import { Scene } from '@babylonjs/core/scene';

import { UIParent } from './UIParent';
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

    this.container = new Rectangle('assetBrowserContainer');
    this.container.width = '220px';
    this.container.height = '100%';
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.background = '#1a3a2a';
    this.container.color = '#3a5a4a';
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

    const header = new TextBlock('assetHeader');
    header.text = 'ASSET BROWSER';
    header.color = '#7FFF7F';
    header.fontSize = 13;
    header.fontFamily = 'Arial, sans-serif';
    header.height = '30px';
    header.paddingTop = '8px';
    mainStack.addControl(header);

    this.buildCategoryTabs(mainStack);
    this.buildAssetScroll(mainStack);
    this.buildActionPanel(mainStack);

    const categories = getAssetCategories();
    if (categories.length > 0) {
      this.selectCategory(categories[0]);
    }
  }

  private buildCategoryTabs(parent: StackPanel): void {
    const tabScroll = new ScrollViewer('catScroll');
    tabScroll.width = '100%';
    tabScroll.height = '90px';
    tabScroll.barColor = '#4a8a5a';
    tabScroll.barBackground = '#1a3a2a';
    tabScroll.thickness = 0;
    parent.addControl(tabScroll);

    const tabGrid = new Grid('catGrid');
    tabGrid.width = '100%';

    const categories = getAssetCategories();
    const cols = 2;
    const rows = Math.ceil(categories.length / cols);
    tabGrid.height = `${rows * 24}px`;

    for (let c = 0; c < cols; c++) tabGrid.addColumnDefinition(1 / cols);
    for (let r = 0; r < rows; r++) tabGrid.addRowDefinition(24, true);

    tabScroll.addControl(tabGrid);

    categories.forEach((cat, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const tab = new Rectangle(`catTab_${cat}`);
      tab.height = '22px';
      tab.cornerRadius = 3;
      tab.thickness = 1;
      tab.color = '#3a5a4a';
      tab.background = '#1a2a20';
      tab.paddingLeft = '2px';
      tab.paddingRight = '2px';

      const label = new TextBlock();
      label.text = cat;
      label.color = '#aaccaa';
      label.fontSize = 9;
      label.fontFamily = 'Arial, sans-serif';
      label.isPointerBlocker = false;
      tab.addControl(label);

      tab.isPointerBlocker = true;
      tab.onPointerUpObservable.add(() => this.selectCategory(cat));

      tab.onPointerEnterObservable.add(() => {
        if (this.activeCategory !== cat) tab.background = '#2a4a3a';
      });
      tab.onPointerOutObservable.add(() => {
        if (this.activeCategory !== cat) tab.background = '#1a2a20';
      });

      tabGrid.addControl(tab, row, col);
      this.categoryTabs.set(cat, tab);
    });
  }

  private buildAssetScroll(parent: StackPanel): void {
    this.scrollViewer = new ScrollViewer('assetScroll');
    this.scrollViewer.width = '100%';
    this.scrollViewer.height = '400px';
    this.scrollViewer.barColor = '#4a8a5a';
    this.scrollViewer.barBackground = '#1a3a2a';
    this.scrollViewer.thickness = 0;
    parent.addControl(this.scrollViewer);
  }

  private buildActionPanel(parent: StackPanel): void {
    this.actionPanel = new Rectangle('actionPanel');
    this.actionPanel.width = '100%';
    this.actionPanel.height = '80px';
    this.actionPanel.thickness = 0;
    this.actionPanel.background = 'rgba(26, 42, 32, 0.8)';
    this.actionPanel.isVisible = false;
    parent.addControl(this.actionPanel);

    const actionStack = new StackPanel();
    actionStack.width = '100%';
    this.actionPanel.addControl(actionStack);

    const selectedLabel = new TextBlock('selectedLabel');
    selectedLabel.text = 'Selected Asset';
    selectedLabel.color = '#7FFF7F';
    selectedLabel.fontSize = 11;
    selectedLabel.height = '20px';
    actionStack.addControl(selectedLabel);

    const buttonRow = new StackPanel();
    buttonRow.isVertical = false;
    buttonRow.height = '30px';
    buttonRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    actionStack.addControl(buttonRow);

    this.createActionButton(buttonRow, 'Rotate', '#4a6a5a', () => this.callbacks.onRotate());
    this.createActionButton(buttonRow, 'Delete', '#6a3a3a', () => this.callbacks.onDelete());

    const cancelRow = new StackPanel();
    cancelRow.isVertical = false;
    cancelRow.height = '25px';
    cancelRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    actionStack.addControl(cancelRow);

    this.createActionButton(cancelRow, 'Cancel', '#4a4a5a', () => this.callbacks.onExitPlaceMode());
  }

  private createActionButton(parent: StackPanel, label: string, bg: string, onClick: () => void): void {
    const btn = new Rectangle(`actionBtn_${label}`);
    btn.width = '70px';
    btn.height = '26px';
    btn.cornerRadius = 4;
    btn.background = bg;
    btn.color = '#7FFF7F';
    btn.thickness = 1;
    btn.paddingLeft = '3px';
    btn.paddingRight = '3px';
    btn.isPointerBlocker = true;

    const text = new TextBlock();
    text.text = label;
    text.color = 'white';
    text.fontSize = 10;
    text.fontFamily = 'Arial, sans-serif';
    text.isPointerBlocker = false;
    btn.addControl(text);

    btn.onPointerUpObservable.add(onClick);
    btn.onPointerEnterObservable.add(() => { btn.alpha = 0.8; });
    btn.onPointerOutObservable.add(() => { btn.alpha = 1; });

    parent.addControl(btn);
  }

  private selectCategory(category: string): void {
    if (this.activeCategory) {
      const prevTab = this.categoryTabs.get(this.activeCategory);
      if (prevTab) {
        prevTab.background = '#1a2a20';
        prevTab.color = '#3a5a4a';
      }
    }

    this.activeCategory = category;
    const tab = this.categoryTabs.get(category);
    if (tab) {
      tab.background = '#2a5a3a';
      tab.color = '#7FFF7F';
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
    card.cornerRadius = 4;
    card.thickness = 1;
    card.color = '#3a5a4a';
    card.background = '#1a2a20';
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
    name.fontSize = 9;
    name.fontFamily = 'Arial, sans-serif';
    name.height = '16px';
    name.textWrapping = true;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(name);

    const dims = new TextBlock();
    dims.text = `${spec.footprint[0]}x${spec.footprint[1]}`;
    dims.color = '#88aa88';
    dims.fontSize = 8;
    dims.fontFamily = 'Arial, sans-serif';
    dims.height = '14px';
    dims.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(dims);

    card.onPointerEnterObservable.add(() => {
      if (this.selectedAssetId !== assetId) card.background = '#2a4a3a';
    });
    card.onPointerOutObservable.add(() => {
      if (this.selectedAssetId !== assetId) card.background = '#1a2a20';
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
