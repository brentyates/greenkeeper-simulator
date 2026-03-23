import { UI_THEME } from './UITheme';

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { POPUP_COLORS, createPanelSection } from './PopupUtils';
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

  // Field refs removed since we now dynamically render


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

  private clearContent(): void {
    if (!this.contentHost) return;
    const controls = this.contentHost.children.slice();
    for (const control of controls) {
      this.contentHost.removeControl(control);
    }
  }

  private updateFromRobot(robot: RobotUnit): void {
    if (!this.contentHost) return;
    this.clearContent();

    const batteryPct = Math.round((robot.resourceCurrent / robot.resourceMax) * 100);
    const speed = robot.stats.speed.toFixed(1);
    const efficiency = Math.round(robot.stats.efficiency * 100);

    const isBroken = robot.state === 'broken';
    const isWorking = robot.state === 'working';

    let diagnosis = isBroken 
      ? `Unit has experienced a critical breakdown. Repair cycle in progress (${Math.ceil(robot.breakdownTimeRemaining)}s remaining).`
      : isWorking
        ? 'Unit is actively performing assigned tasks. Telemetry shows stable operation.'
        : 'Unit is currently offline or waiting for assignment.';

    this.addHeadline(`${robot.type.toUpperCase()} UNIT`, diagnosis);
    
    this.addSection('Condition', 84, (section) => {
      this.addMetricLine(section, 'Status', robot.state.toUpperCase(), isBroken ? UI_THEME.colors.text.danger : isWorking ? UI_THEME.colors.text.success : UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Battery', `${batteryPct}%`, batteryPct > 50 ? UI_THEME.colors.text.success : batteryPct > 20 ? UI_THEME.colors.legacy.c_ffdd88 : UI_THEME.colors.text.danger);
      this.addMetricLine(section, 'Efficiency', `${efficiency}%`, UI_THEME.colors.text.info);
    });

    this.addSection('Telemetry', 70, (section) => {
      this.addMetricLine(section, 'World Position', `X: ${Math.round(robot.worldX)}, Z: ${Math.round(robot.worldZ)}`, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Active Target', robot.targetX !== null ? `X: ${Math.round(robot.targetX)}, Z: ${Math.round(robot.targetY!)}` : 'None', UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Travel Speed', `${speed} units/s`, UI_THEME.colors.text.secondary);
    });
  }

  private addHeadline(titleText: string, description: string): void {
    if (!this.contentHost) return;

    const title = new TextBlock(`headline_${titleText}`);
    title.text = titleText;
    title.color = '#88ccff';
    title.fontSize = UI_THEME.typography.scale.s16;
    title.fontWeight = 'bold';
    title.height = '22px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.contentHost.addControl(title);

    const descriptionText = new TextBlock(`headlineDesc_${titleText}`);
    descriptionText.text = description;
    descriptionText.color = UI_THEME.colors.text.secondary;
    descriptionText.fontSize = UI_THEME.typography.scale.s11;
    descriptionText.height = '34px';
    descriptionText.textWrapping = true;
    descriptionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.contentHost.addControl(descriptionText);
  }

  private addSection(titleText: string, height: number, render: (section: StackPanel) => void): void {
    if (!this.contentHost) return;

    const section = createPanelSection(this.contentHost, {
      name: `EntityInfo_${titleText}`,
      width: 250,
      height,
      theme: 'blue',
      background: 'rgba(24, 40, 51, 0.84)',
      borderColor: '#3f586a',
      cornerRadius: 4,
      paddingTop: 4,
      paddingBottom: 4,
      marginTop: 6,
    });

    const stack = new StackPanel(`${titleText}_stack`);
    stack.width = '234px';
    section.addControl(stack);

    const label = new TextBlock(`${titleText}_label`);
    label.text = titleText.toUpperCase();
    label.color = UI_THEME.colors.text.info;
    label.fontSize = UI_THEME.typography.scale.s10;
    label.fontWeight = 'bold';
    label.height = '18px';
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(label);

    render(stack);
  }

  private addMetricLine(parent: StackPanel, label: string, value: string, valueColor: string): void {
    const row = new StackPanel(`${label}_row`);
    row.isVertical = false;
    row.height = '18px';
    parent.addControl(row);

    const labelText = new TextBlock(`${label}_label`);
    labelText.text = `${label}`;
    labelText.color = UI_THEME.colors.text.secondary;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.width = '100px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const valueText = new TextBlock(`${label}_value`);
    valueText.text = value;
    valueText.color = valueColor;
    valueText.fontSize = UI_THEME.typography.scale.s11;
    valueText.width = '134px';
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(valueText);
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
