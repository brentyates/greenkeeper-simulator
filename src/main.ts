import { startBabylonGame, BabylonMain } from './babylon/BabylonMain';
import { getPreset, listPresets } from './data/testPresets';
import { GameStateSerializer } from './systems/GameStateSerializer';
import { GameState } from './systems/GameState';

export interface StartupParams {
  preset?: string;
  state?: GameState;
  headless?: boolean;
  testMode?: boolean;
  scene?: string;
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
      console.log(`Loaded preset: ${presetName}`);
    } else {
      console.warn(`Unknown preset: ${presetName}. Available presets: ${listPresets().join(', ')}`);
    }
  }

  const stateParam = params.get('state');
  if (stateParam && !result.state) {
    try {
      result.state = GameStateSerializer.fromBase64(stateParam);
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
    console.log('Test mode enabled');
  }

  const scene = params.get('scene');
  if (scene) {
    result.scene = scene;
    console.log(`Scene override: ${scene}`);
  }

  return result;
}

declare global {
  interface Window {
    game: BabylonMain;
    startupParams: StartupParams;
    captureScreenshot: () => Promise<string>;
    exportGameState: () => void;
    loadPreset: (name: string) => void;
    listPresets: () => string[];
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

const game = startBabylonGame('renderCanvas');
window.game = game;

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
