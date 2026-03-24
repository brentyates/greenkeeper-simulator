import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { createActionButton, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
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

const POPUP_W = 480;
const CONTENT_W = POPUP_W - 36;
const ROW_H = 22;

function dollars(n: number): string {
  return '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function addCell(grid: Grid, row: number, col: number, text: string, opts?: {
  color?: string; bold?: boolean; hAlign?: number; fontSize?: number;
}): void {
  const tb = new TextBlock();
  tb.text = text;
  tb.color = opts?.color ?? '#aaaaaa';
  tb.fontSize = opts?.fontSize ?? 11;
  if (opts?.bold) tb.fontWeight = 'bold';
  tb.textHorizontalAlignment = opts?.hAlign ?? Control.HORIZONTAL_ALIGNMENT_LEFT;
  tb.paddingLeft = '6px';
  tb.paddingRight = '6px';
  grid.addControl(tb, row, col);
}

export class DaySummaryPopup {
  private advancedTexture: AdvancedDynamicTexture;
  callbacks: DaySummaryPopupCallbacks;

  private overlay: Rectangle | null = null;
  private dayText: TextBlock | null = null;
  private profitText: TextBlock | null = null;
  private finGrid: Grid | null = null;
  private statsGrid: Grid | null = null;
  private finContainer: StackPanel | null = null;
  private statsContainer: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: DaySummaryPopupCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPopup();
  }

  private createPopup(): void {
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'summary',
      width: POPUP_W,
      height: 540,
      colors: POPUP_COLORS.green,
      padding: 18,
    });

    this.overlay = overlay;
    this.createHeader(stack);
    this.createFinancialSection(stack);
    this.createStatsSection(stack);
    this.createContinueButton(stack);
  }

  private createHeader(parent: StackPanel): void {
    createPopupHeader(parent, {
      title: '🌅 DAY SUMMARY',
      width: CONTENT_W,
      onClose: () => {
        this.hide();
        this.callbacks.onContinue();
      },
      closeLabel: 'Skip',
    });

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1 Complete';
    this.dayText.color = UI_THEME.colors.legacy.c_ffcc00;
    this.dayText.fontSize = 20;
    this.dayText.fontWeight = 'bold';
    this.dayText.height = '32px';
    this.dayText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    parent.addControl(this.dayText);

    this.profitText = new TextBlock('profitText');
    this.profitText.text = 'Net Profit: +$0';
    this.profitText.color = '#44ff44';
    this.profitText.fontSize = 16;
    this.profitText.height = '26px';
    this.profitText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    parent.addControl(this.profitText);
  }

  private createFinancialSection(parent: StackPanel): void {
    this.finContainer = createPanelSection(parent, {
      name: 'financialContainer',
      width: CONTENT_W,
      height: 10,
      theme: 'green',
      paddingTop: 8,
    });
  }

  private buildFinGrid(revItems: Array<{ label: string; amount: number }>, expItems: Array<{ label: string; amount: number }>, totalRev: number, totalExp: number): void {
    if (!this.finContainer) return;
    if (this.finGrid) this.finContainer.removeControl(this.finGrid);

    const maxRows = Math.max(revItems.length, expItems.length);
    const totalRows = 1 + maxRows + 1;
    const gridH = totalRows * ROW_H + 16;

    this.finContainer.height = `${gridH + 16}px`;

    this.finGrid = new Grid('finGrid');
    this.finGrid.width = `${CONTENT_W - 16}px`;
    this.finGrid.height = `${gridH}px`;
    // 4 columns: rev label | rev amount | exp label | exp amount
    this.finGrid.addColumnDefinition(0.28);
    this.finGrid.addColumnDefinition(0.22);
    this.finGrid.addColumnDefinition(0.28);
    this.finGrid.addColumnDefinition(0.22);

    for (let i = 0; i < totalRows; i++) {
      this.finGrid.addRowDefinition(ROW_H, true);
    }

    // Header row
    addCell(this.finGrid, 0, 0, 'REVENUE', { color: '#66ff66', bold: true });
    addCell(this.finGrid, 0, 2, 'EXPENSES', { color: '#ff6666', bold: true });

    // Line items
    for (let i = 0; i < maxRows; i++) {
      const row = i + 1;
      if (i < revItems.length) {
        addCell(this.finGrid, row, 0, revItems[i].label);
        addCell(this.finGrid, row, 1, dollars(revItems[i].amount), { color: '#66ff66', hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT });
      }
      if (i < expItems.length) {
        addCell(this.finGrid, row, 2, expItems[i].label);
        addCell(this.finGrid, row, 3, dollars(expItems[i].amount), { color: '#ff8888', hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT });
      }
    }

    // Total row
    const totalRow = maxRows + 1;
    addCell(this.finGrid, totalRow, 0, 'TOTAL', { color: '#ffffff', bold: true });
    addCell(this.finGrid, totalRow, 1, dollars(totalRev), { color: '#66ff66', bold: true, hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT });
    addCell(this.finGrid, totalRow, 2, 'TOTAL', { color: '#ffffff', bold: true });
    addCell(this.finGrid, totalRow, 3, dollars(totalExp), { color: '#ff8888', bold: true, hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT });

    this.finContainer.addControl(this.finGrid);
  }

  private createStatsSection(parent: StackPanel): void {
    this.statsContainer = createPanelSection(parent, {
      name: 'statsContainer',
      width: CONTENT_W,
      height: 10,
      theme: 'green',
      paddingTop: 6,
    });
  }

  private buildStatsGrid(rows: Array<{ label: string; value: string; color?: string }>): void {
    if (!this.statsContainer) return;
    if (this.statsGrid) this.statsContainer.removeControl(this.statsGrid);

    const totalRows = 1 + rows.length;
    const gridH = totalRows * ROW_H + 12;
    this.statsContainer.height = `${gridH + 12}px`;

    this.statsGrid = new Grid('statsGrid');
    this.statsGrid.width = `${CONTENT_W - 16}px`;
    this.statsGrid.height = `${gridH}px`;
    this.statsGrid.addColumnDefinition(0.55);
    this.statsGrid.addColumnDefinition(0.45);

    for (let i = 0; i < totalRows; i++) {
      this.statsGrid.addRowDefinition(ROW_H, true);
    }

    addCell(this.statsGrid, 0, 0, 'DAY STATISTICS', { color: '#88bbff', bold: true });

    for (let i = 0; i < rows.length; i++) {
      addCell(this.statsGrid, i + 1, 0, rows[i].label, { fontSize: 12 });
      addCell(this.statsGrid, i + 1, 1, rows[i].value, {
        color: rows[i].color ?? '#ffffff',
        fontSize: 12,
        hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT,
      });
    }

    this.statsContainer.addControl(this.statsGrid);
  }

  private createContinueButton(parent: StackPanel): void {
    const btn = createActionButton({
      id: 'continueBtn',
      label: '▶️  Continue to Next Day',
      tone: 'primary',
      width: CONTENT_W,
      height: 45,
      fontSize: 16,
      cornerRadius: 8,
      thickness: 2,
      onClick: () => {
        this.hide();
        this.callbacks.onContinue();
      },
    });
    btn.paddingTop = '10px';
    parent.addControl(btn);
  }

  public show(data: DaySummaryData): void {
    if (!this.overlay || !this.dayText || !this.profitText || !this.finContainer || !this.statsContainer) return;

    this.dayText.text = `Day ${data.day} Complete`;

    const totalRevenue = data.revenue.greenFees + data.revenue.tips + data.revenue.addOns + data.revenue.other;
    const totalExpenses = data.expenses.wages + data.expenses.supplies + data.expenses.research + data.expenses.utilities + data.expenses.other;
    const netProfit = totalRevenue - totalExpenses;

    this.profitText.text = netProfit >= 0
      ? `Net Profit: +$${netProfit.toFixed(2)}`
      : `Net Loss: -$${Math.abs(netProfit).toFixed(2)}`;
    this.profitText.color = netProfit >= 0 ? '#44ff44' : '#ff4444';

    const revItems: Array<{ label: string; amount: number }> = [];
    if (data.revenue.greenFees > 0) revItems.push({ label: 'Green Fees', amount: data.revenue.greenFees });
    if (data.revenue.tips > 0) revItems.push({ label: 'Tips', amount: data.revenue.tips });
    if (data.revenue.addOns > 0) revItems.push({ label: 'Add-ons', amount: data.revenue.addOns });
    if (data.revenue.other > 0) revItems.push({ label: 'Other', amount: data.revenue.other });

    const expItems: Array<{ label: string; amount: number }> = [];
    if (data.expenses.wages > 0) expItems.push({ label: 'Wages', amount: data.expenses.wages });
    if (data.expenses.supplies > 0) expItems.push({ label: 'Supplies', amount: data.expenses.supplies });
    if (data.expenses.research > 0) expItems.push({ label: 'Research', amount: data.expenses.research });
    if (data.expenses.utilities > 0) expItems.push({ label: 'Utilities', amount: data.expenses.utilities });
    if (data.expenses.other > 0) expItems.push({ label: 'Other', amount: data.expenses.other });

    this.buildFinGrid(revItems, expItems, totalRevenue, totalExpenses);

    const hc = data.courseHealth.change;
    const pc = data.prestige.change;
    const statRows = [
      { label: '🏌️  Golfers Served', value: `${data.golfers.totalServed}` },
      { label: '😊  Avg Satisfaction', value: `${data.golfers.averageSatisfaction.toFixed(0)}%`,
        color: data.golfers.averageSatisfaction >= 70 ? '#44ff44' : data.golfers.averageSatisfaction >= 50 ? '#ffaa44' : '#ff4444' },
      { label: '🌿  Course Health', value: `${data.courseHealth.end.toFixed(0)}% (${hc >= 0 ? '+' : ''}${hc.toFixed(1)})`,
        color: hc >= 0 ? '#44ff44' : '#ff4444' },
      { label: '⭐  Prestige', value: `${data.prestige.score.toFixed(0)} (${pc >= 0 ? '+' : ''}${pc.toFixed(0)})`,
        color: pc >= 0 ? '#ffcc00' : '#ff8844' },
    ];
    if (data.maintenance && data.maintenance.tasksCompleted > 0) {
      statRows.push({ label: '🔧  Crew Work', value: `${data.maintenance.tasksCompleted} tasks`, color: '#88ccff' });
    }
    this.buildStatsGrid(statRows);

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
