import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import {
  MarketingState,
  MarketingCampaign,
  MARKETING_CAMPAIGNS,
  canStartCampaign,
  getCooldownRemaining,
  getActiveCampaignCount,
  getCampaignSummary,
} from '../../core/marketing';

export interface MarketingDashboardCallbacks {
  onStartCampaign: (campaignId: string, duration: number) => void;
  onStopCampaign: (campaignId: string) => void;
  onClose: () => void;
}

export class MarketingDashboard {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: MarketingDashboardCallbacks;

  private overlay: Rectangle | null = null;
  private panel: Rectangle | null = null;
  private metricsText: TextBlock | null = null;
  private activeCampaignsList: StackPanel | null = null;
  private availableCampaignsList: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: MarketingDashboardCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.overlay = new Rectangle('marketingOverlay');
    this.overlay.width = '100%';
    this.overlay.height = '100%';
    this.overlay.background = 'rgba(0, 0, 0, 0.6)';
    this.overlay.thickness = 0;
    this.overlay.isVisible = false;
    this.advancedTexture.addControl(this.overlay);

    this.panel = new Rectangle('marketingPanel');
    this.panel.width = '550px';
    this.panel.height = '620px';
    this.panel.cornerRadius = 10;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 3;
    this.panel.background = 'rgba(20, 45, 35, 0.98)';
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 15;
    this.overlay.addControl(this.panel);

    const mainStack = new StackPanel('marketingStack');
    mainStack.paddingTop = '15px';
    mainStack.paddingLeft = '15px';
    mainStack.paddingRight = '15px';
    this.panel.addControl(mainStack);

    this.createHeader(mainStack);
    this.createMetricsSection(mainStack);
    this.createActiveCampaignsSection(mainStack);
    this.createAvailableCampaignsSection(mainStack);
  }

  private createHeader(parent: StackPanel): void {
    const header = new Rectangle('header');
    header.height = '45px';
    header.width = '520px';
    header.thickness = 0;
    header.background = 'transparent';
    parent.addControl(header);

    const title = new TextBlock('title');
    title.text = '📢 MARKETING DASHBOARD';
    title.color = '#ffcc00';
    title.fontSize = 20;
    title.fontWeight = 'bold';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    header.addControl(title);

    const closeBtn = Button.CreateSimpleButton('closeBtn', '✕');
    closeBtn.width = '35px';
    closeBtn.height = '35px';
    closeBtn.cornerRadius = 5;
    closeBtn.background = 'rgba(100, 50, 50, 0.8)';
    closeBtn.color = '#ff8888';
    closeBtn.thickness = 1;
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.onPointerClickObservable.add(() => this.callbacks.onClose());
    header.addControl(closeBtn);
  }

  private createMetricsSection(parent: StackPanel): void {
    const container = new Rectangle('metricsContainer');
    container.height = '50px';
    container.width = '520px';
    container.cornerRadius = 6;
    container.background = 'rgba(30, 60, 45, 0.7)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    container.paddingTop = '5px';
    parent.addControl(container);

    this.metricsText = new TextBlock('metricsText');
    this.metricsText.text = 'Loading...';
    this.metricsText.color = '#aaaaaa';
    this.metricsText.fontSize = 12;
    container.addControl(this.metricsText);
  }

  private createActiveCampaignsSection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('activeLabel');
    sectionLabel.text = '📣 ACTIVE CAMPAIGNS';
    sectionLabel.color = '#88ff88';
    sectionLabel.fontSize = 12;
    sectionLabel.height = '25px';
    sectionLabel.paddingTop = '8px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    parent.addControl(sectionLabel);

    const container = new Rectangle('activeContainer');
    container.height = '130px';
    container.width = '520px';
    container.cornerRadius = 6;
    container.background = 'rgba(20, 40, 30, 0.5)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    parent.addControl(container);

    const scrollViewer = new ScrollViewer('activeScroll');
    scrollViewer.width = '510px';
    scrollViewer.height = '120px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a8a5a';
    container.addControl(scrollViewer);

    this.activeCampaignsList = new StackPanel('activeList');
    this.activeCampaignsList.width = '490px';
    scrollViewer.addControl(this.activeCampaignsList);
  }

  private createAvailableCampaignsSection(parent: StackPanel): void {
    const sectionLabel = new TextBlock('availableLabel');
    sectionLabel.text = '📋 AVAILABLE CAMPAIGNS';
    sectionLabel.color = '#88ccff';
    sectionLabel.fontSize = 12;
    sectionLabel.height = '25px';
    sectionLabel.paddingTop = '8px';
    sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    parent.addControl(sectionLabel);

    const container = new Rectangle('availableContainer');
    container.height = '300px';
    container.width = '520px';
    container.cornerRadius = 6;
    container.background = 'rgba(20, 40, 30, 0.5)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    parent.addControl(container);

    const scrollViewer = new ScrollViewer('availableScroll');
    scrollViewer.width = '510px';
    scrollViewer.height = '290px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a8a5a';
    container.addControl(scrollViewer);

    this.availableCampaignsList = new StackPanel('availableList');
    this.availableCampaignsList.width = '490px';
    scrollViewer.addControl(this.availableCampaignsList);
  }

  private createActiveCampaignRow(campaignId: string, elapsedDays: number, plannedDuration: number): Rectangle {
    const campaign = MARKETING_CAMPAIGNS.find(c => c.id === campaignId);
    if (!campaign) {
      const placeholder = new Rectangle('placeholder');
      placeholder.height = '1px';
      return placeholder;
    }

    const row = new Rectangle(`active_${campaignId}`);
    row.height = '55px';
    row.width = '480px';
    row.cornerRadius = 4;
    row.background = 'rgba(50, 80, 60, 0.6)';
    row.thickness = 1;
    row.color = '#66aa66';
    row.paddingTop = '3px';
    row.paddingBottom = '3px';

    const grid = new Grid('rowGrid');
    grid.addColumnDefinition(0.6);
    grid.addColumnDefinition(0.25);
    grid.addColumnDefinition(80, true);
    row.addControl(grid);

    const infoStack = new StackPanel('info');
    infoStack.isVertical = true;
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.paddingLeft = '10px';
    grid.addControl(infoStack, 0, 0);

    const nameText = new TextBlock('name');
    nameText.text = campaign.name;
    nameText.color = '#ffffff';
    nameText.fontSize = 13;
    nameText.height = '20px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const progressText = new TextBlock('progress');
    progressText.text = `Day ${elapsedDays}/${plannedDuration} | $${campaign.dailyCost}/day`;
    progressText.color = '#888888';
    progressText.fontSize = 11;
    progressText.height = '18px';
    progressText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(progressText);

    const effectText = new TextBlock('effect');
    effectText.text = `+${((campaign.demandMultiplier - 1) * 100).toFixed(0)}% demand`;
    effectText.color = '#88ff88';
    effectText.fontSize = 12;
    grid.addControl(effectText, 0, 1);

    const stopBtn = Button.CreateSimpleButton('stop', 'Stop');
    stopBtn.width = '60px';
    stopBtn.height = '30px';
    stopBtn.cornerRadius = 4;
    stopBtn.background = '#6a4040';
    stopBtn.color = '#ff8888';
    stopBtn.thickness = 1;
    stopBtn.fontSize = 11;
    stopBtn.onPointerClickObservable.add(() => this.callbacks.onStopCampaign(campaignId));
    grid.addControl(stopBtn, 0, 2);

    return row;
  }

  private createAvailableCampaignRow(campaign: MarketingCampaign, state: MarketingState, _currentDay: number, cash: number): Rectangle {
    const row = new Rectangle(`avail_${campaign.id}`);
    row.height = '70px';
    row.width = '480px';
    row.cornerRadius = 4;
    row.thickness = 1;
    row.paddingTop = '3px';
    row.paddingBottom = '3px';

    const canStartResult = canStartCampaign(state, campaign.id, cash);
    const cooldownRemaining = getCooldownRemaining(state, campaign.id);
    const activeCount = getActiveCampaignCount(state, campaign.id);

    if (canStartResult.canStart) {
      row.background = 'rgba(40, 70, 50, 0.5)';
      row.color = '#4a8a5a';
    } else {
      row.background = 'rgba(50, 50, 50, 0.4)';
      row.color = '#555555';
    }

    const grid = new Grid('rowGrid');
    grid.addColumnDefinition(0.55);
    grid.addColumnDefinition(0.25);
    grid.addColumnDefinition(90, true);
    row.addControl(grid);

    const infoStack = new StackPanel('info');
    infoStack.isVertical = true;
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.paddingLeft = '10px';
    grid.addControl(infoStack, 0, 0);

    const nameText = new TextBlock('name');
    nameText.text = campaign.name;
    nameText.color = canStartResult.canStart ? '#ffffff' : '#888888';
    nameText.fontSize = 13;
    nameText.height = '20px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const costText = new TextBlock('cost');
    const totalMinCost = campaign.setupCost + (campaign.dailyCost * campaign.minDuration);
    costText.text = `Setup: $${campaign.setupCost} | Daily: $${campaign.dailyCost} | Min: $${totalMinCost}`;
    costText.color = '#888888';
    costText.fontSize = 10;
    costText.height = '16px';
    costText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(costText);

    const durationText = new TextBlock('duration');
    durationText.text = `Duration: ${campaign.minDuration}-${campaign.maxDuration} days`;
    durationText.color = '#666666';
    durationText.fontSize = 10;
    durationText.height = '16px';
    durationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(durationText);

    const effectStack = new StackPanel('effects');
    effectStack.isVertical = true;
    grid.addControl(effectStack, 0, 1);

    const demandText = new TextBlock('demand');
    demandText.text = campaign.demandMultiplier > 1 ? `+${((campaign.demandMultiplier - 1) * 100).toFixed(0)}% demand` : 'Event';
    demandText.color = '#88ff88';
    demandText.fontSize = 11;
    demandText.height = '18px';
    effectStack.addControl(demandText);

    const audienceText = new TextBlock('audience');
    audienceText.text = campaign.targetAudience.slice(0, 2).join(', ');
    audienceText.color = '#666666';
    audienceText.fontSize = 10;
    audienceText.height = '16px';
    effectStack.addControl(audienceText);

    const actionStack = new StackPanel('actions');
    actionStack.isVertical = true;
    grid.addControl(actionStack, 0, 2);

    if (canStartResult.canStart) {
      const startBtn = Button.CreateSimpleButton('start', 'Start');
      startBtn.width = '70px';
      startBtn.height = '30px';
      startBtn.cornerRadius = 4;
      startBtn.background = '#2a6a4a';
      startBtn.color = '#88ff88';
      startBtn.thickness = 1;
      startBtn.fontSize = 11;
      startBtn.onPointerClickObservable.add(() => this.callbacks.onStartCampaign(campaign.id, campaign.minDuration));
      actionStack.addControl(startBtn);
    } else {
      const statusText = new TextBlock('status');
      if (cooldownRemaining > 0) {
        statusText.text = `Cooldown: ${cooldownRemaining}d`;
        statusText.color = '#ff8888';
      } else if (activeCount >= campaign.maxConcurrent) {
        statusText.text = 'Max active';
        statusText.color = '#ffaa44';
      } else {
        statusText.text = 'Not enough $';
        statusText.color = '#ff8888';
      }
      statusText.fontSize = 10;
      statusText.height = '20px';
      actionStack.addControl(statusText);
    }

    return row;
  }

  public update(state: MarketingState, currentDay: number, cash: number): void {
    const summary = getCampaignSummary(state);

    if (this.metricsText) {
      this.metricsText.text = `Active: ${summary.activeCampaignCount} | Total Spent: $${state.metrics.totalSpent.toFixed(0)} | ROI: ${(state.metrics.averageRoi * 100).toFixed(0)}% | Campaigns Run: ${state.metrics.campaignsRun}`;
    }

    if (this.activeCampaignsList) {
      const children = [...this.activeCampaignsList.children];
      for (const child of children) {
        this.activeCampaignsList.removeControl(child);
      }

      if (summary.activeCampaignCount === 0) {
        const emptyText = new TextBlock('empty');
        emptyText.text = 'No active campaigns';
        emptyText.color = '#666666';
        emptyText.fontSize = 12;
        emptyText.height = '40px';
        this.activeCampaignsList.addControl(emptyText);
      } else {
        for (const active of state.activeCampaigns) {
          if (active.status === 'active') {
            this.activeCampaignsList.addControl(
              this.createActiveCampaignRow(active.campaignId, active.elapsedDays, active.plannedDuration)
            );
          }
        }
      }
    }

    if (this.availableCampaignsList) {
      const children = [...this.availableCampaignsList.children];
      for (const child of children) {
        this.availableCampaignsList.removeControl(child);
      }

      for (const campaign of MARKETING_CAMPAIGNS) {
        this.availableCampaignsList.addControl(
          this.createAvailableCampaignRow(campaign, state, currentDay, cash)
        );
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
