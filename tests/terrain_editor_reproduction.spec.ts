import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);
    // Enable editor
    await page.keyboard.press("t");
    await page.waitForTimeout(100);
  });

  test("can raise terrain", async ({ page }) => {
    // Select Raise tool (1)
    await page.keyboard.press("1");

    // Click on a specific tile (center of screen roughly)
    // Assuming 64x32 tiles, center is roughly 32, 16.
    // We need to click in screen coordinates.
    // Let's just click center of canvas.
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(500); // Wait for visual update

    await expect(page).toHaveScreenshot("editor-raise.png");
  });

  test("can lower terrain", async ({ page }) => {
    // Raising first so we can lower (default elevation might be 0)
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.keyboard.press("1"); // Raise
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(200);

    // Select Lower tool (2)
    await page.keyboard.press("2");
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-lower.png");
  });

  test("can change brush size", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Increase brush size (+)
    // Increase brush size (+) with '.' key
    await page.keyboard.press(".");
    await page.waitForTimeout(100);

    // Select Raise tool
    await page.keyboard.press("1");
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-brush-size.png");
  });

  test("can undo action", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Raise
    await page.keyboard.press("1");
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(200);

    // Undo
    // Undo
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-undo.png");
  });

  test("can paint terrain type", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Select Sand/Bunker (R key)
    await page.keyboard.press("r");
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("editor-paint-bunker.png");
  });
});
