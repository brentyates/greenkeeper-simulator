import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle, pressKey } from './utils/test-helpers';

test.describe('Player Movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
    await page.waitForTimeout(300);
  });

  test('player moves in all 4 isometric directions', async ({ page }) => {
    const getPlayerPosition = () => page.evaluate(() => {
      const game = (window as unknown as { game: Phaser.Game }).game;
      const scene = game.scene.getScene('GameScene') as unknown as { getPlayer: () => { getGridPosition: () => { x: number; y: number } } };
      return scene.getPlayer().getGridPosition();
    });

    const initialPos = await getPlayerPosition();

    await pressKey(page, 'ArrowUp');
    await waitForPlayerIdle(page);
    const upPos = await getPlayerPosition();
    expect(upPos.y).toBe(initialPos.y - 1);
    expect(upPos.x).toBe(initialPos.x);

    await pressKey(page, 'ArrowRight');
    await waitForPlayerIdle(page);
    const rightPos = await getPlayerPosition();
    expect(rightPos.x).toBe(upPos.x + 1);
    expect(rightPos.y).toBe(upPos.y);

    await pressKey(page, 'ArrowDown');
    await waitForPlayerIdle(page);
    const downPos = await getPlayerPosition();
    expect(downPos.y).toBe(rightPos.y + 1);
    expect(downPos.x).toBe(rightPos.x);

    await pressKey(page, 'ArrowLeft');
    await waitForPlayerIdle(page);
    const leftPos = await getPlayerPosition();
    expect(leftPos.x).toBe(downPos.x - 1);
    expect(leftPos.y).toBe(downPos.y);
  });

  test('player direction updates correctly', async ({ page }) => {
    const getPlayerDirection = () => page.evaluate(() => {
      const game = (window as unknown as { game: Phaser.Game }).game;
      const scene = game.scene.getScene('GameScene') as unknown as { getPlayer: () => { getDirection: () => string } };
      return scene.getPlayer().getDirection();
    });

    await pressKey(page, 'ArrowUp');
    await waitForPlayerIdle(page);
    expect(await getPlayerDirection()).toBe('up');

    await page.waitForTimeout(200);

    await pressKey(page, 'ArrowRight');
    await waitForPlayerIdle(page);
    expect(await getPlayerDirection()).toBe('right');

    await pressKey(page, 'ArrowDown');
    await waitForPlayerIdle(page);
    expect(await getPlayerDirection()).toBe('down');

    await pressKey(page, 'ArrowLeft');
    await waitForPlayerIdle(page);
    expect(await getPlayerDirection()).toBe('left');
  });

  test('player stops at map boundaries', async ({ page }) => {
    await page.goto('/?testMode=true&preset=corner_bottom_left');
    await waitForGameReady(page);
    await page.waitForTimeout(300);

    const getPlayerPosition = () => page.evaluate(() => {
      const game = (window as unknown as { game: Phaser.Game }).game;
      const scene = game.scene.getScene('GameScene') as unknown as { getPlayer: () => { getGridPosition: () => { x: number; y: number } } };
      return scene.getPlayer().getGridPosition();
    });

    const initialPos = await getPlayerPosition();

    for (let i = 0; i < 5; i++) {
      await pressKey(page, 'ArrowLeft');
      await waitForPlayerIdle(page);
    }

    const finalPos = await getPlayerPosition();
    expect(finalPos.x).toBeLessThanOrEqual(initialPos.x);
    expect(finalPos.x).toBeGreaterThanOrEqual(0);
  });
});
