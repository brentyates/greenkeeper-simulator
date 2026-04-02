import { test, expect } from '@playwright/test';

test('Quick Playtest - First Day Operations', async ({ page }) => {
  // Playwright config already has baseURL: 'http://localhost:8080'
  await page.goto('/');
  
  // Wait for game to initialize
  await page.waitForFunction(() => (window as any).game !== null, { timeout: 15000 });
  
  // Get initial state
  const initialState = await page.evaluate(() => ({
    cash: (window as any).game.getEconomyState(),
    day: (window as any).game.getGameDay(),
    playerPos: (window as any).game.getPlayerPosition(),
    time: (window as any).game.getGameTime(),
    prestige: (window as any).game.getPrestigeState(),
    holes: (window as any).game.getCourseHoleSummary(),
    equipment: (window as any).game.getEquipmentState(),
    irrigation: (window as any).game.getIrrigationSystem(),
    weather: (window as any).game.getWeatherState(),
  }));
  console.log('Initial state:', JSON.stringify(initialState, null, 2));

  // Move player around
  console.log('Moving player right...');
  await page.evaluate(() => { (window as any).game.movePlayer('right'); });
  await page.waitForTimeout(600);
  const posAfter1 = await page.evaluate(() => (window as any).game.getPlayerPosition());
  console.log('After right move:', posAfter1);

  await page.evaluate(() => { (window as any).game.movePlayer('down'); });
  await page.evaluate(() => { (window as any).game.movePlayer('down'); });
  await page.waitForTimeout(600);
  const posAfter2 = await page.evaluate(() => (window as any).game.getPlayerPosition());
  console.log('After two down moves:', posAfter2);

  // Select equipment (mower)
  console.log('Selecting mower (slot 1)...');
  await page.evaluate(() => { (window as any).game.selectEquipment(1); });
  const eqState = await page.evaluate(() => (window as any).game.getEquipmentState());
  console.log('Equipment state:', JSON.stringify(eqState, null, 2));

  // Check irrigation system  
  const irrigation = await page.evaluate(() => (window as any).game.getIrrigationSystem());
  console.log('Irrigation system keys:', Object.keys(irrigation).join(', '));

  // Advance the day
  console.log('Advancing day...');
  const currentDay = await page.evaluate(() => (window as any).game.getGameDay());
  await page.evaluate(() => { (window as any).game.advanceDay(); });
  const newDay = await page.evaluate(() => (window as any).game.getGameDay());
  console.log(`Day advanced from ${currentDay} to ${newDay}`);

  // Get state after day advance
  const afterDayState = await page.evaluate(() => ({
    cash: (window as any).game.getEconomyState(),
    day: (window as any).game.getGameDay(),
    time: (window as any).game.getGameTime(),
    prestige: (window as any).game.getPrestigeState(),
  }));
  console.log('After day advance:', JSON.stringify(afterDayState, null, 2));

  // Check scenario progress
  const scenario = await page.evaluate(() => (window as any).game.getScenarioState());
  console.log('Scenario state:', JSON.stringify(scenario, null, 2));

  // Test terrain editor
  console.log('Enabling terrain editor...');
  await page.evaluate(() => { (window as any).game.setTerrainEditor(true); });
  const editorEnabled = await page.evaluate(() => (window as any).game.isTerrainEditorEnabled());
  console.log('Terrain editor enabled:', editorEnabled);
  await page.evaluate(() => { (window as any).game.setTerrainEditor(false); });

  console.log('=== Playtest complete! ===');
});
