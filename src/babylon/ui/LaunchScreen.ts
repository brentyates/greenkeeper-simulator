import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';

import { ScenarioDefinition, SCENARIOS } from '../../data/scenarioData';
import { getProgressManager, ProgressManager } from '../../systems/ProgressManager';
import { getCourseById } from '../../data/courseData';
import { hasSave } from '../../core/save-game';
import { listCustomCourses, CustomCourseData } from '../../data/customCourseData';
import { FocusManager } from './FocusManager';
import { AccessibleButton, createAccessibleButton } from './AccessibleButton';
import { configureDialogScrollViewer } from './LayoutUtils';
import { UI_THEME } from './UITheme';
import { uiAutomationBridge } from '../../automation/UIAutomationBridge';

export interface LaunchScreenCallbacks {
  onStartScenario: (scenario: ScenarioDefinition) => void;
  onContinueScenario?: (scenario: ScenarioDefinition) => void;
  onOpenManual?: () => void;
  onOpenDesigner?: () => void;
  onPlayCustomCourse?: (course: CustomCourseData) => void;
  onEditCustomCourse?: (course: CustomCourseData) => void;
}

export class LaunchScreen {
  private advancedTexture: AdvancedDynamicTexture;
  private ownsTexture: boolean;
  private progressManager: ProgressManager;
  private callbacks: LaunchScreenCallbacks;
  private container: Rectangle;
  private selectedScenario: ScenarioDefinition | null = null;
  private scenarioCards: Map<string, Rectangle> = new Map();
  private startButton: AccessibleButton | null = null;
  private continueButton: AccessibleButton | null = null;
  private quickPlayButton: AccessibleButton | null = null;
  private guideButton: AccessibleButton | null = null;
  private focusManager: FocusManager;
  private selectionTitleText: TextBlock | null = null;
  private selectionMetaText: TextBlock | null = null;
  private selectionObjectiveText: TextBlock | null = null;

  constructor(_engine: Engine, scene: Scene, callbacks: LaunchScreenCallbacks, sharedTexture?: AdvancedDynamicTexture) {
    this.callbacks = callbacks;
    this.progressManager = getProgressManager();
    if (sharedTexture) {
      this.advancedTexture = sharedTexture;
      this.ownsTexture = false;
    } else {
      this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('LaunchScreenUI', true, scene);
      this.ownsTexture = true;
    }
    this.focusManager = new FocusManager(scene);

    this.container = new Rectangle('launchContainer');
    this.container.width = '100%';
    this.container.height = '100%';
    this.container.background = UI_THEME.colors.surfaces.launchBackdrop;
    this.container.thickness = 0;

    this.buildUI();

    // Add container to texture - LaunchScreen shows by default
    this.advancedTexture.addControl(this.container);
  }

  private buildUI(): void {
    const mainGrid = new Grid('mainGrid');
    mainGrid.width = '100%';
    mainGrid.height = '100%';
    mainGrid.paddingTop = '18px';
    mainGrid.paddingBottom = '12px';

    mainGrid.addRowDefinition(150, true);
    mainGrid.addRowDefinition(72, true);
    mainGrid.addRowDefinition(1.0);
    mainGrid.addRowDefinition(108, true);
    mainGrid.addRowDefinition(92, true);
    mainGrid.addColumnDefinition(1.0);

    this.container.addControl(mainGrid);

    this.createTitleSection(mainGrid);
    this.createScenarioSection(mainGrid);
    this.createCustomCoursesSection(mainGrid);
    this.createActionBar(mainGrid);
    this.ensureDefaultSelection();
  }

  private createTitleSection(parent: Grid): void {
    const titleContainer = new Rectangle('titleContainer');
    titleContainer.width = '100%';
    titleContainer.height = '100%';
    titleContainer.thickness = 0;
    titleContainer.background = 'transparent';
    parent.addControl(titleContainer, 0, 0);

    const heroCard = new Rectangle('launchHeroCard');
    heroCard.width = '760px';
    heroCard.height = '120px';
    heroCard.cornerRadius = UI_THEME.radii.panel;
    heroCard.background = UI_THEME.colors.surfaces.heroSoft;
    heroCard.color = UI_THEME.colors.launch.cardBorder;
    heroCard.thickness = 2;
    heroCard.shadowColor = UI_THEME.colors.effects.shadow;
    heroCard.shadowBlur = 18;
    heroCard.shadowOffsetY = 6;
    titleContainer.addControl(heroCard);

    const titleStack = new StackPanel('titleStack');
    titleStack.paddingTop = '9px';
    heroCard.addControl(titleStack);

    const eyebrow = new TextBlock('launchEyebrow');
    eyebrow.text = 'COURSE OPERATIONS SIMULATION';
    eyebrow.color = UI_THEME.colors.text.secondary;
    eyebrow.fontSize = UI_THEME.typography.scale.s11;
    eyebrow.fontFamily = UI_THEME.typography.fontFamily;
    eyebrow.height = '18px';
    titleStack.addControl(eyebrow);

    const icon = new TextBlock('gameIcon');
    icon.text = '🌿';
    icon.fontSize = UI_THEME.typography.scale.s28;
    icon.height = '34px';
    titleStack.addControl(icon);

    const title = new TextBlock('gameTitle');
    title.text = 'GREENKEEPER SIMULATOR';
    title.color = UI_THEME.colors.editor.buttonTextActive;
    title.fontSize = UI_THEME.typography.scale.s32;
    title.fontFamily = UI_THEME.typography.fontFamily;
    title.height = '38px';
    titleStack.addControl(title);

    const subtitle = new TextBlock('subtitle');
    subtitle.text = 'Master the art of course maintenance. Pick a scenario, jump into the round, or head straight to the designer.';
    subtitle.color = UI_THEME.colors.text.secondary;
    subtitle.fontSize = UI_THEME.typography.scale.s14;
    subtitle.fontFamily = UI_THEME.typography.fontFamily;
    subtitle.height = '32px';
    subtitle.textWrapping = true;
    titleStack.addControl(subtitle);
  }

  private createScenarioSection(parent: Grid): void {
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.width = '100%';
    headerContainer.height = '100%';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer, 1, 0);

    const headerStack = new StackPanel('scenarioHeaderStack');
    headerStack.paddingTop = '4px';
    headerContainer.addControl(headerStack);

    const header = new TextBlock('scenarioHeader');
    header.text = 'SELECT A SCENARIO';
    header.color = UI_THEME.colors.text.secondary;
    header.fontSize = UI_THEME.typography.scale.s14;
    header.fontFamily = UI_THEME.typography.fontFamily;
    header.height = '18px';
    headerStack.addControl(header);

    const subheader = new TextBlock('scenarioSubheader');
    subheader.text = 'Unlocked scenarios can be started immediately. Completing goals unlocks tougher contracts.';
    subheader.color = UI_THEME.colors.text.muted;
    subheader.fontSize = UI_THEME.typography.scale.s11;
    subheader.fontFamily = UI_THEME.typography.fontFamily;
    subheader.height = '18px';
    headerStack.addControl(subheader);

    const selectionPanel = new Rectangle('scenarioSelectionPanel');
    selectionPanel.width = '820px';
    selectionPanel.height = '34px';
    selectionPanel.cornerRadius = UI_THEME.radii.section;
    selectionPanel.background = UI_THEME.colors.surfaces.hudInset;
    selectionPanel.color = UI_THEME.colors.launch.cardBorder;
    selectionPanel.thickness = 1;
    selectionPanel.paddingTop = '6px';
    selectionPanel.paddingBottom = '6px';
    headerStack.addControl(selectionPanel);

    const selectionGrid = new Grid('scenarioSelectionGrid');
    selectionGrid.addColumnDefinition(0.36);
    selectionGrid.addColumnDefinition(0.28);
    selectionGrid.addColumnDefinition(0.36);
    selectionPanel.addControl(selectionGrid);

    this.selectionTitleText = new TextBlock('selectionTitle');
    this.selectionTitleText.text = 'Choose any unlocked scenario';
    this.selectionTitleText.color = UI_THEME.colors.text.primary;
    this.selectionTitleText.fontSize = UI_THEME.typography.scale.s12;
    this.selectionTitleText.fontFamily = UI_THEME.typography.fontFamily;
    this.selectionTitleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.selectionTitleText.paddingLeft = '10px';
    selectionGrid.addControl(this.selectionTitleText, 0, 0);

    this.selectionMetaText = new TextBlock('selectionMeta');
    this.selectionMetaText.text = 'Quick Play starts the best available challenge';
    this.selectionMetaText.color = UI_THEME.colors.text.secondary;
    this.selectionMetaText.fontSize = UI_THEME.typography.scale.s10;
    this.selectionMetaText.fontFamily = UI_THEME.typography.fontFamily;
    selectionGrid.addControl(this.selectionMetaText, 0, 1);

    this.selectionObjectiveText = new TextBlock('selectionObjective');
    this.selectionObjectiveText.text = 'Pick one to review its objective here';
    this.selectionObjectiveText.color = UI_THEME.colors.text.info;
    this.selectionObjectiveText.fontSize = UI_THEME.typography.scale.s10;
    this.selectionObjectiveText.fontFamily = UI_THEME.typography.fontFamily;
    this.selectionObjectiveText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.selectionObjectiveText.paddingRight = '10px';
    selectionGrid.addControl(this.selectionObjectiveText, 0, 2);

    const scrollContainer = new Rectangle('scrollContainer');
    scrollContainer.width = '100%';
    scrollContainer.height = '100%';
    scrollContainer.thickness = 0;
    scrollContainer.background = 'transparent';
    parent.addControl(scrollContainer, 2, 0);

    const scrollViewer = new ScrollViewer('scenarioScroll');
    scrollViewer.width = '95%';
    scrollViewer.height = '100%';
    configureDialogScrollViewer(scrollViewer, {
      barColor: UI_THEME.colors.border.strong,
      barBackground: UI_THEME.colors.surfaces.hudInset,
    });
    scrollContainer.addControl(scrollViewer);

    const hideHorizontalBar = () => {
      if (scrollViewer.horizontalBar) {
        scrollViewer.horizontalBar.isVisible = false;
      }
      const viewer = scrollViewer as unknown as { _horizontalBarSpace?: { isVisible: boolean } };
      if (viewer._horizontalBarSpace) {
        viewer._horizontalBarSpace.isVisible = false;
      }
    };
    scrollViewer.onAfterDrawObservable.addOnce(hideHorizontalBar);

    // Grid for scenario cards
    const grid = new Grid('scenarioGrid');
    grid.width = '100%';

    const cardsPerRow = 3;
    const numRows = Math.ceil(SCENARIOS.length / cardsPerRow);
    const rowHeight = 152;
    grid.height = `${numRows * rowHeight}px`;

    for (let i = 0; i < cardsPerRow; i++) {
      grid.addColumnDefinition(1 / cardsPerRow);
    }
    for (let i = 0; i < numRows; i++) {
      grid.addRowDefinition(rowHeight, true);
    }

    scrollViewer.addControl(grid);

    SCENARIOS.forEach((scenario, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const card = this.createScenarioCard(scenario);
      grid.addControl(card, row, col);
    });
  }

  private createScenarioCard(scenario: ScenarioDefinition): Rectangle {
    const status = this.progressManager.getScenarioStatus(scenario.id);
    const isLocked = status === 'locked';
    const isCompleted = status === 'completed';

    const card = new Rectangle(`card_${scenario.id}`);
    card.width = '212px';
    card.height = '138px';
    card.cornerRadius = UI_THEME.radii.panel;
    card.thickness = 2;
    card.paddingTop = '6px';
    card.paddingBottom = '6px';
    card.shadowColor = UI_THEME.colors.effects.shadow;
    card.shadowBlur = 10;
    card.shadowOffsetY = 4;

    if (isLocked) {
      card.background = UI_THEME.colors.launch.cardLocked;
      card.color = UI_THEME.colors.border.muted;
      card.alpha = 0.58;
    } else if (isCompleted) {
      card.background = UI_THEME.colors.launch.card;
      card.color = UI_THEME.colors.border.strong;
    } else {
      card.background = UI_THEME.colors.launch.card;
      card.color = UI_THEME.colors.launch.cardBorder;
    }

    const stack = new StackPanel();
    stack.paddingTop = '10px';
    stack.paddingLeft = '12px';
    stack.paddingRight = '12px';
    card.addControl(stack);

    const badgeRow = new StackPanel();
    badgeRow.isVertical = false;
    badgeRow.height = '24px';
    badgeRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(badgeRow);

    const diffBadge = new Rectangle('diffBadge');
    diffBadge.width = '76px';
    diffBadge.height = '20px';
    diffBadge.cornerRadius = UI_THEME.radii.scale.r3;
    diffBadge.thickness = 0;
    diffBadge.background = this.getDifficultyColor(scenario.difficulty);
    badgeRow.addControl(diffBadge);

    const diffText = new TextBlock();
    diffText.text = scenario.difficulty.toUpperCase();
    diffText.color = 'white';
    diffText.fontSize = UI_THEME.typography.scale.s10;
    diffText.fontFamily = UI_THEME.typography.fontFamily;
    diffBadge.addControl(diffText);

    const hasSavedGame = hasSave(scenario.id);

    if (isLocked) {
      const lockIcon = new TextBlock('lockIcon');
      lockIcon.text = '🔒';
      lockIcon.fontSize = UI_THEME.typography.scale.s14;
      lockIcon.width = '30px';
      lockIcon.paddingLeft = '8px';
      badgeRow.addControl(lockIcon);
    } else if (isCompleted) {
      const checkIcon = new TextBlock('checkIcon');
      checkIcon.text = '✅';
      checkIcon.fontSize = UI_THEME.typography.scale.s14;
      checkIcon.width = '30px';
      checkIcon.paddingLeft = '8px';
      badgeRow.addControl(checkIcon);
    }

    if (hasSavedGame && !isLocked) {
      const saveIcon = new TextBlock('saveIcon');
      saveIcon.text = '💾';
      saveIcon.fontSize = UI_THEME.typography.scale.s12;
      saveIcon.width = '25px';
      saveIcon.paddingLeft = '4px';
      badgeRow.addControl(saveIcon);
    }

    const name = new TextBlock('scenarioName');
    name.text = scenario.name;
    name.color = isLocked ? '#5b685f' : UI_THEME.colors.text.primary;
    name.fontSize = UI_THEME.typography.scale.s13;
    name.fontFamily = UI_THEME.typography.fontFamily;
    name.height = '32px';
    name.textWrapping = true;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    name.paddingTop = '6px';
    stack.addControl(name);

    const course = getCourseById(scenario.courseId);
    const courseInfo = new TextBlock('courseInfo');
    courseInfo.text = course ? `${course.name} (Par ${course.par})` : scenario.courseId;
    courseInfo.color = isLocked ? '#4c5a52' : UI_THEME.colors.text.secondary;
    courseInfo.fontSize = UI_THEME.typography.scale.s10;
    courseInfo.fontFamily = UI_THEME.typography.fontFamily;
    courseInfo.height = '18px';
    courseInfo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(courseInfo);

    const objRow = new StackPanel();
    objRow.isVertical = false;
    objRow.height = '22px';
    objRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(objRow);

    const objIcon = new TextBlock('objIcon');
    objIcon.text = this.getObjectiveIcon(scenario.objective.type);
    objIcon.fontSize = UI_THEME.typography.scale.s12;
    objIcon.width = '20px';
    objRow.addControl(objIcon);

    const objText = new TextBlock('objText');
    objText.text = this.getObjectiveShortText(scenario);
    objText.color = isLocked ? '#4c5a52' : UI_THEME.colors.text.info;
    objText.fontSize = UI_THEME.typography.scale.s10;
    objText.fontFamily = UI_THEME.typography.fontFamily;
    objText.width = '176px';
    objText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    objRow.addControl(objText);

    if (isCompleted) {
      const bestScore = this.progressManager.getBestScore(scenario.id);
      if (bestScore !== null) {
        const scoreText = new TextBlock('scoreText');
        scoreText.text = `Best: ${bestScore.toLocaleString()}`;
        scoreText.color = UI_THEME.colors.text.accent;
        scoreText.fontSize = UI_THEME.typography.scale.s10;
        scoreText.fontFamily = UI_THEME.typography.fontFamily;
        scoreText.height = '16px';
        scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(scoreText);
      }
    }

    if (!isLocked) {
      uiAutomationBridge.register({
        id: `menu.scenario.${scenario.id}`,
        label: scenario.name,
        role: 'option',
        getControl: () => card,
        isVisible: () => this.isVisible() && card.isVisible,
        isEnabled: () => !isLocked,
        onActivate: () => this.selectScenario(scenario),
      });

      card.onPointerEnterObservable.add(() => {
        if (this.selectedScenario?.id !== scenario.id) {
          card.background = UI_THEME.colors.launch.cardHover;
        }
      });

      card.onPointerOutObservable.add(() => {
        if (this.selectedScenario?.id !== scenario.id) {
          card.background = UI_THEME.colors.launch.card;
        }
      });

      this.focusManager.register({
        control: card,
        onActivate: () => this.selectScenario(scenario),
        onFocus: () => {
          if (this.selectedScenario?.id !== scenario.id) {
            card.background = UI_THEME.colors.launch.cardHover;
          }
        },
        onBlur: () => {
          if (this.selectedScenario?.id !== scenario.id) {
            card.background = UI_THEME.colors.launch.card;
          }
        },
        isEnabled: () => !isLocked,
        group: 'launch-shell'
      });
    }

    this.scenarioCards.set(scenario.id, card);
    return card;
  }

  private selectScenario(scenario: ScenarioDefinition): void {
    if (this.selectedScenario) {
      const prevCard = this.scenarioCards.get(this.selectedScenario.id);
      if (prevCard) {
        const prevStatus = this.progressManager.getScenarioStatus(this.selectedScenario.id);
        prevCard.background = UI_THEME.colors.launch.card;
        prevCard.color = prevStatus === 'completed' ? UI_THEME.colors.border.strong : UI_THEME.colors.launch.cardBorder;
      }
    }

    this.selectedScenario = scenario;
    const card = this.scenarioCards.get(scenario.id);
    if (card) {
      card.background = UI_THEME.colors.launch.cardSelected;
      card.color = UI_THEME.colors.launch.selectedBorder;
    }

    if (this.continueButton) {
      const hasSavedGame = hasSave(scenario.id);
      this.continueButton.control.isVisible = hasSavedGame;
    }

    const course = getCourseById(scenario.courseId);
    if (this.selectionTitleText) {
      this.selectionTitleText.text = scenario.name;
    }
    if (this.selectionMetaText) {
      this.selectionMetaText.text = `${scenario.difficulty.toUpperCase()} • ${course ? `${course.name} (Par ${course.par})` : scenario.courseId}`;
    }
    if (this.selectionObjectiveText) {
      this.selectionObjectiveText.text = this.getObjectiveShortText(scenario);
    }
  }

  private createActionBar(parent: Grid): void {
    const actionBar = new Rectangle('actionBar');
    actionBar.width = '100%';
    actionBar.height = '100%';
    actionBar.thickness = 0;
    actionBar.background = UI_THEME.colors.surfaces.heroSoft;
    parent.addControl(actionBar, 4, 0);

    const buttonRow = new StackPanel('buttonRow');
    buttonRow.isVertical = false;
    buttonRow.height = '56px';
    actionBar.addControl(buttonRow);

    this.continueButton = createAccessibleButton({
      label: '▶ CONTINUE',
      backgroundColor: UI_THEME.colors.action.neutral.normal,
      borderColor: UI_THEME.colors.border.info,
      onClick: () => {
        if (this.selectedScenario && this.callbacks.onContinueScenario) {
          this.callbacks.onContinueScenario(this.selectedScenario);
        }
      },
      isEnabled: () => this.selectedScenario !== null && hasSave(this.selectedScenario!.id),
      focusGroup: 'launch-shell'
    }, this.focusManager);
    this.continueButton.control.isVisible = false;
    buttonRow.addControl(this.continueButton.control);

    const spacer1 = new Rectangle('spacer1');
    spacer1.width = '10px';
    spacer1.height = '1px';
    spacer1.thickness = 0;
    spacer1.background = 'transparent';
    buttonRow.addControl(spacer1);

    this.startButton = createAccessibleButton({
      label: '▶ NEW GAME',
      backgroundColor: UI_THEME.colors.action.primary.normal,
      borderColor: UI_THEME.colors.launch.selectedBorder,
      onClick: () => {
        if (this.selectedScenario) {
          this.callbacks.onStartScenario(this.selectedScenario);
        }
      },
      isEnabled: () => this.selectedScenario !== null,
      focusGroup: 'launch-shell'
    }, this.focusManager);
    buttonRow.addControl(this.startButton.control);
    uiAutomationBridge.register({
      id: 'menu.new_game',
      label: 'New Game',
      role: 'button',
      getControl: () => this.startButton?.control ?? null,
      isVisible: () => this.isVisible() && (this.startButton?.control.isVisible ?? false),
      isEnabled: () => this.selectedScenario !== null,
      onActivate: () => {
        if (this.selectedScenario) {
          this.callbacks.onStartScenario(this.selectedScenario);
        }
      },
    });

    const spacer2 = new Rectangle('spacer2');
    spacer2.width = '20px';
    spacer2.height = '1px';
    spacer2.thickness = 0;
    spacer2.background = 'transparent';
    buttonRow.addControl(spacer2);

    this.quickPlayButton = createAccessibleButton({
      label: '🎮 QUICK PLAY',
      backgroundColor: UI_THEME.colors.action.success.normal,
      borderColor: UI_THEME.colors.border.strong,
      onClick: () => {
        const unlocked = this.progressManager.getUnlockedScenarios();
        const lastPlayed = this.progressManager.getLastPlayedScenario();

        // Try to continue last played, or pick first unlocked incomplete
        let scenario = unlocked.find(s => s.id === lastPlayed);
        if (!scenario) {
          scenario = unlocked.find(s => !this.progressManager.isScenarioCompleted(s.id));
        }
        if (!scenario && unlocked.length > 0) {
          scenario = unlocked[0];
        }

        if (scenario) {
          this.callbacks.onStartScenario(scenario);
        }
      },
      focusGroup: 'launch-shell'
    }, this.focusManager);
    buttonRow.addControl(this.quickPlayButton.control);
    uiAutomationBridge.register({
      id: 'menu.quick_play',
      label: 'Quick Play',
      role: 'button',
      getControl: () => this.quickPlayButton?.control ?? null,
      isVisible: () => this.isVisible() && (this.quickPlayButton?.control.isVisible ?? false),
      onActivate: () => {
        const unlocked = this.progressManager.getUnlockedScenarios();
        const lastPlayed = this.progressManager.getLastPlayedScenario();
        let scenario = unlocked.find(s => s.id === lastPlayed);
        if (!scenario) {
          scenario = unlocked.find(s => !this.progressManager.isScenarioCompleted(s.id));
        }
        if (!scenario && unlocked.length > 0) {
          scenario = unlocked[0];
        }
        if (scenario) {
          this.callbacks.onStartScenario(scenario);
        }
      },
    });

    const spacer3 = new Rectangle('spacer3');
    spacer3.width = '20px';
    spacer3.height = '1px';
    spacer3.thickness = 0;
    spacer3.background = 'transparent';
    buttonRow.addControl(spacer3);

    this.guideButton = createAccessibleButton({
      label: '📖 GUIDE',
      backgroundColor: UI_THEME.colors.action.neutral.normal,
      borderColor: UI_THEME.colors.border.info,
      onClick: () => {
        if (this.callbacks.onOpenManual) {
          this.callbacks.onOpenManual();
        }
      },
      focusGroup: 'launch-shell'
    }, this.focusManager);
    buttonRow.addControl(this.guideButton.control);
    uiAutomationBridge.register({
      id: 'menu.guide',
      label: 'Guide',
      role: 'button',
      getControl: () => this.guideButton?.control ?? null,
      isVisible: () => this.isVisible() && (this.guideButton?.control.isVisible ?? false),
      onActivate: () => this.callbacks.onOpenManual?.(),
    });

    const spacer4 = new Rectangle('spacer4');
    spacer4.width = '20px';
    spacer4.height = '1px';
    spacer4.thickness = 0;
    spacer4.background = 'transparent';
    buttonRow.addControl(spacer4);

    const designerButton = createAccessibleButton({
      label: '🎨 DESIGNER',
      backgroundColor: UI_THEME.colors.miscButton.customEdit,
      borderColor: UI_THEME.colors.border.info,
      onClick: () => {
        if (this.callbacks.onOpenDesigner) {
          this.callbacks.onOpenDesigner();
        }
      },
      focusGroup: 'launch-shell'
    }, this.focusManager);
    buttonRow.addControl(designerButton.control);
    uiAutomationBridge.register({
      id: 'menu.designer',
      label: 'Designer',
      role: 'button',
      getControl: () => designerButton.control,
      isVisible: () => this.isVisible() && designerButton.control.isVisible,
      onActivate: () => this.callbacks.onOpenDesigner?.(),
    });
  }


  private createCustomCoursesSection(parent: Grid): void {
    const container = new Rectangle('customCoursesContainer');
    container.width = '100%';
    container.height = '100%';
    container.thickness = 0;
    container.background = 'rgba(16, 34, 26, 0.58)';
    parent.addControl(container, 3, 0);

    const stack = new StackPanel('customStack');
    stack.width = '100%';
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    container.addControl(stack);

    const header = new TextBlock('customHeader');
    header.text = 'CUSTOM COURSES';
    header.color = UI_THEME.colors.text.secondary;
    header.fontSize = UI_THEME.typography.scale.s12;
    header.fontFamily = UI_THEME.typography.fontFamily;
    header.height = '24px';
    header.paddingTop = '6px';
    stack.addControl(header);

    const scrollViewer = new ScrollViewer('customScroll');
    scrollViewer.width = '95%';
    scrollViewer.height = '95px';
    configureDialogScrollViewer(scrollViewer, {
      barColor: UI_THEME.colors.border.strong,
      barBackground: UI_THEME.colors.surfaces.hudInset,
    });
    stack.addControl(scrollViewer);

    const cardRow = new StackPanel('customCardRow');
    cardRow.isVertical = false;
    cardRow.height = '85px';
    scrollViewer.addControl(cardRow);

    const courses = listCustomCourses();
    for (const course of courses) {
      const card = this.createCustomCourseCard(course);
      cardRow.addControl(card);
    }

    if (courses.length === 0) {
      const empty = new TextBlock('emptyCustom');
      empty.text = 'No custom courses yet. Open Designer to build your own layout.';
      empty.color = UI_THEME.colors.text.muted;
      empty.fontSize = UI_THEME.typography.scale.s11;
      empty.fontFamily = UI_THEME.typography.fontFamily;
      empty.width = '360px';
      empty.height = '38px';
      empty.textWrapping = true;
      cardRow.addControl(empty);
    }
  }

  private createCustomCourseCard(course: CustomCourseData): Rectangle {
    const card = new Rectangle(`custom_${course.id}`);
    card.width = '160px';
    card.height = '80px';
    card.cornerRadius = UI_THEME.radii.scale.r6;
    card.thickness = 1;
    card.color = UI_THEME.colors.miscButton.mutedGreen;
    card.background = UI_THEME.colors.editor.buttonBase;
    card.paddingLeft = '4px';
    card.paddingRight = '4px';

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    card.addControl(stack);

    const name = new TextBlock();
    name.text = course.name;
    name.color = 'white';
    name.fontSize = UI_THEME.typography.scale.s11;
    name.fontFamily = UI_THEME.typography.fontFamily;
    name.height = '18px';
    name.textWrapping = true;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(name);

    const date = new Date(course.updatedAt);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

    const info = new TextBlock();
    info.text = `${course.width}x${course.height}  ${dateStr}`;
    info.color = UI_THEME.colors.legacy.c_88aa88;
    info.fontSize = UI_THEME.typography.scale.s9;
    info.fontFamily = UI_THEME.typography.fontFamily;
    info.height = '14px';
    info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(info);

    const btnRow = new StackPanel();
    btnRow.isVertical = false;
    btnRow.height = '24px';
    btnRow.paddingTop = '4px';
    stack.addControl(btnRow);

    const playBtn = new Rectangle('playBtn');
    playBtn.width = '50px';
    playBtn.height = '20px';
    playBtn.cornerRadius = UI_THEME.radii.chip;
    playBtn.background = UI_THEME.colors.miscButton.customPlay;
    playBtn.color = UI_THEME.colors.editor.buttonTextActive;
    playBtn.thickness = 1;
    playBtn.isPointerBlocker = true;
    const playText = new TextBlock();
    playText.text = 'Play';
    playText.color = 'white';
    playText.fontSize = UI_THEME.typography.scale.s9;
    playText.isPointerBlocker = false;
    playBtn.addControl(playText);
    playBtn.onPointerUpObservable.add(() => this.callbacks.onPlayCustomCourse?.(course));
    btnRow.addControl(playBtn);

    const spacer = new Rectangle();
    spacer.width = '6px';
    spacer.height = '1px';
    spacer.thickness = 0;
    spacer.background = 'transparent';
    btnRow.addControl(spacer);

    const editBtn = new Rectangle('editBtn');
    editBtn.width = '50px';
    editBtn.height = '20px';
    editBtn.cornerRadius = UI_THEME.radii.chip;
    editBtn.background = UI_THEME.colors.miscButton.customEdit;
    editBtn.color = UI_THEME.colors.miscButton.customEditText;
    editBtn.thickness = 1;
    editBtn.isPointerBlocker = true;
    const editText = new TextBlock();
    editText.text = 'Edit';
    editText.color = 'white';
    editText.fontSize = UI_THEME.typography.scale.s9;
    editText.isPointerBlocker = false;
    editBtn.addControl(editText);
    editBtn.onPointerUpObservable.add(() => this.callbacks.onEditCustomCourse?.(course));
    btnRow.addControl(editBtn);

    card.onPointerEnterObservable.add(() => { card.background = UI_THEME.colors.editor.buttonHover; });
    card.onPointerOutObservable.add(() => { card.background = UI_THEME.colors.editor.buttonBase; });

    return card;
  }

  private getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'beginner': return '#2a7a4a';
      case 'intermediate': return '#7a7a2a';
      case 'advanced': return '#7a4a2a';
      case 'expert': return '#7a2a2a';
      default: return '#4a4a4a';
    }
  }

  private getObjectiveIcon(type: string): string {
    switch (type) {
      case 'economic': return '💰';
      case 'restoration': return '🌱';
      case 'attendance': return '⛳';
      case 'satisfaction': return '⭐';
      default: return '🎯';
    }
  }

  private getObjectiveShortText(scenario: ScenarioDefinition): string {
    const obj = scenario.objective;
    switch (obj.type) {
      case 'economic':
        if (obj.targetProfit) return `Profit $${obj.targetProfit.toLocaleString()}`;
        if (obj.targetRevenue) return `Revenue $${obj.targetRevenue.toLocaleString()}`;
        return 'Economic goal';
      case 'restoration':
        return `Restore to ${obj.targetHealth}% health`;
      case 'attendance':
        return `Host ${obj.targetRounds} rounds`;
      case 'satisfaction':
        return `Maintain ${obj.targetRating}% for ${obj.maintainForDays}d`;
      default:
        return 'Complete objective';
    }
  }

  public show(): void {
    this.advancedTexture.addControl(this.container);
    this.container.isVisible = true;
    this.ensureDefaultSelection();
    this.refreshCards();
    this.focusManager.enableForGroup('launch-shell', 0);
  }

  public hide(): void {
    this.container.isVisible = false;
    this.advancedTexture.removeControl(this.container);
    this.focusManager.disable();
  }

  public isVisible(): boolean {
    return this.container.isVisible;
  }

  private refreshCards(): void {
    for (const [scenarioId, card] of this.scenarioCards) {
      const status = this.progressManager.getScenarioStatus(scenarioId);
      const isLocked = status === 'locked';
      const isCompleted = status === 'completed';
      const isSelected = this.selectedScenario?.id === scenarioId;

      if (isSelected) {
        card.background = UI_THEME.colors.launch.cardSelected;
        card.color = UI_THEME.colors.launch.selectedBorder;
        card.alpha = 1;
      } else if (isLocked) {
        card.background = UI_THEME.colors.launch.cardLocked;
        card.color = UI_THEME.colors.border.muted;
        card.alpha = 0.58;
      } else if (isCompleted) {
        card.background = UI_THEME.colors.launch.card;
        card.color = UI_THEME.colors.border.strong;
        card.alpha = 1;
      } else {
        card.background = UI_THEME.colors.launch.card;
        card.color = UI_THEME.colors.launch.cardBorder;
        card.alpha = 1;
      }
    }
  }

  private ensureDefaultSelection(): void {
    if (this.selectedScenario) {
      this.selectScenario(this.selectedScenario);
      return;
    }

    const lastPlayed = this.progressManager.getLastPlayedScenario();
    const unlocked = this.progressManager.getUnlockedScenarios();
    const scenario =
      unlocked.find((candidate) => candidate.id === lastPlayed)
      ?? unlocked[0]
      ?? SCENARIOS.find((candidate) => this.progressManager.getScenarioStatus(candidate.id) !== 'locked');

    if (scenario) {
      this.selectScenario(scenario);
    }
  }

  public dispose(): void {
    uiAutomationBridge.unregisterPrefix('menu.');
    this.focusManager.dispose();
    this.container.dispose();
    if (this.ownsTexture) {
      this.advancedTexture.dispose();
    }
  }

  public getTexture(): AdvancedDynamicTexture {
    return this.advancedTexture;
  }
}
