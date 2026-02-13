import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { createActionButton, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogSectionLabel } from './DialogBlueprint';
import { UI_THEME } from './UITheme';

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
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'summary',
      width: 450,
      height: 550,
      colors: POPUP_COLORS.green,
      padding: 15,
    });

    this.overlay = overlay;

    this.createHeader(stack);
    this.createFinancialSummary(stack);
    this.createStatsSection(stack);
    this.createContinueButton(stack);
  }

  private createHeader(parent: StackPanel): void {
    createPopupHeader(parent, {
      title: '🌅 DAY SUMMARY',
      width: 420,
      onClose: () => {
        this.hide();
        this.callbacks.onContinue();
      },
      closeLabel: 'Skip',
    });

    const header = new Rectangle('summaryHeaderDetails');
    header.height = '55px';
    header.width = '420px';
    header.thickness = 0;
    header.background = 'transparent';
    parent.addControl(header);

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1 Complete';
    this.dayText.color = UI_THEME.colors.legacy.c_ffcc00;
    this.dayText.fontSize = UI_THEME.typography.scale.s20;
    this.dayText.fontWeight = 'bold';
    this.dayText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.dayText.top = '8px';
    header.addControl(this.dayText);

    this.profitText = new TextBlock('profitText');
    this.profitText.text = 'Net: +$0';
    this.profitText.color = UI_THEME.colors.legacy.c_44ff44;
    this.profitText.fontSize = UI_THEME.typography.scale.s18;
    this.profitText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.profitText.top = '-5px';
    header.addControl(this.profitText);
  }

  private createFinancialSummary(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'financialContainer',
      width: 420,
      height: 210,
      theme: 'green',
      paddingTop: 8,
    });

    const grid = new Grid('financialGrid');
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    container.addControl(grid);

    const revenueSection = new StackPanel('revenueSection');
    revenueSection.paddingLeft = '15px';
    revenueSection.paddingTop = '10px';
    grid.addControl(revenueSection, 0, 0);

    addDialogSectionLabel(revenueSection, {
      id: 'revenueLabel',
      text: '💰 REVENUE',
      tone: 'success',
      fontSize: 12,
      height: 20,
    });

    this.revenueStack = new StackPanel('revenueStack');
    this.revenueStack.paddingTop = '5px';
    revenueSection.addControl(this.revenueStack);

    const expenseSection = new StackPanel('expenseSection');
    expenseSection.paddingTop = '10px';
    grid.addControl(expenseSection, 0, 1);

    const expenseLabel = addDialogSectionLabel(expenseSection, {
      id: 'expenseLabel',
      text: '💸 EXPENSES',
      tone: 'default',
      fontSize: 12,
      height: 20,
    });
    expenseLabel.color = UI_THEME.colors.legacy.c_ff6666;

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
    labelText.color = UI_THEME.colors.legacy.c_aaaaaa;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.width = '100px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const amountText = new TextBlock('amount');
    amountText.text = `$${Math.abs(amount).toLocaleString()}`;
    amountText.color = isPositive ? '#66ff66' : '#ff8888';
    amountText.fontSize = UI_THEME.typography.scale.s11;
    amountText.width = '80px';
    amountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(amountText);

    return row;
  }

  private createStatsSection(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'statsContainer',
      width: 420,
      height: 175,
      theme: 'green',
      paddingTop: 6,
    });

    const title = addDialogSectionLabel(container, {
      id: 'statsLabel',
      text: '📊 DAY STATISTICS',
      tone: 'info',
      fontSize: 12,
      height: 25,
    });
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.top = '10px';

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
    iconText.fontSize = UI_THEME.typography.scale.s14;
    iconText.width = '25px';
    row.addControl(iconText);

    const labelText = new TextBlock('label');
    labelText.text = label;
    labelText.color = UI_THEME.colors.legacy.c_aaaaaa;
    labelText.fontSize = UI_THEME.typography.scale.s12;
    labelText.width = '200px';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row.addControl(labelText);

    const valueText = new TextBlock('value');
    valueText.text = value;
    valueText.color = valueColor;
    valueText.fontSize = UI_THEME.typography.scale.s12;
    valueText.width = '180px';
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    row.addControl(valueText);

    return row;
  }

  private createContinueButton(parent: StackPanel): void {
    const btn = createActionButton({
      id: 'continueBtn',
      label: '▶️  Continue to Next Day',
      tone: 'primary',
      width: 420,
      height: 45,
      fontSize: 16,
      cornerRadius: 8,
      thickness: 2,
      onClick: () => {
        this.hide();
        this.callbacks.onContinue();
      },
    });
    btn.paddingTop = '12px';
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
    totalLabel.color = UI_THEME.colors.legacy.c_ffffff;
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
    expenseTotalLabel.color = UI_THEME.colors.legacy.c_ffffff;
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
