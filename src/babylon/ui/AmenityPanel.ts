import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';

import {
  AmenityUpgrade,
  getAvailableUpgrades,
  getUpgradeCost,
  getUpgradeName,
  getPrestigeGain,
  calculateAmenityScore,
} from '../../core/amenities';
import { PrestigeState } from '../../core/prestige';

export interface AmenityPanelCallbacks {
  onPurchaseUpgrade: (upgrade: AmenityUpgrade) => boolean;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  clubhouse: '🏛️',
  proShop: '🏪',
  dining: '🍽️',
  facility: '🏌️',
  service: '🛎️',
  cart: '🚗',
  comfortStation: '🚻',
  courseFeature: '⛳',
};

export class AmenityPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: AmenityPanelCallbacks;

  private panel: Rectangle | null = null;
  private upgradeListContainer: StackPanel | null = null;
  private scoreText: TextBlock | null = null;
  private cashText: TextBlock | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: AmenityPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('amenityPanel');
    this.panel.width = '480px';
    this.panel.height = '500px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#6a5a8a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(35, 25, 55, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.isVisible = false;
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 10;
    this.panel.shadowOffsetX = 3;
    this.panel.shadowOffsetY = 3;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('amenityStack');
    stack.paddingTop = '12px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    this.createHeader(stack);
    this.createScoreDisplay(stack);
    this.createUpgradeList(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.height = '36px';
    headerContainer.width = '456px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer);

    const title = new TextBlock('title');
    title.text = '🏛️ AMENITIES & UPGRADES';
    title.color = '#cc99ff';
    title.fontSize = 16;
    title.fontWeight = 'bold';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.left = '0px';
    headerContainer.addControl(title);

    this.cashText = new TextBlock('cashText');
    this.cashText.text = 'Cash: $0';
    this.cashText.color = '#88dd88';
    this.cashText.fontSize = 14;
    this.cashText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.cashText.paddingRight = '40px';
    headerContainer.addControl(this.cashText);

    const closeBtn = Button.CreateSimpleButton('closeBtn', '✕');
    closeBtn.width = '28px';
    closeBtn.height = '28px';
    closeBtn.cornerRadius = 4;
    closeBtn.background = '#aa4444';
    closeBtn.color = 'white';
    closeBtn.thickness = 0;
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.onPointerClickObservable.add(() => this.callbacks.onClose());
    closeBtn.onPointerEnterObservable.add(() => { closeBtn.background = '#cc5555'; });
    closeBtn.onPointerOutObservable.add(() => { closeBtn.background = '#aa4444'; });
    headerContainer.addControl(closeBtn);
  }

  private createScoreDisplay(parent: StackPanel): void {
    const container = new Rectangle('scoreContainer');
    container.height = '50px';
    container.width = '456px';
    container.cornerRadius = 4;
    container.background = 'rgba(50, 40, 70, 0.8)';
    container.thickness = 1;
    container.color = '#5a4a7a';
    container.paddingTop = '4px';
    container.paddingBottom = '4px';
    parent.addControl(container);

    this.scoreText = new TextBlock('scoreText');
    this.scoreText.text = 'Amenity Score: 0/1000 | Prestige Contribution: +0';
    this.scoreText.color = '#ddbbff';
    this.scoreText.fontSize = 13;
    this.scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(this.scoreText);
  }

  private createUpgradeList(parent: StackPanel): void {
    const sectionLabel = new TextBlock('upgradeLabel');
    sectionLabel.text = '📦 Available Upgrades';
    sectionLabel.color = '#aabb99';
    sectionLabel.fontSize = 13;
    sectionLabel.fontWeight = 'bold';
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    parent.addControl(sectionLabel);

    const scrollViewer = new ScrollViewer('upgradeScroll');
    scrollViewer.width = '456px';
    scrollViewer.height = '340px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#6a5a8a';
    scrollViewer.barBackground = 'rgba(50, 40, 70, 0.5)';
    parent.addControl(scrollViewer);

    this.upgradeListContainer = new StackPanel('upgradeList');
    this.upgradeListContainer.width = '100%';
    scrollViewer.addControl(this.upgradeListContainer);
  }

  private createUpgradeItem(
    upgrade: AmenityUpgrade,
    prestigeState: PrestigeState,
    canAfford: boolean
  ): Rectangle {
    const cost = getUpgradeCost(prestigeState.amenities, upgrade);
    const prestigeGain = getPrestigeGain(prestigeState.amenities, upgrade);
    const name = getUpgradeName(upgrade);
    const icon = CATEGORY_ICONS[upgrade.type] || '📦';

    const row = new Rectangle(`upgrade_${upgrade.type}_${Date.now()}`);
    row.height = '65px';
    row.width = '440px';
    row.cornerRadius = 4;
    row.background = canAfford ? 'rgba(60, 50, 80, 0.8)' : 'rgba(50, 50, 50, 0.6)';
    row.thickness = 1;
    row.color = canAfford ? '#7a6a9a' : '#555555';
    row.paddingTop = '4px';
    row.paddingBottom = '4px';

    const iconText = new TextBlock('icon');
    iconText.text = icon;
    iconText.fontSize = 22;
    iconText.width = '35px';
    iconText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    iconText.left = '8px';
    row.addControl(iconText);

    const nameText = new TextBlock('name');
    nameText.text = name;
    nameText.color = canAfford ? '#ffffff' : '#888888';
    nameText.fontSize = 13;
    nameText.fontWeight = 'bold';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameText.left = '48px';
    nameText.top = '-14px';
    row.addControl(nameText);

    const categoryText = new TextBlock('category');
    categoryText.text = `Category: ${upgrade.type}`;
    categoryText.color = canAfford ? '#aaaacc' : '#666666';
    categoryText.fontSize = 11;
    categoryText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    categoryText.left = '48px';
    categoryText.top = '4px';
    row.addControl(categoryText);

    const statsText = new TextBlock('stats');
    statsText.text = `Cost: $${cost.toLocaleString()} | Prestige: +${prestigeGain}`;
    statsText.color = canAfford ? '#99dd99' : '#aa6666';
    statsText.fontSize = 11;
    statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statsText.left = '48px';
    statsText.top = '20px';
    row.addControl(statsText);

    const buyBtn = Button.CreateSimpleButton('buyBtn', canAfford ? 'Buy' : 'Need $');
    buyBtn.width = '60px';
    buyBtn.height = '28px';
    buyBtn.cornerRadius = 4;
    buyBtn.background = canAfford ? '#665588' : '#555555';
    buyBtn.color = 'white';
    buyBtn.fontSize = 12;
    buyBtn.thickness = 0;
    buyBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    buyBtn.left = '-8px';
    buyBtn.isEnabled = canAfford;
    if (canAfford) {
      buyBtn.onPointerClickObservable.add(() => {
        this.callbacks.onPurchaseUpgrade(upgrade);
      });
      buyBtn.onPointerEnterObservable.add(() => { buyBtn.background = '#7766aa'; });
      buyBtn.onPointerOutObservable.add(() => { buyBtn.background = '#665588'; });
    }
    row.addControl(buyBtn);

    return row;
  }

  public update(prestigeState: PrestigeState, currentCash: number): void {
    if (!this.upgradeListContainer) return;

    this.upgradeListContainer.clearControls();

    if (this.cashText) {
      this.cashText.text = `Cash: $${currentCash.toLocaleString()}`;
    }

    const amenityScore = calculateAmenityScore(prestigeState.amenities);
    if (this.scoreText) {
      const contribution = Math.round(amenityScore * 0.2);
      this.scoreText.text = `Amenity Score: ${amenityScore}/1000 | Prestige Contribution: +${contribution}`;
    }

    const upgrades = getAvailableUpgrades(prestigeState.amenities);

    if (upgrades.length === 0) {
      const emptyText = new TextBlock('emptyUpgrades');
      emptyText.text = 'All amenities purchased! Your course is fully upgraded.';
      emptyText.color = '#88dd88';
      emptyText.fontSize = 12;
      emptyText.height = '40px';
      emptyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.upgradeListContainer.addControl(emptyText);
    } else {
      const sortedUpgrades = [...upgrades].sort((a, b) => {
        const costA = getUpgradeCost(prestigeState.amenities, a);
        const costB = getUpgradeCost(prestigeState.amenities, b);
        return costA - costB;
      });

      for (const upgrade of sortedUpgrades) {
        const cost = getUpgradeCost(prestigeState.amenities, upgrade);
        const canAfford = currentCash >= cost;
        this.upgradeListContainer.addControl(this.createUpgradeItem(upgrade, prestigeState, canAfford));
      }
    }
  }

  public show(): void {
    if (this.panel) this.panel.isVisible = true;
  }

  public hide(): void {
    if (this.panel) this.panel.isVisible = false;
  }

  public isVisible(): boolean {
    return this.panel?.isVisible ?? false;
  }

  public toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }
}
