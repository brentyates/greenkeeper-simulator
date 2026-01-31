import { BabylonMain, startBabylonGame } from './babylon/BabylonMain';
import { ScenarioDefinition, getScenarioById, SCENARIOS } from './data/scenarioData';
import { hasSave, deleteSave } from './core/save-game';
import { getProgressManager } from './systems/ProgressManager';
import { LaunchScreen } from './babylon/ui/LaunchScreen';
import { UserManual } from './babylon/ui/UserManual';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface StartupParams {
  headless?: boolean;
  testMode?: boolean;
  skipMenu?: boolean;
  scenario?: ScenarioDefinition;
  loadFromSave?: boolean;
}

function parseURLParams(): StartupParams {
  const params = new URLSearchParams(window.location.search);
  const result: StartupParams = {};

  const headless = params.get('headless');
  if (headless === 'true' || headless === '1') {
    result.headless = true;
    console.log('Headless mode enabled');
  }

  const testMode = params.get('testMode');
  if (testMode === 'true' || testMode === '1') {
    result.testMode = true;
    result.skipMenu = true;
    console.log('Test mode enabled');
  }

  const skipMenu = params.get('skipMenu');
  if (skipMenu === 'true' || skipMenu === '1') {
    result.skipMenu = true;
    console.log('Skipping menu');
  }

  const scenarioId = params.get('scenario');
  if (scenarioId) {
    const scenario = getScenarioById(scenarioId);
    if (scenario) {
      result.scenario = scenario;
      result.skipMenu = true;
      console.log(`Loaded scenario: ${scenarioId}`);
    } else {
      console.warn(`Unknown scenario: ${scenarioId}. Available: ${SCENARIOS.map(s => s.id).join(', ')}`);
    }
  }

  const loadFromSave = params.get('loadFromSave');
  if (loadFromSave === 'true' || loadFromSave === '1') {
    result.loadFromSave = true;
  }

  return result;
}

declare global {
  interface Window {
    game: BabylonMain | null;
    startupParams: StartupParams;
    captureScreenshot: () => Promise<string>;
    exportGameState: () => void;
    listScenarios: () => string[];
    loadScenario: (id: string) => void;
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
    getMenuState: () => 'main' | 'guide' | 'game' | null;
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
  private startupParams: StartupParams;
  private progressManager = getProgressManager();

  constructor(canvasId: string, startupParams: StartupParams) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.startupParams = startupParams;

    if (!this.canvas) {
      throw new Error(`Canvas element '${canvasId}' not found`);
    }
  }

  public async start(): Promise<void> {
    // If we have a scenario from URL, start it directly
    if (this.startupParams.scenario) {
      this.startGame(this.startupParams.scenario, this.startupParams.loadFromSave ?? false);
      return;
    }

    // If we have preset/state or skipMenu, go straight to game
    if (this.startupParams.skipMenu) {
      this.startGameDirectly();
      return;
    }

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
      }
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

  private startGame(scenario: ScenarioDefinition, loadFromSave: boolean = false): void {
    // Clean up menu resources
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

    // Record last played scenario
    this.progressManager.setLastPlayedScenario(scenario.id);

    // Start the actual game
    this.game = startBabylonGame('renderCanvas', {
      scenario,
      loadFromSave,
      onReturnToMenu: () => this.returnToMenu(),
      onScenarioComplete: (score: number) => this.handleScenarioComplete(scenario.id, score)
    });
    window.game = this.game;
  }

  private startGameDirectly(): void {
    // Start game without menu (for presets/testing)
    this.game = startBabylonGame('renderCanvas', {
      onReturnToMenu: () => this.returnToMenu()
    });
    window.game = this.game;
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

  public getMenuState(): 'main' | 'guide' | 'game' | null {
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

const startupParams = parseURLParams();
window.startupParams = startupParams;

// Create and start the app
const app = new GameApp('renderCanvas', startupParams);
window.app = app;
window.game = null; // Will be set when game starts
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

window.loadScenario = (id: string) => {
  const scenario = getScenarioById(id);
  if (scenario) {
    window.location.search = `?scenario=${id}`;
  } else {
    console.warn(`Unknown scenario: ${id}. Available: ${SCENARIOS.map(s => s.id).join(', ')}`);
  }
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
