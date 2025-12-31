import Phaser from 'phaser';
import { GameConfig, createTestConfig } from './config';
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

const config = startupParams.testMode ? createTestConfig() : GameConfig;
const game = new Phaser.Game(config);

window.captureScreenshot = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const scene = game.scene.getScene('GameScene');
    if (!scene) {
      reject(new Error('GameScene not found'));
      return;
    }

    game.renderer.snapshot((image) => {
      if (image instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');

          const link = document.createElement('a');
          link.download = `greenkeeper-${Date.now()}.png`;
          link.href = dataUrl;
          link.click();

          resolve(dataUrl);
        } else {
          reject(new Error('Could not get canvas context'));
        }
      } else {
        reject(new Error('Snapshot did not return an image'));
      }
    });
  });
};

window.exportGameState = () => {
  const gameScene = game.scene.getScene('GameScene') as unknown as {
    getGrassSystem: () => unknown;
    getPlayer: () => unknown;
    getEquipmentManager: () => unknown;
    getTimeSystem: () => unknown;
    getGameStateManager: () => unknown;
    cameras: { main: Phaser.Cameras.Scene2D.Camera };
  } | null;

  if (!gameScene) {
    console.error('GameScene not found');
    return;
  }

  const state = GameStateSerializer.serializeFullState(
    gameScene.getGrassSystem() as Parameters<typeof GameStateSerializer.serializeFullState>[0],
    gameScene.getPlayer() as Parameters<typeof GameStateSerializer.serializeFullState>[1],
    gameScene.getEquipmentManager() as Parameters<typeof GameStateSerializer.serializeFullState>[2],
    gameScene.getTimeSystem() as Parameters<typeof GameStateSerializer.serializeFullState>[3],
    gameScene.getGameStateManager() as Parameters<typeof GameStateSerializer.serializeFullState>[4],
    gameScene.cameras.main
  );

  console.log('Game State:', JSON.stringify(state, null, 2));
  console.log('Base64:', GameStateSerializer.toBase64(state));
};

if (startupParams.headless) {
  game.events.once('ready', () => {
    setTimeout(async () => {
      try {
        const dataUrl = await window.captureScreenshot();
        console.log('Headless screenshot captured:', dataUrl.substring(0, 50) + '...');

        const outputDiv = document.createElement('div');
        outputDiv.id = 'headless-output';
        outputDiv.textContent = 'SCREENSHOT_COMPLETE';
        document.body.appendChild(outputDiv);

      } catch (e) {
        console.error('Headless screenshot failed:', e);
      }
    }, 1000);
  });
}
