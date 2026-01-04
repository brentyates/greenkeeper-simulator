import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { createOverlayPopup, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import {
  TeeTimeSystemState,
  TeeTime,
  TeeTimeSpacing,
  SPACING_CONFIGS,
  getTeeTimes,
  formatTeeTime,
  getDailyStats,
  getSpacingLabel,
} from '../../core/tee-times';

export interface TeeSheetPanelCallbacks {
  onCheckIn: (teeTimeId: string) => void;
  onCancel: (teeTimeId: string) => void;
  onMarkNoShow: (teeTimeId: string) => void;
  onChangeDay: (delta: number) => void;
  onSpacingChange: (spacing: TeeTimeSpacing) => void;
  onClose: () => void;
}

export class TeeSheetPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: TeeSheetPanelCallbacks;

  private overlay: Rectangle | null = null;
  private dayText: TextBlock | null = null;
  private statsText: TextBlock | null = null;
  private spacingImpactText: TextBlock | null = null;
  private teeTimeList: StackPanel | null = null;
  private currentSpacing: TeeTimeSpacing = 'standard';

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: TeeSheetPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'teeSheet',
      width: 500,
      height: 700,
      colors: POPUP_COLORS.green,
      padding: 15,
    });

    this.overlay = overlay;

    createPopupHeader(stack, {
      title: '📋 TEE SHEET',
      titleColor: '#88ccff',
      width: 470,
      onClose: () => this.callbacks.onClose(),
    });
    this.createDayNavigation(stack);
    this.createStatsSection(stack);
    this.createSpacingSection(stack);
    this.createTeeTimeList(stack);
    this.createFooter(stack);
  }

  private createDayNavigation(parent: StackPanel): void {
    const navContainer = new Rectangle('navContainer');
    navContainer.height = '40px';
    navContainer.width = '470px';
    navContainer.thickness = 0;
    parent.addControl(navContainer);

    const prevBtn = Button.CreateSimpleButton('prevBtn', '◀');
    prevBtn.width = '40px';
    prevBtn.height = '35px';
    prevBtn.cornerRadius = 5;
    prevBtn.background = '#2a5a3a';
    prevBtn.color = '#88ff88';
    prevBtn.thickness = 1;
    prevBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    prevBtn.onPointerClickObservable.add(() => this.callbacks.onChangeDay(-1));
    navContainer.addControl(prevBtn);

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1';
    this.dayText.color = '#ffcc00';
    this.dayText.fontSize = 18;
    this.dayText.fontWeight = 'bold';
    navContainer.addControl(this.dayText);

    const nextBtn = Button.CreateSimpleButton('nextBtn', '▶');
    nextBtn.width = '40px';
    nextBtn.height = '35px';
    nextBtn.cornerRadius = 5;
    nextBtn.background = '#2a5a3a';
    nextBtn.color = '#88ff88';
    nextBtn.thickness = 1;
    nextBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    nextBtn.onPointerClickObservable.add(() => this.callbacks.onChangeDay(1));
    navContainer.addControl(nextBtn);
  }

  private createStatsSection(parent: StackPanel): void {
    const statsContainer = new Rectangle('statsContainer');
    statsContainer.height = '60px';
    statsContainer.width = '470px';
    statsContainer.cornerRadius = 6;
    statsContainer.background = 'rgba(30, 60, 45, 0.7)';
    statsContainer.thickness = 1;
    statsContainer.color = '#3a5a4a';
    statsContainer.paddingTop = '5px';
    parent.addControl(statsContainer);

    this.statsText = new TextBlock('statsText');
    this.statsText.text = 'Loading...';
    this.statsText.color = '#aaaaaa';
    this.statsText.fontSize = 12;
    this.statsText.textWrapping = true;
    statsContainer.addControl(this.statsText);
  }

  private createSpacingSection(parent: StackPanel): void {
    const spacingContainer = new Rectangle('spacingContainer');
    spacingContainer.height = '85px';
    spacingContainer.width = '470px';
    spacingContainer.cornerRadius = 6;
    spacingContainer.background = 'rgba(40, 70, 55, 0.7)';
    spacingContainer.thickness = 1;
    spacingContainer.color = '#4a7a5a';
    spacingContainer.paddingTop = '5px';
    parent.addControl(spacingContainer);

    const spacingStack = new StackPanel('spacingStack');
    spacingStack.isVertical = true;
    spacingStack.paddingTop = '5px';
    spacingContainer.addControl(spacingStack);

    const titleRow = new StackPanel('titleRow');
    titleRow.isVertical = false;
    titleRow.height = '25px';
    spacingStack.addControl(titleRow);

    const spacingLabel = new TextBlock('spacingLabel');
    spacingLabel.text = '⏱ Tee Time Spacing: ';
    spacingLabel.color = '#88ccff';
    spacingLabel.fontSize = 13;
    spacingLabel.fontWeight = 'bold';
    spacingLabel.width = '150px';
    spacingLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(spacingLabel);

    const buttonRow = new StackPanel('buttonRow');
    buttonRow.isVertical = false;
    buttonRow.height = '30px';
    buttonRow.paddingTop = '3px';
    spacingStack.addControl(buttonRow);

    const spacingOptions: TeeTimeSpacing[] = ['packed', 'tight', 'standard', 'comfortable', 'relaxed', 'exclusive'];
    for (const spacing of spacingOptions) {
      const btn = Button.CreateSimpleButton(`spacing_${spacing}`, getSpacingLabel(spacing));
      btn.width = '72px';
      btn.height = '26px';
      btn.cornerRadius = 4;
      btn.fontSize = 10;
      btn.thickness = 1;
      btn.paddingLeft = '2px';
      btn.paddingRight = '2px';
      btn.background = spacing === this.currentSpacing ? '#4a8a5a' : '#2a4a3a';
      btn.color = spacing === this.currentSpacing ? '#ffffff' : '#aaaaaa';
      btn.onPointerClickObservable.add(() => {
        this.currentSpacing = spacing;
        this.callbacks.onSpacingChange(spacing);
        this.updateSpacingButtons(buttonRow);
        this.updateSpacingImpact();
      });
      buttonRow.addControl(btn);
    }

    this.spacingImpactText = new TextBlock('spacingImpact');
    this.spacingImpactText.text = '';
    this.spacingImpactText.color = '#aaaaaa';
    this.spacingImpactText.fontSize = 10;
    this.spacingImpactText.textWrapping = true;
    this.spacingImpactText.height = '22px';
    this.spacingImpactText.paddingTop = '3px';
    spacingStack.addControl(this.spacingImpactText);
    this.updateSpacingImpact();
  }

  private updateSpacingButtons(buttonRow: StackPanel): void {
    const spacingOptions: TeeTimeSpacing[] = ['packed', 'tight', 'standard', 'comfortable', 'relaxed', 'exclusive'];
    buttonRow.children.forEach((child, index) => {
      if (child instanceof Button && index < spacingOptions.length) {
        const spacing = spacingOptions[index];
        child.background = spacing === this.currentSpacing ? '#4a8a5a' : '#2a4a3a';
        child.color = spacing === this.currentSpacing ? '#ffffff' : '#aaaaaa';
      }
    });
  }

  private updateSpacingImpact(): void {
    if (!this.spacingImpactText) return;
    const config = SPACING_CONFIGS[this.currentSpacing];
    const revenueEffect = config.revenueMultiplier >= 1
      ? `+${((config.revenueMultiplier - 1) * 100).toFixed(0)}%`
      : `-${((1 - config.revenueMultiplier) * 100).toFixed(0)}%`;
    const repEffect = config.reputationModifier >= 0
      ? `+${(config.reputationModifier * 100).toFixed(0)}%`
      : `${(config.reputationModifier * 100).toFixed(0)}%`;
    const paceEffect = config.paceOfPlayPenalty > 0
      ? `+${(config.paceOfPlayPenalty * 100).toFixed(0)}%`
      : config.paceOfPlayPenalty < 0
        ? `${(config.paceOfPlayPenalty * 100).toFixed(0)}%`
        : '0%';
    this.spacingImpactText.text = `Max: ${config.maxDailyTeeTimes} slots | Revenue: ${revenueEffect} | Reputation: ${repEffect} | Pace penalty: ${paceEffect}`;
  }

  private createTeeTimeList(parent: StackPanel): void {
    const listContainer = new Rectangle('listContainer');
    listContainer.height = '290px';
    listContainer.width = '470px';
    listContainer.cornerRadius = 6;
    listContainer.background = 'rgba(20, 40, 30, 0.5)';
    listContainer.thickness = 1;
    listContainer.color = '#3a5a4a';
    listContainer.paddingTop = '8px';
    parent.addControl(listContainer);

    const scrollViewer = new ScrollViewer('teeTimeScroll');
    scrollViewer.width = '460px';
    scrollViewer.height = '280px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 10;
    scrollViewer.barColor = '#4a8a5a';
    listContainer.addControl(scrollViewer);

    this.teeTimeList = new StackPanel('teeTimeList');
    this.teeTimeList.width = '440px';
    scrollViewer.addControl(this.teeTimeList);
  }

  private createFooter(parent: StackPanel): void {
    const footer = new TextBlock('footer');
    footer.text = 'Click time slots to manage bookings';
    footer.color = '#666666';
    footer.fontSize = 11;
    footer.height = '30px';
    footer.paddingTop = '8px';
    parent.addControl(footer);
  }

  private createTeeTimeRow(teeTime: TeeTime): Rectangle {
    const row = new Rectangle(`row_${teeTime.id}`);
    row.height = '50px';
    row.width = '430px';
    row.cornerRadius = 4;
    row.thickness = 1;
    row.paddingTop = '3px';
    row.paddingBottom = '3px';

    const statusColors: Record<string, { bg: string; border: string }> = {
      available: { bg: 'rgba(40, 80, 50, 0.5)', border: '#4a8a5a' },
      reserved: { bg: 'rgba(60, 80, 40, 0.6)', border: '#88aa44' },
      checked_in: { bg: 'rgba(40, 80, 100, 0.6)', border: '#44aacc' },
      in_progress: { bg: 'rgba(80, 80, 40, 0.6)', border: '#aaaa44' },
      completed: { bg: 'rgba(60, 100, 60, 0.6)', border: '#66cc66' },
      no_show: { bg: 'rgba(100, 50, 50, 0.6)', border: '#cc6666' },
      cancelled: { bg: 'rgba(60, 60, 60, 0.4)', border: '#666666' },
    };

    const colors = statusColors[teeTime.status] || statusColors.available;
    row.background = colors.bg;
    row.color = colors.border;

    const grid = new Grid('rowGrid');
    grid.addColumnDefinition(70, true);
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.3);
    grid.addColumnDefinition(90, true);
    row.addControl(grid);

    const timeText = new TextBlock('time');
    timeText.text = formatTeeTime(teeTime.scheduledTime);
    timeText.color = '#ffffff';
    timeText.fontSize = 14;
    timeText.fontWeight = 'bold';
    timeText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    grid.addControl(timeText, 0, 0);

    const infoStack = new StackPanel('info');
    infoStack.isVertical = true;
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.paddingLeft = '5px';
    grid.addControl(infoStack, 0, 1);

    const statusText = new TextBlock('status');
    statusText.text = this.getStatusLabel(teeTime.status);
    statusText.color = '#cccccc';
    statusText.fontSize = 11;
    statusText.height = '18px';
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(statusText);

    const groupText = new TextBlock('group');
    groupText.text = teeTime.groupSize > 0 ? `${teeTime.groupSize} golfer${teeTime.groupSize > 1 ? 's' : ''}` : 'Open';
    groupText.color = '#888888';
    groupText.fontSize = 10;
    groupText.height = '16px';
    groupText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(groupText);

    const revenueText = new TextBlock('revenue');
    revenueText.text = teeTime.totalRevenue > 0 ? `$${teeTime.totalRevenue.toFixed(0)}` : '-';
    revenueText.color = teeTime.totalRevenue > 0 ? '#88ff88' : '#666666';
    revenueText.fontSize = 12;
    grid.addControl(revenueText, 0, 2);

    const actionStack = new StackPanel('actions');
    actionStack.isVertical = false;
    grid.addControl(actionStack, 0, 3);

    if (teeTime.status === 'reserved' && !teeTime.checkedIn) {
      const checkInBtn = Button.CreateSimpleButton('checkIn', '✓');
      checkInBtn.width = '30px';
      checkInBtn.height = '25px';
      checkInBtn.cornerRadius = 3;
      checkInBtn.background = '#2a6a4a';
      checkInBtn.color = '#88ff88';
      checkInBtn.thickness = 1;
      checkInBtn.fontSize = 12;
      checkInBtn.onPointerClickObservable.add(() => this.callbacks.onCheckIn(teeTime.id));
      actionStack.addControl(checkInBtn);

      const cancelBtn = Button.CreateSimpleButton('cancel', '✕');
      cancelBtn.width = '30px';
      cancelBtn.height = '25px';
      cancelBtn.cornerRadius = 3;
      cancelBtn.background = '#6a3a3a';
      cancelBtn.color = '#ff8888';
      cancelBtn.thickness = 1;
      cancelBtn.fontSize = 12;
      cancelBtn.paddingLeft = '3px';
      cancelBtn.onPointerClickObservable.add(() => this.callbacks.onCancel(teeTime.id));
      actionStack.addControl(cancelBtn);
    } else if (teeTime.status === 'checked_in' || teeTime.status === 'in_progress') {
      const noShowBtn = Button.CreateSimpleButton('noShow', '⚠');
      noShowBtn.width = '35px';
      noShowBtn.height = '25px';
      noShowBtn.cornerRadius = 3;
      noShowBtn.background = '#5a4a2a';
      noShowBtn.color = '#ffaa44';
      noShowBtn.thickness = 1;
      noShowBtn.fontSize = 12;
      noShowBtn.onPointerClickObservable.add(() => this.callbacks.onMarkNoShow(teeTime.id));
      actionStack.addControl(noShowBtn);
    }

    return row;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      available: '⬚ Available',
      reserved: '📅 Reserved',
      checked_in: '✓ Checked In',
      in_progress: '🏌️ In Progress',
      completed: '✔ Completed',
      no_show: '❌ No Show',
      cancelled: '⊘ Cancelled',
    };
    return labels[status] || status;
  }

  public update(state: TeeTimeSystemState, currentDay: number): void {
    if (this.dayText) {
      const dayOfWeek = this.getDayOfWeekName(currentDay);
      this.dayText.text = `Day ${currentDay} (${dayOfWeek})`;
    }

    if (this.statsText) {
      const stats = getDailyStats(state, currentDay);
      const avgGroupSize = stats.bookedSlots > 0 ? stats.totalGolfers / stats.bookedSlots : 0;
      this.statsText.text = `Bookings: ${stats.bookedSlots}/${stats.totalSlots} | Revenue: $${stats.totalRevenue.toFixed(0)} | Avg Group: ${avgGroupSize.toFixed(1)}`;
    }

    if (this.currentSpacing !== state.spacingConfig.spacing) {
      this.currentSpacing = state.spacingConfig.spacing;
      this.updateSpacingImpact();
    }

    if (this.teeTimeList) {
      const children = [...this.teeTimeList.children];
      for (const child of children) {
        this.teeTimeList.removeControl(child);
      }

      const teeTimes = getTeeTimes(state, currentDay);
      for (const teeTime of teeTimes) {
        this.teeTimeList.addControl(this.createTeeTimeRow(teeTime));
      }

      if (teeTimes.length === 0) {
        const emptyText = new TextBlock('empty');
        emptyText.text = 'No tee times for this day';
        emptyText.color = '#666666';
        emptyText.fontSize = 14;
        emptyText.height = '40px';
        this.teeTimeList.addControl(emptyText);
      }
    }
  }

  private getDayOfWeekName(day: number): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day % 7];
  }

  public show(): void {
    if (this.overlay) {
      this.overlay.isVisible = true;
    }
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
