import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { createActionButton, createDirectPopup, createListRowCard, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock } from './DialogBlueprint';
import { UI_THEME } from './UITheme';

import {
  ResearchState,
  EquipmentStats,
  getUnlockedAutonomousEquipment,
  RESEARCH_ITEMS,
} from '../../core/research';
import {
  AutonomousEquipmentState,
  RobotUnit,
  countBrokenRobots,
  countWorkingRobots,
} from '../../core/autonomous-equipment';

export interface EquipmentStorePanelCallbacks {
  onPurchaseRobot: (equipmentId: string, stats: EquipmentStats) => boolean;
  onSellRobot: (robotId: string) => boolean;
  onClose: () => void;
}

interface AvailableRobot {
  equipmentId: string;
  name: string;
  description: string;
  stats: EquipmentStats;
}

const ROBOT_ICONS: Record<string, string> = {
  fairway: '🌿',
  bunker: '🏝️',
  green: '⛳',
  rough: '🌾',
  tee: '🏌️',
};

function getRobotIcon(equipmentId: string): string {
  for (const [key, icon] of Object.entries(ROBOT_ICONS)) {
    if (equipmentId.toLowerCase().includes(key)) return icon;
  }
  return '🤖';
}

export class EquipmentStorePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: EquipmentStorePanelCallbacks;

  private panel: Rectangle | null = null;
  private availableListContainer: StackPanel | null = null;
  private ownedListContainer: StackPanel | null = null;
  private statsText: TextBlock | null = null;
  private cashText: TextBlock | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: EquipmentStorePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDirectPopup(this.advancedTexture, {
      name: 'equipmentStore',
      width: 500,
      height: 520,
      colors: POPUP_COLORS.blue,
      padding: 12,
    });

    this.panel = panel;

    this.createHeader(stack);
    this.createFleetStats(stack);
    this.createAvailableSection(stack);
    this.createOwnedSection(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = createPopupHeader(parent, {
      title: '🤖 EQUIPMENT STORE',
      titleColor: '#66ccff',
      width: 476,
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

  private createFleetStats(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'fleetStatsContainer',
      width: 476,
      height: 50,
      theme: 'blue',
      paddingTop: 4,
      paddingBottom: 4,
    });

    this.statsText = new TextBlock('statsText');
    this.statsText.text = 'Fleet: 0 robots | Working: 0 | Broken: 0';
    this.statsText.color = UI_THEME.colors.legacy.c_aaddff;
    this.statsText.fontSize = UI_THEME.typography.scale.s13;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(this.statsText);
  }

  private createAvailableSection(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'availableSection',
      title: {
        text: '📦 Available for Purchase',
        color: '#88cc88',
        fontSize: 13,
        fontWeight: 'bold',
        height: 24,
        paddingTop: 8,
      },
      width: 476,
      height: 160,
      theme: 'blue',
      scroll: {
        name: 'availableScroll',
        width: 476,
        height: 160,
        contentName: 'availableList',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: '#4a7a9a',
          barBackground: 'rgba(30, 50, 70, 0.5)',
        },
      },
    });
    this.availableListContainer = content;
  }

  private createOwnedSection(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'ownedSection',
      title: {
        text: '🔧 Your Fleet',
        color: '#88aacc',
        fontSize: 13,
        fontWeight: 'bold',
        height: 24,
        paddingTop: 8,
      },
      width: 476,
      height: 160,
      theme: 'blue',
      scroll: {
        name: 'ownedScroll',
        width: 476,
        height: 160,
        contentName: 'ownedList',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: '#4a7a9a',
          barBackground: 'rgba(30, 50, 70, 0.5)',
        },
      },
    });
    this.ownedListContainer = content;
  }

  private createAvailableItem(robot: AvailableRobot, canAfford: boolean): Rectangle {
    const row = createListRowCard({
      name: `available_${robot.equipmentId}`,
      width: 460,
      height: 70,
      background: canAfford ? 'rgba(40, 70, 100, 0.8)' : 'rgba(60, 60, 60, 0.6)',
      borderColor: canAfford ? '#5588aa' : '#555555',
    });

    const icon = new TextBlock('icon');
    icon.text = getRobotIcon(robot.equipmentId);
    icon.fontSize = UI_THEME.typography.scale.s24;
    icon.width = '40px';
    icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    icon.left = '8px';
    row.addControl(icon);

    const nameText = new TextBlock('name');
    nameText.text = robot.name;
    nameText.color = canAfford ? '#ffffff' : '#888888';
    nameText.fontSize = UI_THEME.typography.scale.s13;
    nameText.fontWeight = 'bold';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameText.left = '52px';
    nameText.top = '-16px';
    row.addControl(nameText);

    const descText = new TextBlock('desc');
    descText.text = `Speed: ${robot.stats.speed.toFixed(1)}x | Efficiency: ${(robot.stats.efficiency * 100).toFixed(0)}% | Fuel: ${robot.stats.fuelCapacity}`;
    descText.color = canAfford ? '#aaccee' : '#666666';
    descText.fontSize = UI_THEME.typography.scale.s11;
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    descText.left = '52px';
    descText.top = '2px';
    row.addControl(descText);

    const costText = new TextBlock('cost');
    costText.text = `$${(robot.stats.purchaseCost ?? 0).toLocaleString()}/hr: $${(robot.stats.operatingCostPerHour ?? 0).toFixed(2)}`;
    costText.color = canAfford ? '#88dd88' : '#aa6666';
    costText.fontSize = UI_THEME.typography.scale.s11;
    costText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    costText.left = '52px';
    costText.top = '18px';
    row.addControl(costText);

    const buyBtn = createActionButton({
      id: 'buyBtn',
      label: canAfford ? 'Buy' : 'Need $',
      tone: canAfford ? 'success' : 'neutral',
      width: 60,
      height: 28,
      fontSize: 12,
      thickness: 0,
      isEnabled: canAfford,
      onClick: () => {
        this.callbacks.onPurchaseRobot(robot.equipmentId, robot.stats);
      },
    });
    buyBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    buyBtn.left = '-8px';
    row.addControl(buyBtn);

    return row;
  }

  private createOwnedItem(robot: RobotUnit): Rectangle {
    const row = createListRowCard({
      name: `owned_${robot.id}`,
      width: 460,
      height: 55,
      background: robot.state === 'broken'
        ? 'rgba(100, 50, 50, 0.8)'
        : 'rgba(40, 60, 80, 0.8)',
      borderColor: robot.state === 'broken' ? '#aa5555' : '#4a6a8a',
    });

    const icon = new TextBlock('icon');
    icon.text = getRobotIcon(robot.equipmentId);
    icon.fontSize = UI_THEME.typography.scale.s20;
    icon.width = '35px';
    icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    icon.left = '8px';
    row.addControl(icon);

    const stateIcon = robot.state === 'working' ? '⚙️' :
                      robot.state === 'moving' ? '🚶' :
                      robot.state === 'charging' ? '🔋' :
                      robot.state === 'broken' ? '🔧' : '💤';

    const nameText = new TextBlock('name');
    nameText.text = `${robot.id} ${stateIcon}`;
    nameText.color = UI_THEME.colors.legacy.c_ffffff;
    nameText.fontSize = UI_THEME.typography.scale.s12;
    nameText.fontWeight = 'bold';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameText.left = '48px';
    nameText.top = '-10px';
    row.addControl(nameText);

    const fuelPercent = robot.resourceMax > 0
      ? Math.round((robot.resourceCurrent / robot.resourceMax) * 100)
      : 100;

    const statusText = new TextBlock('status');
    statusText.text = `State: ${robot.state} | Fuel: ${fuelPercent}%`;
    statusText.color = robot.state === 'broken' ? '#ff8888' : '#88bbdd';
    statusText.fontSize = UI_THEME.typography.scale.s11;
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusText.left = '48px';
    statusText.top = '10px';
    row.addControl(statusText);

    const sellValue = Math.floor((robot.stats.purchaseCost ?? 0) * 0.5);
    const sellBtn = createActionButton({
      id: 'sellBtn',
      label: `Sell $${sellValue.toLocaleString()}`,
      tone: 'danger',
      width: 80,
      height: 24,
      fontSize: 11,
      thickness: 0,
      onClick: () => {
        this.callbacks.onSellRobot(robot.id);
      },
    });
    sellBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    sellBtn.left = '-8px';
    row.addControl(sellBtn);

    return row;
  }

  public update(
    researchState: ResearchState,
    autonomousState: AutonomousEquipmentState,
    currentCash: number
  ): void {
    if (!this.availableListContainer || !this.ownedListContainer) return;

    this.availableListContainer.clearControls();
    this.ownedListContainer.clearControls();

    if (this.cashText) {
      this.cashText.text = `Cash: $${currentCash.toLocaleString()}`;
    }

    if (this.statsText) {
      const total = autonomousState.robots.length;
      const working = countWorkingRobots(autonomousState);
      const broken = countBrokenRobots(autonomousState);
      this.statsText.text = `Fleet: ${total} robot${total !== 1 ? 's' : ''} | Working: ${working} | Broken: ${broken}`;
    }

    const unlockedRobots = getUnlockedAutonomousEquipment(researchState);
    const availableRobots: AvailableRobot[] = [];

    for (const unlock of unlockedRobots) {
      for (const item of RESEARCH_ITEMS) {
        if (item.unlocks.type === 'equipment' &&
            item.unlocks.equipmentId === unlock.equipmentId) {
          availableRobots.push({
            equipmentId: unlock.equipmentId,
            name: item.name,
            description: item.description,
            stats: unlock.stats,
          });
          break;
        }
      }
    }

    if (availableRobots.length === 0) {
      const emptyText = new TextBlock('emptyAvailable');
      emptyText.text = 'Research robotics to unlock autonomous equipment';
      emptyText.color = UI_THEME.colors.legacy.c_888888;
      emptyText.fontSize = UI_THEME.typography.scale.s12;
      emptyText.height = '40px';
      emptyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.availableListContainer.addControl(emptyText);
    } else {
      for (const robot of availableRobots) {
        const canAfford = currentCash >= (robot.stats.purchaseCost ?? 0);
        this.availableListContainer.addControl(this.createAvailableItem(robot, canAfford));
      }
    }

    if (autonomousState.robots.length === 0) {
      const emptyText = new TextBlock('emptyOwned');
      emptyText.text = 'No robots owned yet';
      emptyText.color = UI_THEME.colors.legacy.c_888888;
      emptyText.fontSize = UI_THEME.typography.scale.s12;
      emptyText.height = '40px';
      emptyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.ownedListContainer.addControl(emptyText);
    } else {
      for (const robot of autonomousState.robots) {
        this.ownedListContainer.addControl(this.createOwnedItem(robot));
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
