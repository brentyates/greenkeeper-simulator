import { Page } from '@playwright/test';

export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForSelector('#game-ready', { state: 'attached', timeout: 10000 });
}

export async function waitForPlayerIdle(page: Page, timeout = 2000): Promise<void> {
  const startTime = Date.now();
  let wasMoving = false;
  let idleFrames = 0;

  while (Date.now() - startTime < timeout) {
    const isMoving = await page.evaluate(() => {
      const game = (window as unknown as { game: Phaser.Game }).game;
      const scene = game.scene.getScene('GameScene') as unknown as { getPlayer: () => { getIsMoving: () => boolean } };
      return scene.getPlayer().getIsMoving();
    });

    if (isMoving) {
      wasMoving = true;
      idleFrames = 0;
    } else {
      idleFrames++;
      if (wasMoving || idleFrames >= 3) {
        await page.waitForTimeout(50);
        return;
      }
    }

    await page.waitForTimeout(30);
  }
}

export async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(200);
  await page.keyboard.up(key);
  await page.waitForTimeout(50);
}

export async function navigateToPreset(page: Page, presetName: string): Promise<void> {
  await page.goto(`/?testMode=true&preset=${presetName}`);
  await waitForGameReady(page);
}

export async function navigateToState(page: Page, base64State: string): Promise<void> {
  await page.goto(`/?testMode=true&state=${base64State}`);
  await waitForGameReady(page);
}

export async function setupTest(page: Page, presetName: string): Promise<void> {
  await navigateToPreset(page, presetName);
}

export async function navigateToTestHarness(page: Page): Promise<void> {
  await page.goto('/?testMode=true&scene=TestHarnessScene');
  await page.waitForSelector('#game-ready', { state: 'attached', timeout: 10000 });
}
