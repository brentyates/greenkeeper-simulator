import { Page } from '@playwright/test';

// Re-export coverage-enabled test and expect
export { test, expect } from '../fixtures/coverage';

/**
 * Wait for the game to be ready and API to be available.
 */
export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  // Give rendering a moment to stabilize
  await page.waitForTimeout(200);
}

/**
 * Wait for player movement to complete using the public API.
 */
export async function waitForPlayerIdle(page: Page): Promise<void> {
  await page.evaluate(() => window.game.waitForPlayerIdle());
}

/**
 * Navigate to test mode and wait for game to be ready.
 */
export async function setupTestMode(page: Page): Promise<void> {
  await page.goto('/?testMode=true');
  await waitForGameReady(page);
}

/**
 * Navigate to a scenario.
 */
export async function navigateToScenario(page: Page, scenarioId: string): Promise<void> {
  await page.goto(`/?testMode=true&scenario=${scenarioId}`);
  await waitForGameReady(page);
}

/**
 * Set all grass cells to mown state (height=0).
 */
export async function setAllGrassMown(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 });
  });
}

/**
 * Set all grass cells to unmown state (height=100).
 */
export async function setAllGrassUnmown(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.game.setAllCellsState({ height: 100, moisture: 50, nutrients: 50, health: 60 });
  });
}

/**
 * Set equipment resources to full.
 */
export async function setFullEquipment(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.game.setEquipmentResource('mower', 100);
    window.game.setEquipmentResource('sprinkler', 100);
    window.game.setEquipmentResource('spreader', 100);
  });
}

/**
 * Set equipment resources to low (for testing refill).
 */
export async function setLowEquipment(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.game.setEquipmentResource('mower', 10);
    window.game.setEquipmentResource('sprinkler', 10);
    window.game.setEquipmentResource('spreader', 10);
  });
}
