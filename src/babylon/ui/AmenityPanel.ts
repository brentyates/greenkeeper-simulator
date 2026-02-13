import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { createActionButton, createDirectPopup, createListRowCard, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock, addDialogSectionLabel } from './DialogBlueprint';
import { UI_THEME } from './UITheme';

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
    const { panel, stack } = createDirectPopup(this.advancedTexture, {
      name: 'amenity',
      width: 480,
      height: 500,
      colors: POPUP_COLORS.purple,
      padding: 12,
    });

    this.panel = panel;

    this.createHeader(stack);
    this.createScoreDisplay(stack);
    this.createUpgradeList(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = createPopupHeader(parent, {
      title: '🏛️ AMENITIES & UPGRADES',
      titleColor: '#cc99ff',
      width: 456,
      onClose: () => this.callbacks.onClose(),
    });

    this.cashText = new TextBlock('cashText');
    this.cashText.text = 'Cash: $0';
    this.cashText.color = UI_THEME.colors.legacy.c_88dd88;
    this.cashText.fontSize = UI_THEME.typography.scale.s14;
    this.cashText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.cashText.paddingRight = '40px';
    headerContainer.addControl(this.cashText);
  }

  private createScoreDisplay(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'scoreContainer',
      width: 456,
      height: 50,
      theme: 'purple',
      paddingTop: 4,
      paddingBottom: 4,
    });

    this.scoreText = new TextBlock('scoreText');
    this.scoreText.text = 'Amenity Score: 0/1000 | Prestige Contribution: +0';
    this.scoreText.color = UI_THEME.colors.legacy.c_ddbbff;
    this.scoreText.fontSize = UI_THEME.typography.scale.s13;
    this.scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(this.scoreText);
  }

  private createUpgradeList(parent: StackPanel): void {
    addDialogSectionLabel(parent, {
      id: 'upgradeLabel',
      text: '📦 Available Upgrades',
      tone: 'muted',
      fontSize: 13,
      fontWeight: 'bold',
      height: 24,
      paddingTop: 8,
    });

    const { content } = addDialogScrollBlock(parent, {
      id: 'upgradeListSection',
      width: 456,
      height: 340,
      theme: 'purple',
      scroll: {
        name: 'upgradeScroll',
        width: 456,
        height: 340,
        contentName: 'upgradeList',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: '#6a5a8a',
          barBackground: 'rgba(50, 40, 70, 0.5)',
        },
      },
    });
    this.upgradeListContainer = content;
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

    const row = createListRowCard({
      name: `upgrade_${upgrade.type}_${Date.now()}`,
      width: 440,
      height: 65,
      background: canAfford ? 'rgba(60, 50, 80, 0.8)' : 'rgba(50, 50, 50, 0.6)',
      borderColor: canAfford ? '#7a6a9a' : '#555555',
    });

    const iconText = new TextBlock('icon');
    iconText.text = icon;
    iconText.fontSize = UI_THEME.typography.scale.s22;
    iconText.width = '35px';
    iconText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    iconText.left = '8px';
    row.addControl(iconText);

    const nameText = new TextBlock('name');
    nameText.text = name;
    nameText.color = canAfford ? '#ffffff' : '#888888';
    nameText.fontSize = UI_THEME.typography.scale.s13;
    nameText.fontWeight = 'bold';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameText.left = '48px';
    nameText.top = '-14px';
    row.addControl(nameText);

    const categoryText = new TextBlock('category');
    categoryText.text = `Category: ${upgrade.type}`;
    categoryText.color = canAfford ? '#aaaacc' : '#666666';
    categoryText.fontSize = UI_THEME.typography.scale.s11;
    categoryText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    categoryText.left = '48px';
    categoryText.top = '4px';
    row.addControl(categoryText);

    const statsText = new TextBlock('stats');
    statsText.text = `Cost: $${cost.toLocaleString()} | Prestige: +${prestigeGain}`;
    statsText.color = canAfford ? '#99dd99' : '#aa6666';
    statsText.fontSize = UI_THEME.typography.scale.s11;
    statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statsText.left = '48px';
    statsText.top = '20px';
    row.addControl(statsText);

    const buyBtn = createActionButton({
      id: 'buyBtn',
      label: canAfford ? 'Buy' : 'Need $',
      tone: canAfford ? 'primary' : 'neutral',
      width: 60,
      height: 28,
      fontSize: 12,
      thickness: 0,
      isEnabled: canAfford,
      onClick: () => {
        this.callbacks.onPurchaseUpgrade(upgrade);
      },
    });
    buyBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    buyBtn.left = '-8px';
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
      emptyText.color = UI_THEME.colors.legacy.c_88dd88;
      emptyText.fontSize = UI_THEME.typography.scale.s12;
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
