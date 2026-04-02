import { UI_THEME } from './UITheme';

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { POPUP_COLORS, createActionButton, createPanelSection } from './PopupUtils';
import { renderDialog } from './DialogRenderer';

import type { RobotUnit } from '../../core/autonomous-equipment';
import type { Employee, EmployeeFocusPreference } from '../../core/employees';
import type { EmployeeTask } from '../../core/employee-work';
import type { Golfer } from '../../core/golfers';
import type { PlacedAsset } from '../../data/customCourseData';
import { getAssetDisplayName } from '../assets/AssetManifest';

export const ENTITY_INSPECTOR_BOUNDS = {
  width: 332,
  height: 352,
  right: 12,
  top: 148,
};

type ActionTone = 'primary' | 'danger' | 'warning' | 'neutral' | 'success';

interface InspectorAction {
  label: string;
  tone: ActionTone;
  onClick: () => void;
}

interface RobotInspectorView {
  kind: 'robot';
  robot: RobotUnit;
  assignedAreaName: string;
  action: InspectorAction | null;
}

interface EmployeeInspectorView {
  kind: 'employee';
  employee: Employee;
  currentTask: EmployeeTask;
  worldX: number;
  worldZ: number;
  areaName: string;
  focus: EmployeeFocusPreference;
  action: InspectorAction | null;
}

interface AssetInspectorView {
  kind: 'asset';
  asset: PlacedAsset;
  canDelete: boolean;
  facilitySnapshot: FacilitySnapshot | null;
  action: InspectorAction | null;
}

interface GolferInspectorView {
  kind: 'golfer';
  golfer: Golfer;
  worldX: number;
  worldZ: number;
  action: InspectorAction | null;
}

interface FacilitySnapshot {
  category: 'facility' | 'utility' | 'prop';
  status: string;
  sectionTitle: string;
  metrics: Array<{
    label: string;
    value: string;
    tone?: string;
  }>;
  note: string;
}

type InspectorView = RobotInspectorView | EmployeeInspectorView | AssetInspectorView | GolferInspectorView;

export class EntityInspectorPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private onClose: () => void;
  private panel: Rectangle | null = null;
  private contentHost: StackPanel | null = null;
  private trackedRobotId: string | null = null;
  private currentView: InspectorView | null = null;

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
      title: 'ENTITY STATUS',
      titleColor: UI_THEME.colors.text.info,
      headerWidth: 304,
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
    this.contentHost.width = '304px';
    parent.addControl(this.contentHost);
  }

  showRobot(robot: RobotUnit, assignedAreaName: string, action: InspectorAction | null = null): void {
    this.trackedRobotId = robot.id;
    this.currentView = {
      kind: 'robot',
      robot,
      assignedAreaName,
      action,
    };
    this.renderCurrentView();
  }

  showEmployee(
    employee: Employee,
    currentTask: EmployeeTask,
    worldX: number,
    worldZ: number,
    areaName: string,
    focus: EmployeeFocusPreference,
    action: InspectorAction | null = null
  ): void {
    this.trackedRobotId = null;
    this.currentView = {
      kind: 'employee',
      employee,
      currentTask,
      worldX,
      worldZ,
      areaName,
      focus,
      action,
    };
    this.renderCurrentView();
  }

  showAsset(asset: PlacedAsset, canDelete: boolean, facilitySnapshot: FacilitySnapshot | null, action: InspectorAction | null = null): void {
    this.trackedRobotId = null;
    this.currentView = {
      kind: 'asset',
      asset,
      canDelete,
      facilitySnapshot,
      action,
    };
    this.renderCurrentView();
  }

  showGolfer(
    golfer: Golfer,
    worldX: number,
    worldZ: number,
    action: InspectorAction | null = null
  ): void {
    this.trackedRobotId = null;
    this.currentView = {
      kind: 'golfer',
      golfer,
      worldX,
      worldZ,
      action,
    };
    this.renderCurrentView();
  }

  update(robot: RobotUnit, assignedAreaName: string): void {
    if (this.currentView?.kind !== 'robot') return;
    this.currentView = {
      ...this.currentView,
      robot,
      assignedAreaName,
    };
    this.renderCurrentView();
  }

  private renderCurrentView(): void {
    if (!this.contentHost || !this.currentView) return;
    this.clearContent();

    if (this.currentView.kind === 'robot') {
      this.renderRobot(this.currentView);
    } else if (this.currentView.kind === 'employee') {
      this.renderEmployee(this.currentView);
    } else if (this.currentView.kind === 'golfer') {
      this.renderGolfer(this.currentView);
    } else {
      this.renderAsset(this.currentView);
    }

    if (this.currentView.action) {
      const button = createActionButton({
        id: `entityInspectorAction_${this.currentView.kind}`,
        label: this.currentView.action.label,
        tone: this.currentView.action.tone,
        width: 304,
        height: 34,
        fontSize: UI_THEME.typography.scale.s11,
        onClick: this.currentView.action.onClick,
      });
      button.paddingTop = '8px';
      this.contentHost.addControl(button);
    }

    if (this.panel) {
      this.panel.isVisible = true;
    }
  }

  private renderRobot(view: RobotInspectorView): void {
    const { robot, assignedAreaName } = view;
    const batteryPct = Math.round((robot.resourceCurrent / Math.max(1, robot.resourceMax)) * 100);
    const speed = robot.stats.speed.toFixed(1);
    const efficiency = Math.round(robot.stats.efficiency * 100);
    const isBroken = robot.state === 'broken';
    const isWorking = robot.state === 'working';
    const isCharging = robot.state === 'charging';
    const isMoving = robot.state === 'moving';

    const diagnosis = isBroken
      ? `This unit is down. Repair cycle is active with about ${Math.ceil(robot.breakdownTimeRemaining)}s remaining.`
      : isCharging
        ? 'This unit is refueling or recharging. No intervention is needed unless it stays here too long.'
        : isWorking
          ? 'This unit is already doing its job. You mostly need confirmation, not control.'
          : isMoving
            ? 'This unit is en route to a task. Use this card to verify that it is headed somewhere sensible.'
            : 'This unit is idle and available. If that is unexpected, the real issue is upstream in your workload or routing.';

    this.addHeadline(`${robot.type.toUpperCase()} UNIT`, diagnosis);

    this.addSection('Snapshot', 92, (section) => {
      this.addMetricLine(section, 'Status', formatRobotState(robot.state), isBroken ? UI_THEME.colors.text.danger : isWorking || isMoving ? UI_THEME.colors.text.success : UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Battery', `${batteryPct}%`, batteryPct > 50 ? UI_THEME.colors.text.success : batteryPct > 20 ? UI_THEME.colors.text.warning : UI_THEME.colors.text.danger);
      this.addMetricLine(section, 'Efficiency', `${efficiency}%`, UI_THEME.colors.text.info);
      this.addMetricLine(section, 'Coverage', assignedAreaName, UI_THEME.colors.text.secondary);
    });

    this.addSection('Telemetry', 76, (section) => {
      this.addMetricLine(section, 'Location', `X ${Math.round(robot.worldX)}, Z ${Math.round(robot.worldZ)}`, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Destination', robot.targetX !== null && robot.targetY !== null ? `X ${Math.round(robot.targetX)}, Z ${Math.round(robot.targetY)}` : 'No target', UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Travel Speed', `${speed} units/s`, UI_THEME.colors.text.secondary);
    });

    this.addSection('What This Means', 82, (section) => {
      this.addBodyText(
        section,
        isBroken
          ? 'This is an exception case. You are inspecting it because something went wrong, and the key question is how long the downtime will hurt operations.'
          : isWorking || isMoving
            ? 'This is mostly a confidence check. The unit is busy, so you can close this and continue managing the course.'
            : 'If this idle state is not intentional, the real fix is usually better staffing, more tasks, or a coverage change elsewhere.',
        isBroken ? UI_THEME.colors.text.warning : UI_THEME.colors.text.secondary,
        48
      );
    });
  }

  private renderEmployee(view: EmployeeInspectorView): void {
    const { employee, currentTask, worldX, worldZ, areaName, focus } = view;
    const moraleTone =
      employee.happiness >= 75
        ? UI_THEME.colors.text.success
        : employee.happiness >= 45
          ? UI_THEME.colors.text.warning
          : UI_THEME.colors.text.danger;
    const fatigueTone =
      employee.fatigue <= 35
        ? UI_THEME.colors.text.success
        : employee.fatigue <= 70
          ? UI_THEME.colors.text.warning
          : UI_THEME.colors.text.danger;

    this.addHeadline(
      employee.name.toUpperCase(),
      `${formatEmployeeRole(employee.role)} on ${formatEmployeeTask(currentTask)} duty. Use this card to confirm coverage, workload, and whether this person still belongs on payroll.`
    );

    this.addSection('Roster', 92, (section) => {
      this.addMetricLine(section, 'Role', formatEmployeeRole(employee.role), UI_THEME.colors.text.info);
      this.addMetricLine(section, 'Status', formatEmployeeStatus(employee.status), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Skill', formatSkillLevel(employee.skillLevel), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Wage', `$${employee.hourlyWage}/hr`, UI_THEME.colors.text.secondary);
    });

    this.addSection('Assignment', 76, (section) => {
      this.addMetricLine(section, 'Task', formatEmployeeTask(currentTask), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Area', areaName, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Focus', formatFocus(focus), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Location', `X ${Math.round(worldX)}, Z ${Math.round(worldZ)}`, UI_THEME.colors.text.secondary);
    });

    this.addSection('Condition', 82, (section) => {
      this.addMetricLine(section, 'Happiness', `${Math.round(employee.happiness)}%`, moraleTone);
      this.addMetricLine(section, 'Fatigue', `${Math.round(employee.fatigue)}%`, fatigueTone);
      this.addMetricLine(section, 'Experience', `${Math.round(employee.experience)}`, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Efficiency', `${Math.round(employee.skills.efficiency * 100)}%`, UI_THEME.colors.text.info);
    });
  }

  private renderAsset(view: AssetInspectorView): void {
    const { asset, canDelete, facilitySnapshot } = view;
    const assetName = getAssetDisplayName(asset.assetId as never);
    const holeFeature = asset.gameplay?.holeFeature;
    const role = getAssetRole(asset.assetId);
    const usage = holeFeature
      ? holeFeature.kind === 'tee_box'
        ? `Hole ${holeFeature.holeNumber} tee box`
        : `Hole ${holeFeature.holeNumber} pin position`
      : role.usage;

    this.addHeadline(
      assetName.toUpperCase(),
      holeFeature
        ? 'This object affects hole layout directly. Inspect it here before moving or deleting it.'
        : role.headline
    );

    this.addSection('Identity', 92, (section) => {
      this.addMetricLine(section, 'Asset', assetName, UI_THEME.colors.text.info);
      this.addMetricLine(section, 'Id', asset.assetId, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Type', role.label, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Usage', usage, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Rotation', `${asset.rotation}°`, UI_THEME.colors.text.secondary);
    });

    if (facilitySnapshot && !holeFeature) {
      const sectionHeight = Math.max(76, 22 + facilitySnapshot.metrics.length * 18);
      this.addSection(facilitySnapshot.sectionTitle, sectionHeight, (section) => {
        this.addMetricLine(section, 'Status', facilitySnapshot.status, UI_THEME.colors.text.info);
        for (const metric of facilitySnapshot.metrics) {
          this.addMetricLine(
            section,
            metric.label,
            metric.value,
            metric.tone ?? UI_THEME.colors.text.secondary
          );
        }
      });
    }

    this.addSection('Placement', 76, (section) => {
      this.addMetricLine(section, 'World X', asset.x.toFixed(1), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'World Y', asset.y.toFixed(1), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'World Z', asset.z.toFixed(1), UI_THEME.colors.text.secondary);
    });

    this.addSection('What This Means', 82, (section) => {
      this.addBodyText(
        section,
        holeFeature
          ? 'This object participates in hole layout. Deleting it will immediately change the course definition for that hole.'
          : facilitySnapshot
            ? facilitySnapshot.note
            : canDelete
              ? 'This is a placed course prop. If it is in the wrong spot or no longer needed, delete it here instead of reopening the builder first.'
              : 'This is a course asset generated by the layout. It is inspectable now, and later this same card can surface richer operational state.',
        UI_THEME.colors.text.secondary,
        48
      );
    });
  }

  private renderGolfer(view: GolferInspectorView): void {
    const { golfer, worldX, worldZ } = view;
    const satisfactionTone =
      golfer.satisfaction >= 75
        ? UI_THEME.colors.text.success
        : golfer.satisfaction >= 45
          ? UI_THEME.colors.text.warning
          : UI_THEME.colors.text.danger;

    this.addHeadline(
      golfer.name.toUpperCase(),
      `${formatGolferType(golfer.type)} golfer currently ${formatGolferStatus(golfer.status)}. This card should tell you whether guests are moving through the course happily enough to come back.`
    );

    this.addSection('Round', 92, (section) => {
      this.addMetricLine(section, 'Type', formatGolferType(golfer.type), UI_THEME.colors.text.info);
      this.addMetricLine(section, 'Status', formatGolferStatus(golfer.status), UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Progress', `${golfer.holesPlayed}/${golfer.totalHoles} holes`, UI_THEME.colors.text.secondary);
      this.addMetricLine(section, 'Paid', `$${Math.round(golfer.paidAmount)}`, UI_THEME.colors.text.secondary);
    });

    this.addSection('Sentiment', 76, (section) => {
      this.addMetricLine(section, 'Satisfaction', `${Math.round(golfer.satisfaction)}%`, satisfactionTone);
      this.addMetricLine(section, 'Will Return', golfer.willReturn ? 'Likely' : 'At Risk', golfer.willReturn ? UI_THEME.colors.text.success : UI_THEME.colors.text.warning);
      this.addMetricLine(section, 'Price Ceiling', `$${Math.round(golfer.preferences.priceThreshold)}`, UI_THEME.colors.text.secondary);
    });

    this.addSection('Position', 82, (section) => {
      this.addMetricLine(section, 'Location', `X ${Math.round(worldX)}, Z ${Math.round(worldZ)}`, UI_THEME.colors.text.secondary);
      this.addBodyText(
        section,
        summarizeGolferFactors(golfer),
        UI_THEME.colors.text.secondary,
        48
      );
    });
  }

  private clearContent(): void {
    if (!this.contentHost) return;
    const controls = this.contentHost.children.slice();
    for (const control of controls) {
      this.contentHost.removeControl(control);
      control.dispose();
    }
  }

  private addHeadline(titleText: string, description: string): void {
    if (!this.contentHost) return;

    const title = new TextBlock(`headline_${titleText}`);
    title.text = titleText;
    title.color = UI_THEME.colors.text.info;
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
      width: 304,
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
    stack.width = '286px';
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
    labelText.width = '122px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const valueText = new TextBlock(`${label}_value`);
    valueText.text = value;
    valueText.color = valueColor;
    valueText.fontSize = UI_THEME.typography.scale.s11;
    valueText.width = '160px';
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(valueText);
  }

  private addBodyText(parent: StackPanel, text: string, color: string, height: number): void {
    const body = new TextBlock(`inspectorBody_${text.slice(0, 10)}`);
    body.text = text;
    body.color = color;
    body.fontSize = UI_THEME.typography.scale.s11;
    body.height = `${height}px`;
    body.textWrapping = true;
    body.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    parent.addControl(body);
  }

  getTrackedRobotId(): string | null {
    return this.trackedRobotId;
  }

  hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
    this.trackedRobotId = null;
    this.currentView = null;
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

function formatRobotState(state: RobotUnit['state']): string {
  switch (state) {
    case 'working':
      return 'Working';
    case 'moving':
      return 'Moving';
    case 'charging':
      return 'Charging';
    case 'broken':
      return 'Broken';
    default:
      return 'Idle';
  }
}

function formatEmployeeRole(role: Employee['role']): string {
  switch (role) {
    case 'groundskeeper':
      return 'Groundskeeper';
    case 'mechanic':
      return 'Mechanic';
    default:
      return role;
  }
}

function formatEmployeeStatus(status: Employee['status']): string {
  switch (status) {
    case 'on_break':
      return 'On Break';
    case 'withholding_work':
      return 'Withholding Work';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function formatEmployeeTask(task: EmployeeTask): string {
  switch (task) {
    case 'mow_grass':
      return 'Mowing';
    case 'water_area':
      return 'Watering';
    case 'fertilize_area':
      return 'Fertilizing';
    case 'rake_bunker':
      return 'Raking Bunkers';
    case 'return_to_base':
      return 'Returning to Base';
    case 'patrol':
      return 'Patrolling';
    default:
      return 'Idle';
  }
}

function formatSkillLevel(skillLevel: Employee['skillLevel']): string {
  return skillLevel.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFocus(focus: EmployeeFocusPreference): string {
  return focus.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatGolferType(type: Golfer['type']): string {
  return type.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatGolferStatus(status: Golfer['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeGolferFactors(golfer: Golfer): string {
  const entries = Object.entries(golfer.satisfactionFactors ?? {})
    .filter(([, value]) => typeof value === 'number')
    .sort((a, b) => Math.abs((a[1] ?? 0)) - Math.abs((b[1] ?? 0)));

  const weakest = entries[0];
  if (!weakest) {
    return 'No specific satisfaction driver is recorded yet. This golfer still gives you a read on flow, pricing, and overall course experience.';
  }

  const [factor, value] = weakest;
  const direction = value < 0 ? 'dragging' : 'helping';
  return `${formatGolferFactor(factor as keyof Golfer['satisfactionFactors'])} is currently ${direction} this guest's experience.`;
}

function formatGolferFactor(factor: string): string {
  return factor.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAssetRole(assetId: string): { label: string; usage: string; headline: string } {
  if (assetId.startsWith('building.clubhouse')) {
    return {
      label: 'Facility',
      usage: 'Club operations and guest services',
      headline: 'This facility is part of the operating side of the course. Inspect it to understand what role it plays in the guest experience and revenue mix.',
    };
  }
  if (assetId === 'amenity.snack.bar') {
    return {
      label: 'Facility',
      usage: 'Food and beverage outpost',
      headline: 'This is a service building, not just scenery. As food-and-beverage systems deepen, this card should tell you whether it is worth the space and demand.',
    };
  }
  if (assetId.startsWith('building.') || assetId === 'amenity.restroom' || assetId === 'amenity.shelter.small') {
    return {
      label: 'Utility Building',
      usage: 'Course support or guest comfort',
      headline: 'This building supports operations or guest comfort. It belongs in the same click flow as future service-state inspectors.',
    };
  }
  if (assetId.startsWith('amenity.') || assetId.startsWith('path.') || assetId.startsWith('bridge.')) {
    return {
      label: 'Course Asset',
      usage: 'Guest-facing course fixture',
      headline: 'This is a live course asset. It influences how finished and usable the course feels even when it does not yet have full simulation behind it.',
    };
  }
  return {
    label: 'Prop',
    usage: 'Decorative or layout scenery',
    headline: 'This object is part of the visible course world. It is inspectable so you can confirm what it is and where it landed.',
  };
}
