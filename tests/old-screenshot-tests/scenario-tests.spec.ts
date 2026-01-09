import { test, expect } from '@playwright/test';

async function waitForGameReady(page: import('@playwright/test').Page, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ready = await page.evaluate(() => window.game !== null);
    if (ready) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Game did not initialize within timeout');
}

test.describe('Scenario System Tests', () => {
  test.describe('Tutorial Scenario', () => {
    test('loads tutorial scenario with correct initial state', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const economyState = await page.evaluate(() => window.getEconomyState());
      expect(economyState).not.toBeNull();
      expect(economyState?.cash).toBeGreaterThanOrEqual(5000);

      const gameDay = await page.evaluate(() => window.getGameDay());
      expect(gameDay).toBe(1);

      const scenarioState = await page.evaluate(() => window.getScenarioState());
      expect(scenarioState).not.toBeNull();
      expect(scenarioState?.completed).toBe(false);
      expect(scenarioState?.failed).toBe(false);
    });

    test('tutorial scenario tracks profit progress', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const scenarioState = await page.evaluate(() => window.getScenarioState());
      expect(scenarioState).not.toBeNull();
      expect(scenarioState?.progress).toBeGreaterThanOrEqual(0);
      expect(scenarioState?.progress).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Scenario Failure - Time Limit', () => {
    test('scenario fails when time limit is exceeded', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      for (let i = 0; i < 31; i++) {
        await page.evaluate(() => window.advanceDay());
      }

      const gameDay = await page.evaluate(() => window.getGameDay());
      expect(gameDay).toBeGreaterThanOrEqual(31);

      const scenarioState = await page.evaluate(() => window.getScenarioState());
      expect(scenarioState?.failed).toBe(true);
    });
  });

  test.describe('Scenario Failure - Bankruptcy', () => {
    test('scenario fails when cash goes below threshold', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.setCash(-1500));
      await page.waitForTimeout(100);

      const economyState = await page.evaluate(() => window.getEconomyState());
      expect(economyState?.cash).toBeLessThan(-1000);

      const scenarioState = await page.evaluate(() => window.getScenarioState());
      expect(scenarioState?.failed).toBe(true);
    });
  });

  test.describe('Scenario Loading', () => {
    test('can list available scenarios', async ({ page }) => {
      await page.goto('/?testMode=true&preset=all_grass_mown');
      await waitForGameReady(page);

      const scenarios = await page.evaluate(() => window.listScenarios());
      expect(scenarios).toContain('tutorial_basics');
      expect(scenarios).toContain('meadowbrook_restoration');
      expect(scenarios.length).toBeGreaterThan(5);
    });

    test('different scenarios have different starting conditions', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);
      const tutorialCash = await page.evaluate(() => window.getEconomyState()?.cash);
      expect(tutorialCash).toBeGreaterThanOrEqual(5000);
      expect(tutorialCash).toBeLessThan(6000);

      await page.goto('/?scenario=meadowbrook_restoration');
      await waitForGameReady(page);
      const meadowbrookCash = await page.evaluate(() => window.getEconomyState()?.cash);
      expect(meadowbrookCash).toBeGreaterThanOrEqual(8000);
      expect(meadowbrookCash).toBeLessThan(9000);
    });
  });

  test.describe('Save/Load Persistence', () => {
    test('game state persists across page reloads', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.clearSave('tutorial_basics'));

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.advanceDay());
      }
      const dayBeforeSave = await page.evaluate(() => window.getGameDay());
      expect(dayBeforeSave).toBe(6);

      await page.evaluate(() => window.saveGame());
      await page.waitForTimeout(100);

      const hasSaveAfter = await page.evaluate(() => window.hasSave('tutorial_basics'));
      expect(hasSaveAfter).toBe(true);

      await page.goto('/?scenario=tutorial_basics&loadFromSave=true');
      await waitForGameReady(page);

      const dayAfterLoad = await page.evaluate(() => window.getGameDay());
      expect(dayAfterLoad).toBe(6);
    });

    test('clearing save removes saved state', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.saveGame());
      await page.waitForTimeout(100);

      const hasSaveBefore = await page.evaluate(() => window.hasSave('tutorial_basics'));
      expect(hasSaveBefore).toBe(true);

      await page.evaluate(() => window.clearSave('tutorial_basics'));

      const hasSaveAfter = await page.evaluate(() => window.hasSave('tutorial_basics'));
      expect(hasSaveAfter).toBe(false);
    });
  });
});
