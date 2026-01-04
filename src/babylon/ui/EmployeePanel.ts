import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';

import {
  Employee,
  EmployeeRole,
  EmployeeRoster,
  ApplicationState,
  SkillLevel,
  PrestigeTier,
  PRESTIGE_HIRING_CONFIG,
} from '../../core/employees';

export interface EmployeePanelCallbacks {
  onHire: (employee: Employee) => void;
  onFire: (employeeId: string) => void;
  onClose: () => void;
  onPostJobOpening: () => void;
}

const ROLE_ICONS: Record<EmployeeRole, string> = {
  groundskeeper: '🌿',
  mechanic: '🔧',
  irrigator: '💧',
  pro_shop_staff: '🏌️',
  manager: '📋',
  caddy: '🎒',
};

const ROLE_LABELS: Record<EmployeeRole, string> = {
  groundskeeper: 'Groundskeeper',
  mechanic: 'Mechanic',
  irrigator: 'Irrigator',
  pro_shop_staff: 'Pro Shop',
  manager: 'Manager',
  caddy: 'Caddy',
};

const SKILL_COLORS: Record<SkillLevel, string> = {
  novice: '#888888',
  trained: '#44aa44',
  experienced: '#4488ff',
  expert: '#ffaa00',
};

export class EmployeePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: EmployeePanelCallbacks;

  private panel: Rectangle | null = null;
  private employeeListContainer: StackPanel | null = null;
  private applicationsContainer: StackPanel | null = null;
  private payrollText: TextBlock | null = null;
  private employeeCountText: TextBlock | null = null;
  private applicationsView: Rectangle | null = null;
  private mainView: Rectangle | null = null;
  private nextApplicationText: TextBlock | null = null;
  private postingCountText: TextBlock | null = null;
  private postJobButton: Button | null = null;

  private selectedEmployeeId: string | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: EmployeePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('employeePanel');
    this.panel.width = '360px';
    this.panel.height = '450px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 45, 35, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.isVisible = false;
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 10;
    this.panel.shadowOffsetX = 3;
    this.panel.shadowOffsetY = 3;
    this.advancedTexture.addControl(this.panel);

    this.createMainView();
    this.createApplicationsView();
  }

  private createMainView(): void {
    this.mainView = new Rectangle('mainView');
    this.mainView.width = '100%';
    this.mainView.height = '100%';
    this.mainView.thickness = 0;
    this.mainView.background = 'transparent';
    this.panel!.addControl(this.mainView);

    const stack = new StackPanel('employeeStack');
    stack.paddingTop = '12px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    stack.paddingBottom = '12px';
    this.mainView.addControl(stack);

    this.createHeader(stack);
    this.createSummaryRow(stack);
    this.createEmployeeList(stack);
    this.createActionButtons(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.height = '36px';
    headerContainer.width = '336px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer);

    const title = new TextBlock('title');
    title.text = '👥 EMPLOYEE MANAGEMENT';
    title.color = '#ffcc00';
    title.fontSize = 16;
    title.fontWeight = 'bold';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.left = '0px';
    headerContainer.addControl(title);

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

  private createSummaryRow(parent: StackPanel): void {
    const summaryContainer = new Rectangle('summaryContainer');
    summaryContainer.height = '50px';
    summaryContainer.width = '336px';
    summaryContainer.cornerRadius = 4;
    summaryContainer.background = 'rgba(30, 60, 45, 0.8)';
    summaryContainer.thickness = 1;
    summaryContainer.color = '#3a5a4a';
    summaryContainer.paddingTop = '8px';
    parent.addControl(summaryContainer);

    const grid = new Grid('summaryGrid');
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    summaryContainer.addControl(grid);

    const countStack = new StackPanel('countStack');
    countStack.paddingLeft = '12px';
    grid.addControl(countStack, 0, 0);

    const countLabel = new TextBlock('countLabel');
    countLabel.text = 'Employees';
    countLabel.color = '#888888';
    countLabel.fontSize = 10;
    countLabel.height = '14px';
    countLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    countStack.addControl(countLabel);

    this.employeeCountText = new TextBlock('employeeCount');
    this.employeeCountText.text = '0 / 10';
    this.employeeCountText.color = '#ffffff';
    this.employeeCountText.fontSize = 18;
    this.employeeCountText.height = '24px';
    this.employeeCountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    countStack.addControl(this.employeeCountText);

    const payrollStack = new StackPanel('payrollStack');
    grid.addControl(payrollStack, 0, 1);

    const payrollLabel = new TextBlock('payrollLabel');
    payrollLabel.text = 'Hourly Payroll';
    payrollLabel.color = '#888888';
    payrollLabel.fontSize = 10;
    payrollLabel.height = '14px';
    payrollLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    payrollStack.addControl(payrollLabel);

    this.payrollText = new TextBlock('payrollText');
    this.payrollText.text = '$0/hr';
    this.payrollText.color = '#ff8844';
    this.payrollText.fontSize = 18;
    this.payrollText.height = '24px';
    this.payrollText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    payrollStack.addControl(this.payrollText);
  }

  private createEmployeeList(parent: StackPanel): void {
    const listContainer = new Rectangle('listContainer');
    listContainer.height = '280px';
    listContainer.width = '336px';
    listContainer.cornerRadius = 4;
    listContainer.background = 'rgba(15, 35, 25, 0.8)';
    listContainer.thickness = 1;
    listContainer.color = '#3a5a4a';
    listContainer.paddingTop = '8px';
    parent.addControl(listContainer);

    const scrollViewer = new ScrollViewer('employeeScroll');
    scrollViewer.width = '320px';
    scrollViewer.height = '270px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a8a5a';
    scrollViewer.barBackground = 'rgba(0,0,0,0.3)';
    listContainer.addControl(scrollViewer);

    this.employeeListContainer = new StackPanel('employeeListStack');
    this.employeeListContainer.width = '100%';
    scrollViewer.addControl(this.employeeListContainer);
  }

  private createEmployeeRow(employee: Employee): Rectangle {
    const isSelected = this.selectedEmployeeId === employee.id;

    const row = new Rectangle(`emp_${employee.id}`);
    row.height = '55px';
    row.width = '300px';
    row.cornerRadius = 4;
    row.background = isSelected ? 'rgba(70, 120, 90, 0.8)' : 'rgba(40, 70, 55, 0.6)';
    row.thickness = isSelected ? 2 : 1;
    row.color = isSelected ? '#7FFF7F' : '#3a5a4a';
    row.paddingTop = '4px';
    row.paddingBottom = '4px';

    row.onPointerClickObservable.add(() => {
      this.selectedEmployeeId = employee.id;
      this.refreshEmployeeList();
    });
    row.onPointerEnterObservable.add(() => {
      if (!isSelected) row.background = 'rgba(50, 90, 70, 0.7)';
    });
    row.onPointerOutObservable.add(() => {
      if (!isSelected) row.background = 'rgba(40, 70, 55, 0.6)';
    });

    const grid = new Grid('empRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(130, true);
    grid.addColumnDefinition(75, true);
    grid.addColumnDefinition(60, true);
    row.addControl(grid);

    const icon = new TextBlock('empIcon');
    icon.text = ROLE_ICONS[employee.role];
    icon.fontSize = 18;
    grid.addControl(icon, 0, 0);

    const infoStack = new StackPanel('empInfo');
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('empName');
    nameText.text = employee.name;
    nameText.color = '#ffffff';
    nameText.fontSize = 12;
    nameText.height = '16px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const roleText = new TextBlock('empRole');
    roleText.text = ROLE_LABELS[employee.role];
    roleText.color = '#aaaaaa';
    roleText.fontSize = 10;
    roleText.height = '14px';
    roleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(roleText);

    const statusText = new TextBlock('empStatus');
    statusText.text = employee.status.replace('_', ' ');
    statusText.color = employee.status === 'working' ? '#44aa44' :
                       employee.status === 'on_break' ? '#ffaa44' : '#888888';
    statusText.fontSize = 9;
    statusText.height = '12px';
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(statusText);

    const skillStack = new StackPanel('skillStack');
    grid.addControl(skillStack, 0, 2);

    const skillText = new TextBlock('empSkill');
    skillText.text = employee.skillLevel;
    skillText.color = SKILL_COLORS[employee.skillLevel];
    skillText.fontSize = 11;
    skillText.height = '16px';
    infoStack.addControl(skillText);

    const wageText = new TextBlock('empWage');
    wageText.text = `$${employee.hourlyWage}/hr`;
    wageText.color = '#ff8844';
    wageText.fontSize = 12;
    grid.addControl(wageText, 0, 3);

    return row;
  }

  private createActionButtons(parent: StackPanel): void {
    const buttonContainer = new Rectangle('buttonContainer');
    buttonContainer.height = '45px';
    buttonContainer.width = '336px';
    buttonContainer.thickness = 0;
    buttonContainer.background = 'transparent';
    buttonContainer.paddingTop = '8px';
    parent.addControl(buttonContainer);

    const grid = new Grid('buttonGrid');
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    buttonContainer.addControl(grid);

    const hireBtn = Button.CreateSimpleButton('hireBtn', '📋 Applications');
    hireBtn.width = '150px';
    hireBtn.height = '35px';
    hireBtn.cornerRadius = 6;
    hireBtn.background = '#2a7a4a';
    hireBtn.color = '#88ff88';
    hireBtn.thickness = 2;
    hireBtn.fontSize = 14;
    hireBtn.onPointerClickObservable.add(() => this.showApplicationsView());
    hireBtn.onPointerEnterObservable.add(() => { hireBtn.background = '#3a9a5a'; });
    hireBtn.onPointerOutObservable.add(() => { hireBtn.background = '#2a7a4a'; });
    grid.addControl(hireBtn, 0, 0);

    const fireBtn = Button.CreateSimpleButton('fireBtn', '🚫 Fire');
    fireBtn.width = '150px';
    fireBtn.height = '35px';
    fireBtn.cornerRadius = 6;
    fireBtn.background = '#7a3a3a';
    fireBtn.color = '#ff8888';
    fireBtn.thickness = 2;
    fireBtn.fontSize = 14;
    fireBtn.onPointerClickObservable.add(() => {
      if (this.selectedEmployeeId) {
        this.callbacks.onFire(this.selectedEmployeeId);
        this.selectedEmployeeId = null;
      }
    });
    fireBtn.onPointerEnterObservable.add(() => { fireBtn.background = '#9a4a4a'; });
    fireBtn.onPointerOutObservable.add(() => { fireBtn.background = '#7a3a3a'; });
    grid.addControl(fireBtn, 0, 1);
  }

  private createApplicationsView(): void {
    this.applicationsView = new Rectangle('applicationsView');
    this.applicationsView.width = '100%';
    this.applicationsView.height = '100%';
    this.applicationsView.thickness = 0;
    this.applicationsView.background = 'transparent';
    this.applicationsView.isVisible = false;
    this.panel!.addControl(this.applicationsView);

    const stack = new StackPanel('applicationsStack');
    stack.paddingTop = '12px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    stack.paddingBottom = '12px';
    this.applicationsView.addControl(stack);

    const headerContainer = new Rectangle('applicationsHeaderContainer');
    headerContainer.height = '36px';
    headerContainer.width = '336px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    stack.addControl(headerContainer);

    const title = new TextBlock('applicationsTitle');
    title.text = '📋 JOB APPLICATIONS';
    title.color = '#ffcc00';
    title.fontSize = 16;
    title.fontWeight = 'bold';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.left = '0px';
    headerContainer.addControl(title);

    const backBtn = Button.CreateSimpleButton('backBtn', '← Back');
    backBtn.width = '70px';
    backBtn.height = '28px';
    backBtn.cornerRadius = 4;
    backBtn.background = '#4a6a5a';
    backBtn.color = 'white';
    backBtn.thickness = 0;
    backBtn.fontSize = 12;
    backBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    backBtn.onPointerClickObservable.add(() => this.hideApplicationsView());
    backBtn.onPointerEnterObservable.add(() => { backBtn.background = '#5a7a6a'; });
    backBtn.onPointerOutObservable.add(() => { backBtn.background = '#4a6a5a'; });
    headerContainer.addControl(backBtn);

    // Status info
    const statusContainer = new Rectangle('statusContainer');
    statusContainer.height = '60px';
    statusContainer.width = '336px';
    statusContainer.cornerRadius = 4;
    statusContainer.background = 'rgba(30, 60, 45, 0.8)';
    statusContainer.thickness = 1;
    statusContainer.color = '#3a5a4a';
    statusContainer.paddingTop = '8px';
    stack.addControl(statusContainer);

    const statusStack = new StackPanel('statusStack');
    statusStack.paddingLeft = '12px';
    statusStack.paddingRight = '12px';
    statusContainer.addControl(statusStack);

    const nextAppLabel = new TextBlock('nextAppLabel');
    nextAppLabel.text = 'Next Application:';
    nextAppLabel.color = '#888888';
    nextAppLabel.fontSize = 10;
    nextAppLabel.height = '14px';
    nextAppLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusStack.addControl(nextAppLabel);

    this.nextApplicationText = new TextBlock('nextApplicationText');
    this.nextApplicationText.text = 'Loading...';
    this.nextApplicationText.color = '#ffcc00';
    this.nextApplicationText.fontSize = 14;
    this.nextApplicationText.height = '18px';
    this.nextApplicationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusStack.addControl(this.nextApplicationText);

    this.postingCountText = new TextBlock('postingCountText');
    this.postingCountText.text = 'No active job postings';
    this.postingCountText.color = '#888888';
    this.postingCountText.fontSize = 10;
    this.postingCountText.height = '16px';
    this.postingCountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    statusStack.addControl(this.postingCountText);

    const applicationsListContainer = new Rectangle('applicationsListContainer');
    applicationsListContainer.height = '280px';
    applicationsListContainer.width = '336px';
    applicationsListContainer.cornerRadius = 4;
    applicationsListContainer.background = 'rgba(15, 35, 25, 0.8)';
    applicationsListContainer.thickness = 1;
    applicationsListContainer.color = '#3a5a4a';
    applicationsListContainer.paddingTop = '8px';
    stack.addControl(applicationsListContainer);

    const scrollViewer = new ScrollViewer('applicationsScroll');
    scrollViewer.width = '320px';
    scrollViewer.height = '270px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a8a5a';
    scrollViewer.barBackground = 'rgba(0,0,0,0.3)';
    applicationsListContainer.addControl(scrollViewer);

    this.applicationsContainer = new StackPanel('applicationsListStack');
    this.applicationsContainer.width = '100%';
    scrollViewer.addControl(this.applicationsContainer);

    this.postJobButton = Button.CreateSimpleButton('postJobBtn', '📢 Post Job Opening ($500)');
    this.postJobButton.width = '336px';
    this.postJobButton.height = '35px';
    this.postJobButton.cornerRadius = 6;
    this.postJobButton.background = '#3a6a8a';
    this.postJobButton.color = '#88ccff';
    this.postJobButton.thickness = 2;
    this.postJobButton.fontSize = 14;
    this.postJobButton.paddingTop = '8px';
    this.postJobButton.onPointerClickObservable.add(() => this.callbacks.onPostJobOpening());
    this.postJobButton.onPointerEnterObservable.add(() => { this.postJobButton!.background = '#4a7a9a'; });
    this.postJobButton.onPointerOutObservable.add(() => { this.postJobButton!.background = '#3a6a8a'; });
    stack.addControl(this.postJobButton);
  }

  private createCandidateRow(candidate: Employee): Rectangle {
    const row = new Rectangle(`cand_${candidate.id}`);
    row.height = '65px';
    row.width = '300px';
    row.cornerRadius = 4;
    row.background = 'rgba(40, 70, 55, 0.6)';
    row.thickness = 1;
    row.color = '#3a5a4a';
    row.paddingTop = '4px';
    row.paddingBottom = '4px';

    row.onPointerEnterObservable.add(() => {
      row.background = 'rgba(50, 90, 70, 0.7)';
    });
    row.onPointerOutObservable.add(() => {
      row.background = 'rgba(40, 70, 55, 0.6)';
    });

    const grid = new Grid('candRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(140, true);
    grid.addColumnDefinition(60, true);
    grid.addColumnDefinition(65, true);
    row.addControl(grid);

    const icon = new TextBlock('candIcon');
    icon.text = ROLE_ICONS[candidate.role];
    icon.fontSize = 18;
    grid.addControl(icon, 0, 0);

    const infoStack = new StackPanel('candInfo');
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('candName');
    nameText.text = candidate.name;
    nameText.color = '#ffffff';
    nameText.fontSize = 12;
    nameText.height = '16px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const roleText = new TextBlock('candRole');
    roleText.text = ROLE_LABELS[candidate.role];
    roleText.color = '#aaaaaa';
    roleText.fontSize = 10;
    roleText.height = '14px';
    roleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(roleText);

    const skillText = new TextBlock('candSkill');
    skillText.text = candidate.skillLevel;
    skillText.color = SKILL_COLORS[candidate.skillLevel];
    skillText.fontSize = 10;
    skillText.height = '14px';
    skillText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(skillText);

    const wageText = new TextBlock('candWage');
    wageText.text = `$${candidate.hourlyWage}/hr`;
    wageText.color = '#ff8844';
    wageText.fontSize = 11;
    grid.addControl(wageText, 0, 2);

    const hireBtn = Button.CreateSimpleButton(`hire_${candidate.id}`, 'Hire');
    hireBtn.width = '55px';
    hireBtn.height = '28px';
    hireBtn.cornerRadius = 4;
    hireBtn.background = '#2a7a4a';
    hireBtn.color = '#88ff88';
    hireBtn.thickness = 1;
    hireBtn.fontSize = 11;
    hireBtn.onPointerClickObservable.add(() => {
      this.callbacks.onHire(candidate);
      this.hideApplicationsView();
    });
    hireBtn.onPointerEnterObservable.add(() => { hireBtn.background = '#3a9a5a'; });
    hireBtn.onPointerOutObservable.add(() => { hireBtn.background = '#2a7a4a'; });
    grid.addControl(hireBtn, 0, 3);

    return row;
  }

  private showApplicationsView(): void {
    this.mainView!.isVisible = false;
    this.applicationsView!.isVisible = true;
  }

  private hideApplicationsView(): void {
    this.mainView!.isVisible = true;
    this.applicationsView!.isVisible = false;
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

    for (const employee of roster.employees) {
      const row = this.createEmployeeRow(employee);
      this.employeeListContainer.addControl(row);
    }

    if (roster.employees.length === 0) {
      const emptyText = new TextBlock('emptyText');
      emptyText.text = 'No employees hired yet.\nClick "Hire" to browse candidates.';
      emptyText.color = '#888888';
      emptyText.fontSize = 12;
      emptyText.height = '60px';
      emptyText.textWrapping = true;
      this.employeeListContainer.addControl(emptyText);
    }

    this.employeeCountText.text = `${roster.employees.length} / ${roster.maxEmployees}`;

    const hourlyPayroll = roster.employees.reduce((sum, e) => sum + e.hourlyWage, 0);
    this.payrollText.text = `$${hourlyPayroll}/hr`;
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

    // Update posting count
    const postingCount = state.activeJobPostings.length;
    if (postingCount === 0) {
      this.postingCountText!.text = 'No active job postings';
      this.postingCountText!.color = '#888888';
    } else {
      this.postingCountText!.text = `${postingCount} active job posting${postingCount > 1 ? 's' : ''}`;
      this.postingCountText!.color = '#44aa44';
    }

    // Update post job button text with current cost
    this.postJobButton!.textBlock!.text = `📢 Post Job Opening ($${config.postingCost})`;

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
      emptyText.color = '#888888';
      emptyText.fontSize = 11;
      emptyText.height = '100px';
      emptyText.textWrapping = true;
      emptyText.lineSpacing = '3px';
      this.applicationsContainer.addControl(emptyText);
    }
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
      this.mainView!.isVisible = true;
      this.applicationsView!.isVisible = false;
    }
  }

  public hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
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
      this.advancedTexture.removeControl(this.panel);
    }
  }
}
