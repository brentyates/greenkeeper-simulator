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

const PANEL_W = 240;
const CONTENT_W = PANEL_W - 24;

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
  private statsGrid: Grid | null = null;
  private taskStack: StackPanel | null = null;
  private activeRegion: NamedRegion | null = null;
  private statusText: TextBlock | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: RegionInfoPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDockedPanel(this.advancedTexture, {
      name: 'regionInfo',
      width: PANEL_W,
      height: 310,
      colors: POPUP_COLORS.green,
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
      verticalAlignment: Control.VERTICAL_ALIGNMENT_CENTER,
      left: 8,
      padding: 12,
    });
    this.panel = panel;

    this.nameText = new TextBlock('regionName');
    this.nameText.color = UI_THEME.colors.legacy.c_ffcc00;
    this.nameText.fontSize = 15;
    this.nameText.fontWeight = 'bold';
    this.nameText.height = '22px';
    this.nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.nameText);

    this.terrainText = new TextBlock('terrainType');
    this.terrainText.color = UI_THEME.colors.text.secondary;
    this.terrainText.fontSize = 10;
    this.terrainText.height = '16px';
    this.terrainText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.terrainText);

    this.statsGrid = new Grid('statsGrid');
    this.statsGrid.width = `${CONTENT_W}px`;
    this.statsGrid.height = '96px';
    this.statsGrid.paddingTop = '6px';
    this.statsGrid.addColumnDefinition(0.6);
    this.statsGrid.addColumnDefinition(0.4);
    this.statsGrid.addRowDefinition(24, true);
    this.statsGrid.addRowDefinition(24, true);
    this.statsGrid.addRowDefinition(24, true);
    this.statsGrid.addRowDefinition(24, true);
    stack.addControl(this.statsGrid);

    this.statusText = new TextBlock('statusText');
    this.statusText.color = UI_THEME.colors.text.secondary;
    this.statusText.fontSize = 10;
    this.statusText.height = '18px';
    this.statusText.paddingTop = '4px';
    this.statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.statusText);

    this.taskStack = new StackPanel('taskBtns');
    this.taskStack.isVertical = false;
    this.taskStack.height = '34px';
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
    tb.color = color ?? '#aaaaaa';
    tb.fontSize = 11;
    tb.textHorizontalAlignment = col === 0 ? Control.HORIZONTAL_ALIGNMENT_LEFT : Control.HORIZONTAL_ALIGNMENT_RIGHT;
    tb.paddingLeft = '2px';
    tb.paddingRight = '2px';
    this.statsGrid.addControl(tb, row, col);
  }

  public show(region: NamedRegion, stats: RegionStats, hasActiveJob: boolean): void {
    if (!this.panel || !this.nameText || !this.terrainText || !this.statsGrid || !this.taskStack || !this.statusText) return;

    this.activeRegion = region;
    this.nameText.text = region.name;

    const terrainName = getTerrainDisplayName(getTerrainType(region.terrainCode));
    this.terrainText.text = `${terrainName} · Hole ${region.holeNumber} · ${region.faceIds.length} tiles`;

    for (const child of [...this.statsGrid.children]) this.statsGrid.removeControl(child);

    const healthColor = stats.avgHealth >= 70 ? '#44ff44' : stats.avgHealth >= 40 ? '#ffaa44' : '#ff4444';
    this.addStatCell(0, 0, '🌿 Grass');
    this.addStatCell(0, 1, `${stats.avgGrassHeight.toFixed(0)}%`);
    this.addStatCell(1, 0, '💧 Moisture');
    this.addStatCell(1, 1, `${stats.avgMoisture.toFixed(0)}%`);
    this.addStatCell(2, 0, '🧪 Nutrients');
    this.addStatCell(2, 1, `${stats.avgNutrients.toFixed(0)}%`);
    this.addStatCell(3, 0, '❤️ Health');
    this.addStatCell(3, 1, `${stats.avgHealth.toFixed(0)}%`, healthColor);

    for (const child of [...this.taskStack.children]) this.taskStack.removeControl(child);

    if (hasActiveJob) {
      this.statusText.text = 'Job in progress';
      this.statusText.color = '#ffaa44';
    } else {
      this.statusText.text = 'Assign task:';
      this.statusText.color = UI_THEME.colors.text.secondary;

      const validTasks: JobTaskType[] = (['mow', 'water', 'fertilize', 'rake'] as JobTaskType[])
        .filter(t => isTaskValidForTerrain(t, region.terrainCode));

      const btnW = Math.floor((CONTENT_W - 4 * (validTasks.length - 1)) / validTasks.length);

      for (const task of validTasks) {
        const btn = createActionButton({
          id: `task_${task}`,
          label: TASK_LABELS[task],
          tone: 'primary',
          width: btnW,
          height: 30,
          fontSize: 11,
          onClick: () => {
            if (this.activeRegion) {
              this.callbacks.onAssignTask(this.activeRegion, task);
            }
            this.hide();
          },
        });
        btn.paddingRight = '2px';
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
