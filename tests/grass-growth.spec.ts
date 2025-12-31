import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Grass Growth Over Time', () => {
  test('grass height increases over time', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);

    const initialHeight = await page.evaluate(() => {
      const scene = (window as unknown as { game: Phaser.Game }).game.scene.getScene('GameScene') as unknown as { grassSystem: { getCell: (x: number, y: number) => { height: number } | null } };
      const cell = scene.grassSystem.getCell(25, 20);
      return cell?.height ?? 0;
    });

    await page.waitForTimeout(5000);

    const finalHeight = await page.evaluate(() => {
      const scene = (window as unknown as { game: Phaser.Game }).game.scene.getScene('GameScene') as unknown as { grassSystem: { getCell: (x: number, y: number) => { height: number } | null } };
      const cell = scene.grassSystem.getCell(25, 20);
      return cell?.height ?? 0;
    });

    expect(finalHeight).toBeGreaterThan(initialHeight);
  });

  test('moisture decreases over time', async ({ page }) => {
    await page.goto('/?testMode=true&preset=equipment_test');
    await waitForGameReady(page);

    const initialMoisture = await page.evaluate(() => {
      const scene = (window as unknown as { game: Phaser.Game }).game.scene.getScene('GameScene') as unknown as { grassSystem: { getCell: (x: number, y: number) => { moisture: number } | null } };
      const cell = scene.grassSystem.getCell(25, 20);
      return cell?.moisture ?? 0;
    });

    await page.waitForTimeout(5000);

    const finalMoisture = await page.evaluate(() => {
      const scene = (window as unknown as { game: Phaser.Game }).game.scene.getScene('GameScene') as unknown as { grassSystem: { getCell: (x: number, y: number) => { moisture: number } | null } };
      const cell = scene.grassSystem.getCell(25, 20);
      return cell?.moisture ?? 0;
    });

    expect(finalMoisture).toBeLessThan(initialMoisture);
  });

  test('nutrients decrease over time', async ({ page }) => {
    await page.goto('/?testMode=true&preset=equipment_test');
    await waitForGameReady(page);

    const initialNutrients = await page.evaluate(() => {
      const scene = (window as unknown as { game: Phaser.Game }).game.scene.getScene('GameScene') as unknown as { grassSystem: { getCell: (x: number, y: number) => { nutrients: number } | null } };
      const cell = scene.grassSystem.getCell(25, 20);
      return cell?.nutrients ?? 0;
    });

    await page.waitForTimeout(5000);

    const finalNutrients = await page.evaluate(() => {
      const scene = (window as unknown as { game: Phaser.Game }).game.scene.getScene('GameScene') as unknown as { grassSystem: { getCell: (x: number, y: number) => { nutrients: number } | null } };
      const cell = scene.grassSystem.getCell(25, 20);
      return cell?.nutrients ?? 0;
    });

    expect(finalNutrients).toBeLessThan(initialNutrients);
  });
});
