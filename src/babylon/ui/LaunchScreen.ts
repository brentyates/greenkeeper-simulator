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
import { FocusManager } from './FocusManager';
import { AccessibleButton, createAccessibleButton } from './AccessibleButton';

export interface LaunchScreenCallbacks {
  onStartScenario: (scenario: ScenarioDefinition) => void;
  onContinueScenario?: (scenario: ScenarioDefinition) => void;
  onOpenManual?: () => void;
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
    this.container.background = '#0d1f15';
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

    // Define rows: title (120px), header (40px), content (flex), action bar (80px)
    mainGrid.addRowDefinition(120, true);
    mainGrid.addRowDefinition(40, true);
    mainGrid.addRowDefinition(1.0);
    mainGrid.addRowDefinition(80, true);
    mainGrid.addColumnDefinition(1.0);

    this.container.addControl(mainGrid);

    // Title section
    this.createTitleSection(mainGrid);

    // Scenario selection area
    this.createScenarioSection(mainGrid);

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
    icon.fontSize = 40;
    icon.height = '50px';
    titleStack.addControl(icon);

    // Game title
    const title = new TextBlock('gameTitle');
    title.text = 'GREENKEEPER SIMULATOR';
    title.color = '#7FFF7F';
    title.fontSize = 32;
    title.fontFamily = 'Arial Black, sans-serif';
    title.height = '45px';
    titleStack.addControl(title);

    // Subtitle
    const subtitle = new TextBlock('subtitle');
    subtitle.text = 'Master the Art of Course Maintenance';
    subtitle.color = '#4a8a5a';
    subtitle.fontSize = 14;
    subtitle.fontFamily = 'Arial, sans-serif';
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
    header.color = '#7a9a7a';
    header.fontSize = 14;
    header.fontFamily = 'Arial, sans-serif';
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
    scrollViewer.barColor = '#4a8a5a';
    scrollViewer.barBackground = '#1a3a2a';
    scrollViewer.thickness = 0;
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
    card.cornerRadius = 8;
    card.thickness = 2;
    card.paddingTop = '5px';
    card.paddingBottom = '5px';

    if (isLocked) {
      card.background = '#1a2a20';
      card.color = '#2a3a30';
      card.alpha = 0.7;
    } else if (isCompleted) {
      card.background = '#1a3a2a';
      card.color = '#4a8a5a';
    } else {
      card.background = '#1a3a2a';
      card.color = '#3a5a4a';
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
    diffBadge.cornerRadius = 3;
    diffBadge.thickness = 0;
    diffBadge.background = this.getDifficultyColor(scenario.difficulty);
    badgeRow.addControl(diffBadge);

    const diffText = new TextBlock();
    diffText.text = scenario.difficulty.toUpperCase();
    diffText.color = 'white';
    diffText.fontSize = 9;
    diffText.fontFamily = 'Arial, sans-serif';
    diffBadge.addControl(diffText);

    // Status icons
    const hasSavedGame = hasSave(scenario.id);

    if (isLocked) {
      const lockIcon = new TextBlock('lockIcon');
      lockIcon.text = '🔒';
      lockIcon.fontSize = 14;
      lockIcon.width = '30px';
      lockIcon.paddingLeft = '8px';
      badgeRow.addControl(lockIcon);
    } else if (isCompleted) {
      const checkIcon = new TextBlock('checkIcon');
      checkIcon.text = '✅';
      checkIcon.fontSize = 14;
      checkIcon.width = '30px';
      checkIcon.paddingLeft = '8px';
      badgeRow.addControl(checkIcon);
    }

    if (hasSavedGame && !isLocked) {
      const saveIcon = new TextBlock('saveIcon');
      saveIcon.text = '💾';
      saveIcon.fontSize = 12;
      saveIcon.width = '25px';
      saveIcon.paddingLeft = '4px';
      badgeRow.addControl(saveIcon);
    }

    // Scenario name
    const name = new TextBlock('scenarioName');
    name.text = scenario.name;
    name.color = isLocked ? '#4a5a50' : 'white';
    name.fontSize = 12;
    name.fontFamily = 'Arial, sans-serif';
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
    courseInfo.fontSize = 10;
    courseInfo.fontFamily = 'Arial, sans-serif';
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
    objIcon.fontSize = 12;
    objIcon.width = '20px';
    objRow.addControl(objIcon);

    const objText = new TextBlock('objText');
    objText.text = this.getObjectiveShortText(scenario);
    objText.color = isLocked ? '#3a4a40' : '#aaccaa';
    objText.fontSize = 10;
    objText.fontFamily = 'Arial, sans-serif';
    objText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    objRow.addControl(objText);

    // Best score if completed
    if (isCompleted) {
      const bestScore = this.progressManager.getBestScore(scenario.id);
      if (bestScore !== null) {
        const scoreText = new TextBlock('scoreText');
        scoreText.text = `Best: ${bestScore.toLocaleString()}`;
        scoreText.color = '#ffcc00';
        scoreText.fontSize = 10;
        scoreText.fontFamily = 'Arial, sans-serif';
        scoreText.height = '16px';
        scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(scoreText);
      }
    }

    // Interaction
    if (!isLocked) {
      card.onPointerEnterObservable.add(() => {
        if (this.selectedScenario?.id !== scenario.id) {
          card.background = '#2a5a3a';
        }
      });

      card.onPointerOutObservable.add(() => {
        if (this.selectedScenario?.id !== scenario.id) {
          card.background = isCompleted ? '#1a3a2a' : '#1a3a2a';
        }
      });

      // Register with focus manager for keyboard navigation
      this.focusManager.register({
        control: card,
        onActivate: () => this.selectScenario(scenario),
        onFocus: () => {
          if (this.selectedScenario?.id !== scenario.id) {
            card.background = '#2a5a3a';
          }
        },
        onBlur: () => {
          if (this.selectedScenario?.id !== scenario.id) {
            card.background = isCompleted ? '#1a3a2a' : '#1a3a2a';
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
        prevCard.background = prevStatus === 'completed' ? '#1a3a2a' : '#1a3a2a';
        prevCard.color = prevStatus === 'completed' ? '#4a8a5a' : '#3a5a4a';
      }
    }

    // Select new
    this.selectedScenario = scenario;
    const card = this.scenarioCards.get(scenario.id);
    if (card) {
      card.background = '#2a6a4a';
      card.color = '#7FFF7F';
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
    parent.addControl(actionBar, 3, 0);

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
        card.background = '#2a6a4a';
        card.color = '#7FFF7F';
        card.alpha = 1;
      } else if (isLocked) {
        card.background = '#1a2a20';
        card.color = '#2a3a30';
        card.alpha = 0.7;
      } else if (isCompleted) {
        card.background = '#1a3a2a';
        card.color = '#4a8a5a';
        card.alpha = 1;
      } else {
        card.background = '#1a3a2a';
        card.color = '#3a5a4a';
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
