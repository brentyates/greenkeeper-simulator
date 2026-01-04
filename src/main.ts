import { BabylonMain, startBabylonGame } from './babylon/BabylonMain';
import { getPreset, listPresets } from './data/testPresets';
import { GameStateSerializer } from './systems/GameStateSerializer';
import { GameState } from './systems/GameState';
import { ScenarioDefinition, getScenarioById, SCENARIOS } from './data/scenarioData';
import { hasSave, deleteSave } from './core/save-game';
import { getProgressManager } from './systems/ProgressManager';
import { LaunchScreen } from './babylon/ui/LaunchScreen';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface StartupParams {
  preset?: string;
  state?: GameState;
  headless?: boolean;
  testMode?: boolean;
  scene?: string;
  skipMenu?: boolean;
  scenario?: ScenarioDefinition;
  loadFromSave?: boolean;
}

function parseURLParams(): StartupParams {
  const params = new URLSearchParams(window.location.search);
  const result: StartupParams = {};

  const presetName = params.get('preset');
  if (presetName) {
    const preset = getPreset(presetName);
    if (preset) {
      result.preset = presetName;
      result.state = preset;
      result.skipMenu = true;
      console.log(`Loaded preset: ${presetName}`);
    } else {
      console.warn(`Unknown preset: ${presetName}. Available presets: ${listPresets().join(', ')}`);
    }
  }

  const stateParam = params.get('state');
  if (stateParam && !result.state) {
    try {
      result.state = GameStateSerializer.fromBase64(stateParam);
      result.skipMenu = true;
      console.log('Loaded state from URL parameter');
    } catch (e) {
      console.error('Failed to parse state from URL:', e);
    }
  }

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

  const scene = params.get('scene');
  if (scene) {
    result.scene = scene;
    console.log(`Scene override: ${scene}`);
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
    loadPreset: (name: string) => void;
    listPresets: () => string[];
    listScenarios: () => string[];
    loadScenario: (id: string) => void;
    getScenarioState: () => { progress: number; completed: boolean; failed: boolean; message?: string } | null;
    getEconomyState: () => { cash: number; earned: number; spent: number } | null;
    setCash: (amount: number) => void;
    advanceDay: () => void;
    getGameDay: () => number | null;
    saveGame: () => void;
    hasSave: (scenarioId: string) => boolean;
    clearSave: (scenarioId: string) => void;
    app: GameApp;
  }
}

class GameApp {
  private canvas: HTMLCanvasElement;
  private engine: Engine | null = null;
  private menuScene: Scene | null = null;
  private launchScreen: LaunchScreen | null = null;
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

    // Create launch screen
    this.launchScreen = new LaunchScreen(this.engine, this.menuScene, {
      onStartScenario: (scenario: ScenarioDefinition) => {
        this.startGame(scenario, false);
      },
      onContinueScenario: (scenario: ScenarioDefinition) => {
        this.startGame(scenario, true);
      }
    });

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

  private handleScenarioComplete(scenarioId: string, score: number): void {
    this.progressManager.completeScenario(scenarioId, score);
    console.log(`Scenario ${scenarioId} completed with score ${score}`);
  }

  public getGame(): BabylonMain | null {
    return this.game;
  }
}

const startupParams = parseURLParams();
window.startupParams = startupParams;

window.listPresets = listPresets;

window.loadPreset = (name: string) => {
  const preset = getPreset(name);
  if (preset) {
    window.location.search = `?preset=${name}`;
  } else {
    console.warn(`Unknown preset: ${name}. Available: ${listPresets().join(', ')}`);
  }
};

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
