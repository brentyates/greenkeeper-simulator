/**
 * Irrigation System Integration Tests
 *
 * Tests irrigation system state management without visual assertions.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Irrigation System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test('can place and remove pipes', async ({ page }) => {
    const placed = await page.evaluate(() => window.game.placePipe(10, 10, 'pvc'));
    expect(placed).toBe(true);

    let system = await page.evaluate(() => window.game.getIrrigationSystem());
    expect(system.pipes).toHaveLength(1);
    expect(system.pipes[0].pipeType).toBe('pvc');

    await page.evaluate(() => window.game.removePipe(10, 10));

    system = await page.evaluate(() => window.game.getIrrigationSystem());
    expect(system.pipes).toHaveLength(0);
  });

  test('can place sprinkler heads on pipes', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setCash(10000);
      window.game.placePipe(10, 10, 'pvc');
    });

    const placed = await page.evaluate(() => window.game.placeSprinklerHead(10, 10, 'fixed'));
    expect(placed).toBe(true);

    const system = await page.evaluate(() => window.game.getIrrigationSystem());
    expect(system.sprinklerHeads).toHaveLength(1);
    expect(system.sprinklerHeads[0].sprinklerType).toBe('fixed');
  });

  test('pipe placement costs money', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(1000));

    const initialCash = await page.evaluate(() => window.game.getEconomyState().cash);

    await page.evaluate(() => window.game.placePipe(10, 10, 'pvc'));

    const finalCash = await page.evaluate(() => window.game.getEconomyState().cash);

    expect(finalCash).toBeLessThan(initialCash);
  });

  test('can set sprinkler schedules', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setCash(10000);
      window.game.placePipe(10, 10, 'pvc');
      window.game.placeSprinklerHead(10, 10, 'fixed');
    });

    const system = await page.evaluate(() => window.game.getIrrigationSystem());
    const headId = system.sprinklerHeads[0].id;

    await page.evaluate((id) => {
      window.game.setIrrigationSchedule(id, {
        enabled: true,
        timeRanges: [{ start: 360, end: 420 }],
      });
    }, headId);

    const updatedSystem = await page.evaluate(() => window.game.getIrrigationSystem());
    const updatedHead = updatedSystem.sprinklerHeads[0];

    expect(updatedHead.schedule.enabled).toBe(true);
    expect(updatedHead.schedule.timeRanges).toHaveLength(1);
  });
});
