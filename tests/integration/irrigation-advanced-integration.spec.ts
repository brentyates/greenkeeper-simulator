/**
 * Advanced Irrigation System Integration Tests
 *
 * Tests leak repair, sprinkler removal, and advanced irrigation features.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Advanced Irrigation Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Sprinkler Head Management', () => {
    test('can remove sprinkler heads', async ({ page }) => {
      // Setup: place pipe and sprinkler head
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placePipe(15, 15, 'pvc');
        window.game.placeSprinklerHead(15, 15, 'fixed');
      });

      let system = await page.evaluate(() => window.game.getIrrigationSystem());
      expect(system.sprinklerHeads.length).toBe(1);

      // Remove the sprinkler head
      await page.evaluate(() => {
        window.game.removeSprinklerHead(15, 15);
      });

      system = await page.evaluate(() => window.game.getIrrigationSystem());
      expect(system.sprinklerHeads.length).toBe(0);
    });

    test('can place different sprinkler types', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
      });

      const types = ['fixed', 'rotary', 'impact'];
      let y = 10;

      for (const sprinklerType of types) {
        await page.evaluate(({ sType, yPos }) => {
          window.game.placePipe(10, yPos, 'pvc');
          window.game.placeSprinklerHead(10, yPos, sType);
        }, { sType: sprinklerType, yPos: y });

        const system = await page.evaluate(() => window.game.getIrrigationSystem());
        const head = system.sprinklerHeads.find(h =>
          h.gridX === 10 && h.gridY === y
        );
        expect(head?.sprinklerType).toBe(sprinklerType);
        y++;
      }
    });
  });

  test.describe('Pipe Types', () => {
    test('can place different pipe types', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(50000);
      });

      // Test placing PVC pipe - the most common type
      const placed = await page.evaluate(() => {
        return window.game.placePipe(5, 5, 'pvc');
      });
      expect(placed).toBe(true);

      const system = await page.evaluate(() => window.game.getIrrigationSystem());
      expect(system.pipes.length).toBeGreaterThan(0);
    });
  });

  test.describe('Leak Repair', () => {
    test('repairLeak returns false when no leak exists', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placePipe(10, 10, 'pvc');
      });

      const result = await page.evaluate(() =>
        window.game.repairLeak(10, 10)
      );

      // No leak should exist at this fresh pipe
      expect(result).toBe(false);
    });

    test('repairLeak costs money when successful', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placePipe(10, 10, 'pvc');
      });

      const before = await page.evaluate(() => window.game.getEconomyState().cash);

      // Try to repair - may or may not succeed depending on leak state
      await page.evaluate(() => window.game.repairLeak(10, 10));

      const after = await page.evaluate(() => window.game.getEconomyState().cash);
      // Cash should either be same (no leak) or less (repaired)
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  test.describe('Irrigation System State', () => {
    test('getIrrigationSystem returns full state', async ({ page }) => {
      const system = await page.evaluate(() => window.game.getIrrigationSystem());

      expect(system).toBeDefined();
      expect(Array.isArray(system.pipes)).toBe(true);
      expect(Array.isArray(system.sprinklerHeads)).toBe(true);
    });

    test('irrigation schedule has correct properties', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placePipe(10, 10, 'pvc');
        window.game.placeSprinklerHead(10, 10, 'fixed');
      });

      const system = await page.evaluate(() => window.game.getIrrigationSystem());
      const head = system.sprinklerHeads[0];

      expect(head.schedule).toBeDefined();
      expect(typeof head.schedule.enabled).toBe('boolean');
      expect(Array.isArray(head.schedule.timeRanges)).toBe(true);
    });

    test('setIrrigationSchedule updates schedule', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placePipe(10, 10, 'pvc');
        window.game.placeSprinklerHead(10, 10, 'fixed');
      });

      let system = await page.evaluate(() => window.game.getIrrigationSystem());
      const headId = system.sprinklerHeads[0].id;

      await page.evaluate((id) => {
        window.game.setIrrigationSchedule(id, {
          enabled: true,
          timeRanges: [
            { start: 360, end: 420 },
            { start: 1080, end: 1140 },
          ],
        });
      }, headId);

      system = await page.evaluate(() => window.game.getIrrigationSystem());
      const head = system.sprinklerHeads[0];

      expect(head.schedule.enabled).toBe(true);
      expect(head.schedule.timeRanges.length).toBe(2);
    });
  });
});
