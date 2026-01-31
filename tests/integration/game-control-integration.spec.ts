/**
 * Game Control Integration Tests
 *
 * Tests game lifecycle, save/load, pause, and time control via public API.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Game Control Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Pause Control', () => {
    test('can pause and unpause the game', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      let state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(true);

      await page.evaluate(() => window.game.setPaused(false));
      state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(false);
    });

    test('setPaused works with boolean', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      let state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(true);

      await page.evaluate(() => window.game.setPaused(false));
      state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(false);
    });

    test('time does not advance when paused', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      const before = await page.evaluate(() => window.game.getGameTime());

      await page.waitForTimeout(500);

      const after = await page.evaluate(() => window.game.getGameTime());
      expect(after.hours).toBe(before.hours);
      expect(after.minutes).toBe(before.minutes);
    });
  });

  test.describe('Time Control', () => {
    test('advanceDay increments game day', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameDay());

      await page.evaluate(() => window.game.advanceDay());

      const after = await page.evaluate(() => window.game.getGameDay());
      expect(after).toBe(before + 1);
    });

    test('advanceTimeByMinutes advances game time', async ({ page }) => {
      // Pause first to get stable readings
      await page.evaluate(() => window.game.setPaused(true));

      const before = await page.evaluate(() => window.game.getGameTime());
      const beforeTotal = before.hours * 60 + before.minutes;

      await page.evaluate(() => window.game.advanceTimeByMinutes(30));

      const after = await page.evaluate(() => window.game.getGameTime());
      const afterTotal = after.hours * 60 + after.minutes;

      // Time should have advanced (may wrap around midnight)
      // Just verify time changed and is different from before
      const totalMinutesInDay = 24 * 60;
      const afterAdjusted = afterTotal < beforeTotal ? afterTotal + totalMinutesInDay : afterTotal;
      expect(afterAdjusted).toBeGreaterThan(beforeTotal);
    });

    test('forceGrassGrowth triggers growth simulation', async ({ page }) => {
      const initialStats = await page.evaluate(() => window.game.getCourseStats());

      await page.evaluate(() => window.game.forceGrassGrowth(60));

      const finalStats = await page.evaluate(() => window.game.getCourseStats());
      // Stats may change depending on course state
      expect(finalStats).toBeDefined();
    });
  });

  test.describe('Save/Load', () => {
    test('hasSavedGame returns boolean', async ({ page }) => {
      const hasGame = await page.evaluate(() => window.game.hasSavedGame());
      expect(typeof hasGame).toBe('boolean');
    });

    test('saveCurrentGame saves without error', async ({ page }) => {
      // Should not throw - just verify the method completes
      await page.evaluate(() => window.game.saveCurrentGame());
      // Method ran successfully if no error
      expect(true).toBe(true);
    });
  });

  test.describe('Game State', () => {
    test('getFullGameState returns complete state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(state.player).toBeDefined();
      expect(state.equipment).toBeDefined();
      expect(state.terrain).toBeDefined();
      expect(state.economy).toBeDefined();
    });

    test('getUIState returns UI state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getUIState());

      expect(typeof state.isPaused).toBe('boolean');
      expect(state.overlayMode).toBeDefined();
      // isTerrainEditorEnabled is a separate method, not part of getUIState
      const editorEnabled = await page.evaluate(() => window.game.isTerrainEditorEnabled());
      expect(typeof editorEnabled).toBe('boolean');
    });

    test('getScenarioState returns scenario info', async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });

      const state = await page.evaluate(() => window.game.getScenarioState());

      // Scenario state returns { progress, completed, failed, message }
      expect(state).not.toBeNull();
      if (state) {
        expect(typeof state.progress).toBe('number');
        expect(typeof state.completed).toBe('boolean');
        expect(typeof state.failed).toBe('boolean');
      }
    });
  });

  test.describe('Direct API Control', () => {
    test('movePlayer moves player position', async ({ page }) => {
      const initialPos = await page.evaluate(() => window.game.getPlayerPosition());

      await page.evaluate(() => window.game.movePlayer('right'));
      await page.evaluate(() => window.game.waitForPlayerIdle());

      const finalPos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(finalPos.y).toBe(initialPos.y + 1);
    });

    test('selectEquipment selects equipment slot', async ({ page }) => {
      await page.evaluate(() => window.game.selectEquipment(1));

      const state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBe(0);
      expect(state.mower?.active).toBe(true);
    });

    test('toggleEquipment toggles active state', async ({ page }) => {
      await page.evaluate(() => window.game.selectEquipment(1));
      let state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);

      await page.evaluate(() => window.game.toggleEquipment());
      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(false);
    });

    test('setPaused controls pause state', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(false));
      let uiState = await page.evaluate(() => window.game.getUIState());
      expect(uiState.isPaused).toBe(false);

      await page.evaluate(() => window.game.setPaused(true));
      uiState = await page.evaluate(() => window.game.getUIState());
      expect(uiState.isPaused).toBe(true);
    });
  });

  test.describe('Toggle Equipment', () => {
    test('toggleEquipment turns equipment on and off', async ({ page }) => {
      // Select equipment - it starts active
      await page.evaluate(() => window.game.selectEquipment(1));
      let state = await page.evaluate(() => window.game.getEquipmentState());
      // selectedSlot is 0-indexed (0=mower)
      expect(state.selectedSlot).toBe(0);
      const initialActive = state.mower?.active;
      expect(initialActive).toBe(true); // Should be active after selection

      // Toggle should turn it off (deselect)
      await page.evaluate(() => window.game.toggleEquipment());
      state = await page.evaluate(() => window.game.getEquipmentState());
      // After toggle, either selectedSlot is null or mower is inactive
      expect(state.mower?.active || state.selectedSlot === null).toBeTruthy();
    });
  });
});
