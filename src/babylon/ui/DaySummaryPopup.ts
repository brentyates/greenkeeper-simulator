import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';

export interface DaySummaryData {
  day: number;
  revenue: {
    greenFees: number;
    tips: number;
    addOns: number;
    other: number;
  };
  expenses: {
    wages: number;
    supplies: number;
    research: number;
    utilities: number;
    other: number;
  };
  courseHealth: {
    start: number;
    end: number;
    change: number;
  };
  golfers: {
    totalServed: number;
    averageSatisfaction: number;
    tipsEarned: number;
  };
  prestige: {
    score: number;
    change: number;
  };
  maintenance?: {
    tasksCompleted: number;
    tilesMowed: number;
    tilesWatered: number;
    tilesFertilized: number;
  };
}

export interface DaySummaryPopupCallbacks {
  onContinue: () => void;
}

export class DaySummaryPopup {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: DaySummaryPopupCallbacks;

  private overlay: Rectangle | null = null;
  private panel: Rectangle | null = null;
  private dayText: TextBlock | null = null;
  private profitText: TextBlock | null = null;
  private revenueStack: StackPanel | null = null;
  private expenseStack: StackPanel | null = null;
  private statsStack: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: DaySummaryPopupCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPopup();
  }

  private createPopup(): void {
    this.overlay = new Rectangle('summaryOverlay');
    this.overlay.width = '100%';
    this.overlay.height = '100%';
    this.overlay.background = 'rgba(0, 0, 0, 0.7)';
    this.overlay.thickness = 0;
    this.overlay.isVisible = false;
    this.advancedTexture.addControl(this.overlay);

    this.panel = new Rectangle('summaryPanel');
    this.panel.width = '450px';
    this.panel.height = '550px';
    this.panel.cornerRadius = 10;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 3;
    this.panel.background = 'rgba(20, 45, 35, 0.98)';
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 15;
    this.panel.shadowOffsetX = 5;
    this.panel.shadowOffsetY = 5;
    this.overlay.addControl(this.panel);

    const stack = new StackPanel('summaryStack');
    stack.paddingTop = '15px';
    stack.paddingLeft = '15px';
    stack.paddingRight = '15px';
    stack.paddingBottom = '15px';
    this.panel.addControl(stack);

    this.createHeader(stack);
    this.createFinancialSummary(stack);
    this.createStatsSection(stack);
    this.createContinueButton(stack);
  }

  private createHeader(parent: StackPanel): void {
    const header = new Rectangle('header');
    header.height = '55px';
    header.width = '420px';
    header.thickness = 0;
    header.background = 'transparent';
    parent.addControl(header);

    const sunIcon = new TextBlock('sunIcon');
    sunIcon.text = '🌅';
    sunIcon.fontSize = 28;
    sunIcon.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    sunIcon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    sunIcon.left = '5px';
    header.addControl(sunIcon);

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1 Complete';
    this.dayText.color = '#ffcc00';
    this.dayText.fontSize = 22;
    this.dayText.fontWeight = 'bold';
    this.dayText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.dayText.top = '5px';
    header.addControl(this.dayText);

    this.profitText = new TextBlock('profitText');
    this.profitText.text = 'Net: +$0';
    this.profitText.color = '#44ff44';
    this.profitText.fontSize = 18;
    this.profitText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.profitText.top = '-5px';
    header.addControl(this.profitText);
  }

  private createFinancialSummary(parent: StackPanel): void {
    const container = new Rectangle('financialContainer');
    container.height = '210px';
    container.width = '420px';
    container.cornerRadius = 6;
    container.background = 'rgba(30, 60, 45, 0.7)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    container.paddingTop = '8px';
    parent.addControl(container);

    const grid = new Grid('financialGrid');
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    container.addControl(grid);

    const revenueSection = new StackPanel('revenueSection');
    revenueSection.paddingLeft = '15px';
    revenueSection.paddingTop = '10px';
    grid.addControl(revenueSection, 0, 0);

    const revenueTitle = new TextBlock('revenueTitle');
    revenueTitle.text = '💰 REVENUE';
    revenueTitle.color = '#44ff44';
    revenueTitle.fontSize = 12;
    revenueTitle.height = '20px';
    revenueTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    revenueSection.addControl(revenueTitle);

    this.revenueStack = new StackPanel('revenueStack');
    this.revenueStack.paddingTop = '5px';
    revenueSection.addControl(this.revenueStack);

    const expenseSection = new StackPanel('expenseSection');
    expenseSection.paddingTop = '10px';
    grid.addControl(expenseSection, 0, 1);

    const expenseTitle = new TextBlock('expenseTitle');
    expenseTitle.text = '💸 EXPENSES';
    expenseTitle.color = '#ff6666';
    expenseTitle.fontSize = 12;
    expenseTitle.height = '20px';
    expenseTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    expenseSection.addControl(expenseTitle);

    this.expenseStack = new StackPanel('expenseStack');
    this.expenseStack.paddingTop = '5px';
    expenseSection.addControl(this.expenseStack);
  }

  private createLineItem(label: string, amount: number, isPositive: boolean): StackPanel {
    const row = new StackPanel('row');
    row.isVertical = false;
    row.height = '22px';
    row.width = '180px';

    const labelText = new TextBlock('label');
    labelText.text = label;
    labelText.color = '#aaaaaa';
    labelText.fontSize = 11;
    labelText.width = '100px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const amountText = new TextBlock('amount');
    amountText.text = `$${Math.abs(amount).toLocaleString()}`;
    amountText.color = isPositive ? '#66ff66' : '#ff8888';
    amountText.fontSize = 11;
    amountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(amountText);

    return row;
  }

  private createStatsSection(parent: StackPanel): void {
    const container = new Rectangle('statsContainer');
    container.height = '175px';
    container.width = '420px';
    container.cornerRadius = 6;
    container.background = 'rgba(30, 60, 45, 0.7)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    container.paddingTop = '6px';
    parent.addControl(container);

    const title = new TextBlock('statsTitle');
    title.text = '📊 DAY STATISTICS';
    title.color = '#88ccff';
    title.fontSize = 12;
    title.height = '25px';
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.top = '10px';
    container.addControl(title);

    this.statsStack = new StackPanel('statsStack');
    this.statsStack.paddingTop = '35px';
    this.statsStack.paddingLeft = '15px';
    container.addControl(this.statsStack);
  }

  private createStatLine(icon: string, label: string, value: string, valueColor: string = '#ffffff'): StackPanel {
    const row = new StackPanel('statRow');
    row.isVertical = false;
    row.height = '24px';
    row.width = '390px';

    const iconText = new TextBlock('icon');
    iconText.text = icon;
    iconText.fontSize = 14;
    iconText.width = '25px';
    row.addControl(iconText);

    const labelText = new TextBlock('label');
    labelText.text = label;
    labelText.color = '#aaaaaa';
    labelText.fontSize = 12;
    labelText.width = '200px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const valueText = new TextBlock('value');
    valueText.text = value;
    valueText.color = valueColor;
    valueText.fontSize = 12;
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(valueText);

    return row;
  }

  private createContinueButton(parent: StackPanel): void {
    const btn = Button.CreateSimpleButton('continueBtn', '▶️  Continue to Next Day');
    btn.width = '420px';
    btn.height = '45px';
    btn.cornerRadius = 8;
    btn.background = '#2a7a4a';
    btn.color = '#88ff88';
    btn.thickness = 2;
    btn.fontSize = 16;
    btn.paddingTop = '12px';
    btn.onPointerClickObservable.add(() => {
      this.hide();
      this.callbacks.onContinue();
    });
    btn.onPointerEnterObservable.add(() => { btn.background = '#3a9a5a'; });
    btn.onPointerOutObservable.add(() => { btn.background = '#2a7a4a'; });
    parent.addControl(btn);
  }

  public show(data: DaySummaryData): void {
    if (!this.overlay || !this.dayText || !this.profitText || !this.revenueStack || !this.expenseStack || !this.statsStack) return;

    this.dayText.text = `Day ${data.day} Complete`;

    const totalRevenue = data.revenue.greenFees + data.revenue.tips + data.revenue.addOns + data.revenue.other;
    const totalExpenses = data.expenses.wages + data.expenses.supplies + data.expenses.research + data.expenses.utilities + data.expenses.other;
    const netProfit = totalRevenue - totalExpenses;

    this.profitText.text = netProfit >= 0
      ? `Net Profit: +$${netProfit.toLocaleString()}`
      : `Net Loss: -$${Math.abs(netProfit).toLocaleString()}`;
    this.profitText.color = netProfit >= 0 ? '#44ff44' : '#ff4444';

    const revenueChildren = [...this.revenueStack.children];
    for (const child of revenueChildren) {
      this.revenueStack.removeControl(child);
    }

    if (data.revenue.greenFees > 0) {
      this.revenueStack.addControl(this.createLineItem('Green Fees', data.revenue.greenFees, true));
    }
    if (data.revenue.tips > 0) {
      this.revenueStack.addControl(this.createLineItem('Tips', data.revenue.tips, true));
    }
    if (data.revenue.addOns > 0) {
      this.revenueStack.addControl(this.createLineItem('Add-ons', data.revenue.addOns, true));
    }
    if (data.revenue.other > 0) {
      this.revenueStack.addControl(this.createLineItem('Other', data.revenue.other, true));
    }

    const totalRow = this.createLineItem('TOTAL', totalRevenue, true);
    const totalLabel = totalRow.children[0] as TextBlock;
    totalLabel.color = '#ffffff';
    totalLabel.fontWeight = 'bold';
    this.revenueStack.addControl(totalRow);

    const expenseChildren = [...this.expenseStack.children];
    for (const child of expenseChildren) {
      this.expenseStack.removeControl(child);
    }

    if (data.expenses.wages > 0) {
      this.expenseStack.addControl(this.createLineItem('Wages', data.expenses.wages, false));
    }
    if (data.expenses.supplies > 0) {
      this.expenseStack.addControl(this.createLineItem('Supplies', data.expenses.supplies, false));
    }
    if (data.expenses.research > 0) {
      this.expenseStack.addControl(this.createLineItem('Research', data.expenses.research, false));
    }
    if (data.expenses.utilities > 0) {
      this.expenseStack.addControl(this.createLineItem('Utilities', data.expenses.utilities, false));
    }
    if (data.expenses.other > 0) {
      this.expenseStack.addControl(this.createLineItem('Other', data.expenses.other, false));
    }

    const expenseTotal = this.createLineItem('TOTAL', totalExpenses, false);
    const expenseTotalLabel = expenseTotal.children[0] as TextBlock;
    expenseTotalLabel.color = '#ffffff';
    expenseTotalLabel.fontWeight = 'bold';
    this.expenseStack.addControl(expenseTotal);

    const statsChildren = [...this.statsStack.children];
    for (const child of statsChildren) {
      this.statsStack.removeControl(child);
    }

    this.statsStack.addControl(
      this.createStatLine('🏌️', 'Golfers Served', `${data.golfers.totalServed}`)
    );
    this.statsStack.addControl(
      this.createStatLine('😊', 'Avg Satisfaction', `${data.golfers.averageSatisfaction.toFixed(0)}%`,
        data.golfers.averageSatisfaction >= 70 ? '#44ff44' : data.golfers.averageSatisfaction >= 50 ? '#ffaa44' : '#ff4444')
    );

    const healthChange = data.courseHealth.change;
    this.statsStack.addControl(
      this.createStatLine('🌿', 'Course Health', `${data.courseHealth.end.toFixed(0)}% (${healthChange >= 0 ? '+' : ''}${healthChange.toFixed(1)}%)`,
        healthChange >= 0 ? '#44ff44' : '#ff4444')
    );

    const prestigeChange = data.prestige.change;
    this.statsStack.addControl(
      this.createStatLine('⭐', 'Prestige Score', `${data.prestige.score.toFixed(0)} (${prestigeChange >= 0 ? '+' : ''}${prestigeChange.toFixed(0)})`,
        prestigeChange >= 0 ? '#ffcc00' : '#ff8844')
    );

    if (data.maintenance && data.maintenance.tasksCompleted > 0) {
      this.statsStack.addControl(
        this.createStatLine('🔧', 'Crew Work', `${data.maintenance.tasksCompleted} tasks completed`, '#88ccff')
      );
    }

    this.overlay.isVisible = true;
  }

  public hide(): void {
    if (this.overlay) {
      this.overlay.isVisible = false;
    }
  }

  public isVisible(): boolean {
    return this.overlay?.isVisible ?? false;
  }

  public dispose(): void {
    if (this.overlay) {
      this.advancedTexture.removeControl(this.overlay);
    }
  }
}
