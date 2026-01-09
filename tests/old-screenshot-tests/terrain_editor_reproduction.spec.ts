import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);

    // Enable editor via API
    await page.evaluate(() => {
      window.game.enableTerrainEditor();
    });
    await page.waitForTimeout(100);
  });

  test("can raise terrain", async ({ page }) => {
    // Set Raise tool and edit at player position via API
    await page.evaluate(() => {
      window.game.setEditorTool('raise');
      const pos = window.game.getPlayerPosition();
      window.game.editTerrainAt(pos.x, pos.y);
    });
    await page.waitForTimeout(500); // Wait for visual update

    await expect(page).toHaveScreenshot("editor-raise.png");
  });

  test("can lower terrain", async ({ page }) => {
    // Raise first, then lower via API
    await page.evaluate(() => {
      window.game.setEditorTool('raise');
      const pos = window.game.getPlayerPosition();
      window.game.editTerrainAt(pos.x, pos.y);
    });
    await page.waitForTimeout(200);

    // Select Lower tool and click
    await page.evaluate(() => {
      window.game.setEditorTool('lower');
      const pos = window.game.getPlayerPosition();
      window.game.editTerrainAt(pos.x, pos.y);
    });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-lower.png");
  });

  test("can change brush size", async ({ page }) => {
    // Increase brush size and raise terrain via API
    await page.evaluate(() => {
      window.game.setEditorBrushSize(2); // Size 2
      window.game.setEditorTool('raise');
      const pos = window.game.getPlayerPosition();
      window.game.editTerrainAt(pos.x, pos.y);
    });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-brush-size.png");
  });

  test("can undo action", async ({ page }) => {
    // Raise terrain then undo via API
    await page.evaluate(() => {
      window.game.setEditorTool('raise');
      const pos = window.game.getPlayerPosition();
      window.game.editTerrainAt(pos.x, pos.y);
    });
    await page.waitForTimeout(200);

    // Undo via API
    await page.evaluate(() => {
      window.game.undoTerrainEdit();
    });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-undo.png");
  });

  test("can paint terrain type", async ({ page }) => {
    // Paint terrain type at player position via API
    // Note: The 'r' key selects bunker brush, but we need to use the API
    await page.evaluate(() => {
      // Set terrain type directly for testing
      const pos = window.game.getPlayerPosition();
      window.game.setTerrainTypeAt(pos.x, pos.y, 'bunker');
    });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-paint-bunker.png");
  });
});
