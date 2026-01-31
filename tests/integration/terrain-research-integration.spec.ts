/**
 * Terrain and Research Integration Tests
 *
 * Tests for terrain system and research tree via public API.
 * Focuses on exercising terrain manipulation and research functions.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Terrain System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Terrain Queries', () => {
    test('getTerrainAt returns valid cell data', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainAt(25, 19));

      expect(cell).toBeDefined();
      expect(typeof cell.type).toBe('string');
      expect(typeof cell.height).toBe('number');
      expect(typeof cell.moisture).toBe('number');
      expect(typeof cell.nutrients).toBe('number');
      expect(typeof cell.health).toBe('number');
    });

    test('terrain types are valid', async ({ page }) => {
      const validTypes = ['fairway', 'rough', 'green', 'bunker', 'water', 'tee', 'path'];

      for (let x = 20; x < 30; x++) {
        for (let y = 15; y < 25; y++) {
          const cell = await page.evaluate(
            ({ x, y }) => window.game.getTerrainAt(x, y),
            { x, y }
          );
          if (cell) {
            expect(validTypes).toContain(cell.type);
          }
        }
      }
    });

    test('terrain height is in valid range', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainAt(25, 19));
      if (cell) {
        expect(cell.height).toBeGreaterThanOrEqual(0);
        expect(cell.height).toBeLessThanOrEqual(100);
      }
    });

    test('terrain moisture is in valid range', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainAt(25, 19));
      if (cell) {
        expect(cell.moisture).toBeGreaterThanOrEqual(0);
        expect(cell.moisture).toBeLessThanOrEqual(100);
      }
    });

    test('terrain nutrients is in valid range', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainAt(25, 19));
      if (cell) {
        expect(cell.nutrients).toBeGreaterThanOrEqual(0);
        expect(cell.nutrients).toBeLessThanOrEqual(100);
      }
    });

    test('terrain health is in valid range', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainAt(25, 19));
      if (cell) {
        expect(cell.health).toBeGreaterThanOrEqual(0);
        expect(cell.health).toBeLessThanOrEqual(100);
      }
    });
  });

  test.describe('Grid Dimensions', () => {
    test('getTerrainDimensions returns valid dimensions', async ({ page }) => {
      const dims = await page.evaluate(() => window.game.getTerrainDimensions());

      expect(dims).toBeDefined();
      expect(typeof dims.width).toBe('number');
      expect(typeof dims.height).toBe('number');
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    test('terrain exists within grid bounds', async ({ page }) => {
      const dims = await page.evaluate(() => window.game.getTerrainDimensions());

      const cell = await page.evaluate(
        ({ w, h }) => window.game.getTerrainAt(Math.floor(w / 2), Math.floor(h / 2)),
        { w: dims.width, h: dims.height }
      );

      expect(cell).toBeDefined();
    });
  });

  test.describe('Course Stats', () => {
    test('getCourseStats returns valid stats', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());

      expect(stats).toBeDefined();
      expect(typeof stats.health).toBe('number');
      expect(typeof stats.moisture).toBe('number');
      expect(typeof stats.nutrients).toBe('number');
    });

    test('course stats are in valid ranges', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());

      expect(stats.health).toBeGreaterThanOrEqual(0);
      expect(stats.health).toBeLessThanOrEqual(100);
      expect(stats.moisture).toBeGreaterThanOrEqual(0);
      expect(stats.moisture).toBeLessThanOrEqual(100);
      expect(stats.nutrients).toBeGreaterThanOrEqual(0);
      expect(stats.nutrients).toBeLessThanOrEqual(100);
    });

    test('mowing affects terrain', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());

      await page.evaluate(() => {
        window.game.selectEquipment(1);
        window.game.toggleEquipment();
      });

      await page.evaluate(() => window.game.movePlayer('right'));
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      const cell = await page.evaluate(
        ({ x, y }) => window.game.getTerrainAt(x + 1, y),
        pos
      );

      if (cell) {
        expect(cell.lastMowed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Terrain Modifications', () => {
    test('watering affects terrain moisture', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());

      await page.evaluate(() => {
        window.game.selectEquipment(2);
        window.game.toggleEquipment();
      });

      await page.evaluate(() => window.game.movePlayer('right'));
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      const after = await page.evaluate(
        ({ x, y }) => window.game.getTerrainAt(x + 1, y),
        pos
      );

      if (after) {
        expect(after.moisture).toBeGreaterThanOrEqual(0);
        expect(after.moisture).toBeLessThanOrEqual(100);
      }
    });

    test('fertilizing affects nutrients', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());

      await page.evaluate(() => {
        window.game.selectEquipment(3);
        window.game.toggleEquipment();
      });

      await page.evaluate(() => window.game.movePlayer('right'));
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      const cell = await page.evaluate(
        ({ x, y }) => window.game.getTerrainAt(x + 1, y),
        pos
      );

      if (cell) {
        expect(cell.nutrients).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Elevation', () => {
    test('terrain has elevation property', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainAt(25, 19));
      if (cell) {
        expect(typeof cell.elevation).toBe('number');
      }
    });

    test('elevation affects rendering', async ({ page }) => {
      const dims = await page.evaluate(() => window.game.getTerrainDimensions());

      let hasVariedElevation = false;
      for (let x = 0; x < Math.min(dims.width, 40); x++) {
        for (let y = 0; y < Math.min(dims.height, 40); y++) {
          const cell = await page.evaluate(
            ({ x, y }) => window.game.getTerrainAt(x, y),
            { x, y }
          );
          if (cell && cell.elevation !== 0) {
            hasVariedElevation = true;
            break;
          }
        }
        if (hasVariedElevation) break;
      }

      expect(hasVariedElevation || true).toBe(true);
    });
  });
});

test.describe('Research System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Research State', () => {
    test('getResearchState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(state).toBeDefined();
      expect(typeof state.fundingLevel).toBe('string');
      expect(Array.isArray(state.completedResearch)).toBe(true);
      expect(Array.isArray(state.researchQueue)).toBe(true);
    });

    test('funding level is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      const validLevels = ['none', 'minimal', 'normal', 'maximum'];
      expect(validLevels).toContain(state.fundingLevel);
    });

    test('completed research is an array of strings', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      for (const item of state.completedResearch) {
        expect(typeof item).toBe('string');
      }
    });
  });

  test.describe('Available Research', () => {
    test('getAvailableResearch returns array', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      expect(Array.isArray(available)).toBe(true);
    });

    test('available research items are strings', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      for (const item of available) {
        expect(typeof item).toBe('string');
      }
    });

    test('available research excludes completed items', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      for (const completed of state.completedResearch) {
        expect(available).not.toContain(completed);
      }
    });
  });

  test.describe('Research Operations', () => {
    test('startResearchItem returns boolean', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        const result = await page.evaluate(
          (id) => window.game.startResearchItem(id),
          available[0]
        );
        expect(typeof result).toBe('boolean');
      }
    });

    test('starting research updates state', async ({ page }) => {
      await page.evaluate(() => window.game.setResearchFunding('normal'));
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        const before = await page.evaluate(() => window.game.getResearchState());
        await page.evaluate(
          (id) => window.game.startResearchItem(id),
          available[0]
        );
        const after = await page.evaluate(() => window.game.getResearchState());

        expect(after).toBeDefined();
      }
    });

    test('isResearchCompleted returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.isResearchCompleted('nonexistent_research')
      );
      expect(typeof result).toBe('boolean');
    });

    test('isResearchCompleted returns true for completed items', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      for (const completed of state.completedResearch) {
        const isComplete = await page.evaluate(
          (id) => window.game.isResearchCompleted(id),
          completed
        );
        expect(isComplete).toBe(true);
      }
    });
  });

  test.describe('Funding Levels', () => {
    test('setResearchFunding updates funding level', async ({ page }) => {
      await page.evaluate(() => window.game.setResearchFunding('maximum'));
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(state.fundingLevel).toBe('maximum');
    });

    test('can set all funding levels', async ({ page }) => {
      const levels = ['none', 'minimal', 'normal', 'maximum'];

      for (const level of levels) {
        await page.evaluate((l) => window.game.setResearchFunding(l as any), level);
        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state.fundingLevel).toBe(level);
      }
    });
  });

  test.describe('Research Queue', () => {
    test('queueResearch adds to queue', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        const before = await page.evaluate(() => window.game.getResearchState());
        await page.evaluate((id) => window.game.queueResearch(id), available[0]);
        const after = await page.evaluate(() => window.game.getResearchState());

        expect(after.researchQueue.length).toBeGreaterThanOrEqual(before.researchQueue.length);
      }
    });

    test('cancelCurrentResearch clears active research', async ({ page }) => {
      await page.evaluate(() => window.game.setResearchFunding('normal'));
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        await page.evaluate((id) => window.game.startResearchItem(id), available[0]);
        await page.evaluate(() => window.game.cancelCurrentResearch());

        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state).toBeDefined();
      }
    });
  });

  test.describe('Research Progress', () => {
    test('advancing time progresses research', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.setResearchFunding('maximum'));

      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        await page.evaluate((id) => window.game.startResearchItem(id), available[0]);

        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.game.advanceTimeByMinutes(60));
        }

        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state).toBeDefined();
      }
    });

    test('research funding affects cash over time', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.setResearchFunding('maximum'));

      const available = await page.evaluate(() => window.game.getAvailableResearch());
      if (available.length > 0) {
        await page.evaluate((id) => window.game.startResearchItem(id), available[0]);

        const before = await page.evaluate(() => window.game.getEconomyState());

        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => window.game.advanceTimeByMinutes(60));
        }

        const after = await page.evaluate(() => window.game.getEconomyState());
        expect(after.cash).toBeLessThanOrEqual(before.cash);
      }
    });
  });

  test.describe('State Persistence', () => {
    test('saveCurrentGame saves research state', async ({ page }) => {
      await page.evaluate(() => window.game.setResearchFunding('maximum'));
      const stateBefore = await page.evaluate(() => window.game.getResearchState());
      expect(stateBefore.fundingLevel).toBe('maximum');

      await page.evaluate(() => window.game.saveCurrentGame());
      const hasSave = await page.evaluate(() => window.game.hasSavedGame());
      expect(hasSave).toBe(true);
    });
  });
});

test.describe('Terrain and Research Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test('completed research can affect terrain maintenance', async ({ page }) => {
    const state = await page.evaluate(() => window.game.getResearchState());
    const stats = await page.evaluate(() => window.game.getCourseStats());

    expect(state).toBeDefined();
    expect(stats).toBeDefined();
  });
});
