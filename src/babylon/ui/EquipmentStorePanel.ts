import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
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
import type { CourseArea } from '../../core/employee-work';
import { uiAutomationBridge } from '../../automation/UIAutomationBridge';
import type { Button } from '@babylonjs/gui/2D/controls/button';

export interface EquipmentStorePanelCallbacks {
  onPurchaseRobot: (equipmentId: string, stats: EquipmentStats) => boolean;
  onSellRobot: (robotId: string) => boolean;
  onAssignRobotArea: (robotId: string, areaId: string | null) => void;
  onClose: () => void;
}

interface AvailableRobot {
  equipmentId: string;
  name: string;
  description: string;
  stats: EquipmentStats;
}

const EQUIPMENT_STORE_WIDTH = 560;
const EQUIPMENT_STORE_HEIGHT = 600;
const EQUIPMENT_CONTENT_WIDTH = 536;
const EQUIPMENT_ROW_WIDTH = 520;

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

function getAreaLabel(areaId: string | null, areas: readonly CourseArea[]): string {
  if (!areaId || areaId === 'all_course') return 'Anywhere';
  return areas.find((area) => area.id === areaId)?.name ?? 'Assigned Area';
}

export class EquipmentStorePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: EquipmentStorePanelCallbacks;

  private panel: Rectangle | null = null;
  private availableListContainer: StackPanel | null = null;
  private ownedListContainer: StackPanel | null = null;
  private statsText: TextBlock | null = null;
  private cashText: TextBlock | null = null;
  private selectedRobotId: string | null = null;
  private selectedRobotSummary: TextBlock | null = null;
  private selectedRobotDuty: TextBlock | null = null;
  private selectedRobotAreaGrid: Grid | null = null;
  private currentResearchState: ResearchState | null = null;
  private currentAutonomousState: AutonomousEquipmentState | null = null;
  private currentCash: number = 0;
  private currentAreas: readonly CourseArea[] = [];
  private mainCloseButton: Button | null = null;
  private availableBuyButtons = new Map<string, Button>();
  private ownedSelectControls = new Map<string, Rectangle>();
  private ownedSellButtons = new Map<string, Button>();
  private selectedRobotAreaButtons = new Map<string, Button>();

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: EquipmentStorePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDirectPopup(this.advancedTexture, {
      name: 'equipmentStore',
      width: EQUIPMENT_STORE_WIDTH,
      height: EQUIPMENT_STORE_HEIGHT,
      colors: POPUP_COLORS.blue,
      padding: 12,
    });

    this.panel = panel;

    this.createHeader(stack);
    this.createFleetStats(stack);
    this.createRobotPolicySection(stack);
    this.createAvailableSection(stack);
    this.createOwnedSection(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = createPopupHeader(parent, {
      title: '🤖 FLEET OPS',
      titleColor: UI_THEME.colors.text.info,
      width: EQUIPMENT_CONTENT_WIDTH,
      onClose: () => this.callbacks.onClose(),
      onCloseButtonCreated: (button) => {
        this.mainCloseButton = button;
        this.syncAutomationControls();
      },
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
      width: EQUIPMENT_CONTENT_WIDTH,
      height: 56,
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

  private createRobotPolicySection(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'robotPolicyContainer',
      width: EQUIPMENT_CONTENT_WIDTH,
      height: 112,
      theme: 'blue',
      paddingTop: 6,
    });

    this.selectedRobotSummary = new TextBlock('selectedRobotSummary');
    this.selectedRobotSummary.text = 'Select a robot to set its patrol zone.';
    this.selectedRobotSummary.color = UI_THEME.colors.legacy.c_ffffff;
    this.selectedRobotSummary.fontSize = UI_THEME.typography.scale.s12;
    this.selectedRobotSummary.height = '20px';
    this.selectedRobotSummary.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.selectedRobotSummary.paddingLeft = '12px';
    this.selectedRobotSummary.paddingTop = '6px';
    container.addControl(this.selectedRobotSummary);

    this.selectedRobotDuty = new TextBlock('selectedRobotDuty');
    this.selectedRobotDuty.text = 'Each robot keeps working on its own. Set where it should spend its time.';
    this.selectedRobotDuty.color = UI_THEME.colors.text.secondary;
    this.selectedRobotDuty.fontSize = UI_THEME.typography.scale.s10;
    this.selectedRobotDuty.height = '28px';
    this.selectedRobotDuty.textWrapping = true;
    this.selectedRobotDuty.lineSpacing = '2px';
    this.selectedRobotDuty.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.selectedRobotDuty.paddingLeft = '12px';
    this.selectedRobotDuty.paddingRight = '12px';
    this.selectedRobotDuty.top = '18px';
    container.addControl(this.selectedRobotDuty);

    this.selectedRobotAreaGrid = new Grid('selectedRobotAreaGrid');
    this.selectedRobotAreaGrid.width = `${EQUIPMENT_CONTENT_WIDTH - 18}px`;
    this.selectedRobotAreaGrid.height = '44px';
    this.selectedRobotAreaGrid.top = '38px';
    this.selectedRobotAreaGrid.addColumnDefinition(0.25);
    this.selectedRobotAreaGrid.addColumnDefinition(0.25);
    this.selectedRobotAreaGrid.addColumnDefinition(0.25);
    this.selectedRobotAreaGrid.addColumnDefinition(0.25);
    this.selectedRobotAreaGrid.addRowDefinition(1);
    container.addControl(this.selectedRobotAreaGrid);
  }

  private createAvailableSection(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'availableSection',
      title: {
        text: '📦 Available for Purchase',
        color: UI_THEME.colors.text.success,
        fontSize: 13,
        fontWeight: 'bold',
        height: 24,
        paddingTop: 8,
      },
      width: EQUIPMENT_CONTENT_WIDTH,
      height: 210,
      theme: 'blue',
      scroll: {
        name: 'availableScroll',
        width: EQUIPMENT_CONTENT_WIDTH,
        height: 210,
        contentName: 'availableList',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: UI_THEME.colors.border.info,
          barBackground: UI_THEME.colors.surfaces.panelInset,
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
        color: UI_THEME.colors.text.info,
        fontSize: 13,
        fontWeight: 'bold',
        height: 24,
        paddingTop: 8,
      },
      width: EQUIPMENT_CONTENT_WIDTH,
      height: 210,
      theme: 'blue',
      scroll: {
        name: 'ownedScroll',
        width: EQUIPMENT_CONTENT_WIDTH,
        height: 210,
        contentName: 'ownedList',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: UI_THEME.colors.border.info,
          barBackground: UI_THEME.colors.surfaces.panelInset,
        },
      },
    });
    this.ownedListContainer = content;
  }

  private createAvailableItem(robot: AvailableRobot, canAfford: boolean): Rectangle {
    const row = createListRowCard({
      name: `available_${robot.equipmentId}`,
      width: EQUIPMENT_ROW_WIDTH,
      height: 76,
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
    descText.color = canAfford ? UI_THEME.colors.text.info : UI_THEME.colors.text.muted;
    descText.fontSize = UI_THEME.typography.scale.s11;
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    descText.left = '52px';
    descText.top = '2px';
    row.addControl(descText);

    const costText = new TextBlock('cost');
    costText.text = `$${(robot.stats.purchaseCost ?? 0).toLocaleString()}/hr: $${(robot.stats.operatingCostPerHour ?? 0).toFixed(2)}`;
    costText.color = canAfford ? UI_THEME.colors.text.success : UI_THEME.colors.text.danger;
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
    this.availableBuyButtons.set(robot.equipmentId, buyBtn);

    return row;
  }

  private createOwnedItem(robot: RobotUnit): Rectangle {
    const isSelected = this.selectedRobotId === robot.id;
    const row = createListRowCard({
      name: `owned_${robot.id}`,
      width: EQUIPMENT_ROW_WIDTH,
      height: 55,
      background: isSelected
        ? 'rgba(70, 110, 145, 0.92)'
        : robot.state === 'broken'
        ? 'rgba(100, 50, 50, 0.8)'
        : 'rgba(40, 60, 80, 0.8)',
      borderColor: isSelected ? '#8ec6ff' : robot.state === 'broken' ? '#aa5555' : '#4a6a8a',
      thickness: isSelected ? 2 : 1,
    });

    row.onPointerClickObservable.add(() => {
      this.selectedRobotId = robot.id;
      if (this.currentResearchState && this.currentAutonomousState) {
        this.update(this.currentResearchState, this.currentAutonomousState, this.currentCash, this.currentAreas);
      }
    });
    this.ownedSelectControls.set(robot.id, row);

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
    statusText.text = `State: ${robot.state} | Fuel: ${fuelPercent}% | Zone: ${getAreaLabel(robot.assignedAreaId ?? null, this.currentAreas)}`;
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
    this.ownedSellButtons.set(robot.id, sellBtn);

    return row;
  }

  public update(
    researchState: ResearchState,
    autonomousState: AutonomousEquipmentState,
    currentCash: number,
    areas: readonly CourseArea[]
  ): void {
    this.currentResearchState = researchState;
    this.currentAutonomousState = autonomousState;
    this.currentCash = currentCash;
    this.currentAreas = areas;
    if (!this.availableListContainer || !this.ownedListContainer) return;

    this.availableListContainer.clearControls();
    this.ownedListContainer.clearControls();
    this.availableBuyButtons.clear();
    this.ownedSelectControls.clear();
    this.ownedSellButtons.clear();
    this.selectedRobotAreaButtons.clear();

    if (this.cashText) {
      this.cashText.text = `Cash: $${currentCash.toLocaleString()}`;
    }

    if (this.statsText) {
      const total = autonomousState.robots.length;
      const working = countWorkingRobots(autonomousState);
      const broken = countBrokenRobots(autonomousState);
      this.statsText.text = `Fleet: ${total} robot${total !== 1 ? 's' : ''} | Working: ${working} | Broken: ${broken}`;
    }

    if (this.selectedRobotId && !autonomousState.robots.find((robot) => robot.id === this.selectedRobotId)) {
      this.selectedRobotId = null;
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
      emptyText.text = 'No robots are available yet.\nResearch robotics projects to unlock autonomous equipment for purchase.';
      emptyText.color = UI_THEME.colors.text.secondary;
      emptyText.fontSize = UI_THEME.typography.scale.s12;
      emptyText.height = '58px';
      emptyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      emptyText.textWrapping = true;
      emptyText.lineSpacing = '4px';
      this.availableListContainer.addControl(emptyText);
    } else {
      for (const robot of availableRobots) {
        const canAfford = currentCash >= (robot.stats.purchaseCost ?? 0);
        this.availableListContainer.addControl(this.createAvailableItem(robot, canAfford));
      }
    }

    if (autonomousState.robots.length === 0) {
      const emptyText = new TextBlock('emptyOwned');
      emptyText.text = 'Your fleet is empty.\nPurchase robots here once they are unlocked.';
      emptyText.color = UI_THEME.colors.text.secondary;
      emptyText.fontSize = UI_THEME.typography.scale.s12;
      emptyText.height = '52px';
      emptyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      emptyText.textWrapping = true;
      this.ownedListContainer.addControl(emptyText);
    } else {
      for (const robot of autonomousState.robots) {
        this.ownedListContainer.addControl(this.createOwnedItem(robot));
      }
    }

    if (this.selectedRobotSummary && this.selectedRobotAreaGrid && this.selectedRobotDuty) {
      const robot = autonomousState.robots.find((candidate) => candidate.id === this.selectedRobotId) ?? null;
      const children = [...this.selectedRobotAreaGrid.children];
      for (const child of children) {
        this.selectedRobotAreaGrid.removeControl(child);
      }

      if (!robot) {
        this.selectedRobotSummary.text = 'Select a robot to set its patrol zone.';
        this.selectedRobotDuty.text = 'Each robot keeps working on its own. Set where it should spend its time.';
      } else {
        const areaName = getAreaLabel(robot.assignedAreaId ?? null, areas);
        this.selectedRobotSummary.text = `${robot.id} • ${robot.type} • ${areaName}`;
        this.selectedRobotDuty.text = `${robot.type === 'mower' ? 'Mowing' : robot.type === 'sprayer' ? 'Watering' : robot.type === 'spreader' ? 'Fertilizing' : 'Bunker care'} automation runs inside this zone. Move it when one side of the course needs more machine attention.`;
        const areaOptions: Array<{ id: string | null; label: string }> = [
          { id: null, label: 'Anywhere' },
          ...areas.filter((area) => area.id !== 'all_course').slice(0, 3).map((area) => ({
            id: area.id,
            label: area.name,
          })),
        ];
        areaOptions.forEach((option, index) => {
          const button = createActionButton({
            id: `robotArea_${robot.id}_${option.id ?? 'any'}`,
            label: option.label,
            tone: robot.assignedAreaId === option.id ? 'primary' : 'neutral',
            width: 118,
            height: 24,
            fontSize: 10,
            onClick: () => this.callbacks.onAssignRobotArea(robot.id, option.id),
          });
          this.selectedRobotAreaButtons.set(option.id ?? 'anywhere', button);
          this.selectedRobotAreaGrid!.addControl(button, 0, index);
        });
      }
    }
    this.syncAutomationControls();
  }

  public show(): void {
    if (this.panel) this.panel.isVisible = true;
    this.syncAutomationControls();
  }

  public hide(): void {
    if (this.panel) this.panel.isVisible = false;
    this.syncAutomationControls();
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
    uiAutomationBridge.unregisterPrefix('panel.fleet.');
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  private syncAutomationControls(): void {
    uiAutomationBridge.unregisterPrefix('panel.fleet.');

    uiAutomationBridge.register({
      id: 'panel.fleet.close',
      label: 'Close Fleet Operations',
      role: 'button',
      getControl: () => this.mainCloseButton,
      isVisible: () => this.panel?.isVisible ?? false,
      isEnabled: () => this.mainCloseButton?.isEnabled ?? false,
      onActivate: () => this.callbacks.onClose(),
    });

    for (const [equipmentId, button] of this.availableBuyButtons) {
      uiAutomationBridge.register({
        id: `panel.fleet.buy.${equipmentId}`,
        label: `Buy Robot ${equipmentId}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }

    for (const [robotId, control] of this.ownedSelectControls) {
      uiAutomationBridge.register({
        id: `panel.fleet.select.${robotId}`,
        label: `Select Robot ${robotId}`,
        role: 'button',
        getControl: () => control,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => true,
        onActivate: () => control.onPointerClickObservable.notifyObservers(null as never),
      });
    }

    for (const [robotId, button] of this.ownedSellButtons) {
      uiAutomationBridge.register({
        id: `panel.fleet.sell.${robotId}`,
        label: `Sell Robot ${robotId}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }

    for (const [areaId, button] of this.selectedRobotAreaButtons) {
      uiAutomationBridge.register({
        id: `panel.fleet.assign_area.${areaId}`,
        label: `Assign Robot Area ${areaId}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }
  }
}
