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
    this.container.background = UI_THEME.colors.legacy.c_0d1f15;
    this.container.thickness = 0;

    this.buildUI();

    // Add container to texture - LaunchScreen shows by default
    this.advancedTexture.addControl(this.container);
  }

  private buildUI(): void {
    // Main layout using Grid for proper height distribution
    const mainGrid = new Grid('mainGrid');
    mainGrid.width = '100%';
    mainGrid.height = '100%';
    mainGrid.paddingTop = '20px';
    mainGrid.paddingBottom = '10px';

    // Define rows: title (120px), header (40px), scenarios (flex), custom courses (120px), action bar (80px)
    mainGrid.addRowDefinition(120, true);
    mainGrid.addRowDefinition(40, true);
    mainGrid.addRowDefinition(1.0);
    mainGrid.addRowDefinition(130, true);
    mainGrid.addRowDefinition(80, true);
    mainGrid.addColumnDefinition(1.0);

    this.container.addControl(mainGrid);

    // Title section
    this.createTitleSection(mainGrid);

    // Scenario selection area
    this.createScenarioSection(mainGrid);

    // Custom courses section
    this.createCustomCoursesSection(mainGrid);

    // Bottom action bar
    this.createActionBar(mainGrid);
  }

  private createTitleSection(parent: Grid): void {
    const titleContainer = new Rectangle('titleContainer');
    titleContainer.width = '100%';
    titleContainer.height = '100%';
    titleContainer.thickness = 0;
    titleContainer.background = 'transparent';
    parent.addControl(titleContainer, 0, 0);

    const titleStack = new StackPanel('titleStack');
    titleContainer.addControl(titleStack);

    // Game icon
    const icon = new TextBlock('gameIcon');
    icon.text = '🌿';
    icon.fontSize = UI_THEME.typography.scale.s40;
    icon.height = '50px';
    titleStack.addControl(icon);

    // Game title
    const title = new TextBlock('gameTitle');
    title.text = 'GREENKEEPER SIMULATOR';
    title.color = UI_THEME.colors.editor.buttonTextActive;
    title.fontSize = UI_THEME.typography.scale.s32;
    title.fontFamily = UI_THEME.typography.fontFamily;
    title.height = '45px';
    titleStack.addControl(title);

    // Subtitle
    const subtitle = new TextBlock('subtitle');
    subtitle.text = 'Master the Art of Course Maintenance';
    subtitle.color = UI_THEME.colors.legacy.c_4a8a5a;
    subtitle.fontSize = UI_THEME.typography.scale.s14;
    subtitle.fontFamily = UI_THEME.typography.fontFamily;
    subtitle.height = '20px';
    titleStack.addControl(subtitle);
  }

  private createScenarioSection(parent: Grid): void {
    // Section header in row 1
    const headerContainer = new Rectangle('headerContainer');
    headerContainer.width = '100%';
    headerContainer.height = '100%';
    headerContainer.thickness = 0;
    headerContainer.background = 'transparent';
    parent.addControl(headerContainer, 1, 0);

    const header = new TextBlock('scenarioHeader');
    header.text = 'SELECT SCENARIO';
    header.color = UI_THEME.colors.legacy.c_7a9a7a;
    header.fontSize = UI_THEME.typography.scale.s14;
    header.fontFamily = UI_THEME.typography.fontFamily;
    headerContainer.addControl(header);

    // Scrollable scenario container in row 2 (flexible height)
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
      barColor: '#4a8a5a',
      barBackground: UI_THEME.colors.editor.buttonBase,
    });
    scrollContainer.addControl(scrollViewer);

    // Hide horizontal scrollbar area after it's created (it's created lazily on first render)
    const hideHorizontalBar = () => {
      // Hide the scrollbar itself
      if (scrollViewer.horizontalBar) {
        scrollViewer.horizontalBar.isVisible = false;
      }
      // Hide the scrollbar track/container (private property, access via any)
      const viewer = scrollViewer as unknown as { _horizontalBarSpace?: { isVisible: boolean } };
      if (viewer._horizontalBarSpace) {
        viewer._horizontalBarSpace.isVisible = false;
      }
    };
    scrollViewer.onAfterDrawObservable.addOnce(hideHorizontalBar);

    // Grid for scenario cards
    const grid = new Grid('scenarioGrid');
    grid.width = '100%';

    // Calculate rows needed (3 cards per row)
    const cardsPerRow = 3;
    const numRows = Math.ceil(SCENARIOS.length / cardsPerRow);
    const rowHeight = 140;
    grid.height = `${numRows * rowHeight}px`;

    for (let i = 0; i < cardsPerRow; i++) {
      grid.addColumnDefinition(1 / cardsPerRow);
    }
    for (let i = 0; i < numRows; i++) {
      grid.addRowDefinition(rowHeight, true);
    }

    scrollViewer.addControl(grid);

    // Create scenario cards
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
    card.width = '180px';
    card.height = '125px';
    card.cornerRadius = UI_THEME.radii.scale.r8;
    card.thickness = 2;
    card.paddingTop = '5px';
    card.paddingBottom = '5px';

    if (isLocked) {
      card.background = UI_THEME.colors.miscButton.neutralBase;
      card.color = UI_THEME.colors.legacy.c_2a3a30;
      card.alpha = 0.7;
    } else if (isCompleted) {
      card.background = UI_THEME.colors.editor.buttonBase;
      card.color = UI_THEME.colors.legacy.c_4a8a5a;
    } else {
      card.background = UI_THEME.colors.editor.buttonBase;
      card.color = UI_THEME.colors.editor.buttonBorder;
    }

    const stack = new StackPanel();
    stack.paddingTop = '8px';
    stack.paddingLeft = '10px';
    stack.paddingRight = '10px';
    card.addControl(stack);

    // Status badge
    const badgeRow = new StackPanel();
    badgeRow.isVertical = false;
    badgeRow.height = '22px';
    badgeRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(badgeRow);

    // Difficulty badge
    const diffBadge = new Rectangle('diffBadge');
    diffBadge.width = '70px';
    diffBadge.height = '18px';
    diffBadge.cornerRadius = UI_THEME.radii.scale.r3;
    diffBadge.thickness = 0;
    diffBadge.background = this.getDifficultyColor(scenario.difficulty);
    badgeRow.addControl(diffBadge);

    const diffText = new TextBlock();
    diffText.text = scenario.difficulty.toUpperCase();
    diffText.color = 'white';
    diffText.fontSize = UI_THEME.typography.scale.s9;
    diffText.fontFamily = UI_THEME.typography.fontFamily;
    diffBadge.addControl(diffText);

    // Status icons
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

    // Scenario name
    const name = new TextBlock('scenarioName');
    name.text = scenario.name;
    name.color = isLocked ? '#4a5a50' : 'white';
    name.fontSize = UI_THEME.typography.scale.s12;
    name.fontFamily = UI_THEME.typography.fontFamily;
    name.height = '20px';
    name.textWrapping = true;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    name.paddingTop = '4px';
    stack.addControl(name);

    // Course info
    const course = getCourseById(scenario.courseId);
    const courseInfo = new TextBlock('courseInfo');
    courseInfo.text = course ? `${course.name} (Par ${course.par})` : scenario.courseId;
    courseInfo.color = isLocked ? '#3a4a40' : '#88aa88';
    courseInfo.fontSize = UI_THEME.typography.scale.s10;
    courseInfo.fontFamily = UI_THEME.typography.fontFamily;
    courseInfo.height = '16px';
    courseInfo.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(courseInfo);

    // Objective icon
    const objRow = new StackPanel();
    objRow.isVertical = false;
    objRow.height = '18px';
    objRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(objRow);

    const objIcon = new TextBlock('objIcon');
    objIcon.text = this.getObjectiveIcon(scenario.objective.type);
    objIcon.fontSize = UI_THEME.typography.scale.s12;
    objIcon.width = '20px';
    objRow.addControl(objIcon);

    const objText = new TextBlock('objText');
    objText.text = this.getObjectiveShortText(scenario);
    objText.color = isLocked ? '#3a4a40' : UI_THEME.colors.editor.buttonText;
    objText.fontSize = UI_THEME.typography.scale.s10;
    objText.fontFamily = UI_THEME.typography.fontFamily;
    objText.width = '200px';
    objText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    objRow.addControl(objText);

    // Best score if completed
    if (isCompleted) {
      const bestScore = this.progressManager.getBestScore(scenario.id);
      if (bestScore !== null) {
        const scoreText = new TextBlock('scoreText');
        scoreText.text = `Best: ${bestScore.toLocaleString()}`;
        scoreText.color = UI_THEME.colors.legacy.c_ffcc00;
        scoreText.fontSize = UI_THEME.typography.scale.s10;
        scoreText.fontFamily = UI_THEME.typography.fontFamily;
        scoreText.height = '16px';
        scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(scoreText);
      }
    }

    // Interaction
    if (!isLocked) {
      card.onPointerEnterObservable.add(() => {
        if (this.selectedScenario?.id !== scenario.id) {
          card.background = UI_THEME.colors.miscButton.customPlay;
        }
      });

      card.onPointerOutObservable.add(() => {
        if (this.selectedScenario?.id !== scenario.id) {
          card.background = isCompleted ? UI_THEME.colors.editor.buttonBase : UI_THEME.colors.editor.buttonBase;
        }
      });

      // Register with focus manager for keyboard navigation
      this.focusManager.register({
        control: card,
        onActivate: () => this.selectScenario(scenario),
        onFocus: () => {
          if (this.selectedScenario?.id !== scenario.id) {
            card.background = UI_THEME.colors.miscButton.customPlay;
          }
        },
        onBlur: () => {
          if (this.selectedScenario?.id !== scenario.id) {
            card.background = isCompleted ? UI_THEME.colors.editor.buttonBase : UI_THEME.colors.editor.buttonBase;
          }
        },
        isEnabled: () => !isLocked,
        group: 'launch-scenarios'
      });
    }

    this.scenarioCards.set(scenario.id, card);
    return card;
  }

  private selectScenario(scenario: ScenarioDefinition): void {
    // Deselect previous
    if (this.selectedScenario) {
      const prevCard = this.scenarioCards.get(this.selectedScenario.id);
      if (prevCard) {
        const prevStatus = this.progressManager.getScenarioStatus(this.selectedScenario.id);
        prevCard.background = prevStatus === 'completed' ? UI_THEME.colors.editor.buttonBase : UI_THEME.colors.editor.buttonBase;
        prevCard.color = prevStatus === 'completed' ? '#4a8a5a' : UI_THEME.colors.editor.buttonBorder;
      }
    }

    // Select new
    this.selectedScenario = scenario;
    const card = this.scenarioCards.get(scenario.id);
    if (card) {
      card.background = UI_THEME.colors.editor.buttonActive;
      card.color = UI_THEME.colors.editor.buttonTextActive;
    }

    // Show/hide continue button based on saved game
    if (this.continueButton) {
      const hasSavedGame = hasSave(scenario.id);
      this.continueButton.control.isVisible = hasSavedGame;
    }
  }

  private createActionBar(parent: Grid): void {
    const actionBar = new Rectangle('actionBar');
    actionBar.width = '100%';
    actionBar.height = '100%';
    actionBar.thickness = 0;
    actionBar.background = 'rgba(26, 58, 42, 0.5)';
    parent.addControl(actionBar, 4, 0);

    const buttonRow = new StackPanel('buttonRow');
    buttonRow.isVertical = false;
    buttonRow.height = '50px';
    actionBar.addControl(buttonRow);

    // Continue button (only visible when saved game exists)
    this.continueButton = createAccessibleButton({
      label: '▶ CONTINUE',
      backgroundColor: '#4a6a7a',
      onClick: () => {
        if (this.selectedScenario && this.callbacks.onContinueScenario) {
          this.callbacks.onContinueScenario(this.selectedScenario);
        }
      },
      isEnabled: () => this.selectedScenario !== null && hasSave(this.selectedScenario!.id),
      focusGroup: 'launch-buttons'
    }, this.focusManager);
    this.continueButton.control.isVisible = false;
    buttonRow.addControl(this.continueButton.control);

    // Spacer after continue
    const spacer1 = new Rectangle('spacer1');
    spacer1.width = '10px';
    spacer1.height = '1px';
    spacer1.thickness = 0;
    spacer1.background = 'transparent';
    buttonRow.addControl(spacer1);

    // Start button (new game)
    this.startButton = createAccessibleButton({
      label: '▶ NEW GAME',
      onClick: () => {
        if (this.selectedScenario) {
          this.callbacks.onStartScenario(this.selectedScenario);
        }
      },
      isEnabled: () => this.selectedScenario !== null,
      focusGroup: 'launch-buttons'
    }, this.focusManager);
    buttonRow.addControl(this.startButton.control);

    // Spacer
    const spacer2 = new Rectangle('spacer2');
    spacer2.width = '20px';
    spacer2.height = '1px';
    spacer2.thickness = 0;
    spacer2.background = 'transparent';
    buttonRow.addControl(spacer2);

    // Quick play button (auto-select first unlocked)
    this.quickPlayButton = createAccessibleButton({
      label: '🎮 QUICK PLAY',
      backgroundColor: '#4a7a5a',
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
      focusGroup: 'launch-buttons'
    }, this.focusManager);
    buttonRow.addControl(this.quickPlayButton.control);

    // Spacer
    const spacer3 = new Rectangle('spacer3');
    spacer3.width = '20px';
    spacer3.height = '1px';
    spacer3.thickness = 0;
    spacer3.background = 'transparent';
    buttonRow.addControl(spacer3);

    // Guide button
    this.guideButton = createAccessibleButton({
      label: '📖 GUIDE',
      backgroundColor: '#5a6a7a',
      onClick: () => {
        if (this.callbacks.onOpenManual) {
          this.callbacks.onOpenManual();
        }
      },
      focusGroup: 'launch-buttons'
    }, this.focusManager);
    buttonRow.addControl(this.guideButton.control);

    // Spacer
    const spacer4 = new Rectangle('spacer4');
    spacer4.width = '20px';
    spacer4.height = '1px';
    spacer4.thickness = 0;
    spacer4.background = 'transparent';
    buttonRow.addControl(spacer4);

    // Course Designer button
    const designerButton = createAccessibleButton({
      label: '🎨 DESIGNER',
      backgroundColor: '#5a5a7a',
      onClick: () => {
        if (this.callbacks.onOpenDesigner) {
          this.callbacks.onOpenDesigner();
        }
      },
      focusGroup: 'launch-buttons'
    }, this.focusManager);
    buttonRow.addControl(designerButton.control);
  }


  private createCustomCoursesSection(parent: Grid): void {
    const container = new Rectangle('customCoursesContainer');
    container.width = '100%';
    container.height = '100%';
    container.thickness = 0;
    container.background = 'rgba(26, 42, 32, 0.4)';
    parent.addControl(container, 3, 0);

    const stack = new StackPanel('customStack');
    stack.width = '100%';
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    container.addControl(stack);

    const header = new TextBlock('customHeader');
    header.text = 'CUSTOM COURSES';
    header.color = UI_THEME.colors.legacy.c_7a9a7a;
    header.fontSize = UI_THEME.typography.scale.s12;
    header.fontFamily = UI_THEME.typography.fontFamily;
    header.height = '24px';
    header.paddingTop = '6px';
    stack.addControl(header);

    const scrollViewer = new ScrollViewer('customScroll');
    scrollViewer.width = '95%';
    scrollViewer.height = '95px';
    configureDialogScrollViewer(scrollViewer, {
      barColor: '#4a8a5a',
      barBackground: UI_THEME.colors.editor.buttonBase,
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
      empty.text = 'No custom courses yet';
      empty.color = UI_THEME.colors.miscButton.mutedGreen;
      empty.fontSize = UI_THEME.typography.scale.s11;
      empty.fontFamily = UI_THEME.typography.fontFamily;
      empty.width = '200px';
      empty.height = '30px';
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
    this.refreshCards();
    // Enable keyboard navigation - start with scenario selection
    this.focusManager.enableForGroup('launch-scenarios', 0);
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
    // Update card states based on current progress
    for (const [scenarioId, card] of this.scenarioCards) {
      const status = this.progressManager.getScenarioStatus(scenarioId);
      const isLocked = status === 'locked';
      const isCompleted = status === 'completed';
      const isSelected = this.selectedScenario?.id === scenarioId;

      if (isSelected) {
        card.background = UI_THEME.colors.editor.buttonActive;
        card.color = UI_THEME.colors.editor.buttonTextActive;
        card.alpha = 1;
      } else if (isLocked) {
        card.background = UI_THEME.colors.miscButton.neutralBase;
        card.color = UI_THEME.colors.legacy.c_2a3a30;
        card.alpha = 0.7;
      } else if (isCompleted) {
        card.background = UI_THEME.colors.editor.buttonBase;
        card.color = UI_THEME.colors.legacy.c_4a8a5a;
        card.alpha = 1;
      } else {
        card.background = UI_THEME.colors.editor.buttonBase;
        card.color = UI_THEME.colors.editor.buttonBorder;
        card.alpha = 1;
      }
    }
  }

  public dispose(): void {
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
