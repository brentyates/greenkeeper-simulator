import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import {
  createOverlayPopup,
  createPopupHeader,
  createSectionDivider,
  createActionButton,
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

const POPUP_W = 360;
const CONTENT_W = POPUP_W - 32;

const TASK_LABELS: Record<JobTaskType, string> = {
  mow: '🌿 Mow',
  water: '💧 Water',
  fertilize: '🧪 Fertilize',
  rake: '⛱ Rake',
};

function isTaskValidForTerrain(taskType: JobTaskType, terrainCode: number): boolean {
  if (taskType === 'rake') return terrainCode === 3;
  return terrainCode === 0 || terrainCode === 1 || terrainCode === 2 || terrainCode === 5;
}

export class RegionInfoPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: RegionInfoPanelCallbacks;
  private overlay: Rectangle | null = null;
  private nameText: TextBlock | null = null;
  private terrainText: TextBlock | null = null;
  private statsGrid: Grid | null = null;
  private statsContainer: Rectangle | null = null;
  private taskStack: StackPanel | null = null;
  private taskContainer: Rectangle | null = null;
  private activeRegion: NamedRegion | null = null;
  private statusText: TextBlock | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: RegionInfoPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'regionInfo',
      width: POPUP_W,
      height: 380,
      colors: POPUP_COLORS.green,
      padding: 16,
    });
    this.overlay = overlay;

    createPopupHeader(stack, {
      title: '📍 REGION INFO',
      width: CONTENT_W,
      onClose: () => { this.hide(); this.callbacks.onClose(); },
    });

    this.nameText = new TextBlock('regionName');
    this.nameText.color = UI_THEME.colors.legacy.c_ffcc00;
    this.nameText.fontSize = 18;
    this.nameText.fontWeight = 'bold';
    this.nameText.height = '28px';
    this.nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(this.nameText);

    this.terrainText = new TextBlock('terrainType');
    this.terrainText.color = UI_THEME.colors.text.secondary;
    this.terrainText.fontSize = 12;
    this.terrainText.height = '20px';
    this.terrainText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(this.terrainText);

    this.statsContainer = new Rectangle('statsContainer');
    this.statsContainer.height = '100px';
    this.statsContainer.width = `${CONTENT_W}px`;
    this.statsContainer.cornerRadius = 6;
    this.statsContainer.background = UI_THEME.colors.surfaces.section;
    this.statsContainer.thickness = 1;
    this.statsContainer.color = UI_THEME.colors.border.default;
    this.statsContainer.paddingTop = '6px';
    stack.addControl(this.statsContainer);

    this.statsGrid = new Grid('statsGrid');
    this.statsGrid.width = `${CONTENT_W - 16}px`;
    this.statsGrid.height = '88px';
    this.statsGrid.addColumnDefinition(0.55);
    this.statsGrid.addColumnDefinition(0.45);
    this.statsGrid.addRowDefinition(22, true);
    this.statsGrid.addRowDefinition(22, true);
    this.statsGrid.addRowDefinition(22, true);
    this.statsGrid.addRowDefinition(22, true);
    this.statsContainer.addControl(this.statsGrid);

    createSectionDivider(stack, 'ASSIGN TASK', CONTENT_W);

    this.statusText = new TextBlock('statusText');
    this.statusText.color = UI_THEME.colors.text.secondary;
    this.statusText.fontSize = 11;
    this.statusText.height = '18px';
    this.statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(this.statusText);

    this.taskContainer = new Rectangle('taskContainer');
    this.taskContainer.height = '44px';
    this.taskContainer.width = `${CONTENT_W}px`;
    this.taskContainer.thickness = 0;
    this.taskContainer.paddingTop = '4px';
    stack.addControl(this.taskContainer);

    this.taskStack = new StackPanel('taskBtns');
    this.taskStack.isVertical = false;
    this.taskStack.height = '40px';
    this.taskContainer.addControl(this.taskStack);
  }

  private addStatCell(row: number, col: number, text: string, color?: string): void {
    if (!this.statsGrid) return;
    const tb = new TextBlock();
    tb.text = text;
    tb.color = color ?? '#aaaaaa';
    tb.fontSize = 11;
    tb.textHorizontalAlignment = col === 0 ? Control.HORIZONTAL_ALIGNMENT_LEFT : Control.HORIZONTAL_ALIGNMENT_RIGHT;
    tb.paddingLeft = '8px';
    tb.paddingRight = '8px';
    this.statsGrid.addControl(tb, row, col);
  }

  public show(region: NamedRegion, stats: RegionStats, hasActiveJob: boolean): void {
    if (!this.overlay || !this.nameText || !this.terrainText || !this.statsGrid || !this.taskStack || !this.statusText) return;

    this.activeRegion = region;
    this.nameText.text = region.name;

    const terrainName = getTerrainDisplayName(getTerrainType(region.terrainCode));
    this.terrainText.text = `${terrainName} · Hole ${region.holeNumber} · ${region.faceIds.length} tiles`;

    for (const child of [...this.statsGrid.children]) this.statsGrid.removeControl(child);

    const healthColor = stats.avgHealth >= 70 ? '#44ff44' : stats.avgHealth >= 40 ? '#ffaa44' : '#ff4444';
    this.addStatCell(0, 0, '🌿 Grass Height');
    this.addStatCell(0, 1, `${stats.avgGrassHeight.toFixed(0)}%`);
    this.addStatCell(1, 0, '💧 Moisture');
    this.addStatCell(1, 1, `${stats.avgMoisture.toFixed(0)}%`);
    this.addStatCell(2, 0, '🧪 Nutrients');
    this.addStatCell(2, 1, `${stats.avgNutrients.toFixed(0)}%`);
    this.addStatCell(3, 0, '❤️ Health');
    this.addStatCell(3, 1, `${stats.avgHealth.toFixed(0)}%`, healthColor);

    for (const child of [...this.taskStack.children]) this.taskStack.removeControl(child);

    if (hasActiveJob) {
      this.statusText.text = 'Job in progress on this region';
      this.statusText.color = '#ffaa44';
    } else {
      this.statusText.text = 'Select a maintenance task:';
      this.statusText.color = UI_THEME.colors.text.secondary;

      const validTasks: JobTaskType[] = (['mow', 'water', 'fertilize', 'rake'] as JobTaskType[])
        .filter(t => isTaskValidForTerrain(t, region.terrainCode));

      const btnW = Math.floor((CONTENT_W - 8 * (validTasks.length - 1)) / validTasks.length);

      for (const task of validTasks) {
        const btn = createActionButton({
          id: `task_${task}`,
          label: TASK_LABELS[task],
          tone: 'primary',
          width: btnW,
          height: 36,
          fontSize: 13,
          onClick: () => {
            if (this.activeRegion) {
              this.callbacks.onAssignTask(this.activeRegion, task);
            }
            this.hide();
          },
        });
        btn.paddingRight = '4px';
        this.taskStack.addControl(btn);
      }
    }

    this.overlay.isVisible = true;
  }

  public hide(): void {
    if (this.overlay) this.overlay.isVisible = false;
    this.activeRegion = null;
  }

  public isVisible(): boolean {
    return this.overlay?.isVisible ?? false;
  }

  public dispose(): void {
    if (this.overlay) this.advancedTexture.removeControl(this.overlay);
  }
}
