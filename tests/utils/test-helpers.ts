import { Page } from '@playwright/test';

export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForSelector('#game-ready', { timeout: 10000 });
}

export async function navigateToPreset(page: Page, presetName: string): Promise<void> {
  await page.goto(`/?testMode=true&preset=${presetName}`);
  await waitForGameReady(page);
}

export async function navigateToState(page: Page, base64State: string): Promise<void> {
  await page.goto(`/?testMode=true&state=${base64State}`);
  await waitForGameReady(page);
}

export async function setupTest(page: Page, presetName: string): Promise<void> {
  await navigateToPreset(page, presetName);
}

export async function navigateToTestHarness(page: Page): Promise<void> {
  await page.goto('/?testMode=true&scene=TestHarnessScene');
  await page.waitForSelector('#game-ready', { timeout: 10000 });
}
