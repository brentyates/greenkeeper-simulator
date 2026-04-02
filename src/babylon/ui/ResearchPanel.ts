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
import { uiAutomationBridge } from '../../automation/UIAutomationBridge';

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

function getResearchRecommendation(state: ResearchState): string {
  if (state.currentResearch) {
    const item = RESEARCH_ITEMS.find((entry) => entry.id === state.currentResearch?.itemId);
    return item
      ? `Recommendation: keep ${item.name} funded until it lands unless cash becomes the bigger problem.`
      : 'Recommendation: keep active research funded unless cash pressure forces a pause.';
  }

  const completed = new Set(state.completedResearch);
  if (!completed.has('basic_sprinkler')) {
    return 'Recommendation: irrigation research is the best early unlock when turf quality is fragile.';
  }
  if (!completed.has('employee_training_1')) {
    return 'Recommendation: training improves recurring upkeep and is a strong next management unlock.';
  }
  if (!completed.has('riding_mower_basic')) {
    return 'Recommendation: mower upgrades help when coverage is stretched and labor starts to bottleneck.';
  }
  return 'Recommendation: pick the next unlock that removes your current bottleneck: quality, staff efficiency, or automation.';
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

const RESEARCH_DIALOG_WIDTH = 456;
const RESEARCH_DIALOG_HEIGHT = 536;
const RESEARCH_CONTENT_WIDTH = 432;
const RESEARCH_SCROLL_WIDTH = 416;

export class ResearchPanel {
  private advancedTexture: AdvancedDynamicTexture;
  private callbacks: ResearchPanelCallbacks;

  private panel: Rectangle | null = null;
  private researchListContainer: StackPanel | null = null;
  private currentResearchText: TextBlock | null = null;
  private progressBar: Rectangle | null = null;
  private progressFill: Rectangle | null = null;
  private progressText: TextBlock | null = null;
  private recommendationText: TextBlock | null = null;
  private fundingText: TextBlock | null = null;
  private costText: TextBlock | null = null;
  private fundingButtons: Map<FundingLevel, Button> = new Map();
  private categoryButtons: Map<ResearchCategory, Button> = new Map();
  private mainCloseButton: Button | null = null;
  private researchActionButtons: Map<string, Button> = new Map();

  private selectedCategory: ResearchCategory | null = null;

  constructor(advancedTexture: AdvancedDynamicTexture, callbacks: ResearchPanelCallbacks) {
    this.advancedTexture = advancedTexture;
    this.callbacks = callbacks;
    this.createPanel();
  }

  private createPanel(): void {
    const { panel, stack } = createDirectPopup(this.advancedTexture, {
      name: 'research',
      width: RESEARCH_DIALOG_WIDTH,
      height: RESEARCH_DIALOG_HEIGHT,
      colors: POPUP_COLORS.green,
      padding: 12,
    });

    this.panel = panel;

    createPopupHeader(stack, {
      title: '🔬 RESEARCH LAB',
      width: RESEARCH_CONTENT_WIDTH,
      onClose: () => this.callbacks.onClose(),
      onCloseButtonCreated: (button) => {
        this.mainCloseButton = button;
      },
    });
    this.createCurrentResearchSection(stack);
    this.createFundingControls(stack);
    this.createCategoryTabs(stack);
    this.createResearchList(stack);
  }

  private createCurrentResearchSection(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'currentResearchContainer',
      width: RESEARCH_CONTENT_WIDTH,
      height: 102,
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
    this.currentResearchText.color = UI_THEME.colors.text.primary;
    this.currentResearchText.fontSize = UI_THEME.typography.scale.s12;
    this.currentResearchText.width = '260px';
    this.currentResearchText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(this.currentResearchText);

    this.progressBar = new Rectangle('progressBar');
    this.progressBar.width = '404px';
    this.progressBar.height = '16px';
    this.progressBar.cornerRadius = UI_THEME.radii.scale.r3;
    this.progressBar.background = UI_THEME.colors.surfaces.panelInset;
    this.progressBar.color = UI_THEME.colors.border.muted;
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
    this.progressText.color = UI_THEME.colors.text.primary;
    this.progressText.fontSize = UI_THEME.typography.scale.s10;
    this.progressBar.addControl(this.progressText);

    this.recommendationText = new TextBlock('researchRecommendation');
    this.recommendationText.text = 'Recommendation: open with irrigation or training so early course quality is easier to protect.';
    this.recommendationText.color = UI_THEME.colors.text.info;
    this.recommendationText.fontSize = UI_THEME.typography.scale.s10;
    this.recommendationText.height = '24px';
    this.recommendationText.paddingTop = '6px';
    this.recommendationText.textWrapping = true;
    this.recommendationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.recommendationText);
  }

  private createFundingControls(parent: StackPanel): void {
    const container = createPanelSection(parent, {
      name: 'fundingContainer',
      width: RESEARCH_CONTENT_WIDTH,
      height: 56,
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
    this.fundingText.color = UI_THEME.colors.text.primary;
    this.fundingText.fontSize = UI_THEME.typography.scale.s11;
    this.fundingText.width = '60px';
    this.fundingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelRow.addControl(this.fundingText);

    this.costText = new TextBlock('costText');
    this.costText.text = '($150/min)';
    this.costText.color = UI_THEME.colors.text.warning;
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
        width: 92,
        height: 24,
        fontSize: 10,
        style: {
          selectedBackground: UI_THEME.colors.action.primary.normal,
          selectedColor: UI_THEME.colors.text.primary,
          unselectedBackground: UI_THEME.colors.action.neutral.normal,
          unselectedColor: UI_THEME.colors.text.secondary,
          hoverBackground: UI_THEME.colors.action.neutral.hover,
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
      width: RESEARCH_CONTENT_WIDTH,
      height: 38,
      theme: 'neutral',
      thickness: 0,
      cornerRadius: 0,
      paddingTop: 6,
      scroll: {
        name: 'categoryScroll',
        width: RESEARCH_CONTENT_WIDTH,
        height: 38,
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
    tabRow.height = '30px';
    container.addControl(tabRow);

    const categories: ResearchCategory[] = ['equipment', 'fertilizers', 'irrigation', 'landscaping', 'facilities', 'management', 'robotics'];

    categories.forEach((cat) => {
      const btn = createSelectableButton({
        id: `cat_${cat}`,
        label: `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`,
        width: 96,
        height: 28,
        fontSize: 9,
        style: {
          selectedBackground: UI_THEME.colors.action.primary.normal,
          selectedColor: UI_THEME.colors.text.primary,
          unselectedBackground: UI_THEME.colors.action.neutral.normal,
          unselectedColor: CATEGORY_COLORS[cat],
          hoverBackground: UI_THEME.colors.action.neutral.hover,
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
      width: RESEARCH_CONTENT_WIDTH,
      height: 288,
      theme: 'green',
      paddingTop: 6,
      scroll: {
        name: 'researchScroll',
        width: RESEARCH_SCROLL_WIDTH,
        height: 276,
        contentName: 'researchListStack',
        contentWidth: '100%',
        options: {
          barSize: 8,
          barColor: UI_THEME.colors.border.strong,
          barBackground: UI_THEME.colors.surfaces.panelInset,
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
      width: 392,
      height: 66,
      background: isCompleted ? 'rgba(40, 90, 55, 0.72)' :
                  isLocked ? 'rgba(40, 40, 40, 0.6)' :
                  isResearching ? 'rgba(60, 90, 70, 0.76)' :
                  UI_THEME.colors.surfaces.sectionAlt,
      borderColor: isResearching ? UI_THEME.colors.text.success : UI_THEME.colors.border.default,
    });

    if (!isLocked && !isCompleted) {
      row.onPointerEnterObservable.add(() => {
        row.background = UI_THEME.colors.surfaces.section;
      });
      row.onPointerOutObservable.add(() => {
        row.background = isResearching ? 'rgba(60, 90, 70, 0.76)' : UI_THEME.colors.surfaces.sectionAlt;
      });
    }

    const grid = new Grid('researchRowGrid');
    grid.addColumnDefinition(35, true);
    grid.addColumnDefinition(230, true);
    grid.addColumnDefinition(62, true);
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
    nameText.color = isLocked ? UI_THEME.colors.text.muted : isCompleted ? UI_THEME.colors.text.success : UI_THEME.colors.text.primary;
    nameText.fontSize = UI_THEME.typography.scale.s11;
    nameText.height = '15px';
    nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(nameText);

    const descText = new TextBlock('researchDesc');
    descText.text = item.description.substring(0, 42) + (item.description.length > 42 ? '...' : '');
    descText.color = UI_THEME.colors.text.secondary;
    descText.fontSize = UI_THEME.typography.scale.s9;
    descText.height = '12px';
    descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    infoStack.addControl(descText);

    if (isResearching && progress > 0) {
      const miniProgress = new Rectangle('miniProgress');
      miniProgress.width = '208px';
      miniProgress.height = '8px';
      miniProgress.cornerRadius = UI_THEME.radii.scale.r2;
      miniProgress.background = UI_THEME.colors.surfaces.panelInset;
      miniProgress.thickness = 0;
      miniProgress.paddingTop = '4px';
      miniProgress.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      infoStack.addControl(miniProgress);

      const miniFill = new Rectangle('miniFill');
      miniFill.width = `${progress}%`;
      miniFill.height = '100%';
      miniFill.background = UI_THEME.colors.action.primary.normal;
      miniFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      miniProgress.addControl(miniFill);
    }

    const costText = new TextBlock('researchCost');
    costText.text = isCompleted ? '✓' : `${item.baseCost}`;
    costText.color = isCompleted ? UI_THEME.colors.text.success : isLocked ? UI_THEME.colors.text.muted : UI_THEME.colors.text.warning;
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
      this.researchActionButtons.set(`start.${item.id}`, startBtn);
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
      this.researchActionButtons.set(`cancel.${item.id}`, cancelBtn);
    }

    return row;
  }

  public update(state: ResearchState): void {
    if (!this.researchListContainer || !this.currentResearchText || !this.progressFill || !this.progressText || !this.fundingText || !this.costText || !this.recommendationText) return;

    const children = [...this.researchListContainer.children];
    for (const child of children) {
      this.researchListContainer.removeControl(child);
    }
    this.researchActionButtons.clear();

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
    this.recommendationText.text = getResearchRecommendation(state);

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
    this.syncAutomationControls();
  }

  public show(): void {
    if (this.panel) {
      this.panel.isVisible = true;
      this.syncAutomationControls();
    }
  }

  public hide(): void {
    if (this.panel) {
      this.panel.isVisible = false;
    }
    this.syncAutomationControls();
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
    uiAutomationBridge.unregisterPrefix('panel.research.');
    if (this.panel) {
      this.advancedTexture.removeControl(this.panel);
    }
  }

  private syncAutomationControls(): void {
    uiAutomationBridge.unregisterPrefix('panel.research.');

    uiAutomationBridge.register({
      id: 'panel.research.close',
      label: 'Close Research Panel',
      role: 'button',
      getControl: () => this.mainCloseButton,
      isVisible: () => this.panel?.isVisible ?? false,
      isEnabled: () => this.mainCloseButton?.isEnabled ?? false,
      onActivate: () => this.callbacks.onClose(),
    });

    for (const [level, button] of this.fundingButtons) {
      uiAutomationBridge.register({
        id: `panel.research.funding.${level}`,
        label: `Set Research Funding ${level}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => this.callbacks.onSetFunding(level),
      });
    }

    for (const [category, button] of this.categoryButtons) {
      uiAutomationBridge.register({
        id: `panel.research.category.${category}`,
        label: `Toggle Research Category ${category}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => {
          this.selectedCategory = this.selectedCategory === category ? null : category;
          this.refreshCategoryButtons();
          this.syncAutomationControls();
        },
      });
    }

    for (const [actionId, button] of this.researchActionButtons) {
      uiAutomationBridge.register({
        id: `panel.research.${actionId}`,
        label: `Research Action ${actionId}`,
        role: 'button',
        getControl: () => button,
        isVisible: () => this.panel?.isVisible ?? false,
        isEnabled: () => button.isEnabled,
        onActivate: () => button.onPointerClickObservable.notifyObservers(null as never),
      });
    }
  }
}
