import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';
import {
  createActionButton,
  createListRowCard,
  createPanelSection,
  createSelectableButton,
  POPUP_COLORS,
  setSelectableButtonState,
} from './PopupUtils';
import { addDialogActionBar, addDialogScrollBlock, addDialogSectionLabel } from './DialogBlueprint';
import { UI_THEME } from './UITheme';
import { renderDialog } from './DialogRenderer';
import { uiAutomationBridge } from '../../automation/UIAutomationBridge';

import {
  Employee,
  EmployeeRole,
  EmployeeRoster,
  ApplicationState,
  SkillLevel,
  PrestigeTier,
  EmployeeFocusPreference,
  PRESTIGE_HIRING_CONFIG,
  EMPLOYEE_ROLE_INFO,
} from '../../core/employees';
import { EmployeeWorkSystemState } from '../../core/employee-work';
import { type EmployeeTask } from '../../core/movable-entity';
import { AutonomousEquipmentState } from '../../core/autonomous-equipment';

export interface EmployeePanelCallbacks {
  onHire: (employee: Employee) => void;
  onFire: (employeeId: string) => void;
  onAssignArea: (employeeId: string, areaId: string | null) => void;
  onAssignFocus: (employeeId: string, focus: EmployeeFocusPreference) => void;
  onClose: () => void;
  onPostJobOpening: (role: EmployeeRole) => void;
}

const SKILL_COLORS: Record<SkillLevel, string> = {
  novice: '#888888',
  trained: '#44aa44',
  experienced: '#4488ff',
  expert: '#ffaa00',
};

const EMPLOYEE_DIALOG_WIDTH = 448;
const EMPLOYEE_DIALOG_HEIGHT = 608;
const EMPLOYEE_CONTENT_WIDTH = 420;
const EMPLOYEE_SCROLL_WIDTH = 398;

const EMPLOYEE_FOCUS_LABELS: Record<EmployeeFocusPreference, string> = {
  balanced: 'Balanced',
  mowing: 'Mow',
  watering: 'Water',
  fertilizing: 'Feed',
  bunkers: 'Bunkers',
};

function getWorkerTaskLabel(task: EmployeeTask, moving: boolean): string {
  if (moving && task === 'patrol') return 'En route';
  switch (task) {
    case 'mow_grass':
      return 'Mowing';
    case 'water_area':
      return 'Watering';
    case 'fertilize_area':
      return 'Feeding Turf';
    case 'rake_bunker':
      return 'Raking Bunker';
    case 'patrol':
      return 'Scanning Grounds';
    case 'return_to_base':
      return 'Returning';
    default:
      return 'Standing By';
  }
}

export class EmployeePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: EmployeePanelCallbacks;

  private panel: Rectangle | null = null;
  private applicationsPanel: Rectangle | null = null;
  private employeeListContainer: StackPanel | null = null;
  private applicationsContainer: StackPanel | null = null;
  private payrollText: TextBlock | null = null;
  private employeeCountText: TextBlock | null = null;
  private coverageText: TextBlock | null = null;
  private nextApplicationText: TextBlock | null = null;
  private postingCountText: TextBlock | null = null;
  private postJobButton: Button | null = null;
  private fireButton: Button | null = null;
  private mainActionHintText: TextBlock | null = null;
  private assignmentSummaryText: TextBlock | null = null;
  private assignmentDutyText: TextBlock | null = null;
  private assignmentButtonGrid: Grid | null = null;
  private focusButtonGrid: Grid | null = null;
  private zoneStatusText: TextBlock | null = null;
  private hasActivePosting: boolean = false;
  private currentRoster: EmployeeRoster | null = null;
  private currentWorkState: EmployeeWorkSystemState | null = null;
  private currentAutonomousState: AutonomousEquipmentState | null = null;

  private selectedEmployeeId: string | null = null;
  private selectedEmployeeName: string | null = null;
  private selectedPostingRole: EmployeeRole = 'groundskeeper';
  private roleButtons: Map<EmployeeRole, Button> = new Map();
  private areaButtons: Map<string, Button> = new Map();
  private focusButtons: Map<EmployeeFocusPreference, Button> = new Map();
  private employeeRowControls: Map<string, Rectangle> = new Map();
  private candidateHireButtons: Map<string, Button> = new Map();
  private applicationsButton: Button | null = null;
  private mainCloseButton: Button | null = null;
  private applicationsCloseButton: Button | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: EmployeePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const mainDialog = renderDialog(this.advancedTexture, {
      name: 'employee',
      shell: 'direct',
      width: EMPLOYEE_DIALOG_WIDTH,
      height: EMPLOYEE_DIALOG_HEIGHT,
      padding: 12,
      colors: POPUP_COLORS.green,
      title: '👥 COURSE OPERATIONS',
      headerWidth: EMPLOYEE_CONTENT_WIDTH,
      onClose: () => this.callbacks.onClose(),
      onCloseButtonCreated: (button) => {
        this.mainCloseButton = button;
      },
      nodes: [
        { type: 'custom', id: 'summary', render: (parent) => this.createSummaryRow(parent) },
        { type: 'custom', id: 'employeeList', render: (parent) => this.createEmployeeList(parent) },
        { type: 'custom', id: 'assignment', render: (parent) => this.createAssignmentSection(parent) },
        { type: 'custom', id: 'mainActions', render: (parent) => this.createActionButtons(parent) },
      ],
    });
    this.panel = mainDialog.panel;
    this.createApplicationsView();
  }

  private createSummaryRow(parent: StackPanel): void {
    const summaryContainer = createPanelSection(parent, {
      name: 'summaryContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 64,
      theme: 'green',
      paddingTop: 8,
    });

    const grid = new Grid('summaryGrid');
    grid.addColumnDefinition(0.34);
    grid.addColumnDefinition(0.33);
    grid.addColumnDefinition(0.33);
    summaryContainer.addControl(grid);

    const countStack = new StackPanel('countStack');
    countStack.paddingLeft = '12px';
    grid.addControl(countStack, 0, 0);

    addDialogSectionLabel(countStack, {
      id: 'countLabel',
      text: 'Employees',
      tone: 'muted',
      fontSize: 10,
      height: 14,
    });

    this.employeeCountText = new TextBlock('employeeCount');
    this.employeeCountText.text = '0 / 10';
    this.employeeCountText.color = UI_THEME.colors.legacy.c_ffffff;
    this.employeeCountText.fontSize = UI_THEME.typography.scale.s18;
    this.employeeCountText.height = '24px';
    this.employeeCountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    countStack.addControl(this.employeeCountText);

    const payrollStack = new StackPanel('payrollStack');
    grid.addControl(payrollStack, 0, 1);

    addDialogSectionLabel(payrollStack, {
      id: 'payrollLabel',
      text: 'Hourly Payroll',
      tone: 'muted',
      fontSize: 10,
      height: 14,
    });

    this.payrollText = new TextBlock('payrollText');
    this.payrollText.text = '$0/hr';
    this.payrollText.color = UI_THEME.colors.legacy.c_ff8844;
    this.payrollText.fontSize = UI_THEME.typography.scale.s18;
    this.payrollText.height = '24px';
    this.payrollText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    payrollStack.addControl(this.payrollText);

    const coverageStack = new StackPanel('coverageStack');
    grid.addControl(coverageStack, 0, 2);

    addDialogSectionLabel(coverageStack, {
      id: 'coverageLabel',
      text: 'Ops Coverage',
      tone: 'muted',
      fontSize: 10,
      height: 14,
    });

    this.coverageText = new TextBlock('coverageText');
    this.coverageText.text = 'No zones set';
    this.coverageText.color = UI_THEME.colors.text.info;
    this.coverageText.fontSize = UI_THEME.typography.scale.s16;
    this.coverageText.height = '24px';
    this.coverageText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    coverageStack.addControl(this.coverageText);
  }

  private createAssignmentSection(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'assignmentContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 186,
      theme: 'blue',
      paddingTop: 8,
    });

    const stack = new StackPanel('assignmentStack');
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    container.addControl(stack);

    addDialogSectionLabel(stack, {
      id: 'assignmentLabel',
      text: 'Crew Assignment',
      tone: 'muted',
      fontSize: 10,
      height: 14,
    });

    this.assignmentSummaryText = new TextBlock('assignmentSummary');
    this.assignmentSummaryText.text = 'Select a crew member from the roster to adjust coverage.';
    this.assignmentSummaryText.color = UI_THEME.colors.legacy.c_ffffff;
    this.assignmentSummaryText.fontSize = UI_THEME.typography.scale.s13;
    this.assignmentSummaryText.height = '18px';
    this.assignmentSummaryText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.assignmentSummaryText);

    this.assignmentDutyText = new TextBlock('assignmentDuty');
    this.assignmentDutyText.text = 'Crew owns recurring upkeep. Pick a zone and focus after you choose someone below.';
    this.assignmentDutyText.color = UI_THEME.colors.text.secondary;
    this.assignmentDutyText.fontSize = UI_THEME.typography.scale.s10;
    this.assignmentDutyText.height = '28px';
    this.assignmentDutyText.textWrapping = true;
    this.assignmentDutyText.lineSpacing = '2px';
    this.assignmentDutyText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.assignmentDutyText);

    this.assignmentButtonGrid = new Grid('assignmentButtonGrid');
    this.assignmentButtonGrid.width = `${EMPLOYEE_SCROLL_WIDTH}px`;
    this.assignmentButtonGrid.height = '52px';
    this.assignmentButtonGrid.paddingTop = '6px';
    this.assignmentButtonGrid.addColumnDefinition(0.5);
    this.assignmentButtonGrid.addColumnDefinition(0.5);
    this.assignmentButtonGrid.addRowDefinition(0.5);
    this.assignmentButtonGrid.addRowDefinition(0.5);
    stack.addControl(this.assignmentButtonGrid);

    const focusLabel = new TextBlock('focusLabel');
    focusLabel.text = 'Work Focus';
    focusLabel.color = UI_THEME.colors.text.secondary;
    focusLabel.fontSize = UI_THEME.typography.scale.s10;
    focusLabel.height = '14px';
    focusLabel.paddingTop = '6px';
    focusLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(focusLabel);

    this.focusButtonGrid = new Grid('focusButtonGrid');
    this.focusButtonGrid.width = `${EMPLOYEE_SCROLL_WIDTH}px`;
    this.focusButtonGrid.height = '38px';
    this.focusButtonGrid.addColumnDefinition(0.2);
    this.focusButtonGrid.addColumnDefinition(0.2);
    this.focusButtonGrid.addColumnDefinition(0.2);
    this.focusButtonGrid.addColumnDefinition(0.2);
    this.focusButtonGrid.addColumnDefinition(0.2);
    this.focusButtonGrid.addRowDefinition(1);
    stack.addControl(this.focusButtonGrid);

    this.zoneStatusText = new TextBlock('zoneStatusText');
    this.zoneStatusText.text = 'Zones: no recurring coverage set.';
    this.zoneStatusText.color = UI_THEME.colors.text.muted;
    this.zoneStatusText.fontSize = UI_THEME.typography.scale.s10;
    this.zoneStatusText.height = '38px';
    this.zoneStatusText.textWrapping = true;
    this.zoneStatusText.lineSpacing = '2px';
    this.zoneStatusText.paddingTop = '6px';
    this.zoneStatusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.zoneStatusText);
  }

  private createEmployeeList(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'listContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 244,
      theme: 'green',
      paddingTop: 8,
      scroll: {
        name: 'employeeScroll',
        width: EMPLOYEE_SCROLL_WIDTH,
        height: 230,
        contentName: 'employeeListStack',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: UI_THEME.colors.border.strong,
          barBackground: UI_THEME.colors.surfaces.panelInset,
        },
      },
    });
    this.employeeListContainer = content;
  }

  private createEmployeeRow(employee: Employee): Rectangle {
    const isSelected = this.selectedEmployeeId === employee.id;
    const worker = this.currentWorkState?.workers.find((candidate) => candidate.employeeId === employee.id) ?? null;
    const areaName = this.getAreaName(employee.assignedArea);
    const taskLabel = worker ? getWorkerTaskLabel(worker.currentTask, worker.path.length > 0) : 'Standing By';
    const focusLabel = EMPLOYEE_FOCUS_LABELS[employee.assignedFocus ?? 'balanced'];

    const row = createListRowCard({
      name: `emp_${employee.id}`,
      width: 378,
      height: 82,
      background: isSelected ? 'rgba(74, 126, 96, 0.9)' : UI_THEME.colors.surfaces.sectionAlt,
      borderColor: isSelected ? UI_THEME.colors.launch.selectedBorder : UI_THEME.colors.editor.buttonBorder,
      thickness: isSelected ? 2 : 1,
    });
    this.employeeRowControls.set(employee.id, row);

    row.onPointerClickObservable.add(() => {
      this.selectedEmployeeId = employee.id;
      this.selectedEmployeeName = employee.name;
      if (this.currentRoster && this.currentWorkState) {
        this.update(this.currentRoster, this.currentWorkState, this.currentAutonomousState);
      } else {
        this.updateMainActionState();
      }
    });
    row.onPointerEnterObservable.add(() => {
      if (!isSelected) row.background = UI_THEME.colors.surfaces.section;
    });
    row.onPointerOutObservable.add(() => {
      if (!isSelected) row.background = UI_THEME.colors.surfaces.sectionAlt;
    });

    const grid = new Grid('empRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(172, true);
    grid.addColumnDefinition(98, true);
    grid.addColumnDefinition(73, true);
    row.addControl(grid);

    const icon = new TextBlock('empIcon');
    icon.text = EMPLOYEE_ROLE_INFO[employee.role].icon;
    icon.fontSize = UI_THEME.typography.scale.s18;
    grid.addControl(icon, 0, 0);

    const infoStack = new StackPanel('empInfo');
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('empName');
    nameText.text = employee.name;
    nameText.color = UI_THEME.colors.legacy.c_ffffff;
    nameText.fontSize = UI_THEME.typography.scale.s12;
    nameText.height = '16px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const roleText = new TextBlock('empRole');
    roleText.text = EMPLOYEE_ROLE_INFO[employee.role].name;
    roleText.color = UI_THEME.colors.text.secondary;
    roleText.fontSize = UI_THEME.typography.scale.s10;
    roleText.height = '14px';
    roleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(roleText);

    const statusText = new TextBlock('empStatus');
    statusText.text = `${taskLabel} • ${employee.status.replace('_', ' ')}`;
    statusText.color = employee.status === 'working' ? '#7ed88b' :
                       employee.status === 'on_break' ? '#ffaa44' : '#888888';
    statusText.fontSize = UI_THEME.typography.scale.s9;
    statusText.height = '14px';
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(statusText);

    const coverageStack = new StackPanel('coverageStack');
    grid.addControl(coverageStack, 0, 2);

    const areaText = new TextBlock('empArea');
    areaText.text = areaName;
    areaText.color = UI_THEME.colors.text.info;
    areaText.fontSize = UI_THEME.typography.scale.s10;
    areaText.height = '16px';
    areaText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    coverageStack.addControl(areaText);

    const skillText = new TextBlock('empSkill');
    skillText.text = `${focusLabel} • ${employee.skillLevel}`;
    skillText.color = SKILL_COLORS[employee.skillLevel];
    skillText.fontSize = UI_THEME.typography.scale.s11;
    skillText.height = '14px';
    skillText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    coverageStack.addControl(skillText);

    const wageText = new TextBlock('empWage');
    wageText.text = `$${employee.hourlyWage}/hr`;
    wageText.color = UI_THEME.colors.text.warning;
    wageText.fontSize = UI_THEME.typography.scale.s12;
    wageText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    grid.addControl(wageText, 0, 3);

    return row;
  }

  private createActionButtons(parent: StackPanel): void {
    const { buttons } = addDialogActionBar(parent, {
      id: 'employeeMainActions',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 56,
      theme: 'green',
      actions: [
        {
          id: 'hireBtn',
          label: '📋 Applications',
          tone: 'primary',
          onClick: () => this.showApplicationsView(),
        },
        {
          id: 'fireBtn',
          label: '🚫 Fire Selected',
          tone: 'danger',
          onClick: () => {
            if (this.selectedEmployeeId) {
              this.callbacks.onFire(this.selectedEmployeeId);
              this.selectedEmployeeId = null;
              this.selectedEmployeeName = null;
              this.updateMainActionState();
            }
          },
        },
      ],
    });
    this.applicationsButton = buttons[0] ?? null;
    this.fireButton = buttons[1] ?? null;

    this.mainActionHintText = new TextBlock('mainActionHint');
    this.mainActionHintText.color = UI_THEME.colors.legacy.c_97ada0;
    this.mainActionHintText.fontSize = UI_THEME.typography.scale.s10;
    this.mainActionHintText.height = '18px';
    this.mainActionHintText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.mainActionHintText.paddingTop = '4px';
    parent.addControl(this.mainActionHintText);
    this.updateMainActionState();
  }

  private updateMainActionState(): void {
    const hasSelection = this.selectedEmployeeId !== null;
    if (this.fireButton) {
      this.fireButton.isEnabled = hasSelection;
      this.fireButton.alpha = hasSelection ? 1 : 0.55;
      this.fireButton.background = hasSelection ? '#7a3a3a' : '#4a3d3d';
      this.fireButton.color = hasSelection ? '#ff8888' : '#b6a2a2';
      if (this.fireButton.textBlock) {
        this.fireButton.textBlock.text = hasSelection ? '🚫 Fire Selected' : '🚫 Select Employee';
      }
    }
    if (this.mainActionHintText) {
      this.mainActionHintText.text = hasSelection
        ? `Selected: ${this.selectedEmployeeName ?? 'Employee'}`
        : 'Roster first: pick a crew member, then assign a zone and focus.';
    }
    this.refreshAssignmentSection();
  }

  private createApplicationsView(): void {
    const dialog = renderDialog(this.advancedTexture, {
      name: 'employeeApplications',
      shell: 'direct',
      width: EMPLOYEE_DIALOG_WIDTH,
      height: EMPLOYEE_DIALOG_HEIGHT,
      padding: 12,
      colors: POPUP_COLORS.green,
      title: '📋 JOB APPLICATIONS',
      headerWidth: EMPLOYEE_CONTENT_WIDTH,
      onClose: () => this.hideApplicationsView(),
      onCloseButtonCreated: (button) => {
        this.applicationsCloseButton = button;
      },
      nodes: [
        { type: 'custom', id: 'applicationsContent', render: (stack) => this.renderApplicationsContent(stack) },
      ],
    });
    this.applicationsPanel = dialog.panel;
    this.applicationsPanel.isVisible = false;
  }

  private renderApplicationsContent(stack: StackPanel): void {

    // Status info
    const statusContainer = createPanelSection(stack, {
      name: 'statusContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 60,
      theme: 'green',
      paddingTop: 8,
    });

    const statusStack = new StackPanel('statusStack');
    statusStack.paddingLeft = '12px';
    statusStack.paddingRight = '12px';
    statusContainer.addControl(statusStack);

    addDialogSectionLabel(statusStack, {
      id: 'nextAppLabel',
      text: 'Next Application:',
      tone: 'muted',
      fontSize: 10,
      height: 14,
    });

    this.nextApplicationText = new TextBlock('nextApplicationText');
    this.nextApplicationText.text = 'Loading...';
    this.nextApplicationText.color = UI_THEME.colors.text.accent;
    this.nextApplicationText.fontSize = UI_THEME.typography.scale.s14;
    this.nextApplicationText.height = '18px';
    this.nextApplicationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusStack.addControl(this.nextApplicationText);

    this.postingCountText = new TextBlock('postingCountText');
    this.postingCountText.text = 'No active job postings';
    this.postingCountText.color = UI_THEME.colors.text.muted;
    this.postingCountText.fontSize = UI_THEME.typography.scale.s10;
    this.postingCountText.height = '16px';
    this.postingCountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusStack.addControl(this.postingCountText);

    // Role selection for job posting
    this.createRoleSelectionRow(stack);

    const { content } = addDialogScrollBlock(stack, {
      id: 'applicationsListContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 218,
      theme: 'green',
      paddingTop: 8,
      scroll: {
        name: 'applicationsScroll',
        width: EMPLOYEE_SCROLL_WIDTH,
        height: 206,
        contentName: 'applicationsListStack',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: UI_THEME.colors.border.strong,
          barBackground: UI_THEME.colors.surfaces.panelInset,
        },
      },
    });
    this.applicationsContainer = content;

    this.postJobButton = createActionButton({
      id: 'postJobBtn',
      label: '📢 Post Job Opening ($500)',
      tone: 'neutral',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 35,
      fontSize: 14,
      cornerRadius: UI_THEME.radii.button,
      thickness: 2,
      onClick: () => this.callbacks.onPostJobOpening(this.selectedPostingRole),
    });
    this.postJobButton.background = UI_THEME.colors.miscButton.blueAction;
    this.postJobButton.color = UI_THEME.colors.miscButton.blueActionText;
    this.postJobButton.paddingTop = '8px';
    this.postJobButton.onPointerEnterObservable.add(() => {
      this.postJobButton!.background = this.hasActivePosting ? '#3a6a4a' : '#4a7a9a';
    });
    this.postJobButton.onPointerOutObservable.add(() => {
      this.postJobButton!.background = this.hasActivePosting ? UI_THEME.colors.miscButton.customPlay : UI_THEME.colors.miscButton.blueAction;
    });
    stack.addControl(this.postJobButton);
  }

  private createRoleSelectionRow(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'roleSelectionContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 78,
      theme: 'blue',
      paddingTop: 8,
    });

    const innerStack = new StackPanel('roleSelectionStack');
    innerStack.paddingLeft = '8px';
    innerStack.paddingRight = '8px';
    container.addControl(innerStack);

    addDialogSectionLabel(innerStack, {
      id: 'roleLabel',
      text: 'Post for role:',
      tone: 'muted',
      fontSize: 10,
      height: 14,
    });

    const roles = Object.keys(EMPLOYEE_ROLE_INFO) as EmployeeRole[];

    const buttonRow = new Grid('roleButtonRow');
    buttonRow.height = '48px';
    buttonRow.width = `${EMPLOYEE_SCROLL_WIDTH}px`;
    roles.forEach(() => buttonRow.addColumnDefinition(1 / roles.length));
    innerStack.addControl(buttonRow);
    roles.forEach((role, index) => {
      const btn = createSelectableButton({
        id: `role_${role}`,
        label: `${EMPLOYEE_ROLE_INFO[role].icon} ${EMPLOYEE_ROLE_INFO[role].name}`,
        width: 188,
        height: 36,
        fontSize: 11,
        style: {
          selectedBackground: '#4a8a9a',
          selectedColor: '#ffffff',
          unselectedBackground: '#2a4a5a',
          unselectedColor: '#88aacc',
          hoverBackground: '#376173',
        },
        selected: role === this.selectedPostingRole,
        onClick: () => this.selectPostingRole(role),
      });
      this.updateRoleButtonStyle(btn, role === this.selectedPostingRole);
      buttonRow.addControl(btn, 0, index);
      this.roleButtons.set(role, btn);
    });
  }

  private updateRoleButtonStyle(btn: Button, isSelected: boolean): void {
    setSelectableButtonState(btn, isSelected);
  }

  private selectPostingRole(role: EmployeeRole): void {
    this.selectedPostingRole = role;
    this.roleButtons.forEach((btn, r) => {
      this.updateRoleButtonStyle(btn, r === role);
    });
    this.updatePostJobButtonText();
    this.syncAutomationControls();
  }

  private updatePostJobButtonText(): void {
    if (!this.postJobButton || this.hasActivePosting) return;
    const roleInfo = EMPLOYEE_ROLE_INFO[this.selectedPostingRole];
    this.postJobButton.textBlock!.text = `📢 Post for ${roleInfo.name}`;
  }

  private createCandidateRow(candidate: Employee): Rectangle {
    const row = createListRowCard({
      name: `cand_${candidate.id}`,
      width: 348,
      height: 72,
      background: UI_THEME.colors.surfaces.sectionAlt,
      borderColor: UI_THEME.colors.editor.buttonBorder,
    });

    row.onPointerEnterObservable.add(() => {
      row.background = UI_THEME.colors.surfaces.section;
    });
    row.onPointerOutObservable.add(() => {
      row.background = UI_THEME.colors.surfaces.sectionAlt;
    });

    const grid = new Grid('candRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(166, true);
    grid.addColumnDefinition(82, true);
    grid.addColumnDefinition(65, true);
    row.addControl(grid);

    const icon = new TextBlock('candIcon');
    icon.text = EMPLOYEE_ROLE_INFO[candidate.role].icon;
    icon.fontSize = UI_THEME.typography.scale.s18;
    grid.addControl(icon, 0, 0);

    const infoStack = new StackPanel('candInfo');
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('candName');
    nameText.text = candidate.name;
    nameText.color = UI_THEME.colors.legacy.c_ffffff;
    nameText.fontSize = UI_THEME.typography.scale.s12;
    nameText.height = '16px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const roleText = new TextBlock('candRole');
    roleText.text = `${EMPLOYEE_ROLE_INFO[candidate.role].name} • ${candidate.skillLevel}`;
    roleText.color = UI_THEME.colors.text.secondary;
    roleText.fontSize = UI_THEME.typography.scale.s10;
    roleText.height = '14px';
    roleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(roleText);

    const skillText = new TextBlock('candSkill');
    skillText.text = `Happiness ${Math.round(candidate.happiness)} • fatigue ${Math.round(candidate.fatigue)}`;
    skillText.color = SKILL_COLORS[candidate.skillLevel];
    skillText.fontSize = UI_THEME.typography.scale.s10;
    skillText.height = '14px';
    skillText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(skillText);

    const wageText = new TextBlock('candWage');
    wageText.text = `$${candidate.hourlyWage}/hr`;
    wageText.color = UI_THEME.colors.text.warning;
    wageText.fontSize = UI_THEME.typography.scale.s11;
    grid.addControl(wageText, 0, 2);

    const hireBtn = createActionButton({
      id: `hire_${candidate.id}`,
      label: 'Hire',
      tone: 'primary',
      width: 55,
      height: 28,
      fontSize: 11,
      onClick: () => {
        this.callbacks.onHire(candidate);
        this.hideApplicationsView();
      },
    });
    grid.addControl(hireBtn, 0, 3);
    this.candidateHireButtons.set(candidate.id, hireBtn);

    return row;
  }

  private showApplicationsView(): void {
    if (this.panel) this.panel.isVisible = false;
    if (this.applicationsPanel) this.applicationsPanel.isVisible = true;
    this.syncAutomationControls();
  }

  private hideApplicationsView(): void {
    if (this.panel) this.panel.isVisible = true;
    if (this.applicationsPanel) this.applicationsPanel.isVisible = false;
    this.syncAutomationControls();
  }

  private refreshAssignmentSection(): void {
    if (!this.assignmentSummaryText || !this.assignmentDutyText || !this.assignmentButtonGrid || !this.focusButtonGrid || !this.zoneStatusText) return;

    const roster = this.currentRoster;
    const workState = this.currentWorkState;
    const selectedEmployee = roster?.employees.find((employee) => employee.id === this.selectedEmployeeId) ?? null;

    const buttonChildren = [...this.assignmentButtonGrid.children];
    for (const child of buttonChildren) {
      this.assignmentButtonGrid.removeControl(child);
    }
    this.areaButtons.clear();
    const focusChildren = [...this.focusButtonGrid.children];
    for (const child of focusChildren) {
      this.focusButtonGrid.removeControl(child);
    }
    this.focusButtons.clear();
    if (!selectedEmployee || !workState) {
      this.assignmentSummaryText.text = 'Choose a crew member from the roster first.';
      this.assignmentDutyText.text = 'After selection, set a zone and work focus so this person keeps part of the course running without more clicks.';
      this.zoneStatusText.text = this.buildZoneStatusText();
      this.syncAutomationControls();
      return;
    }

    const worker = workState.workers.find((candidate) => candidate.employeeId === selectedEmployee.id) ?? null;
    const areaName = this.getAreaName(selectedEmployee.assignedArea);
    const currentTask = worker ? getWorkerTaskLabel(worker.currentTask, worker.path.length > 0) : 'Standing By';

    const focusName = EMPLOYEE_FOCUS_LABELS[selectedEmployee.assignedFocus ?? 'balanced'];
    this.assignmentSummaryText.text = `${selectedEmployee.name} • ${EMPLOYEE_ROLE_INFO[selectedEmployee.role].name} • ${focusName}`;
    this.assignmentDutyText.text = `Coverage: ${areaName}. Current task: ${currentTask}. Use zone + focus to decide what this worker should keep on top of every day.`;

    const areaOptions: Array<{ id: string | null; label: string }> = [
      { id: null, label: 'Anywhere' },
      ...workState.areas
        .filter((area) => area.id !== 'all_course')
        .map((area) => ({ id: area.id, label: area.name })),
    ];

    areaOptions.forEach((option, index) => {
      const button = createSelectableButton({
        id: `assignArea_${option.id ?? 'any'}`,
        label: option.label,
        width: 182,
        height: 18,
        fontSize: 10,
        style: {
          selectedBackground: '#4a8a9a',
          selectedColor: '#ffffff',
          unselectedBackground: '#203948',
          unselectedColor: '#9ec6d8',
          hoverBackground: '#376173',
        },
        selected: selectedEmployee.assignedArea === option.id,
        onClick: () => this.callbacks.onAssignArea(selectedEmployee.id, option.id),
    });
      const row = Math.floor(index / 2);
      const column = index % 2;
      this.assignmentButtonGrid!.addControl(button, row, column);
      this.areaButtons.set(option.id ?? 'anywhere', button);
    });

    const focusOptions: EmployeeFocusPreference[] = ['balanced', 'mowing', 'watering', 'fertilizing', 'bunkers'];
    focusOptions.forEach((focus, index) => {
      const button = createSelectableButton({
        id: `focus_${focus}`,
        label: EMPLOYEE_FOCUS_LABELS[focus],
        width: 72,
        height: 24,
        fontSize: 9,
        style: {
          selectedBackground: '#5a8f62',
          selectedColor: '#ffffff',
          unselectedBackground: '#233a28',
          unselectedColor: '#abd4b0',
          hoverBackground: '#33543b',
        },
        selected: (selectedEmployee.assignedFocus ?? 'balanced') === focus,
        onClick: () => this.callbacks.onAssignFocus(selectedEmployee.id, focus),
      });
      this.focusButtonGrid!.addControl(button, 0, index);
      this.focusButtons.set(focus, button);
    });

    this.zoneStatusText.text = this.buildZoneStatusText();
    this.syncAutomationControls();
  }

  private getAreaName(areaId: string | null): string {
    if (!areaId || areaId === 'all_course') return 'Anywhere';
    return this.currentWorkState?.areas.find((area) => area.id === areaId)?.name ?? 'Assigned Area';
  }

  private buildZoneStatusText(): string {
    if (!this.currentWorkState) return 'Zones: no recurring coverage set.';

    const areas = this.currentWorkState.areas.filter((area) => area.id !== 'all_course');
    if (areas.length === 0) return 'Zones: no recurring coverage set.';

    const lines = areas.map((area) => {
      const crew = this.currentRoster?.employees.filter((employee) => employee.assignedArea === area.id) ?? [];
      const robots = this.currentAutonomousState?.robots.filter((robot) => robot.assignedAreaId === area.id) ?? [];
      const crewLabel =
        crew.length > 0
          ? crew.map((employee) => `${employee.name.split(' ')[0]}:${EMPLOYEE_FOCUS_LABELS[employee.assignedFocus ?? 'balanced']}`).join(', ')
          : 'no crew';
      const robotLabel = robots.length > 0 ? `${robots.length} robot${robots.length !== 1 ? 's' : ''}` : 'no robots';
      return `${area.name}: ${crewLabel} • ${robotLabel}`;
    });

    return lines.join('\n');
  }

  public update(
    roster: EmployeeRoster,
    workState: EmployeeWorkSystemState,
    autonomousState: AutonomousEquipmentState | null = null
  ): void {
    this.currentRoster = roster;
    this.currentWorkState = workState;
    this.currentAutonomousState = autonomousState;

    if (!this.employeeListContainer || !this.employeeCountText || !this.payrollText || !this.coverageText) return;

    const children = [...this.employeeListContainer.children];
    for (const child of children) {
      this.employeeListContainer.removeControl(child);
    }
    this.employeeRowControls.clear();

    if (this.selectedEmployeeId) {
      const selected = roster.employees.find((employee) => employee.id === this.selectedEmployeeId);
      if (!selected) {
        this.selectedEmployeeId = null;
        this.selectedEmployeeName = null;
      } else {
        this.selectedEmployeeName = selected.name;
      }
    }

    if (!this.selectedEmployeeId && roster.employees.length > 0) {
      this.selectedEmployeeId = roster.employees[0].id;
      this.selectedEmployeeName = roster.employees[0].name;
    }

    for (const employee of roster.employees) {
      const row = this.createEmployeeRow(employee);
      this.employeeListContainer.addControl(row);
    }

    if (roster.employees.length === 0) {
      const emptyText = new TextBlock('emptyText');
      emptyText.text = 'No crew hired yet.\nOpen Applications to review candidates and start building your staff.';
      emptyText.color = UI_THEME.colors.text.secondary;
      emptyText.fontSize = UI_THEME.typography.scale.s12;
      emptyText.height = '72px';
      emptyText.textWrapping = true;
      emptyText.lineSpacing = '4px';
      this.employeeListContainer.addControl(emptyText);
    }

    this.employeeCountText.text = `${roster.employees.length} / ${roster.maxEmployees}`;

    const hourlyPayroll = roster.employees.reduce((sum, e) => sum + e.hourlyWage, 0);
    this.payrollText.text = `$${hourlyPayroll}/hr`;
    const staffedZones = new Set(
      roster.employees
        .map((employee) => employee.assignedArea)
        .filter((areaId): areaId is string => areaId !== null && areaId !== 'all_course')
    ).size;
    const zonedRobots = autonomousState?.robots.filter((robot) => robot.assignedAreaId && robot.assignedAreaId !== 'all_course').length ?? 0;
    this.coverageText.text =
      staffedZones > 0 || zonedRobots > 0
        ? `${staffedZones} crew • ${zonedRobots} bot${zonedRobots !== 1 ? 's' : ''}`
        : 'Course-wide';
    this.updateMainActionState();
    this.syncAutomationControls();
  }

  public updateApplications(state: ApplicationState, prestigeTier: PrestigeTier, currentGameTime: number): void {
    if (!this.applicationsContainer) return;

    // Update status text
    const config = PRESTIGE_HIRING_CONFIG[prestigeTier];
    const minutesUntilNext = Math.max(0, state.nextApplicationTime - currentGameTime);
    const hoursUntilNext = minutesUntilNext / 60;

    if (minutesUntilNext < 1) {
      this.nextApplicationText!.text = 'Soon...';
    } else if (hoursUntilNext < 1) {
      this.nextApplicationText!.text = `${Math.ceil(minutesUntilNext)} minutes`;
    } else {
      this.nextApplicationText!.text = `${hoursUntilNext.toFixed(1)} hours`;
    }

    // Update post job button based on active postings
    const postingCount = state.activeJobPostings.length;
    this.hasActivePosting = postingCount > 0;

    if (postingCount === 0) {
      this.postingCountText!.text = 'No active job postings';
      this.postingCountText!.color = UI_THEME.colors.text.muted;
      this.updatePostJobButtonText();
      this.postJobButton!.background = UI_THEME.colors.miscButton.blueAction;
      this.postJobButton!.color = UI_THEME.colors.miscButton.blueActionText;
      this.postJobButton!.isEnabled = true;
    } else {
      const posting = state.activeJobPostings[0];
      const roleInfo = EMPLOYEE_ROLE_INFO[posting.role];
      const expiresInMinutes = Math.max(0, posting.expiresAt - currentGameTime);
      const expiresInHours = expiresInMinutes / 60;
      const expiresText = expiresInHours >= 1
        ? `${expiresInHours.toFixed(1)}h left`
        : `${Math.ceil(expiresInMinutes)}m left`;
      this.postingCountText!.text = `✓ Hiring ${roleInfo.name} (${expiresText})`;
      this.postingCountText!.color = UI_THEME.colors.text.success;
      this.postJobButton!.textBlock!.text = `⏳ ${roleInfo.icon} Posting Active`;
      this.postJobButton!.background = UI_THEME.colors.legacy.c_444444;
      this.postJobButton!.color = UI_THEME.colors.legacy.c_888888;
      this.postJobButton!.isEnabled = false;
    }

    // Update applications list
    const children = [...this.applicationsContainer.children];
    for (const child of children) {
      this.applicationsContainer.removeControl(child);
    }
    this.candidateHireButtons.clear();

    for (const application of state.applications) {
      const row = this.createCandidateRow(application);
      this.applicationsContainer.addControl(row);
    }

    if (state.applications.length === 0) {
      const emptyText = new TextBlock('emptyApplicationsText');
      const tierName = prestigeTier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      emptyText.text = `No applicants are waiting.\n\n${tierName} courses usually get fresh interest every ${config.applicationRate} hours.\n\nPost a role when you need coverage sooner or when you want to steer who applies next.`;
      emptyText.color = UI_THEME.colors.text.secondary;
      emptyText.fontSize = UI_THEME.typography.scale.s11;
      emptyText.height = '118px';
      emptyText.textWrapping = true;
      emptyText.lineSpacing = '3px';
      this.applicationsContainer.addControl(emptyText);
    }
    this.syncAutomationControls();
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
      if (this.applicationsPanel) this.applicationsPanel.isVisible = false;
      this.updateMainActionState();
      this.syncAutomationControls();
    }
  }

  public hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
    if (this.applicationsPanel) {
      this.applicationsPanel.isVisible = false;
    }
    this.syncAutomationControls();
  }

  public isVisible(): boolean {
    return (this.panel?.isVisible ?? false) || (this.applicationsPanel?.isVisible ?? false);
  }

  public toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public dispose(): void {
    uiAutomationBridge.unregisterPrefix('panel.employee.');
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
    }
    if (this.applicationsPanel) {
      this.advancedTexture.removeControl(this.applicationsPanel);
    }
  }

  private syncAutomationControls(): void {
    uiAutomationBridge.unregisterPrefix('panel.employee.');

    uiAutomationBridge.register({
      id: 'panel.employee.close',
      label: 'Close Course Operations',
      role: 'button',
      getControl: () => this.mainCloseButton,
      isVisible: () => this.panel?.isVisible ?? false,
      isEnabled: () => this.mainCloseButton?.isEnabled ?? false,
      onActivate: () => this.callbacks.onClose(),
    });
    uiAutomationBridge.register({
      id: 'panel.employee.open_applications',
      label: 'Open Applications',
      role: 'button',
      getControl: () => this.applicationsButton,
      isVisible: () => this.panel?.isVisible ?? false,
      isEnabled: () => this.applicationsButton?.isEnabled ?? false,
      onActivate: () => this.showApplicationsView(),
    });
    uiAutomationBridge.register({
      id: 'panel.employee.fire_selected',
      label: 'Fire Selected Employee',
      role: 'button',
      getControl: () => this.fireButton,
      isVisible: () => this.panel?.isVisible ?? false,
      isEnabled: () => this.fireButton?.isEnabled ?? false,
      onActivate: () => this.fireButton?.onPointerClickObservable.notifyObservers(null as never),
    });

    for (const [employeeId, control] of this.employeeRowControls) {
      const employee = this.currentRoster?.employees.find((candidate) => candidate.id === employeeId);
      uiAutomationBridge.register({
        id: `panel.employee.select.${employeeId}`,
        label: employee ? `Select ${employee.name}` : `Select Employee ${employeeId}`,
        role: 'button',
        getControl: () => control,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => true,
        onActivate: () => {
          this.selectedEmployeeId = employeeId;
          this.selectedEmployeeName = employee?.name ?? null;
          if (this.currentRoster && this.currentWorkState) {
            this.update(this.currentRoster, this.currentWorkState, this.currentAutonomousState);
          } else {
            this.updateMainActionState();
          }
        },
      });
    }

    for (const [areaId, button] of this.areaButtons) {
      uiAutomationBridge.register({
        id: `panel.employee.assign_area.${areaId}`,
        label: `Assign Area ${areaId}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }

    for (const [focus, button] of this.focusButtons) {
      uiAutomationBridge.register({
        id: `panel.employee.assign_focus.${focus}`,
        label: `Set Focus ${focus}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }

    uiAutomationBridge.register({
      id: 'panel.employee.applications.close',
      label: 'Close Applications',
      role: 'button',
      getControl: () => this.applicationsCloseButton,
      isVisible: () => this.applicationsPanel?.isVisible ?? false,
      isEnabled: () => this.applicationsCloseButton?.isEnabled ?? false,
      onActivate: () => this.hideApplicationsView(),
    });
    uiAutomationBridge.register({
      id: 'panel.employee.applications.close_all',
      label: 'Close Applications And Crew Panel',
      role: 'button',
      getControl: () => this.mainCloseButton,
      isVisible: () => this.applicationsPanel?.isVisible ?? false,
      isEnabled: () => this.mainCloseButton?.isEnabled ?? false,
      onActivate: () => this.callbacks.onClose(),
    });
    uiAutomationBridge.register({
      id: 'panel.employee.applications.post_job',
      label: 'Post Job Opening',
      role: 'button',
      getControl: () => this.postJobButton,
      isVisible: () => this.applicationsPanel?.isVisible ?? false,
      isEnabled: () => this.postJobButton?.isEnabled ?? false,
      onActivate: () => this.callbacks.onPostJobOpening(this.selectedPostingRole),
    });

    for (const [role, button] of this.roleButtons) {
      uiAutomationBridge.register({
        id: `panel.employee.applications.role.${role}`,
        label: `Select Posting Role ${role}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.applicationsPanel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => this.selectPostingRole(role),
      });
    }

    for (const [candidateId, button] of this.candidateHireButtons) {
      uiAutomationBridge.register({
        id: `panel.employee.applications.hire.${candidateId}`,
        label: `Hire Candidate ${candidateId}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.applicationsPanel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }
  }
}
