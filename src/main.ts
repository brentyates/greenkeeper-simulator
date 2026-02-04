import { BabylonMain, startBabylonGame } from './babylon/BabylonMain';
import { ScenarioDefinition, getScenarioById, SCENARIOS } from './data/scenarioData';
import { hasSave, deleteSave } from './core/save-game';
import { getProgressManager } from './systems/ProgressManager';
import { LaunchScreen } from './babylon/ui/LaunchScreen';
import { UserManual } from './babylon/ui/UserManual';
import { CourseDesigner, CourseDesignerOptions } from './babylon/CourseDesigner';
import { CourseSetupDialog, CourseSetupResult } from './babylon/ui/CourseSetupDialog';
import { CustomCourseData, createSandboxScenario } from './data/customCourseData';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

declare global {
  interface Window {
    game: BabylonMain | null;
    captureScreenshot: () => Promise<string>;
    exportGameState: () => void;
    listScenarios: () => string[];
    startScenario: (id: string, loadFromSave?: boolean) => boolean;
    getScenarioState: () => { progress: number; completed: boolean; failed: boolean; message?: string } | null;
    getEconomyState: () => { cash: number; earned: number; spent: number } | null;
    getPrestigeState: () => { score: number; stars: number; tier: string; amenityScore: number } | null;
    purchaseAmenity: (upgradeType: string) => boolean;
    getTeeTimeStats: () => { totalBookings: number; cancellations: number; noShows: number; slotsAvailable: number } | null;
    getMarketingStats: () => { activeCampaigns: number; totalSpent: number; totalROI: number } | null;
    startMarketingCampaign: (campaignId: string, days?: number) => boolean;
    setCash: (amount: number) => void;
    advanceDay: () => void;
    getGameDay: () => number | null;
    saveGame: () => void;
    hasSave: (scenarioId: string) => boolean;
    clearSave: (scenarioId: string) => void;
    app: GameApp;
    showGuide: () => void;
    hideGuide: () => void;
    isGuideVisible: () => boolean;
    navigateGuideSection: (sectionId: string) => void;
    getGuideSection: () => string | null;
    listGuideSections: () => { id: string; label: string }[];
    showMainMenu: () => void;
    getMenuState: () => 'main' | 'guide' | 'game' | 'designer' | null;
    designer: CourseDesigner | null;
  }
}

class GameApp {
  private canvas: HTMLCanvasElement;
  private engine: Engine | null = null;
  private menuScene: Scene | null = null;
  private menuTexture: AdvancedDynamicTexture | null = null;
  private launchScreen: LaunchScreen | null = null;
  private userManual: UserManual | null = null;
  private game: BabylonMain | null = null;
  private designer: CourseDesigner | null = null;
  private setupDialog: CourseSetupDialog | null = null;
  private progressManager = getProgressManager();

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;

    if (!this.canvas) {
      throw new Error(`Canvas element '${canvasId}' not found`);
    }
  }

  public async start(): Promise<void> {
    // Show launch screen
    this.showLaunchScreen();
  }

  private showLaunchScreen(): void {
    // Create engine and menu scene
    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.menuScene = new Scene(this.engine);
    this.menuScene.clearColor = new Color4(0.05, 0.12, 0.08, 1);

    // Add a camera (required for rendering, even just for GUI)
    new FreeCamera('menuCamera', new Vector3(0, 0, -10), this.menuScene);

    // Create single shared GUI texture (only one fullscreen GUI per scene!)
    this.menuTexture = AdvancedDynamicTexture.CreateFullscreenUI('MenuUI', true, this.menuScene);

    // Create launch screen with shared texture
    this.launchScreen = new LaunchScreen(this.engine, this.menuScene, {
      onStartScenario: (scenario: ScenarioDefinition) => {
        this.startGame(scenario, false);
      },
      onContinueScenario: (scenario: ScenarioDefinition) => {
        this.startGame(scenario, true);
      },
      onOpenManual: () => {
        this.showUserManual();
      },
      onOpenDesigner: () => {
        this.showCourseSetupDialog();
      },
      onPlayCustomCourse: (course: CustomCourseData) => {
        this.startCustomGame(course);
      },
      onEditCustomCourse: (course: CustomCourseData) => {
        this.startDesigner({ editCourse: course });
      },
    }, this.menuTexture);

    // Create user manual with same shared texture
    this.userManual = new UserManual(this.engine, this.menuScene, {
      onClose: () => {
        this.hideUserManual();
      }
    }, this.menuTexture);

    // Start render loop for menu
    this.engine.runRenderLoop(() => {
      this.menuScene?.render();
    });

    // Handle resize
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  public startGame(scenario: ScenarioDefinition, loadFromSave: boolean = false): void {
    this.disposeMenu();

    // Record last played scenario
    this.progressManager.setLastPlayedScenario(scenario.id);

    // Start the actual game
    this.game = startBabylonGame('renderCanvas', {
      scenario,
      loadFromSave,
      useVectorTerrain: true,
      onReturnToMenu: () => this.returnToMenu(),
      onScenarioComplete: (score: number) => this.handleScenarioComplete(scenario.id, score)
    });
    window.game = this.game;
  }

  public startScenarioById(id: string, loadFromSave: boolean = false): boolean {
    const scenario = getScenarioById(id);
    if (scenario) {
      this.startGame(scenario, loadFromSave);
      return true;
    }
    console.warn(`Unknown scenario: ${id}. Available: ${SCENARIOS.map(s => s.id).join(', ')}`);
    return false;
  }

  private returnToMenu(): void {
    // Clean up game
    if (this.game) {
      this.game.dispose();
      this.game = null;
      window.game = null;
    }

    // Show launch screen again
    this.showLaunchScreen();
  }

  private disposeMenu(): void {
    if (this.setupDialog) {
      this.setupDialog.dispose();
      this.setupDialog = null;
    }
    if (this.launchScreen) {
      this.launchScreen.dispose();
      this.launchScreen = null;
    }
    if (this.userManual) {
      this.userManual.dispose();
      this.userManual = null;
    }
    if (this.menuTexture) {
      this.menuTexture.dispose();
      this.menuTexture = null;
    }
    if (this.menuScene) {
      this.menuScene.dispose();
      this.menuScene = null;
    }
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
  }

  private showCourseSetupDialog(): void {
    if (!this.menuTexture) return;

    this.setupDialog = new CourseSetupDialog(this.menuTexture, {
      onCreate: (result: CourseSetupResult) => {
        this.setupDialog?.dispose();
        this.setupDialog = null;
        this.startDesigner({
          blank: { width: result.width, height: result.height, name: result.name },
          templateCourseId: result.templateCourseId,
        });
      },
      onCancel: () => {
        this.setupDialog?.dispose();
        this.setupDialog = null;
      },
    });
  }

  public startDesigner(options: CourseDesignerOptions): void {
    this.disposeMenu();

    this.designer = new CourseDesigner('renderCanvas', {
      ...options,
      onExit: () => this.returnFromDesigner(),
    });
    window.designer = this.designer;
  }

  private returnFromDesigner(): void {
    if (this.designer) {
      this.designer.dispose();
      this.designer = null;
      window.designer = null;
    }
    this.showLaunchScreen();
  }

  private startCustomGame(course: CustomCourseData): void {
    const scenario = createSandboxScenario(course);
    this.startGame(scenario, false);
  }

  private showUserManual(): void {
    if (this.launchScreen) {
      this.launchScreen.hide();
    }
    if (this.userManual) {
      this.userManual.show();
    }
  }

  private hideUserManual(): void {
    if (this.userManual) {
      this.userManual.hide();
    }
    if (this.launchScreen) {
      this.launchScreen.show();
    }
  }

  private handleScenarioComplete(scenarioId: string, score: number): void {
    this.progressManager.completeScenario(scenarioId, score);
    console.log(`Scenario ${scenarioId} completed with score ${score}`);
  }

  public getGame(): BabylonMain | null {
    return this.game;
  }

  public showGuide(): void {
    if (this.menuScene && this.launchScreen && this.userManual) {
      this.showUserManual();
    }
  }

  public hideGuide(): void {
    if (this.menuScene && this.launchScreen && this.userManual) {
      this.hideUserManual();
    }
  }

  public isGuideVisible(): boolean {
    return this.userManual?.isVisible() ?? false;
  }

  public navigateGuideSection(sectionId: string): void {
    if (this.userManual) {
      this.userManual.navigateToSection(sectionId);
    }
  }

  public getGuideSection(): string | null {
    if (this.userManual) {
      return this.userManual.getCurrentSection();
    }
    return null;
  }

  public listGuideSections(): { id: string; label: string }[] {
    if (this.userManual) {
      return this.userManual.getAvailableSections();
    }
    return [];
  }

  public showMainMenu(): void {
    if (this.userManual?.isVisible()) {
      this.hideUserManual();
    }
  }

  public getMenuState(): 'main' | 'guide' | 'game' | 'designer' | null {
    if (this.designer) {
      return 'designer';
    }
    if (this.game) {
      return 'game';
    }
    if (this.userManual?.isVisible()) {
      return 'guide';
    }
    if (this.launchScreen) {
      return 'main';
    }
    return null;
  }
}

// Create and start the app
const app = new GameApp('renderCanvas');
window.app = app;
window.game = null;
window.designer = null;
app.start();

window.captureScreenshot = async (): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.download = `greenkeeper-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      resolve(dataUrl);
    } else {
      resolve('');
    }
  });
};

window.exportGameState = () => {
  console.log('Game state export not yet implemented for Babylon.js version');
};

window.listScenarios = () => SCENARIOS.map(s => s.id);

window.startScenario = (id: string, loadFromSave: boolean = false) => {
  return window.app.startScenarioById(id, loadFromSave);
};

window.getScenarioState = () => {
  if (window.game) {
    return window.game.getScenarioState();
  }
  return null;
};

window.getEconomyState = () => {
  if (window.game) {
    return window.game.getEconomyState();
  }
  return null;
};

window.getPrestigeState = () => {
  if (window.game) {
    return window.game.getPrestigeState();
  }
  return null;
};

window.purchaseAmenity = (upgradeType: string) => {
  if (window.game) {
    return window.game.purchaseAmenity(upgradeType);
  }
  return false;
};

window.getTeeTimeStats = () => {
  if (window.game) {
    return window.game.getTeeTimeStats();
  }
  return null;
};

window.getMarketingStats = () => {
  if (window.game) {
    return window.game.getMarketingStats();
  }
  return null;
};

window.startMarketingCampaign = (campaignId: string, days?: number) => {
  if (window.game) {
    return window.game.startMarketingCampaign(campaignId, days);
  }
  return false;
};

window.setCash = (amount: number) => {
  if (window.game) {
    window.game.setCash(amount);
  }
};

window.advanceDay = () => {
  if (window.game) {
    window.game.advanceDay();
  }
};

window.getGameDay = () => {
  if (window.game) {
    return window.game.getGameDay();
  }
  return null;
};

window.saveGame = () => {
  if (window.game) {
    window.game.saveCurrentGame();
  }
};

window.hasSave = (scenarioId: string) => {
  return hasSave(scenarioId);
};

window.clearSave = (scenarioId: string) => {
  deleteSave(scenarioId);
};

window.showGuide = () => {
  window.app.showGuide();
};

window.hideGuide = () => {
  window.app.hideGuide();
};

window.isGuideVisible = () => {
  return window.app.isGuideVisible();
};

window.navigateGuideSection = (sectionId: string) => {
  window.app.navigateGuideSection(sectionId);
};

window.getGuideSection = () => {
  return window.app.getGuideSection();
};

window.listGuideSections = () => {
  return window.app.listGuideSections();
};

window.showMainMenu = () => {
  window.app.showMainMenu();
};

window.getMenuState = () => {
  return window.app.getMenuState();
};
