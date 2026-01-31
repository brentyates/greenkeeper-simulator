/**
 * Terrain and Grass System Integration Tests
 *
 * Tests GrassSystem integration with core logic.
 */

import { test, expect } from '../fixtures/coverage';


test.describe('Terrain and Grass Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('grass grows over time', async ({ page }) => {
    const initialStats = await page.evaluate(() => window.game.getCourseStats());

    // Advance time
    await page.evaluate(() => window.game.advanceTimeByMinutes(60));

    const finalStats = await page.evaluate(() => window.game.getCourseStats());

    expect(finalStats.height).toBeGreaterThan(initialStats.height);
  });

  test('moisture decreases over time', async ({ page }) => {
    const initialStats = await page.evaluate(() => window.game.getCourseStats());

    await page.evaluate(() => window.game.advanceTimeByMinutes(120));

    const finalStats = await page.evaluate(() => window.game.getCourseStats());

    expect(finalStats.moisture).toBeLessThan(initialStats.moisture);
  });

  test('mowing updates course stats', async ({ page }) => {
    const initialStats = await page.evaluate(() => window.game.getCourseStats());

    await page.evaluate(async () => {
      window.game.selectEquipment(1);
      for (let i = 0; i < 20; i++) {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      }
    });

    const finalStats = await page.evaluate(() => window.game.getCourseStats());

    expect(finalStats.height).toBeLessThan(initialStats.height);
  });

  test('elevation is accessible', async ({ page }) => {
    const elevation = await page.evaluate(() => window.game.getElevationAt(10, 10));
    expect(typeof elevation).toBe('number');
  });

  test('terrain type is accessible', async ({ page }) => {
    const type = await page.evaluate(() => window.game.getTerrainTypeAt(10, 10));
    expect(['fairway', 'rough', 'green', 'bunker', 'water', 'tee']).toContain(type);
  });

  test('grass rendering updates when terrain changes', async ({ page }) => {
    const initialCount = await page.evaluate(() => window.game.getGrassRenderUpdateCount());

    await page.evaluate(async () => {
      window.game.selectEquipment(1);
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      }
    });

    const finalCount = await page.evaluate(() => window.game.getGrassRenderUpdateCount());

    expect(finalCount).toBeGreaterThan(initialCount);
  });

  test('overlay modes can be changed', async ({ page }) => {
    await page.evaluate(() => window.game.setOverlayMode('moisture'));
    expect(await page.evaluate(() => window.game.getOverlayMode())).toBe('moisture');

    await page.evaluate(() => window.game.setOverlayMode('nutrients'));
    expect(await page.evaluate(() => window.game.getOverlayMode())).toBe('nutrients');

    await page.evaluate(() => window.game.setOverlayMode('height'));
    expect(await page.evaluate(() => window.game.getOverlayMode())).toBe('height');

    await page.evaluate(() => window.game.setOverlayMode('normal'));
    expect(await page.evaluate(() => window.game.getOverlayMode())).toBe('normal');
  });
});
