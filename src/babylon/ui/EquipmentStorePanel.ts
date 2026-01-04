import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';

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
    this.panel = new Rectangle('equipmentStorePanel');
    this.panel.width = '500px';
    this.panel.height = '520px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#4a7a9a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 35, 55, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.isVisible = false;
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 10;
    this.panel.shadowOffsetX = 3;
    this.panel.shadowOffsetY = 3;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('equipmentStack');
    stack.paddingTop = '12px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    this.createHeader(stack);
    this.createFleetStats(stack);
    this.createAvailableSection(stack);
    this.createOwnedSection(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.height = '36px';
    headerContainer.width = '476px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer);

    const title = new TextBlock('title');
    title.text = '🤖 EQUIPMENT STORE';
    title.color = '#66ccff';
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

  private createFleetStats(parent: StackPanel): void {
    const container = new Rectangle('fleetStatsContainer');
    container.height = '50px';
    container.width = '476px';
    container.cornerRadius = 4;
    container.background = 'rgba(30, 50, 70, 0.8)';
    container.thickness = 1;
    container.color = '#3a5a7a';
    container.paddingTop = '4px';
    container.paddingBottom = '4px';
    parent.addControl(container);

    this.statsText = new TextBlock('statsText');
    this.statsText.text = 'Fleet: 0 robots | Working: 0 | Broken: 0';
    this.statsText.color = '#aaddff';
    this.statsText.fontSize = 13;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(this.statsText);
  }

  private createAvailableSection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('availableLabel');
    sectionLabel.text = '📦 Available for Purchase';
    sectionLabel.color = '#88cc88';
    sectionLabel.fontSize = 13;
    sectionLabel.fontWeight = 'bold';
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    parent.addControl(sectionLabel);

    const scrollViewer = new ScrollViewer('availableScroll');
    scrollViewer.width = '476px';
    scrollViewer.height = '160px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a7a9a';
    scrollViewer.barBackground = 'rgba(30, 50, 70, 0.5)';
    parent.addControl(scrollViewer);

    this.availableListContainer = new StackPanel('availableList');
    this.availableListContainer.width = '100%';
    scrollViewer.addControl(this.availableListContainer);
  }

  private createOwnedSection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('ownedLabel');
    sectionLabel.text = '🔧 Your Fleet';
    sectionLabel.color = '#88aacc';
    sectionLabel.fontSize = 13;
    sectionLabel.fontWeight = 'bold';
    sectionLabel.height = '24px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sectionLabel.paddingTop = '8px';
    parent.addControl(sectionLabel);

    const scrollViewer = new ScrollViewer('ownedScroll');
    scrollViewer.width = '476px';
    scrollViewer.height = '160px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a7a9a';
    scrollViewer.barBackground = 'rgba(30, 50, 70, 0.5)';
    parent.addControl(scrollViewer);

    this.ownedListContainer = new StackPanel('ownedList');
    this.ownedListContainer.width = '100%';
    scrollViewer.addControl(this.ownedListContainer);
  }

  private createAvailableItem(robot: AvailableRobot, canAfford: boolean): Rectangle {
    const row = new Rectangle(`available_${robot.equipmentId}`);
    row.height = '70px';
    row.width = '460px';
    row.cornerRadius = 4;
    row.background = canAfford ? 'rgba(40, 70, 100, 0.8)' : 'rgba(60, 60, 60, 0.6)';
    row.thickness = 1;
    row.color = canAfford ? '#5588aa' : '#555555';
    row.paddingTop = '4px';
    row.paddingBottom = '4px';

    const icon = new TextBlock('icon');
    icon.text = getRobotIcon(robot.equipmentId);
    icon.fontSize = 24;
    icon.width = '40px';
    icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    icon.left = '8px';
    row.addControl(icon);

    const nameText = new TextBlock('name');
    nameText.text = robot.name;
    nameText.color = canAfford ? '#ffffff' : '#888888';
    nameText.fontSize = 13;
    nameText.fontWeight = 'bold';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameText.left = '52px';
    nameText.top = '-16px';
    row.addControl(nameText);

    const descText = new TextBlock('desc');
    descText.text = `Speed: ${robot.stats.speed.toFixed(1)}x | Efficiency: ${(robot.stats.efficiency * 100).toFixed(0)}% | Fuel: ${robot.stats.fuelCapacity}`;
    descText.color = canAfford ? '#aaccee' : '#666666';
    descText.fontSize = 11;
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    descText.left = '52px';
    descText.top = '2px';
    row.addControl(descText);

    const costText = new TextBlock('cost');
    costText.text = `$${(robot.stats.purchaseCost ?? 0).toLocaleString()}/hr: $${(robot.stats.operatingCostPerHour ?? 0).toFixed(2)}`;
    costText.color = canAfford ? '#88dd88' : '#aa6666';
    costText.fontSize = 11;
    costText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    costText.left = '52px';
    costText.top = '18px';
    row.addControl(costText);

    const buyBtn = Button.CreateSimpleButton('buyBtn', canAfford ? 'Buy' : 'Need $');
    buyBtn.width = '60px';
    buyBtn.height = '28px';
    buyBtn.cornerRadius = 4;
    buyBtn.background = canAfford ? '#338833' : '#555555';
    buyBtn.color = 'white';
    buyBtn.fontSize = 12;
    buyBtn.thickness = 0;
    buyBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    buyBtn.left = '-8px';
    buyBtn.isEnabled = canAfford;
    if (canAfford) {
      buyBtn.onPointerClickObservable.add(() => {
        this.callbacks.onPurchaseRobot(robot.equipmentId, robot.stats);
      });
      buyBtn.onPointerEnterObservable.add(() => { buyBtn.background = '#44aa44'; });
      buyBtn.onPointerOutObservable.add(() => { buyBtn.background = '#338833'; });
    }
    row.addControl(buyBtn);

    return row;
  }

  private createOwnedItem(robot: RobotUnit): Rectangle {
    const row = new Rectangle(`owned_${robot.id}`);
    row.height = '55px';
    row.width = '460px';
    row.cornerRadius = 4;
    row.background = robot.state === 'broken'
      ? 'rgba(100, 50, 50, 0.8)'
      : 'rgba(40, 60, 80, 0.8)';
    row.thickness = 1;
    row.color = robot.state === 'broken' ? '#aa5555' : '#4a6a8a';
    row.paddingTop = '4px';
    row.paddingBottom = '4px';

    const icon = new TextBlock('icon');
    icon.text = getRobotIcon(robot.equipmentId);
    icon.fontSize = 20;
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
    nameText.color = '#ffffff';
    nameText.fontSize = 12;
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
    statusText.fontSize = 11;
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusText.left = '48px';
    statusText.top = '10px';
    row.addControl(statusText);

    const sellValue = Math.floor((robot.stats.purchaseCost ?? 0) * 0.5);
    const sellBtn = Button.CreateSimpleButton('sellBtn', `Sell $${sellValue.toLocaleString()}`);
    sellBtn.width = '80px';
    sellBtn.height = '24px';
    sellBtn.cornerRadius = 4;
    sellBtn.background = '#884433';
    sellBtn.color = 'white';
    sellBtn.fontSize = 11;
    sellBtn.thickness = 0;
    sellBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    sellBtn.left = '-8px';
    sellBtn.onPointerClickObservable.add(() => {
      this.callbacks.onSellRobot(robot.id);
    });
    sellBtn.onPointerEnterObservable.add(() => { sellBtn.background = '#aa5544'; });
    sellBtn.onPointerOutObservable.add(() => { sellBtn.background = '#884433'; });
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
      emptyText.color = '#888888';
      emptyText.fontSize = 12;
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
      emptyText.color = '#888888';
      emptyText.fontSize = 12;
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
