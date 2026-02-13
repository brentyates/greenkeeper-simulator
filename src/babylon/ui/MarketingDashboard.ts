import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
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
import { createActionButton, createOverlayPopup, createPanelSection, createPopupHeader, POPUP_COLORS } from './PopupUtils';
import { addDialogScrollBlock } from './DialogBlueprint';
import { UI_THEME } from './UITheme';

export interface MarketingDashboardCallbacks {
  onStartCampaign: (campaignId: string, duration: number) => void;
  onStopCampaign: (campaignId: string) => void;
  onClose: () => void;
}

export class MarketingDashboard {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: MarketingDashboardCallbacks;

  private overlay: Rectangle | null = null;
  private metricsText: TextBlock | null = null;
  private activeCampaignsList: StackPanel | null = null;
  private availableCampaignsList: StackPanel | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: MarketingDashboardCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'marketing',
      width: 550,
      height: 620,
      colors: POPUP_COLORS.green,
      padding: 15,
    });

    this.overlay = overlay;

    createPopupHeader(stack, {
      title: '📢 MARKETING DASHBOARD',
      width: 520,
      onClose: () => this.callbacks.onClose(),
    });
    this.createMetricsSection(stack);
    this.createActiveCampaignsSection(stack);
    this.createAvailableCampaignsSection(stack);
  }

  private createMetricsSection(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'metricsContainer',
      width: 520,
      height: 50,
      theme: 'green',
      paddingTop: 5,
    });

    this.metricsText = new TextBlock('metricsText');
    this.metricsText.text = 'Loading...';
    this.metricsText.color = UI_THEME.colors.text.secondary;
    this.metricsText.fontSize = UI_THEME.typography.bodySize;
    this.metricsText.fontFamily = UI_THEME.typography.fontFamily;
    container.addControl(this.metricsText);
  }

  private createActiveCampaignsSection(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'activeContainer',
      title: {
        text: '📣 ACTIVE CAMPAIGNS',
        color: '#88ff88',
        fontSize: 12,
        height: 25,
        paddingTop: 8,
      },
      width: 520,
      height: 130,
      theme: 'green',
      paddingTop: 6,
      scroll: {
        name: 'activeScroll',
        width: 510,
        height: 120,
        contentName: 'activeList',
        contentWidth: '490px',
        options: {
          barSize: 8,
          barColor: '#4a8a5a',
        },
      },
    });
    this.activeCampaignsList = content;
  }

  private createAvailableCampaignsSection(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'availableContainer',
      title: {
        text: '📋 AVAILABLE CAMPAIGNS',
        color: '#88ccff',
        fontSize: 12,
        height: 25,
        paddingTop: 8,
      },
      width: 520,
      height: 300,
      theme: 'green',
      paddingTop: 6,
      scroll: {
        name: 'availableScroll',
        width: 510,
        height: 290,
        contentName: 'availableList',
        contentWidth: '490px',
        options: {
          barSize: 8,
          barColor: '#4a8a5a',
        },
      },
    });
    this.availableCampaignsList = content;
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
    row.cornerRadius = UI_THEME.radii.chip;
    row.background = 'rgba(50, 80, 60, 0.6)';
    row.thickness = 1;
    row.color = UI_THEME.colors.legacy.c_66aa66;
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
    nameText.color = UI_THEME.colors.text.primary;
    nameText.fontSize = UI_THEME.typography.scale.s13;
    nameText.fontFamily = UI_THEME.typography.fontFamily;
    nameText.height = '20px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const progressText = new TextBlock('progress');
    progressText.text = `Day ${elapsedDays}/${plannedDuration} | $${campaign.dailyCost}/day`;
    progressText.color = UI_THEME.colors.text.muted;
    progressText.fontSize = UI_THEME.typography.scale.s11;
    progressText.fontFamily = UI_THEME.typography.fontFamily;
    progressText.height = '18px';
    progressText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(progressText);

    const effectText = new TextBlock('effect');
    effectText.text = `+${((campaign.demandMultiplier - 1) * 100).toFixed(0)}% demand`;
    effectText.color = UI_THEME.colors.text.success;
    effectText.fontSize = UI_THEME.typography.scale.s12;
    effectText.fontFamily = UI_THEME.typography.fontFamily;
    grid.addControl(effectText, 0, 1);

    const stopBtn = createActionButton({
      id: `stop_${campaignId}`,
      label: 'Stop',
      tone: 'danger',
      width: 68,
      fontSize: UI_THEME.typography.captionSize,
      onClick: () => this.callbacks.onStopCampaign(campaignId),
    });
    grid.addControl(stopBtn, 0, 2);

    return row;
  }

  private createAvailableCampaignRow(campaign: MarketingCampaign, state: MarketingState, _currentDay: number, cash: number): Rectangle {
    const row = new Rectangle(`avail_${campaign.id}`);
    row.height = '70px';
    row.width = '480px';
    row.cornerRadius = UI_THEME.radii.chip;
    row.thickness = 1;
    row.paddingTop = '3px';
    row.paddingBottom = '3px';

    const canStartResult = canStartCampaign(state, campaign.id, cash);
    const cooldownRemaining = getCooldownRemaining(state, campaign.id);
    const activeCount = getActiveCampaignCount(state, campaign.id);

    if (canStartResult.canStart) {
      row.background = 'rgba(40, 70, 50, 0.5)';
      row.color = UI_THEME.colors.legacy.c_4a8a5a;
    } else {
      row.background = 'rgba(50, 50, 50, 0.4)';
      row.color = UI_THEME.colors.legacy.c_555555;
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
    nameText.fontSize = UI_THEME.typography.scale.s13;
    nameText.fontFamily = UI_THEME.typography.fontFamily;
    nameText.height = '20px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const costText = new TextBlock('cost');
    const totalMinCost = campaign.setupCost + (campaign.dailyCost * campaign.minDuration);
    costText.text = `Setup: $${campaign.setupCost} | Daily: $${campaign.dailyCost} | Min: $${totalMinCost}`;
    costText.color = UI_THEME.colors.text.muted;
    costText.fontSize = UI_THEME.typography.scale.s10;
    costText.fontFamily = UI_THEME.typography.fontFamily;
    costText.height = '16px';
    costText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(costText);

    const durationText = new TextBlock('duration');
    durationText.text = `Duration: ${campaign.minDuration}-${campaign.maxDuration} days`;
    durationText.color = UI_THEME.colors.legacy.c_666666;
    durationText.fontSize = UI_THEME.typography.scale.s10;
    durationText.fontFamily = UI_THEME.typography.fontFamily;
    durationText.height = '16px';
    durationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(durationText);

    const effectStack = new StackPanel('effects');
    effectStack.isVertical = true;
    grid.addControl(effectStack, 0, 1);

    const demandText = new TextBlock('demand');
    demandText.text = campaign.demandMultiplier > 1 ? `+${((campaign.demandMultiplier - 1) * 100).toFixed(0)}% demand` : 'Event';
    demandText.color = UI_THEME.colors.text.success;
    demandText.fontSize = UI_THEME.typography.scale.s11;
    demandText.fontFamily = UI_THEME.typography.fontFamily;
    demandText.height = '18px';
    effectStack.addControl(demandText);

    const audienceText = new TextBlock('audience');
    audienceText.text = campaign.targetAudience.slice(0, 2).join(', ');
    audienceText.color = UI_THEME.colors.legacy.c_666666;
    audienceText.fontSize = UI_THEME.typography.scale.s10;
    audienceText.fontFamily = UI_THEME.typography.fontFamily;
    audienceText.height = '16px';
    effectStack.addControl(audienceText);

    const actionStack = new StackPanel('actions');
    actionStack.isVertical = true;
    actionStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    grid.addControl(actionStack, 0, 2);

    if (canStartResult.canStart) {
      const startBtn = createActionButton({
        id: `start_${campaign.id}`,
        label: 'Start',
        tone: 'success',
        width: 72,
        fontSize: UI_THEME.typography.captionSize,
        onClick: () => this.callbacks.onStartCampaign(campaign.id, campaign.minDuration),
      });
      actionStack.addControl(startBtn);
    } else {
      const statusText = new TextBlock('status');
      if (cooldownRemaining > 0) {
        statusText.text = `Cooldown: ${cooldownRemaining}d`;
        statusText.color = UI_THEME.colors.legacy.c_ff8888;
      } else if (activeCount >= campaign.maxConcurrent) {
        statusText.text = 'Max active';
        statusText.color = UI_THEME.colors.legacy.c_ffaa44;
      } else {
        statusText.text = 'Not enough $';
        statusText.color = UI_THEME.colors.legacy.c_ff8888;
      }
      statusText.fontSize = UI_THEME.typography.captionSize;
      statusText.fontFamily = UI_THEME.typography.fontFamily;
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
        emptyText.color = UI_THEME.colors.text.muted;
        emptyText.fontSize = UI_THEME.typography.bodySize;
        emptyText.fontFamily = UI_THEME.typography.fontFamily;
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
