import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';
import {
  createDockedPanel,
  createActionButton,
  createPanelSection,
  POPUP_COLORS,
} from './PopupUtils';
import { UI_THEME } from './UITheme';
import type { NamedRegion } from '../../core/named-region';
import type { RegionStats } from '../../core/standing-orders';
import type { JobTaskType } from '../../core/job';
import { getTerrainType, getTerrainDisplayName } from '../../core/terrain';

export interface RegionInfoPanelCallbacks {
  onAssignTask: (region: NamedRegion, taskType: JobTaskType) => void;
  onClose: () => void;
}

const TASK_LABELS: Record<JobTaskType, string> = {
  mow: '🌿 Mow',
  water: '💧 Water',
  fertilize: '🧪 Fert',
  rake: '⛱ Rake',
};

function isTaskValidForTerrain(taskType: JobTaskType, terrainCode: number): boolean {
  if (taskType === 'rake') return terrainCode === 3;
  return terrainCode === 0 || terrainCode === 1 || terrainCode === 2 || terrainCode === 5;
}

export class RegionInfoPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: RegionInfoPanelCallbacks;
  private panel: Rectangle | null = null;
  private nameText: TextBlock | null = null;
  private terrainText: TextBlock | null = null;
  private conditionText: TextBlock | null = null;
  private recommendationText: TextBlock | null = null;
  private statsGrid: Grid | null = null;
  private taskStack: StackPanel | null = null;
  private activeRegion: NamedRegion | null = null;
  private statusText: TextBlock | null = null;
  private activeRecommendationTask: JobTaskType | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: RegionInfoPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDockedPanel(this.advancedTexture, {
      name: 'regionInfo',
      width: 296,
      height: 352,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
      left: 8,
      top: 134,
      padding: 12,
    });
    this.panel = panel;

    this.nameText = new TextBlock('regionName');
    this.nameText.color = UI_THEME.colors.text.accent;
    this.nameText.fontSize = UI_THEME.typography.scale.s16;
    this.nameText.fontWeight = 'bold';
    this.nameText.height = '24px';
    this.nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.nameText);

    this.terrainText = new TextBlock('terrainType');
    this.terrainText.color = UI_THEME.colors.text.secondary;
    this.terrainText.fontSize = UI_THEME.typography.scale.s10;
    this.terrainText.height = '18px';
    this.terrainText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.terrainText);

    const briefingSection = createPanelSection(stack, {
      name: 'regionBriefing',
      width: 270,
      height: 74,
      theme: 'green',
      background: UI_THEME.colors.surfaces.panelInset,
      borderColor: UI_THEME.colors.border.info,
      paddingTop: 4,
      paddingBottom: 4,
      marginTop: 6,
    });
    const briefingStack = new StackPanel('regionBriefingStack');
    briefingStack.width = '248px';
    briefingSection.addControl(briefingStack);

    this.conditionText = new TextBlock('regionConditionText');
    this.conditionText.color = UI_THEME.colors.text.primary;
    this.conditionText.fontSize = UI_THEME.typography.scale.s12;
    this.conditionText.fontWeight = 'bold';
    this.conditionText.height = '18px';
    this.conditionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    briefingStack.addControl(this.conditionText);

    this.recommendationText = new TextBlock('regionRecommendationText');
    this.recommendationText.color = UI_THEME.colors.text.secondary;
    this.recommendationText.fontSize = UI_THEME.typography.scale.s10;
    this.recommendationText.height = '38px';
    this.recommendationText.textWrapping = true;
    this.recommendationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    briefingStack.addControl(this.recommendationText);

    this.statsGrid = new Grid('statsGrid');
    this.statsGrid.width = '270px';
    this.statsGrid.height = '78px';
    this.statsGrid.paddingTop = '6px';
    this.statsGrid.addColumnDefinition(0.5);
    this.statsGrid.addColumnDefinition(0.5);
    this.statsGrid.addRowDefinition(26, true);
    this.statsGrid.addRowDefinition(26, true);
    stack.addControl(this.statsGrid);

    this.statusText = new TextBlock('statusText');
    this.statusText.color = UI_THEME.colors.text.secondary;
    this.statusText.fontSize = UI_THEME.typography.scale.s10;
    this.statusText.height = '24px';
    this.statusText.paddingTop = '4px';
    this.statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statusText.textWrapping = true;
    stack.addControl(this.statusText);

    this.taskStack = new StackPanel('taskBtns');
    this.taskStack.isVertical = false;
    this.taskStack.height = '38px';
    this.taskStack.paddingTop = '4px';
    stack.addControl(this.taskStack);

    const closeBtn = Button.CreateSimpleButton('closeRegion', '✕');
    closeBtn.width = '20px';
    closeBtn.height = '20px';
    closeBtn.fontSize = 12;
    closeBtn.color = '#aaaaaa';
    closeBtn.thickness = 0;
    closeBtn.background = 'transparent';
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    closeBtn.top = '4px';
    closeBtn.left = '-4px';
    closeBtn.onPointerClickObservable.add(() => { this.hide(); this.callbacks.onClose(); });
    panel.addControl(closeBtn);
  }

  private addStatCell(row: number, col: number, text: string, color?: string): void {
    if (!this.statsGrid) return;
    const tb = new TextBlock();
    tb.text = text;
    tb.color = color ?? UI_THEME.colors.text.secondary;
    tb.fontSize = UI_THEME.typography.scale.s11;
    tb.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    tb.paddingLeft = '4px';
    tb.paddingRight = '4px';
    this.statsGrid.addControl(tb, row, col);
  }

  public show(region: NamedRegion, stats: RegionStats, hasActiveJob: boolean): void {
    if (!this.panel || !this.nameText || !this.terrainText || !this.statsGrid || !this.taskStack || !this.statusText || !this.conditionText || !this.recommendationText) return;

    this.activeRegion = region;
    this.nameText.text = region.name;

    const terrainName = getTerrainDisplayName(getTerrainType(region.terrainCode));
    this.terrainText.text = `${terrainName} · Hole ${region.holeNumber} · ${region.faceIds.length} tiles`;

    const briefing = describeRegionIntent(region, stats, hasActiveJob);
    this.activeRecommendationTask = briefing.recommendedTask;
    this.conditionText.text = briefing.condition;
    this.recommendationText.text = briefing.recommendation;

    for (const child of [...this.statsGrid.children]) this.statsGrid.removeControl(child);

    this.addStatCell(0, 0, `Grass ${stats.avgGrassHeight.toFixed(0)}%`, getValueColor(stats.avgGrassHeight));
    this.addStatCell(0, 1, `Moisture ${stats.avgMoisture.toFixed(0)}%`, getValueColor(stats.avgMoisture));
    this.addStatCell(1, 0, `Nutrients ${stats.avgNutrients.toFixed(0)}%`, getValueColor(stats.avgNutrients));
    this.addStatCell(1, 1, `Health ${stats.avgHealth.toFixed(0)}%`, getValueColor(stats.avgHealth));

    for (const child of [...this.taskStack.children]) this.taskStack.removeControl(child);

    if (hasActiveJob) {
      this.statusText.text = 'Work order already assigned here. Inspect the condition and move on unless priorities have changed.';
      this.statusText.color = UI_THEME.colors.text.warning;
    } else {
      this.statusText.text = this.activeRecommendationTask
        ? `Quick assign: ${TASK_LABELS[this.activeRecommendationTask]} is the best next move here.`
        : 'Quick assign: choose the work you already intend to dispatch.';
      this.statusText.color = UI_THEME.colors.text.secondary;

      const validTasks: JobTaskType[] = (['mow', 'water', 'fertilize', 'rake'] as JobTaskType[])
        .filter(t => isTaskValidForTerrain(t, region.terrainCode));

      const btnW = Math.floor((270 - 6 * (validTasks.length - 1)) / validTasks.length);

      for (const task of validTasks) {
        const btn = createActionButton({
          id: `task_${task}`,
          label: TASK_LABELS[task],
          tone: task === this.activeRecommendationTask ? 'primary' : 'neutral',
          width: btnW,
          height: 32,
          fontSize: 11,
          onClick: () => {
            if (this.activeRegion) {
              this.callbacks.onAssignTask(this.activeRegion, task);
            }
            this.hide();
          },
        });
        btn.paddingRight = '2px';
        if (task === this.activeRecommendationTask) {
          btn.color = UI_THEME.colors.text.primary;
        }
        this.taskStack.addControl(btn);
      }
    }

    this.panel.isVisible = true;
  }

  public hide(): void {
    if (this.panel) this.panel.isVisible = false;
    this.activeRegion = null;
  }

  public isVisible(): boolean {
    return this.panel?.isVisible ?? false;
  }

  public dispose(): void {
    if (this.panel) this.advancedTexture.removeControl(this.panel);
  }
}

function getValueColor(value: number): string {
  if (value >= 70) return UI_THEME.colors.text.success;
  if (value >= 40) return UI_THEME.colors.text.warning;
  return UI_THEME.colors.text.danger;
}

function describeRegionIntent(
  region: NamedRegion,
  stats: RegionStats,
  hasActiveJob: boolean
): { condition: string; recommendation: string; recommendedTask: JobTaskType | null } {
  if (hasActiveJob) {
    return {
      condition: 'Work is already underway',
      recommendation: 'This region already has a job assigned. Use this card to confirm context, then keep dispatching elsewhere.',
      recommendedTask: null,
    };
  }

  if (region.terrainCode === 3) {
    return {
      condition: 'Bunker maintenance tool',
      recommendation: 'Bunkers are usually intentional spot work. If the sand looks off, dispatch a rake crew immediately.',
      recommendedTask: 'rake',
    };
  }

  const needs = [
    { task: 'water' as JobTaskType, deficit: 55 - stats.avgMoisture },
    { task: 'fertilize' as JobTaskType, deficit: 60 - stats.avgNutrients },
    { task: 'mow' as JobTaskType, deficit: stats.avgGrassHeight - 65 },
  ].sort((a, b) => b.deficit - a.deficit);

  const topNeed = needs[0];
  if (stats.avgHealth < 45) {
    return {
      condition: 'This turf is in visible trouble',
      recommendation: topNeed.task === 'water'
        ? 'Moisture is the main problem. Dispatch watering first before worrying about presentation.'
        : topNeed.task === 'fertilize'
          ? 'Nutrient support is the main issue. Feed this region before chasing cosmetic improvements.'
          : 'The grass is overgrown and unhealthy. Cut it back to stabilize playability and recovery.',
      recommendedTask: topNeed.task,
    };
  }

  if (topNeed.task === 'water' && topNeed.deficit > 0) {
    return {
      condition: 'Playable, but drying out',
      recommendation: 'If you already came here thinking “water this,” you are probably right. Moisture is the limiting factor now.',
      recommendedTask: 'water',
    };
  }

  if (topNeed.task === 'fertilize' && topNeed.deficit > 0) {
    return {
      condition: 'Holding shape, lacking support',
      recommendation: 'Nutrients are trailing the other turf metrics. Fertilize if you want this area to recover and stay strong.',
      recommendedTask: 'fertilize',
    };
  }

  if (topNeed.task === 'mow' && topNeed.deficit > 0) {
    return {
      condition: 'Healthy enough, needs presentation',
      recommendation: 'This looks more like a grooming decision than an emergency. Mow it now if appearance or pace of play matters.',
      recommendedTask: 'mow',
    };
  }

  return {
    condition: 'Stable region, no urgent issue',
    recommendation: 'Nothing here is screaming for intervention. Only assign work if it supports the plan you already have in mind.',
    recommendedTask: 'mow',
  };
}
