import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { createOverlayPopup, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { WalkOnState, WalkOnGolfer } from '../../core/walk-ons';

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
    const metricsContainer = new Rectangle('metricsContainer');
    metricsContainer.height = '70px';
    metricsContainer.width = '420px';
    metricsContainer.cornerRadius = 6;
    metricsContainer.background = 'rgba(30, 60, 45, 0.7)';
    metricsContainer.thickness = 1;
    metricsContainer.color = '#3a5a4a';
    metricsContainer.paddingTop = '5px';
    parent.addControl(metricsContainer);

    this.metricsText = new TextBlock('metricsText');
    this.metricsText.text = 'Loading...';
    this.metricsText.color = '#aaaaaa';
    this.metricsText.fontSize = 12;
    this.metricsText.textWrapping = true;
    metricsContainer.addControl(this.metricsText);
  }

  private createQueueList(parent: StackPanel): void {
    const listContainer = new Rectangle('listContainer');
    listContainer.height = '320px';
    listContainer.width = '420px';
    listContainer.cornerRadius = 6;
    listContainer.background = 'rgba(20, 40, 30, 0.5)';
    listContainer.thickness = 1;
    listContainer.color = '#3a5a4a';
    listContainer.paddingTop = '8px';
    parent.addControl(listContainer);

    const scrollViewer = new ScrollViewer('queueScroll');
    scrollViewer.width = '410px';
    scrollViewer.height = '310px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 10;
    scrollViewer.barColor = '#4a8a5a';
    listContainer.addControl(scrollViewer);

    this.queueList = new StackPanel('queueList');
    this.queueList.width = '390px';
    scrollViewer.addControl(this.queueList);
  }

  private createFooter(parent: StackPanel): void {
    const footer = new TextBlock('footer');
    footer.text = 'Golfers waiting for available tee times';
    footer.color = '#666666';
    footer.fontSize = 11;
    footer.height = '30px';
    footer.paddingTop = '8px';
    parent.addControl(footer);
  }

  private createGolferRow(golfer: WalkOnGolfer): Rectangle {
    const row = new Rectangle(`row_${golfer.golferId}`);
    row.height = '55px';
    row.width = '380px';
    row.cornerRadius = 4;
    row.thickness = 1;
    row.paddingTop = '3px';
    row.paddingBottom = '3px';

    const waitLevel = golfer.waitedMinutes / golfer.waitTolerance;
    if (waitLevel >= 0.8) {
      row.background = 'rgba(100, 50, 50, 0.6)';
      row.color = '#cc6666';
    } else if (waitLevel >= 0.5) {
      row.background = 'rgba(100, 80, 40, 0.6)';
      row.color = '#ccaa44';
    } else {
      row.background = 'rgba(40, 80, 50, 0.5)';
      row.color = '#4a8a5a';
    }

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
    nameText.color = '#ffffff';
    nameText.fontSize = 13;
    nameText.fontWeight = 'bold';
    nameText.height = '20px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const detailText = new TextBlock('detail');
    detailText.text = `Group: ${golfer.desiredGroupSize} | ${golfer.membershipStatus}`;
    detailText.color = '#888888';
    detailText.fontSize = 10;
    detailText.height = '16px';
    detailText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(detailText);

    const waitStack = new StackPanel('waitInfo');
    waitStack.isVertical = true;
    grid.addControl(waitStack, 0, 1);

    const waitText = new TextBlock('wait');
    waitText.text = `${golfer.waitedMinutes}m waited`;
    waitText.color = waitLevel >= 0.8 ? '#ff8888' : waitLevel >= 0.5 ? '#ffaa44' : '#88ff88';
    waitText.fontSize = 12;
    waitText.height = '20px';
    waitStack.addControl(waitText);

    const toleranceText = new TextBlock('tolerance');
    toleranceText.text = `Max: ${golfer.waitTolerance}m`;
    toleranceText.color = '#666666';
    toleranceText.fontSize = 10;
    toleranceText.height = '16px';
    waitStack.addControl(toleranceText);

    if (golfer.status === 'waiting') {
      const actionStack = new StackPanel('actions');
      actionStack.isVertical = false;
      grid.addControl(actionStack, 0, 2);

      const assignBtn = Button.CreateSimpleButton('assign', '✓');
      assignBtn.width = '35px';
      assignBtn.height = '28px';
      assignBtn.cornerRadius = 3;
      assignBtn.background = '#2a6a4a';
      assignBtn.color = '#88ff88';
      assignBtn.thickness = 1;
      assignBtn.fontSize = 14;
      assignBtn.onPointerClickObservable.add(() => this.callbacks.onAssignToSlot(golfer.golferId));
      actionStack.addControl(assignBtn);

      const turnAwayBtn = Button.CreateSimpleButton('turnAway', '✕');
      turnAwayBtn.width = '35px';
      turnAwayBtn.height = '28px';
      turnAwayBtn.cornerRadius = 3;
      turnAwayBtn.background = '#6a3a3a';
      turnAwayBtn.color = '#ff8888';
      turnAwayBtn.thickness = 1;
      turnAwayBtn.fontSize = 14;
      turnAwayBtn.paddingLeft = '3px';
      turnAwayBtn.onPointerClickObservable.add(() => this.callbacks.onTurnAway(golfer.golferId));
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
        emptyText.color = '#666666';
        emptyText.fontSize = 14;
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
