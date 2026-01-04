import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Button } from '@babylonjs/gui/2D/controls/button';

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

  private selectedCategory: ResearchCategory | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: ResearchPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    this.panel = new Rectangle('researchPanel');
    this.panel.width = '420px';
    this.panel.height = '500px';
    this.panel.cornerRadius = 8;
    this.panel.color = '#5a9a6a';
    this.panel.thickness = 2;
    this.panel.background = 'rgba(20, 45, 35, 0.95)';
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.isVisible = false;
    this.panel.isPointerBlocker = true;
    this.panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.panel.shadowBlur = 10;
    this.panel.shadowOffsetX = 3;
    this.panel.shadowOffsetY = 3;
    this.advancedTexture.addControl(this.panel);

    const stack = new StackPanel('researchStack');
    stack.width = '396px';
    stack.paddingTop = '12px';
    stack.paddingBottom = '12px';
    this.panel.addControl(stack);

    this.createHeader(stack);
    this.createCurrentResearchSection(stack);
    this.createFundingControls(stack);
    this.createCategoryTabs(stack);
    this.createResearchList(stack);
  }

  private createHeader(parent: StackPanel): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.height = '36px';
    headerContainer.width = '396px';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer);

    const title = new TextBlock('title');
    title.text = '🔬 RESEARCH LAB';
    title.color = '#ffcc00';
    title.fontSize = 16;
    title.fontWeight = 'bold';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.left = '0px';
    headerContainer.addControl(title);

    const closeBtn = Button.CreateSimpleButton('closeBtn', '✕');
    closeBtn.width = '28px';
    closeBtn.height = '28px';
    closeBtn.cornerRadius = 4;
    closeBtn.background = '#aa4444';
    closeBtn.color = 'white';
    closeBtn.thickness = 0;
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.onPointerClickObservable.add(() => this.callbacks.onClose());
    closeBtn.onPointerEnterObservable.add(() => { closeBtn.background = '#cc5555'; });
    closeBtn.onPointerOutObservable.add(() => { closeBtn.background = '#aa4444'; });
    headerContainer.addControl(closeBtn);
  }

  private createCurrentResearchSection(parent: StackPanel): void {
    const container = new Rectangle('currentResearchContainer');
    container.height = '70px';
    container.width = '396px';
    container.cornerRadius = 4;
    container.background = 'rgba(30, 60, 45, 0.8)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    container.paddingTop = '8px';
    parent.addControl(container);

    const stack = new StackPanel('currentStack');
    stack.paddingTop = '8px';
    stack.paddingLeft = '10px';
    container.addControl(stack);

    const titleRow = new StackPanel('titleRow');
    titleRow.isVertical = false;
    titleRow.height = '18px';
    stack.addControl(titleRow);

    const label = new TextBlock('currentLabel');
    label.text = 'Current Research:';
    label.color = '#888888';
    label.fontSize = 10;
    label.width = '100px';
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(label);

    this.currentResearchText = new TextBlock('currentResearchText');
    this.currentResearchText.text = 'None';
    this.currentResearchText.color = '#ffffff';
    this.currentResearchText.fontSize = 12;
    this.currentResearchText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(this.currentResearchText);

    this.progressBar = new Rectangle('progressBar');
    this.progressBar.width = '370px';
    this.progressBar.height = '16px';
    this.progressBar.cornerRadius = 3;
    this.progressBar.background = '#1a3a2a';
    this.progressBar.color = '#3a5a4a';
    this.progressBar.thickness = 1;
    this.progressBar.paddingTop = '6px';
    stack.addControl(this.progressBar);

    this.progressFill = new Rectangle('progressFill');
    this.progressFill.width = '0%';
    this.progressFill.height = '100%';
    this.progressFill.background = '#44aa44';
    this.progressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.progressBar.addControl(this.progressFill);

    this.progressText = new TextBlock('progressText');
    this.progressText.text = '0 / 0';
    this.progressText.color = '#ffffff';
    this.progressText.fontSize = 10;
    this.progressBar.addControl(this.progressText);
  }

  private createFundingControls(parent: StackPanel): void {
    const container = new Rectangle('fundingContainer');
    container.height = '50px';
    container.width = '396px';
    container.cornerRadius = 4;
    container.background = 'rgba(30, 60, 45, 0.8)';
    container.thickness = 1;
    container.color = '#3a5a4a';
    container.paddingTop = '6px';
    parent.addControl(container);

    const grid = new Grid('fundingGrid');
    grid.addRowDefinition(0.4);
    grid.addRowDefinition(0.6);
    container.addControl(grid);

    const labelRow = new StackPanel('labelRow');
    labelRow.isVertical = false;
    labelRow.paddingLeft = '10px';
    grid.addControl(labelRow, 0, 0);

    const fundingLabel = new TextBlock('fundingLabel');
    fundingLabel.text = 'Funding Level:';
    fundingLabel.color = '#888888';
    fundingLabel.fontSize = 10;
    fundingLabel.width = '80px';
    fundingLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelRow.addControl(fundingLabel);

    this.fundingText = new TextBlock('fundingText');
    this.fundingText.text = 'Normal';
    this.fundingText.color = '#ffffff';
    this.fundingText.fontSize = 11;
    this.fundingText.width = '60px';
    this.fundingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelRow.addControl(this.fundingText);

    this.costText = new TextBlock('costText');
    this.costText.text = '($150/min)';
    this.costText.color = '#ff8844';
    this.costText.fontSize = 10;
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
      const btn = Button.CreateSimpleButton(`funding_${level}`, FUNDING_LABELS[level]);
      btn.width = '85px';
      btn.height = '22px';
      btn.cornerRadius = 4;
      btn.background = '#3a5a4a';
      btn.color = '#aaaaaa';
      btn.thickness = 1;
      btn.fontSize = 10;
      btn.onPointerClickObservable.add(() => this.callbacks.onSetFunding(level));
      btn.onPointerEnterObservable.add(() => {
        if (!this.fundingButtons.get(level)?.metadata?.selected) {
          btn.background = '#4a6a5a';
        }
      });
      btn.onPointerOutObservable.add(() => {
        if (!this.fundingButtons.get(level)?.metadata?.selected) {
          btn.background = '#3a5a4a';
        }
      });
      this.fundingButtons.set(level, btn);
      buttonRow.addControl(btn, 0, idx);
    });
  }

  private createCategoryTabs(parent: StackPanel): void {
    const container = new ScrollViewer('categoryScroll');
    container.height = '35px';
    container.width = '396px';
    container.thickness = 0;
    container.barSize = 0;
    container.paddingTop = '6px';
    parent.addControl(container);

    const tabRow = new StackPanel('tabRow');
    tabRow.isVertical = false;
    tabRow.height = '28px';
    container.addControl(tabRow);

    const categories: ResearchCategory[] = ['equipment', 'fertilizers', 'irrigation', 'landscaping', 'facilities', 'management', 'robotics'];

    categories.forEach((cat) => {
      const btn = Button.CreateSimpleButton(`cat_${cat}`, `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`);
      btn.width = '95px';
      btn.height = '26px';
      btn.cornerRadius = 4;
      btn.background = '#2a4a3a';
      btn.color = CATEGORY_COLORS[cat];
      btn.thickness = 1;
      btn.fontSize = 10;
      btn.paddingRight = '4px';
      btn.onPointerClickObservable.add(() => {
        this.selectedCategory = this.selectedCategory === cat ? null : cat;
        this.refreshCategoryButtons(categories);
      });
      tabRow.addControl(btn);
    });
  }

  private refreshCategoryButtons(_categories: ResearchCategory[]): void {
    // This is called but we don't have direct references to buttons
    // For now, a full update handles this
  }

  private createResearchList(parent: StackPanel): void {
    const listContainer = new Rectangle('listContainer');
    listContainer.height = '280px';
    listContainer.width = '396px';
    listContainer.cornerRadius = 4;
    listContainer.background = 'rgba(15, 35, 25, 0.8)';
    listContainer.thickness = 1;
    listContainer.color = '#3a5a4a';
    listContainer.paddingTop = '6px';
    parent.addControl(listContainer);

    const scrollViewer = new ScrollViewer('researchScroll');
    scrollViewer.width = '380px';
    scrollViewer.height = '270px';
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 8;
    scrollViewer.barColor = '#4a8a5a';
    scrollViewer.barBackground = 'rgba(0,0,0,0.3)';
    listContainer.addControl(scrollViewer);

    this.researchListContainer = new StackPanel('researchListStack');
    this.researchListContainer.width = '100%';
    scrollViewer.addControl(this.researchListContainer);
  }

  private createResearchRow(item: ResearchItem, status: ResearchStatus, progress: number): Rectangle {
    const isLocked = status === 'locked';
    const isCompleted = status === 'completed';
    const isResearching = status === 'researching';

    const row = new Rectangle(`research_${item.id}`);
    row.height = '60px';
    row.width = '360px';
    row.cornerRadius = 4;
    row.background = isCompleted ? 'rgba(40, 90, 55, 0.6)' :
                     isLocked ? 'rgba(40, 40, 40, 0.6)' :
                     isResearching ? 'rgba(60, 90, 70, 0.7)' :
                     'rgba(40, 70, 55, 0.6)';
    row.thickness = 1;
    row.color = isResearching ? '#88ff88' : '#3a5a4a';
    row.paddingTop = '4px';
    row.paddingBottom = '4px';

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
    icon.fontSize = 16;
    icon.alpha = isLocked ? 0.4 : 1;
    grid.addControl(icon, 0, 0);

    const infoStack = new StackPanel('researchInfo');
    infoStack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(infoStack, 0, 1);

    const nameText = new TextBlock('researchName');
    nameText.text = item.name;
    nameText.color = isLocked ? '#666666' : isCompleted ? '#88ff88' : '#ffffff';
    nameText.fontSize = 11;
    nameText.height = '15px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const descText = new TextBlock('researchDesc');
    descText.text = item.description.substring(0, 35) + (item.description.length > 35 ? '...' : '');
    descText.color = '#888888';
    descText.fontSize = 9;
    descText.height = '12px';
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(descText);

    if (isResearching && progress > 0) {
      const miniProgress = new Rectangle('miniProgress');
      miniProgress.width = '180px';
      miniProgress.height = '8px';
      miniProgress.cornerRadius = 2;
      miniProgress.background = '#1a3a2a';
      miniProgress.thickness = 0;
      miniProgress.paddingTop = '4px';
      miniProgress.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      infoStack.addControl(miniProgress);

      const miniFill = new Rectangle('miniFill');
      miniFill.width = `${progress}%`;
      miniFill.height = '100%';
      miniFill.background = '#44aa44';
      miniFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      miniProgress.addControl(miniFill);
    }

    const costText = new TextBlock('researchCost');
    costText.text = isCompleted ? '✓' : `${item.baseCost}`;
    costText.color = isCompleted ? '#88ff88' : isLocked ? '#666666' : '#ff8844';
    costText.fontSize = 11;
    grid.addControl(costText, 0, 2);

    if (!isLocked && !isCompleted && !isResearching) {
      const startBtn = Button.CreateSimpleButton(`start_${item.id}`, 'Start');
      startBtn.width = '55px';
      startBtn.height = '24px';
      startBtn.cornerRadius = 4;
      startBtn.background = '#2a7a4a';
      startBtn.color = '#88ff88';
      startBtn.thickness = 1;
      startBtn.fontSize = 10;
      startBtn.onPointerClickObservable.add(() => this.callbacks.onStartResearch(item.id));
      startBtn.onPointerEnterObservable.add(() => { startBtn.background = '#3a9a5a'; });
      startBtn.onPointerOutObservable.add(() => { startBtn.background = '#2a7a4a'; });
      grid.addControl(startBtn, 0, 3);
    } else if (isResearching) {
      const cancelBtn = Button.CreateSimpleButton(`cancel_${item.id}`, 'Cancel');
      cancelBtn.width = '55px';
      cancelBtn.height = '24px';
      cancelBtn.cornerRadius = 4;
      cancelBtn.background = '#7a3a3a';
      cancelBtn.color = '#ff8888';
      cancelBtn.thickness = 1;
      cancelBtn.fontSize = 10;
      cancelBtn.onPointerClickObservable.add(() => this.callbacks.onCancelResearch());
      cancelBtn.onPointerEnterObservable.add(() => { cancelBtn.background = '#9a4a4a'; });
      cancelBtn.onPointerOutObservable.add(() => { cancelBtn.background = '#7a3a3a'; });
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
      const selected = level === state.fundingLevel;
      btn.metadata = { selected };
      btn.background = selected ? '#4a8a5a' : '#3a5a4a';
      btn.color = selected ? '#ffffff' : '#aaaaaa';
    });

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
