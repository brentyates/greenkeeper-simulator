import { Page } from '@playwright/test';

// Re-export coverage-enabled test and expect
export { test, expect } from '../fixtures/coverage';

/**
 * Wait for the game to be ready and API to be available.
 */
export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  await page.waitForTimeout(200);
}

/**
 * Wait for player movement to complete.
 */
export async function waitForPlayerIdle(page: Page): Promise<void> {
  await page.evaluate(() => window.game.waitForPlayerIdle());
}

/**
 * Navigate to a scenario and wait for game ready.
 */
export async function navigateToScenario(page: Page, scenarioId: string): Promise<void> {
  await page.goto(`/?testMode=true&scenario=${scenarioId}`);
  await waitForGameReady(page);
}
