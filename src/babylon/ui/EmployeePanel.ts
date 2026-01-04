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
  HiringPool,
  SkillLevel,
} from '../../core/employees';

export interface EmployeePanelCallbacks {
  onHire: (employee: Employee) => void;
  onFire: (employeeId: string) => void;
  onClose: () => void;
  onRefreshPool: () => void;
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
  private hiringPoolContainer: StackPanel | null = null;
  private payrollText: TextBlock | null = null;
  private employeeCountText: TextBlock | null = null;
  private hiringView: Rectangle | null = null;
  private mainView: Rectangle | null = null;

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
    this.createHiringView();
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

    const hireBtn = Button.CreateSimpleButton('hireBtn', '➕ Hire');
    hireBtn.width = '150px';
    hireBtn.height = '35px';
    hireBtn.cornerRadius = 6;
    hireBtn.background = '#2a7a4a';
    hireBtn.color = '#88ff88';
    hireBtn.thickness = 2;
    hireBtn.fontSize = 14;
    hireBtn.onPointerClickObservable.add(() => this.showHiringView());
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

  private createHiringView(): void {
    this.hiringView = new Rectangle('hiringView');
    this.hiringView.width = '100%';
    this.hiringView.height = '100%';
    this.hiringView.thickness = 0;
    this.hiringView.background = 'transparent';
    this.hiringView.isVisible = false;
    this.panel!.addControl(this.hiringView);

    const stack = new StackPanel('hiringStack');
    stack.paddingTop = '12px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    stack.paddingBottom = '12px';
    this.hiringView.addControl(stack);

    const headerContainer = new Rectangle('hiringHeaderContainer');
    headerContainer.height = '36px';
    headerContainer.width = '336px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    stack.addControl(headerContainer);

    const title = new TextBlock('hiringTitle');
    title.text = '📋 HIRING POOL';
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
    backBtn.onPointerClickObservable.add(() => this.hideHiringView());
    backBtn.onPointerEnterObservable.add(() => { backBtn.background = '#5a7a6a'; });
    backBtn.onPointerOutObservable.add(() => { backBtn.background = '#4a6a5a'; });
    headerContainer.addControl(backBtn);

    const poolContainer = new Rectangle('poolContainer');
    poolContainer.height = '350px';
    poolContainer.width = '336px';
    poolContainer.cornerRadius = 4;
    poolContainer.background = 'rgba(15, 35, 25, 0.8)';
    poolContainer.thickness = 1;
    poolContainer.color = '#3a5a4a';
    poolContainer.paddingTop = '8px';
    stack.addControl(poolContainer);

    const scrollViewer = new ScrollViewer('poolScroll');
    scrollViewer.width = '320px';
    scrollViewer.height = '340px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a8a5a';
    scrollViewer.barBackground = 'rgba(0,0,0,0.3)';
    poolContainer.addControl(scrollViewer);

    this.hiringPoolContainer = new StackPanel('hiringPoolStack');
    this.hiringPoolContainer.width = '100%';
    scrollViewer.addControl(this.hiringPoolContainer);

    const refreshBtn = Button.CreateSimpleButton('refreshBtn', '🔄 Refresh Pool');
    refreshBtn.width = '336px';
    refreshBtn.height = '35px';
    refreshBtn.cornerRadius = 6;
    refreshBtn.background = '#3a6a8a';
    refreshBtn.color = '#88ccff';
    refreshBtn.thickness = 2;
    refreshBtn.fontSize = 14;
    refreshBtn.paddingTop = '8px';
    refreshBtn.onPointerClickObservable.add(() => this.callbacks.onRefreshPool());
    refreshBtn.onPointerEnterObservable.add(() => { refreshBtn.background = '#4a7a9a'; });
    refreshBtn.onPointerOutObservable.add(() => { refreshBtn.background = '#3a6a8a'; });
    stack.addControl(refreshBtn);
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
      this.hideHiringView();
    });
    hireBtn.onPointerEnterObservable.add(() => { hireBtn.background = '#3a9a5a'; });
    hireBtn.onPointerOutObservable.add(() => { hireBtn.background = '#2a7a4a'; });
    grid.addControl(hireBtn, 0, 3);

    return row;
  }

  private showHiringView(): void {
    this.mainView!.isVisible = false;
    this.hiringView!.isVisible = true;
    this.callbacks.onRefreshPool();
  }

  private hideHiringView(): void {
    this.mainView!.isVisible = true;
    this.hiringView!.isVisible = false;
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

  public updateHiringPool(pool: HiringPool): void {
    if (!this.hiringPoolContainer) return;

    const children = [...this.hiringPoolContainer.children];
    for (const child of children) {
      this.hiringPoolContainer.removeControl(child);
    }

    for (const candidate of pool.candidates) {
      const row = this.createCandidateRow(candidate);
      this.hiringPoolContainer.addControl(row);
    }

    if (pool.candidates.length === 0) {
      const emptyText = new TextBlock('emptyPoolText');
      emptyText.text = 'No candidates available.\nClick "Refresh Pool" to find new candidates.';
      emptyText.color = '#888888';
      emptyText.fontSize = 12;
      emptyText.height = '60px';
      emptyText.textWrapping = true;
      this.hiringPoolContainer.addControl(emptyText);
    }
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
      this.mainView!.isVisible = true;
      this.hiringView!.isVisible = false;
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
