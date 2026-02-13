import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';
import {
  createActionButton,
  createDirectPopup,
  createListRowCard,
  createPanelSection,
  createPopupHeader,
  createSelectableButton,
  POPUP_COLORS,
  setSelectableButtonState,
} from './PopupUtils';
import { addDialogScrollBlock, addDialogSectionLabel } from './DialogBlueprint';
import { UI_THEME } from './UITheme';

import {
  ResearchState,
  ResearchItem,
  ResearchCategory,
  ResearchStatus,
  FundingLevel,
  FUNDING_COST_PER_MINUTE,
  FUNDING_POINTS_PER_MINUTE,
  CATEGORY_COLORS,
  RESEARCH_ITEMS,
  getResearchStatus,
  getResearchProgress,
} from '../../core/research';

export interface ResearchPanelCallbacks {
  onStartResearch: (itemId: string) => void;
  onQueueResearch: (itemId: string) => void;
  onCancelResearch: () => void;
  onSetFunding: (level: FundingLevel) => void;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<ResearchCategory, string> = {
  equipment: '🔧',
  fertilizers: '🧪',
  irrigation: '💧',
  landscaping: '🌳',
  facilities: '🏢',
  management: '📊',
  robotics: '🤖',
};

const CATEGORY_LABELS: Record<ResearchCategory, string> = {
  equipment: 'Equipment',
  fertilizers: 'Fertilizers',
  irrigation: 'Irrigation',
  landscaping: 'Landscaping',
  facilities: 'Facilities',
  management: 'Management',
  robotics: 'Robotics',
};

const FUNDING_LABELS: Record<FundingLevel, string> = {
  none: 'None',
  minimum: 'Minimum',
  normal: 'Normal',
  maximum: 'Maximum',
};

export class ResearchPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: ResearchPanelCallbacks;

  private panel: Rectangle | null = null;
  private researchListContainer: StackPanel | null = null;
  private currentResearchText: TextBlock | null = null;
  private progressBar: Rectangle | null = null;
  private progressFill: Rectangle | null = null;
  private progressText: TextBlock | null = null;
  private fundingText: TextBlock | null = null;
  private costText: TextBlock | null = null;
  private fundingButtons: Map<FundingLevel, Button> = new Map();
  private categoryButtons: Map<ResearchCategory, Button> = new Map();

  private selectedCategory: ResearchCategory | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: ResearchPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDirectPopup(this.advancedTexture, {
      name: 'research',
      width: 420,
      height: 500,
      colors: POPUP_COLORS.green,
      padding: 12,
    });

    this.panel = panel;

    createPopupHeader(stack, {
      title: '🔬 RESEARCH LAB',
      width: 396,
      onClose: () => this.callbacks.onClose(),
    });
    this.createCurrentResearchSection(stack);
    this.createFundingControls(stack);
    this.createCategoryTabs(stack);
    this.createResearchList(stack);
  }

  private createCurrentResearchSection(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'currentResearchContainer',
      width: 396,
      height: 70,
      theme: 'green',
      paddingTop: 8,
    });

    const stack = new StackPanel('currentStack');
    stack.paddingTop = '8px';
    stack.paddingLeft = '10px';
    container.addControl(stack);

    const titleRow = new StackPanel('titleRow');
    titleRow.isVertical = false;
    titleRow.height = '18px';
    stack.addControl(titleRow);

    const label = addDialogSectionLabel(titleRow, {
      id: 'currentLabel',
      text: 'Current Research:',
      tone: 'muted',
      fontSize: 10,
      height: 18,
    });
    label.width = '100px';

    this.currentResearchText = new TextBlock('currentResearchText');
    this.currentResearchText.text = 'None';
    this.currentResearchText.color = UI_THEME.colors.legacy.c_ffffff;
    this.currentResearchText.fontSize = UI_THEME.typography.scale.s12;
    this.currentResearchText.width = '260px';
    this.currentResearchText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(this.currentResearchText);

    this.progressBar = new Rectangle('progressBar');
    this.progressBar.width = '370px';
    this.progressBar.height = '16px';
    this.progressBar.cornerRadius = UI_THEME.radii.scale.r3;
    this.progressBar.background = UI_THEME.colors.legacy.c_1a3a2a;
    this.progressBar.color = UI_THEME.colors.legacy.c_3a5a4a;
    this.progressBar.thickness = 1;
    this.progressBar.paddingTop = '6px';
    stack.addControl(this.progressBar);

    this.progressFill = new Rectangle('progressFill');
    this.progressFill.width = '0%';
    this.progressFill.height = '100%';
    this.progressFill.background = UI_THEME.colors.legacy.c_44aa44;
    this.progressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.progressBar.addControl(this.progressFill);

    this.progressText = new TextBlock('progressText');
    this.progressText.text = '0 / 0';
    this.progressText.color = UI_THEME.colors.legacy.c_ffffff;
    this.progressText.fontSize = UI_THEME.typography.scale.s10;
    this.progressBar.addControl(this.progressText);
  }

  private createFundingControls(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'fundingContainer',
      width: 396,
      height: 50,
      theme: 'green',
      paddingTop: 6,
    });

    const grid = new Grid('fundingGrid');
    grid.addRowDefinition(0.4);
    grid.addRowDefinition(0.6);
    container.addControl(grid);

    const labelRow = new StackPanel('labelRow');
    labelRow.isVertical = false;
    labelRow.paddingLeft = '10px';
    grid.addControl(labelRow, 0, 0);

    const fundingLabel = addDialogSectionLabel(labelRow, {
      id: 'fundingLabel',
      text: 'Funding Level:',
      tone: 'muted',
      fontSize: 10,
      height: 18,
    });
    fundingLabel.width = '80px';

    this.fundingText = new TextBlock('fundingText');
    this.fundingText.text = 'Normal';
    this.fundingText.color = UI_THEME.colors.legacy.c_ffffff;
    this.fundingText.fontSize = UI_THEME.typography.scale.s11;
    this.fundingText.width = '60px';
    this.fundingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelRow.addControl(this.fundingText);

    this.costText = new TextBlock('costText');
    this.costText.text = '($150/min)';
    this.costText.color = UI_THEME.colors.legacy.c_ff8844;
    this.costText.fontSize = UI_THEME.typography.scale.s10;
    this.costText.width = '80px';
    this.costText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelRow.addControl(this.costText);

    const buttonRow = new Grid('buttonRow');
    buttonRow.paddingLeft = '10px';
    buttonRow.addColumnDefinition(0.25);
    buttonRow.addColumnDefinition(0.25);
    buttonRow.addColumnDefinition(0.25);
    buttonRow.addColumnDefinition(0.25);
    grid.addControl(buttonRow, 1, 0);

    const levels: FundingLevel[] = ['none', 'minimum', 'normal', 'maximum'];
    levels.forEach((level, idx) => {
      const btn = createSelectableButton({
        id: `funding_${level}`,
        label: FUNDING_LABELS[level],
        width: 85,
        height: 22,
        fontSize: 10,
        style: {
          selectedBackground: '#4a8a5a',
          selectedColor: '#ffffff',
          unselectedBackground: '#3a5a4a',
          unselectedColor: '#aaaaaa',
          hoverBackground: '#4a6a5a',
        },
        onClick: () => this.callbacks.onSetFunding(level),
      });
      this.fundingButtons.set(level, btn);
      buttonRow.addControl(btn, 0, idx);
    });
  }

  private createCategoryTabs(parent: StackPanel): void {
    const { scrollViewer: container } = addDialogScrollBlock(parent, {
      id: 'categorySection',
      width: 396,
      height: 35,
      theme: 'neutral',
      thickness: 0,
      cornerRadius: 0,
      paddingTop: 6,
      scroll: {
        name: 'categoryScroll',
        width: 396,
        height: 35,
        contentName: 'categoryScrollContent',
        contentWidth: '100%',
        options: {
          barSize: 0,
        },
      },
    });
    container.barSize = 0;
    container.paddingTop = '6px';

    const tabRow = new StackPanel('tabRow');
    tabRow.isVertical = false;
    tabRow.height = '28px';
    container.addControl(tabRow);

    const categories: ResearchCategory[] = ['equipment', 'fertilizers', 'irrigation', 'landscaping', 'facilities', 'management', 'robotics'];

    categories.forEach((cat) => {
      const btn = createSelectableButton({
        id: `cat_${cat}`,
        label: `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`,
        width: 95,
        height: 26,
        fontSize: 10,
        style: {
          selectedBackground: '#3a6a5a',
          selectedColor: '#ffffff',
          unselectedBackground: '#2a4a3a',
          unselectedColor: CATEGORY_COLORS[cat],
          hoverBackground: '#345746',
        },
        onClick: () => {
          this.selectedCategory = this.selectedCategory === cat ? null : cat;
          this.refreshCategoryButtons();
        },
      });
      btn.paddingRight = '4px';
      tabRow.addControl(btn);
      this.categoryButtons.set(cat, btn);
    });
    this.refreshCategoryButtons();
  }

  private refreshCategoryButtons(): void {
    this.categoryButtons.forEach((button, category) => {
      setSelectableButtonState(button, this.selectedCategory === category);
    });
  }

  private createResearchList(parent: StackPanel): void {
    const { content } = addDialogScrollBlock(parent, {
      id: 'listContainer',
      width: 396,
      height: 280,
      theme: 'green',
      paddingTop: 6,
      scroll: {
        name: 'researchScroll',
        width: 380,
        height: 270,
        contentName: 'researchListStack',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: '#4a8a5a',
          barBackground: 'rgba(0,0,0,0.3)',
        },
      },
    });
    this.researchListContainer = content;
  }

  private createResearchRow(item: ResearchItem, status: ResearchStatus, progress: number): Rectangle {
    const isLocked = status === 'locked';
    const isCompleted = status === 'completed';
    const isResearching = status === 'researching';

    const row = createListRowCard({
      name: `research_${item.id}`,
      width: 360,
      height: 60,
      background: isCompleted ? 'rgba(40, 90, 55, 0.6)' :
                  isLocked ? 'rgba(40, 40, 40, 0.6)' :
                  isResearching ? 'rgba(60, 90, 70, 0.7)' :
                  'rgba(40, 70, 55, 0.6)',
      borderColor: isResearching ? '#88ff88' : '#3a5a4a',
    });

    if (!isLocked && !isCompleted) {
      row.onPointerEnterObservable.add(() => {
        row.background = 'rgba(50, 90, 70, 0.7)';
      });
      row.onPointerOutObservable.add(() => {
        row.background = isResearching ? 'rgba(60, 90, 70, 0.7)' : 'rgba(40, 70, 55, 0.6)';
      });
    }

    const grid = new Grid('researchRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(200, true);
    grid.addColumnDefinition(60, true);
    grid.addColumnDefinition(65, true);
    row.addControl(grid);

    const icon = new TextBlock('researchIcon');
    icon.text = CATEGORY_ICONS[item.category];
    icon.fontSize = UI_THEME.typography.scale.s16;
    icon.alpha = isLocked ? 0.4 : 1;
    grid.addControl(icon, 0, 0);

    const infoStack = new StackPanel('researchInfo');
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('researchName');
    nameText.text = item.name;
    nameText.color = isLocked ? '#666666' : isCompleted ? '#88ff88' : '#ffffff';
    nameText.fontSize = UI_THEME.typography.scale.s11;
    nameText.height = '15px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const descText = new TextBlock('researchDesc');
    descText.text = item.description.substring(0, 35) + (item.description.length > 35 ? '...' : '');
    descText.color = UI_THEME.colors.legacy.c_888888;
    descText.fontSize = UI_THEME.typography.scale.s9;
    descText.height = '12px';
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(descText);

    if (isResearching && progress > 0) {
      const miniProgress = new Rectangle('miniProgress');
      miniProgress.width = '180px';
      miniProgress.height = '8px';
      miniProgress.cornerRadius = UI_THEME.radii.scale.r2;
      miniProgress.background = UI_THEME.colors.legacy.c_1a3a2a;
      miniProgress.thickness = 0;
      miniProgress.paddingTop = '4px';
      miniProgress.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      infoStack.addControl(miniProgress);

      const miniFill = new Rectangle('miniFill');
      miniFill.width = `${progress}%`;
      miniFill.height = '100%';
      miniFill.background = UI_THEME.colors.legacy.c_44aa44;
      miniFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      miniProgress.addControl(miniFill);
    }

    const costText = new TextBlock('researchCost');
    costText.text = isCompleted ? '✓' : `${item.baseCost}`;
    costText.color = isCompleted ? '#88ff88' : isLocked ? '#666666' : '#ff8844';
    costText.fontSize = UI_THEME.typography.scale.s11;
    grid.addControl(costText, 0, 2);

    if (!isLocked && !isCompleted && !isResearching) {
      const startBtn = createActionButton({
        id: `start_${item.id}`,
        label: 'Start',
        tone: 'primary',
        width: 55,
        height: 24,
        fontSize: 10,
        onClick: () => this.callbacks.onStartResearch(item.id),
      });
      grid.addControl(startBtn, 0, 3);
    } else if (isResearching) {
      const cancelBtn = createActionButton({
        id: `cancel_${item.id}`,
        label: 'Cancel',
        tone: 'danger',
        width: 55,
        height: 24,
        fontSize: 10,
        onClick: () => this.callbacks.onCancelResearch(),
      });
      grid.addControl(cancelBtn, 0, 3);
    }

    return row;
  }

  public update(state: ResearchState): void {
    if (!this.researchListContainer || !this.currentResearchText || !this.progressFill || !this.progressText || !this.fundingText || !this.costText) return;

    const children = [...this.researchListContainer.children];
    for (const child of children) {
      this.researchListContainer.removeControl(child);
    }

    if (state.currentResearch) {
      const item = RESEARCH_ITEMS.find(i => i.id === state.currentResearch!.itemId);
      this.currentResearchText.text = item?.name ?? 'Unknown';
      const progress = getResearchProgress(state);
      this.progressFill.width = `${progress}%`;
      this.progressText.text = `${state.currentResearch.pointsEarned.toFixed(0)} / ${state.currentResearch.pointsRequired}`;
    } else {
      this.currentResearchText.text = 'None';
      this.progressFill.width = '0%';
      this.progressText.text = '0 / 0';
    }

    this.fundingText.text = FUNDING_LABELS[state.fundingLevel];
    const cost = FUNDING_COST_PER_MINUTE[state.fundingLevel];
    const points = FUNDING_POINTS_PER_MINUTE[state.fundingLevel];
    this.costText.text = cost > 0 ? `($${cost}/min, +${points}pts)` : '(free)';

    this.fundingButtons.forEach((btn, level) => {
      setSelectableButtonState(btn, level === state.fundingLevel);
    });
    this.refreshCategoryButtons();

    const itemsToShow = this.selectedCategory
      ? RESEARCH_ITEMS.filter(i => i.category === this.selectedCategory)
      : RESEARCH_ITEMS;

    const sortedItems = [...itemsToShow].sort((a, b) => {
      const statusA = getResearchStatus(state, a.id);
      const statusB = getResearchStatus(state, b.id);
      const order = { researching: 0, available: 1, locked: 2, completed: 3 };
      return (order[statusA] - order[statusB]) || (a.tier - b.tier);
    });

    for (const item of sortedItems.slice(0, 20)) {
      const status = getResearchStatus(state, item.id);
      const progress = status === 'researching' ? getResearchProgress(state) : 0;
      const row = this.createResearchRow(item, status, progress);
      this.researchListContainer.addControl(row);
    }
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
    }
  }

  public hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
  }

  public isVisible(): boolean {
    return this.panel?.isVisible ?? false;
  }

  public toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public dispose(): void {
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
    }
  }
}
