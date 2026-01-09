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
 * Navigate to a test preset.
 */
export async function navigateToPreset(page: Page, presetName: string): Promise<void> {
  await page.goto(`/?testMode=true&preset=${presetName}`);
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
 * Navigate with arbitrary state (base64-encoded).
 */
export async function navigateToState(page: Page, base64State: string): Promise<void> {
  await page.goto(`/?testMode=true&state=${base64State}`);
  await waitForGameReady(page);
}

/**
 * Setup a test with a specific preset (alias for navigateToPreset).
 */
export async function setupTest(page: Page, presetName: string): Promise<void> {
  await navigateToPreset(page, presetName);
}
