import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { createActionButton, createListRowCard, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock, addDialogSectionLabel } from './DialogBlueprint';
import { addUniformButtons, createHorizontalRow, UI_SPACING } from './LayoutUtils';
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
import { UI_THEME } from './UITheme';

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
  private spacingButtons = new Map<TeeTimeSpacing, Button>();

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
    const navContainer = createPanelSection(parent, {
      name: 'navContainer',
      width: 470,
      height: 40,
      theme: 'neutral',
      thickness: 0,
      cornerRadius: 0,
    });

    const prevBtn = createActionButton({
      id: 'prevBtn',
      label: '◀',
      tone: 'primary',
      width: 40,
      height: 35,
      cornerRadius: 5,
      onClick: () => this.callbacks.onChangeDay(-1),
    });
    prevBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    navContainer.addControl(prevBtn);

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1';
    this.dayText.color = UI_THEME.colors.legacy.c_ffcc00;
    this.dayText.fontSize = UI_THEME.typography.scale.s18;
    this.dayText.fontWeight = 'bold';
    navContainer.addControl(this.dayText);

    const nextBtn = createActionButton({
      id: 'nextBtn',
      label: '▶',
      tone: 'primary',
      width: 40,
      height: 35,
      cornerRadius: 5,
      onClick: () => this.callbacks.onChangeDay(1),
    });
    nextBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    navContainer.addControl(nextBtn);
  }

  private createStatsSection(parent: StackPanel): void {
    const statsContainer = createPanelSection(parent, {
      name: 'statsContainer',
      width: 470,
      height: 60,
      theme: 'green',
      paddingTop: 5,
    });

    this.statsText = new TextBlock('statsText');
    this.statsText.text = 'Loading...';
    this.statsText.color = UI_THEME.colors.legacy.c_aaaaaa;
    this.statsText.fontSize = UI_THEME.typography.scale.s12;
    this.statsText.textWrapping = true;
    statsContainer.addControl(this.statsText);
  }

  private createSpacingSection(parent: StackPanel): void {
    const spacingContainer = createPanelSection(parent, {
      name: 'spacingContainer',
      width: 470,
      height: 85,
      theme: 'green',
      paddingTop: 5,
    });

    const spacingStack = new StackPanel('spacingStack');
    spacingStack.isVertical = true;
    spacingStack.paddingTop = '5px';
    spacingContainer.addControl(spacingStack);

    addDialogSectionLabel(spacingStack, {
      id: 'spacingLabel',
      text: '⏱ Tee Time Spacing',
      tone: 'info',
      fontSize: 13,
      fontWeight: 'bold',
      height: 20,
    });

    const spacingRows: TeeTimeSpacing[][] = [
      ['packed', 'tight', 'standard'],
      ['comfortable', 'relaxed', 'exclusive'],
    ];
    this.spacingButtons.clear();
    spacingRows.forEach((rowOptions, index) => {
      const row = createHorizontalRow(spacingStack, {
        name: `spacingRow_${index}`,
        widthPx: 450,
        heightPx: 26,
        paddingTopPx: index === 0 ? 2 : UI_SPACING.xs,
      });
      const created = addUniformButtons(row, {
        rowWidthPx: 450,
        rowHeightPx: 26,
        gapPx: UI_SPACING.sm,
        specs: rowOptions.map((spacing) => ({
          id: `spacing_${spacing}`,
          label: getSpacingLabel(spacing),
          onClick: () => {
            this.currentSpacing = spacing;
            this.callbacks.onSpacingChange(spacing);
            this.updateSpacingButtons();
            this.updateSpacingImpact();
          },
          fontSize: 10,
          background: '#2a4a3a',
          hoverBackground: '#355e4a',
        })),
      });
      rowOptions.forEach((spacing, i) => {
        const button = created[i];
        if (button) {
          this.spacingButtons.set(spacing, button);
        }
      });
    });
    this.updateSpacingButtons();

    this.spacingImpactText = new TextBlock('spacingImpact');
    this.spacingImpactText.text = '';
    this.spacingImpactText.color = UI_THEME.colors.legacy.c_aaaaaa;
    this.spacingImpactText.fontSize = UI_THEME.typography.scale.s10;
    this.spacingImpactText.textWrapping = true;
    this.spacingImpactText.height = '22px';
    this.spacingImpactText.paddingTop = '3px';
    spacingStack.addControl(this.spacingImpactText);
    this.updateSpacingImpact();
  }

  private updateSpacingButtons(): void {
    this.spacingButtons.forEach((button, spacing) => {
      const selected = spacing === this.currentSpacing;
      button.background = selected ? '#4a8a5a' : '#2a4a3a';
      button.color = selected ? '#ffffff' : '#aaaaaa';
      button.thickness = selected ? 2 : 1;
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
    const { content } = addDialogScrollBlock(parent, {
      id: 'listContainer',
      width: 470,
      height: 290,
      theme: 'green',
      paddingTop: 8,
      scroll: {
        name: 'teeTimeScroll',
        width: 460,
        height: 280,
        contentName: 'teeTimeList',
        contentWidth: '440px',
        options: {
          barSize: 10,
          barColor: '#4a8a5a',
        },
      },
    });
    this.teeTimeList = content;
  }

  private createFooter(parent: StackPanel): void {
    const footer = new TextBlock('footer');
    footer.text = 'Click time slots to manage bookings';
    footer.color = UI_THEME.colors.legacy.c_666666;
    footer.fontSize = UI_THEME.typography.scale.s11;
    footer.height = '30px';
    footer.paddingTop = '8px';
    parent.addControl(footer);
  }

  private createTeeTimeRow(teeTime: TeeTime): Rectangle {
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
    const row = createListRowCard({
      name: `row_${teeTime.id}`,
      width: 430,
      height: 50,
      background: colors.bg,
      borderColor: colors.border,
      paddingTop: 3,
      paddingBottom: 3,
    });

    const grid = new Grid('rowGrid');
    grid.addColumnDefinition(70, true);
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.3);
    grid.addColumnDefinition(90, true);
    row.addControl(grid);

    const timeText = new TextBlock('time');
    timeText.text = formatTeeTime(teeTime.scheduledTime);
    timeText.color = UI_THEME.colors.legacy.c_ffffff;
    timeText.fontSize = UI_THEME.typography.scale.s14;
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
    statusText.color = UI_THEME.colors.legacy.c_cccccc;
    statusText.fontSize = UI_THEME.typography.scale.s11;
    statusText.height = '18px';
    statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(statusText);

    const groupText = new TextBlock('group');
    groupText.text = teeTime.groupSize > 0 ? `${teeTime.groupSize} golfer${teeTime.groupSize > 1 ? 's' : ''}` : 'Open';
    groupText.color = UI_THEME.colors.legacy.c_888888;
    groupText.fontSize = UI_THEME.typography.scale.s10;
    groupText.height = '16px';
    groupText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(groupText);

    const revenueText = new TextBlock('revenue');
    revenueText.text = teeTime.totalRevenue > 0 ? `$${teeTime.totalRevenue.toFixed(0)}` : '-';
    revenueText.color = teeTime.totalRevenue > 0 ? '#88ff88' : '#666666';
    revenueText.fontSize = UI_THEME.typography.scale.s12;
    grid.addControl(revenueText, 0, 2);

    const actionStack = new StackPanel('actions');
    actionStack.isVertical = false;
    grid.addControl(actionStack, 0, 3);

    if (teeTime.status === 'reserved' && !teeTime.checkedIn) {
      const checkInBtn = createActionButton({
        id: 'checkIn',
        label: '✓',
        tone: 'success',
        width: 30,
        height: 25,
        fontSize: 12,
        cornerRadius: 3,
        onClick: () => this.callbacks.onCheckIn(teeTime.id),
      });
      actionStack.addControl(checkInBtn);

      const cancelBtn = createActionButton({
        id: 'cancel',
        label: '✕',
        tone: 'danger',
        width: 30,
        height: 25,
        fontSize: 12,
        cornerRadius: 3,
        onClick: () => this.callbacks.onCancel(teeTime.id),
      });
      cancelBtn.paddingLeft = '3px';
      actionStack.addControl(cancelBtn);
    } else if (teeTime.status === 'checked_in' || teeTime.status === 'in_progress') {
      const noShowBtn = createActionButton({
        id: 'noShow',
        label: '⚠',
        tone: 'warning',
        width: 35,
        height: 25,
        fontSize: 12,
        cornerRadius: 3,
        onClick: () => this.callbacks.onMarkNoShow(teeTime.id),
      });
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
        emptyText.color = UI_THEME.colors.legacy.c_666666;
        emptyText.fontSize = UI_THEME.typography.scale.s14;
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
