import { UI_THEME } from './UITheme';

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { POPUP_COLORS } from './PopupUtils';
import { renderDialog } from './DialogRenderer';

import { RobotUnit } from '../../core/autonomous-equipment';

export const ENTITY_INSPECTOR_BOUNDS = {
  width: 280,
  height: 300,
  right: 10,
  top: 10,
};

export class EntityInspectorPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private onClose: () => void;
  private panel: Rectangle | null = null;
  private contentHost: StackPanel | null = null;
  private trackedRobotId: string | null = null;

  private typeText: TextBlock | null = null;
  private stateText: TextBlock | null = null;
  private batteryText: TextBlock | null = null;
  private positionText: TextBlock | null = null;
  private targetText: TextBlock | null = null;
  private speedText: TextBlock | null = null;
  private efficiencyText: TextBlock | null = null;
  private breakdownText: TextBlock | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, onClose: () => void) {
    this.advancedTexture = advancedTexture;
    this.onClose = onClose;
    this.createPanel();
  }

  private createPanel(): void {
    const rendered = renderDialog(this.advancedTexture, {
      name: 'entityInspector',
      shell: 'docked',
      width: ENTITY_INSPECTOR_BOUNDS.width,
      height: ENTITY_INSPECTOR_BOUNDS.height,
      padding: 12,
      colors: POPUP_COLORS.blue,
      dock: {
        horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_RIGHT,
        verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
        left: -ENTITY_INSPECTOR_BOUNDS.right,
        top: ENTITY_INSPECTOR_BOUNDS.top,
      },
      title: 'ROBOT INSPECTOR',
      titleColor: '#88ccff',
      headerWidth: 250,
      onClose: () => this.onClose(),
      nodes: [
        { type: 'custom', id: 'inspectorBody', render: (parent) => this.buildContent(parent) },
      ],
    });
    this.panel = rendered.panel;
    this.panel.isVisible = false;
  }

  private buildContent(parent: StackPanel): void {
    this.contentHost = new StackPanel('inspectorContent');
    this.contentHost.width = '250px';
    parent.addControl(this.contentHost);

    this.typeText = this.addRow('inspType', 'Type: —');
    this.stateText = this.addRow('inspState', 'State: —');
    this.batteryText = this.addRow('inspBattery', 'Battery: —');
    this.positionText = this.addRow('inspPos', 'Position: —');
    this.targetText = this.addRow('inspTarget', 'Target: —');
    this.speedText = this.addRow('inspSpeed', 'Speed: —');
    this.efficiencyText = this.addRow('inspEff', 'Efficiency: —');
    this.breakdownText = this.addRow('inspBreak', '');
  }

  private addRow(name: string, text: string): TextBlock {
    const tb = new TextBlock(name);
    tb.text = text;
    tb.color = UI_THEME.colors.legacy.c_aaaaaa;
    tb.fontSize = UI_THEME.typography.scale.s12;
    tb.height = '22px';
    tb.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    tb.paddingLeft = '4px';
    this.contentHost!.addControl(tb);
    return tb;
  }

  showRobot(robot: RobotUnit): void {
    if (!this.panel) return;
    this.trackedRobotId = robot.id;
    this.updateFromRobot(robot);
    this.panel.isVisible = true;
  }

  update(robot: RobotUnit): void {
    this.updateFromRobot(robot);
  }

  private updateFromRobot(robot: RobotUnit): void {
    if (!this.typeText) return;

    const batteryPct = Math.round((robot.resourceCurrent / robot.resourceMax) * 100);

    this.typeText.text = `Type: ${robot.type.toUpperCase()}`;
    this.typeText.color = UI_THEME.colors.legacy.c_88ccff;

    this.stateText!.text = `State: ${robot.state}`;
    this.stateText!.color = robot.state === 'broken'
      ? UI_THEME.colors.legacy.c_ff7f7f
      : robot.state === 'working'
        ? UI_THEME.colors.legacy.c_7fff7f
        : UI_THEME.colors.legacy.c_aaaaaa;

    this.batteryText!.text = `Battery: ${batteryPct}%`;
    this.batteryText!.color = batteryPct > 50
      ? UI_THEME.colors.legacy.c_7fff7f
      : batteryPct > 20
        ? UI_THEME.colors.legacy.c_ffdd88
        : UI_THEME.colors.legacy.c_ff7f7f;

    this.positionText!.text = `Position: (${Math.round(robot.worldX)}, ${Math.round(robot.worldZ)})`;
    this.positionText!.color = UI_THEME.colors.legacy.c_aaaaaa;

    this.targetText!.text = robot.targetX !== null
      ? `Target: (${Math.round(robot.targetX!)}, ${Math.round(robot.targetY!)})`
      : 'Target: none';
    this.targetText!.color = UI_THEME.colors.legacy.c_aaaaaa;

    this.speedText!.text = `Speed: ${robot.stats.speed.toFixed(1)}`;
    this.speedText!.color = UI_THEME.colors.legacy.c_aaaaaa;

    this.efficiencyText!.text = `Efficiency: ${Math.round(robot.stats.efficiency * 100)}%`;
    this.efficiencyText!.color = UI_THEME.colors.legacy.c_aaaaaa;

    if (robot.state === 'broken' && robot.breakdownTimeRemaining > 0) {
      this.breakdownText!.text = `Repair: ${Math.ceil(robot.breakdownTimeRemaining)}s remaining`;
      this.breakdownText!.color = UI_THEME.colors.legacy.c_ff7f7f;
      this.breakdownText!.height = '22px';
    } else {
      this.breakdownText!.text = '';
      this.breakdownText!.height = '0px';
    }
  }

  getTrackedRobotId(): string | null {
    return this.trackedRobotId;
  }

  hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
    this.trackedRobotId = null;
  }

  isVisible(): boolean {
    return this.panel?.isVisible ?? false;
  }

  dispose(): void {
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
      this.panel.dispose();
    }
  }
}
