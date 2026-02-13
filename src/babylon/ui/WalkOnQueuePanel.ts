import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { createActionButton, createListRowCard, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock } from './DialogBlueprint';
import { WalkOnState, WalkOnGolfer } from '../../core/walk-ons';
import { UI_THEME } from './UITheme';

export interface WalkOnQueuePanelCallbacks {
  onAssignToSlot: (golferId: string) => void;
  onTurnAway: (golferId: string) => void;
  onClose: () => void;
}

export class WalkOnQueuePanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: WalkOnQueuePanelCallbacks;

  private overlay: Rectangle | null = null;
  private metricsText: TextBlock | null = null;
  private queueList: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: WalkOnQueuePanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'walkOn',
      width: 450,
      height: 500,
      colors: POPUP_COLORS.green,
      padding: 15,
    });

    this.overlay = overlay;

    createPopupHeader(stack, {
      title: '🚶 WALK-ON QUEUE',
      titleColor: '#88ccff',
      width: 420,
      onClose: () => this.callbacks.onClose(),
    });
    this.createMetricsSection(stack);
    this.createQueueList(stack);
    this.createFooter(stack);
  }

  private createMetricsSection(parent: StackPanel): void {
    const metricsContainer = createPanelSection(parent, {
      name: 'metricsContainer',
      width: 420,
      height: 70,
      theme: 'green',
      paddingTop: 5,
    });

    this.metricsText = new TextBlock('metricsText');
    this.metricsText.text = 'Loading...';
    this.metricsText.color = UI_THEME.colors.legacy.c_aaaaaa;
    this.metricsText.fontSize = UI_THEME.typography.scale.s12;
    this.metricsText.textWrapping = true;
    metricsContainer.addControl(this.metricsText);
  }

  private createQueueList(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'listContainer',
      width: 420,
      height: 320,
      theme: 'green',
      paddingTop: 8,
      scroll: {
        name: 'queueScroll',
        width: 410,
        height: 310,
        contentName: 'queueList',
        contentWidth: '390px',
        options: {
          barSize: 10,
          barColor: '#4a8a5a',
        },
      },
    });
    this.queueList = content;
  }

  private createFooter(parent: StackPanel): void {
    const footer = new TextBlock('footer');
    footer.text = 'Golfers waiting for available tee times';
    footer.color = UI_THEME.colors.legacy.c_666666;
    footer.fontSize = UI_THEME.typography.scale.s11;
    footer.height = '30px';
    footer.paddingTop = '8px';
    parent.addControl(footer);
  }

  private createGolferRow(golfer: WalkOnGolfer): Rectangle {
    const waitLevel = golfer.waitedMinutes / golfer.waitTolerance;
    const rowColors = waitLevel >= 0.8
      ? { background: 'rgba(100, 50, 50, 0.6)', borderColor: '#cc6666' }
      : waitLevel >= 0.5
      ? { background: 'rgba(100, 80, 40, 0.6)', borderColor: '#ccaa44' }
      : { background: 'rgba(40, 80, 50, 0.5)', borderColor: '#4a8a5a' };
    const row = createListRowCard({
      name: `row_${golfer.golferId}`,
      width: 380,
      height: 55,
      background: rowColors.background,
      borderColor: rowColors.borderColor,
      paddingTop: 3,
      paddingBottom: 3,
    });

    const grid = new Grid('rowGrid');
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.25);
    grid.addColumnDefinition(90, true);
    row.addControl(grid);

    const infoStack = new StackPanel('info');
    infoStack.isVertical = true;
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.paddingLeft = '10px';
    grid.addControl(infoStack, 0, 0);

    const nameText = new TextBlock('name');
    nameText.text = golfer.name;
    nameText.color = UI_THEME.colors.legacy.c_ffffff;
    nameText.fontSize = UI_THEME.typography.scale.s13;
    nameText.fontWeight = 'bold';
    nameText.height = '20px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const detailText = new TextBlock('detail');
    detailText.text = `Group: ${golfer.desiredGroupSize} | ${golfer.membershipStatus}`;
    detailText.color = UI_THEME.colors.legacy.c_888888;
    detailText.fontSize = UI_THEME.typography.scale.s10;
    detailText.height = '16px';
    detailText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(detailText);

    const waitStack = new StackPanel('waitInfo');
    waitStack.isVertical = true;
    grid.addControl(waitStack, 0, 1);

    const waitText = new TextBlock('wait');
    waitText.text = `${golfer.waitedMinutes}m waited`;
    waitText.color = waitLevel >= 0.8 ? '#ff8888' : waitLevel >= 0.5 ? '#ffaa44' : '#88ff88';
    waitText.fontSize = UI_THEME.typography.scale.s12;
    waitText.height = '20px';
    waitStack.addControl(waitText);

    const toleranceText = new TextBlock('tolerance');
    toleranceText.text = `Max: ${golfer.waitTolerance}m`;
    toleranceText.color = UI_THEME.colors.legacy.c_666666;
    toleranceText.fontSize = UI_THEME.typography.scale.s10;
    toleranceText.height = '16px';
    waitStack.addControl(toleranceText);

    if (golfer.status === 'waiting') {
      const actionStack = new StackPanel('actions');
      actionStack.isVertical = false;
      grid.addControl(actionStack, 0, 2);

      const assignBtn = createActionButton({
        id: 'assign',
        label: '✓',
        tone: 'success',
        width: 35,
        height: 28,
        fontSize: 14,
        cornerRadius: 3,
        onClick: () => this.callbacks.onAssignToSlot(golfer.golferId),
      });
      actionStack.addControl(assignBtn);

      const turnAwayBtn = createActionButton({
        id: 'turnAway',
        label: '✕',
        tone: 'danger',
        width: 35,
        height: 28,
        fontSize: 14,
        cornerRadius: 3,
        onClick: () => this.callbacks.onTurnAway(golfer.golferId),
      });
      turnAwayBtn.paddingLeft = '3px';
      actionStack.addControl(turnAwayBtn);
    }

    return row;
  }

  public update(state: WalkOnState): void {
    if (this.metricsText) {
      const { metrics, queue, policy } = state;
      const waitingCount = queue.filter(g => g.status === 'waiting').length;
      this.metricsText.text = [
        `📊 Today's Stats:`,
        `Served: ${metrics.walkOnsServedToday} | Turned Away: ${metrics.walkOnsTurnedAwayToday} | Gave Up: ${metrics.walkOnsGaveUpToday}`,
        `Queue: ${waitingCount}/${policy.maxQueueSize} | Avg Wait: ${metrics.averageWaitTime.toFixed(0)}m`,
      ].join('\n');
    }

    if (this.queueList) {
      const children = [...this.queueList.children];
      for (const child of children) {
        this.queueList.removeControl(child);
      }

      const waitingGolfers = state.queue.filter(g => g.status === 'waiting');
      for (const golfer of waitingGolfers) {
        this.queueList.addControl(this.createGolferRow(golfer));
      }

      if (waitingGolfers.length === 0) {
        const emptyText = new TextBlock('empty');
        emptyText.text = 'No golfers waiting';
        emptyText.color = UI_THEME.colors.legacy.c_666666;
        emptyText.fontSize = UI_THEME.typography.scale.s14;
        emptyText.height = '40px';
        this.queueList.addControl(emptyText);
      }
    }
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
