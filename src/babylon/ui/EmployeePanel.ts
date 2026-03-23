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

import {
  Employee,
  EmployeeRole,
  EmployeeRoster,
  ApplicationState,
  SkillLevel,
  PrestigeTier,
  PRESTIGE_HIRING_CONFIG,
  EMPLOYEE_ROLE_INFO,
} from '../../core/employees';

export interface EmployeePanelCallbacks {
  onHire: (employee: Employee) => void;
  onFire: (employeeId: string) => void;
  onClose: () => void;
  onPostJobOpening: (role: EmployeeRole) => void;
}

const SKILL_COLORS: Record<SkillLevel, string> = {
  novice: '#888888',
  trained: '#44aa44',
  experienced: '#4488ff',
  expert: '#ffaa00',
};

const EMPLOYEE_DIALOG_WIDTH = 408;
const EMPLOYEE_DIALOG_HEIGHT = 492;
const EMPLOYEE_CONTENT_WIDTH = 384;
const EMPLOYEE_SCROLL_WIDTH = 368;

export class EmployeePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: EmployeePanelCallbacks;

  private panel: Rectangle | null = null;
  private applicationsPanel: Rectangle | null = null;
  private employeeListContainer: StackPanel | null = null;
  private applicationsContainer: StackPanel | null = null;
  private payrollText: TextBlock | null = null;
  private employeeCountText: TextBlock | null = null;
  private nextApplicationText: TextBlock | null = null;
  private postingCountText: TextBlock | null = null;
  private postJobButton: Button | null = null;
  private fireButton: Button | null = null;
  private mainActionHintText: TextBlock | null = null;
  private hasActivePosting: boolean = false;

  private selectedEmployeeId: string | null = null;
  private selectedEmployeeName: string | null = null;
  private selectedPostingRole: EmployeeRole = 'groundskeeper';
  private roleButtons: Map<EmployeeRole, Button> = new Map();

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
      title: '👥 EMPLOYEE MANAGEMENT',
      headerWidth: EMPLOYEE_CONTENT_WIDTH,
      onClose: () => this.callbacks.onClose(),
      nodes: [
        { type: 'custom', id: 'summary', render: (parent) => this.createSummaryRow(parent) },
        { type: 'custom', id: 'employeeList', render: (parent) => this.createEmployeeList(parent) },
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
      height: 56,
      theme: 'green',
      paddingTop: 8,
    });

    const grid = new Grid('summaryGrid');
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
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
  }

  private createEmployeeList(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'listContainer',
      width: EMPLOYEE_CONTENT_WIDTH,
      height: 304,
      theme: 'green',
      paddingTop: 8,
      scroll: {
        name: 'employeeScroll',
        width: EMPLOYEE_SCROLL_WIDTH,
        height: 290,
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

    const row = createListRowCard({
      name: `emp_${employee.id}`,
      width: 348,
      height: 62,
      background: isSelected ? 'rgba(74, 126, 96, 0.9)' : UI_THEME.colors.surfaces.sectionAlt,
      borderColor: isSelected ? UI_THEME.colors.launch.selectedBorder : UI_THEME.colors.editor.buttonBorder,
      thickness: isSelected ? 2 : 1,
    });

    row.onPointerClickObservable.add(() => {
      this.selectedEmployeeId = employee.id;
      this.selectedEmployeeName = employee.name;
      this.refreshEmployeeList();
      this.updateMainActionState();
    });
    row.onPointerEnterObservable.add(() => {
      if (!isSelected) row.background = UI_THEME.colors.surfaces.section;
    });
    row.onPointerOutObservable.add(() => {
      if (!isSelected) row.background = UI_THEME.colors.surfaces.sectionAlt;
    });

    const grid = new Grid('empRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(166, true);
    grid.addColumnDefinition(84, true);
    grid.addColumnDefinition(63, true);
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
    statusText.text = employee.status.replace('_', ' ');
    statusText.color = employee.status === 'working' ? '#44aa44' :
                       employee.status === 'on_break' ? '#ffaa44' : '#888888';
    statusText.fontSize = UI_THEME.typography.scale.s9;
    statusText.height = '12px';
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(statusText);

    const skillStack = new StackPanel('skillStack');
    grid.addControl(skillStack, 0, 2);

    const skillText = new TextBlock('empSkill');
    skillText.text = employee.skillLevel;
    skillText.color = SKILL_COLORS[employee.skillLevel];
    skillText.fontSize = UI_THEME.typography.scale.s11;
    skillText.height = '16px';
    skillText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    skillStack.addControl(skillText);

    const wageText = new TextBlock('empWage');
    wageText.text = `$${employee.hourlyWage}/hr`;
    wageText.color = UI_THEME.colors.text.warning;
    wageText.fontSize = UI_THEME.typography.scale.s12;
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
        : 'Tip: click an employee row to enable firing.';
    }
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
      height: 65,
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
    buttonRow.height = '40px';
    buttonRow.width = `${EMPLOYEE_SCROLL_WIDTH}px`;
    roles.forEach(() => buttonRow.addColumnDefinition(1 / roles.length));
    innerStack.addControl(buttonRow);
    roles.forEach((role, index) => {
      const btn = createSelectableButton({
        id: `role_${role}`,
        label: EMPLOYEE_ROLE_INFO[role].icon,
        width: 45,
        height: 32,
        fontSize: 16,
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
      height: 65,
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
    grid.addColumnDefinition(178, true);
    grid.addColumnDefinition(72, true);
    grid.addColumnDefinition(63, true);
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
    roleText.text = EMPLOYEE_ROLE_INFO[candidate.role].name;
    roleText.color = UI_THEME.colors.text.secondary;
    roleText.fontSize = UI_THEME.typography.scale.s10;
    roleText.height = '14px';
    roleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(roleText);

    const skillText = new TextBlock('candSkill');
    skillText.text = candidate.skillLevel;
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

    return row;
  }

  private showApplicationsView(): void {
    if (this.panel) this.panel.isVisible = false;
    if (this.applicationsPanel) this.applicationsPanel.isVisible = true;
  }

  private hideApplicationsView(): void {
    if (this.panel) this.panel.isVisible = true;
    if (this.applicationsPanel) this.applicationsPanel.isVisible = false;
  }

  private refreshEmployeeList(): void {
    if (!this.employeeListContainer) return;

    const children = [...this.employeeListContainer.children];
    for (const child of children) {
      this.employeeListContainer.removeControl(child);
    }
  }

  public update(roster: EmployeeRoster): void {
    if (!this.employeeListContainer || !this.employeeCountText || !this.payrollText) return;

    const children = [...this.employeeListContainer.children];
    for (const child of children) {
      this.employeeListContainer.removeControl(child);
    }

    if (this.selectedEmployeeId) {
      const selected = roster.employees.find((employee) => employee.id === this.selectedEmployeeId);
      if (!selected) {
        this.selectedEmployeeId = null;
        this.selectedEmployeeName = null;
      } else {
        this.selectedEmployeeName = selected.name;
      }
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
    this.updateMainActionState();
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

    for (const application of state.applications) {
      const row = this.createCandidateRow(application);
      this.applicationsContainer.addControl(row);
    }

    if (state.applications.length === 0) {
      const emptyText = new TextBlock('emptyApplicationsText');
      const tierName = prestigeTier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      emptyText.text = `No applications yet.\n\n${tierName} courses receive applications every ${config.applicationRate} hours.\n\nPost a job opening to speed up the process!`;
      emptyText.color = UI_THEME.colors.text.secondary;
      emptyText.fontSize = UI_THEME.typography.scale.s11;
      emptyText.height = '100px';
      emptyText.textWrapping = true;
      emptyText.lineSpacing = '3px';
      this.applicationsContainer.addControl(emptyText);
    }
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
      if (this.applicationsPanel) this.applicationsPanel.isVisible = false;
      this.updateMainActionState();
    }
  }

  public hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
    if (this.applicationsPanel) {
      this.applicationsPanel.isVisible = false;
    }
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
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
    }
    if (this.applicationsPanel) {
      this.advancedTexture.removeControl(this.applicationsPanel);
    }
  }
}
