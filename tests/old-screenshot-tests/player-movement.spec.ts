import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Player Movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
    await page.waitForTimeout(300);
  });

  test('player moves in all 4 isometric directions', async ({ page }) => {
    // Use public API to get player position
    const getPlayerPosition = () => page.evaluate(() => window.game.getPlayerPosition());

    const initialPos = await getPlayerPosition();

    // Use public API for movement
    await page.evaluate(() => window.game.movePlayer('up'));
    await page.evaluate(() => window.game.waitForPlayerIdle());
    const upPos = await getPlayerPosition();
    expect(upPos.y).toBe(initialPos.y - 1);
    expect(upPos.x).toBe(initialPos.x);

    await page.evaluate(() => window.game.movePlayer('right'));
    await page.evaluate(() => window.game.waitForPlayerIdle());
    const rightPos = await getPlayerPosition();
    expect(rightPos.x).toBe(upPos.x + 1);
    expect(rightPos.y).toBe(upPos.y);

    await page.evaluate(() => window.game.movePlayer('down'));
    await page.evaluate(() => window.game.waitForPlayerIdle());
    const downPos = await getPlayerPosition();
    expect(downPos.y).toBe(rightPos.y + 1);
    expect(downPos.x).toBe(rightPos.x);

    await page.evaluate(() => window.game.movePlayer('left'));
    await page.evaluate(() => window.game.waitForPlayerIdle());
    const leftPos = await getPlayerPosition();
    expect(leftPos.x).toBe(downPos.x - 1);
    expect(leftPos.y).toBe(downPos.y);
  });

  test('player direction updates correctly (visual test)', async ({ page }) => {
    // This is primarily a visual test - direction changes are visible in sprites
    await page.evaluate(() => window.game.movePlayer('up'));
    await page.evaluate(() => window.game.waitForPlayerIdle());
    await page.waitForTimeout(200);

    await page.evaluate(() => window.game.movePlayer('right'));
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.movePlayer('down'));
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.movePlayer('left'));
    await page.evaluate(() => window.game.waitForPlayerIdle());

    // Direction is reflected visually in the game
    await expect(page).toHaveScreenshot('player-facing-left.png');
  });

  test('player stops at map boundaries', async ({ page }) => {
    await page.goto('/?testMode=true&preset=corner_bottom_left');
    await waitForGameReady(page);
    await page.waitForTimeout(300);

    const getPlayerPosition = () => page.evaluate(() => window.game.getPlayerPosition());

    const initialPos = await getPlayerPosition();

    // Try to move left 5 times - should hit boundary
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('left');
      }
    });
    await page.evaluate(() => window.game.waitForPlayerIdle());

    const finalPos = await getPlayerPosition();
    expect(finalPos.x).toBeLessThanOrEqual(initialPos.x);
    expect(finalPos.x).toBeGreaterThanOrEqual(0);
  });
});
