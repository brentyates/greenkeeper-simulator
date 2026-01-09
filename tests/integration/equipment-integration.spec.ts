/**
 * Equipment System Integration Tests
 *
 * Tests the integration between:
 * - EquipmentManager (Babylon UI layer)
 * - equipment-selection.ts (core logic)
 * - equipment-logic.ts (core logic)
 * - BabylonMain controller
 *
 * These tests verify that the equipment system is correctly wired
 * from user input through to game state changes.
 */

import { test, expect, waitForGameReady } from '../utils/test-helpers';


test.describe('Equipment System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=equipment_test');
    await waitForGameReady(page);
  });

  test.describe('Equipment Selection and Activation', () => {
    test('selecting equipment toggles it on', async ({ page }) => {
      // Initially nothing selected
      let state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBeNull();

      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));

      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBe(0); // Slot 1 maps to index 0
      expect(state.mower?.active).toBe(true);
    });

    test('pressing same equipment button toggles it off', async ({ page }) => {
      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));

      let state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);

      // Press same button again
      await page.evaluate(() => window.game.selectEquipment(1));

      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBeNull();
      expect(state.mower?.active).toBe(false);
    });

    test('switching equipment deactivates previous', async ({ page }) => {
      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));

      let state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);

      // Switch to sprinkler
      await page.evaluate(() => window.game.selectEquipment(2));

      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBe(1);
      expect(state.mower?.active).toBe(false);
      expect(state.sprinkler?.active).toBe(true);
    });

    test('can toggle between all three equipment types', async ({ page }) => {
      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));
      let state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);

      // Switch to sprinkler
      await page.evaluate(() => window.game.selectEquipment(2));
      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.sprinkler?.active).toBe(true);

      // Switch to spreader
      await page.evaluate(() => window.game.selectEquipment(3));
      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.spreader?.active).toBe(true);

      // Back to mower
      await page.evaluate(() => window.game.selectEquipment(1));
      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);
    });
  });

  test.describe('Resource Management', () => {
    test('equipment depletes resources when active', async ({ page }) => {
      // Unpause the game (presets start paused)
      await page.evaluate(() => window.game.unpause());

      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));

      const initialState = await page.evaluate(() => window.game.getEquipmentState());
      const initialFuel = initialState.mower!.resource;

      // Wait for game loop to deplete resources (mower: 0.5 units/sec)
      await page.waitForTimeout(3000);

      const finalState = await page.evaluate(() => window.game.getEquipmentState());

      // Resource should have depleted (0.5 * 3 = ~1.5 units)
      expect(finalState.mower!.resource).toBeLessThan(initialFuel);
      expect(finalState.mower!.active).toBe(true);
    });

    test('equipment auto-deselects when resource depleted', async ({ page }) => {
      // Unpause the game (presets start paused)
      await page.evaluate(() => window.game.unpause());

      // Set very low fuel (will deplete in ~2 sec at 0.5 units/sec)
      await page.evaluate(() => {
        window.game.setEquipmentResource('mower', 1);
        window.game.selectEquipment(1);
      });

      // Wait for fuel to run out
      await page.waitForTimeout(3000);

      const state = await page.evaluate(() => window.game.getEquipmentState());

      // Should auto-deselect when fuel hits zero
      expect(state.selectedSlot).toBeNull();
      expect(state.mower!.resource).toBe(0);
    });

    test('inactive equipment does not deplete resources', async ({ page }) => {
      const initialState = await page.evaluate(() => window.game.getEquipmentState());
      const initialFuel = initialState.mower!.resource;

      // Move without equipment active
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.game.movePlayer('right');
          await window.game.waitForPlayerIdle();
        }
      });

      const finalState = await page.evaluate(() => window.game.getEquipmentState());

      // Resource should NOT have changed
      expect(finalState.mower!.resource).toBe(initialFuel);
    });
  });

  test.describe('Equipment Effects on Terrain', () => {
    test('mowing reduces grass height', async ({ page }) => {
      await page.goto('/?testMode=true&preset=all_grass_unmown');
      await waitForGameReady(page);

      const pos = await page.evaluate(() => window.game.getPlayerPosition());

      // Check initial grass height
      const initialGrass = await page.evaluate(({ x, y }) => {
        return window.game.getTerrainAt(x, y + 1);
      }, pos);

      expect(initialGrass!.height).toBeGreaterThan(0.8); // Unmown

      // Mow the grass
      await page.evaluate(async () => {
        window.game.selectEquipment(1);
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      // Check grass was mowed
      const mownGrass = await page.evaluate(({ x, y }) => {
        return window.game.getTerrainAt(x, y + 1);
      }, pos);

      expect(mownGrass!.height).toBeLessThan(0.3); // Mown!
      expect(mownGrass!.lastMowed).toBeGreaterThan(0); // Timestamp set
    });

    test('watering increases moisture', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());

      // Check initial moisture
      const initialTerrain = await page.evaluate(({ x, y }) => {
        return window.game.getTerrainAt(x, y + 1);
      }, pos);

      const initialMoisture = initialTerrain!.moisture;

      // Water the grass
      await page.evaluate(async () => {
        window.game.selectEquipment(2);
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      // Check moisture increased
      const wateredTerrain = await page.evaluate(({ x, y }) => {
        return window.game.getTerrainAt(x, y + 1);
      }, pos);

      expect(wateredTerrain!.moisture).toBeGreaterThan(initialMoisture);
      expect(wateredTerrain!.lastWatered).toBeGreaterThan(0);
    });

    test('fertilizing increases nutrients', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());

      // Check initial nutrients
      const initialTerrain = await page.evaluate(({ x, y }) => {
        return window.game.getTerrainAt(x, y + 1);
      }, pos);

      const initialNutrients = initialTerrain!.nutrients;

      // Fertilize the grass
      await page.evaluate(async () => {
        window.game.selectEquipment(3);
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      // Check nutrients increased
      const fertilizedTerrain = await page.evaluate(({ x, y }) => {
        return window.game.getTerrainAt(x, y + 1);
      }, pos);

      expect(fertilizedTerrain!.nutrients).toBeGreaterThan(initialNutrients);
      expect(fertilizedTerrain!.lastFertilized).toBeGreaterThan(0);
    });
  });

  test.describe('Refill Station Integration', () => {
    test('player can refill at refill station', async ({ page }) => {
      // Use scenario to get proper economy setup
      await page.goto('/?testMode=true&scenario=tutorial_basics');
      await waitForGameReady(page);

      // Deplete some resources
      await page.evaluate(() => {
        window.game.setEquipmentResource('mower', 50);
        window.game.setEquipmentResource('sprinkler', 30);
        window.game.setEquipmentResource('spreader', 20);
      });

      // Teleport directly to refill station (8, 50)
      await page.evaluate(() => {
        window.game.teleport(8, 50);
      });

      // Verify at station
      const atStation = await page.evaluate(() => window.game.isAtRefillStation());
      expect(atStation).toBe(true);

      // Refill
      const result = await page.evaluate(() => window.game.refillAtCurrentPosition());
      expect(result.success).toBe(true);
      expect(result.cost).toBeGreaterThan(0);

      const afterState = await page.evaluate(() => window.game.getEquipmentState());

      // All equipment should be refilled
      expect(afterState.mower!.resource).toBe(afterState.mower!.max);
      expect(afterState.sprinkler!.resource).toBe(afterState.sprinkler!.max);
      expect(afterState.spreader!.resource).toBe(afterState.spreader!.max);
    });

    test('refill fails when not at station', async ({ page }) => {
      // Move away from station
      await page.evaluate(() => {
        window.game.teleport(5, 5);
      });

      const atStation = await page.evaluate(() => window.game.isAtRefillStation());
      expect(atStation).toBe(false);

      const result = await page.evaluate(() => window.game.refillAtCurrentPosition());
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
    });

    test('refill costs money', async ({ page }) => {
      // Use scenario for proper economy
      await page.goto('/?testMode=true&scenario=tutorial_basics');
      await waitForGameReady(page);

      // Set cash and deplete resources
      await page.evaluate(() => {
        window.game.setCash(1000);
        window.game.setEquipmentResource('mower', 0);
        window.game.setEquipmentResource('sprinkler', 0);
        window.game.setEquipmentResource('spreader', 0);
      });

      const initialCash = await page.evaluate(() => window.game.getEconomyState().cash);

      // Teleport to refill station (8, 50)
      await page.evaluate(() => {
        window.game.teleport(8, 50);
      });

      const result = await page.evaluate(() => window.game.refillAtCurrentPosition());
      expect(result.success).toBe(true);

      const finalCash = await page.evaluate(() => window.game.getEconomyState().cash);

      // Cash should have decreased
      expect(finalCash).toBeLessThan(initialCash);
      expect(finalCash).toBe(initialCash - result.cost);
    });
  });

  test.describe('Particle Effects Integration', () => {
    test('particle effects activate with equipment', async ({ page }) => {
      // No particles initially
      let hasParticles = await page.evaluate(() => window.game.hasActiveParticles());
      expect(hasParticles).toBe(false);

      // Select equipment
      await page.evaluate(() => window.game.selectEquipment(1));

      // Should have particles
      hasParticles = await page.evaluate(() => window.game.hasActiveParticles());
      expect(hasParticles).toBe(true);

      // Deselect
      await page.evaluate(() => window.game.selectEquipment(1));

      // Particles should stop
      hasParticles = await page.evaluate(() => window.game.hasActiveParticles());
      expect(hasParticles).toBe(false);
    });

    test('particles switch when changing equipment', async ({ page }) => {
      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));
      let hasParticles = await page.evaluate(() => window.game.hasActiveParticles());
      expect(hasParticles).toBe(true);

      // Switch to sprinkler
      await page.evaluate(() => window.game.selectEquipment(2));
      hasParticles = await page.evaluate(() => window.game.hasActiveParticles());
      expect(hasParticles).toBe(true); // Should still have particles (different type)
    });
  });

  test.describe('Overlay Mode Integration', () => {
    test('selecting sprinkler switches to moisture overlay', async ({ page }) => {
      const initialOverlay = await page.evaluate(() => window.game.getOverlayMode());
      expect(initialOverlay).toBe('normal');

      await page.evaluate(() => window.game.selectEquipment(2));

      const newOverlay = await page.evaluate(() => window.game.getOverlayMode());
      expect(newOverlay).toBe('moisture');
    });

    test('selecting spreader switches to nutrients overlay', async ({ page }) => {
      await page.evaluate(() => window.game.selectEquipment(3));

      const overlay = await page.evaluate(() => window.game.getOverlayMode());
      expect(overlay).toBe('nutrients');
    });

    test('selecting mower uses normal overlay (no overlay)', async ({ page }) => {
      // First switch to a different overlay
      await page.evaluate(() => window.game.selectEquipment(2));
      expect(await page.evaluate(() => window.game.getOverlayMode())).toBe('moisture');

      // Select mower
      await page.evaluate(() => window.game.selectEquipment(1));

      const overlay = await page.evaluate(() => window.game.getOverlayMode());
      expect(overlay).toBe('normal');
    });

    test('deselecting equipment returns to normal overlay', async ({ page }) => {
      await page.evaluate(() => {
        window.game.selectEquipment(2); // Select sprinkler
        window.game.selectEquipment(2); // Deselect
      });

      const overlay = await page.evaluate(() => window.game.getOverlayMode());
      expect(overlay).toBe('normal');
    });

    test('manually set overlay persists when switching equipment', async ({ page }) => {
      // Manually set overlay to height
      await page.evaluate(() => window.game.setOverlayMode('height'));
      let overlay = await page.evaluate(() => window.game.getOverlayMode());
      expect(overlay).toBe('height');

      // Select mower - should NOT change manually set overlay
      await page.evaluate(() => window.game.selectEquipment(1));
      overlay = await page.evaluate(() => window.game.getOverlayMode());

      expect(overlay).toBe('height');
    });
  });

  test.describe('Edge Cases', () => {
    test('equipment selection persists across movements', async ({ page }) => {
      await page.evaluate(() => window.game.selectEquipment(1));

      await page.evaluate(async () => {
        for (let i = 0; i < 10; i++) {
          window.game.movePlayer('right');
          await window.game.waitForPlayerIdle();
        }
      });

      const state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);
    });

    test('cannot activate equipment with zero resources', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setEquipmentResource('mower', 0);
        window.game.selectEquipment(1);
      });

      const state = await page.evaluate(() => window.game.getEquipmentState());
      // Should not activate with zero resources
      expect(state.selectedSlot).toBeNull();
    });

    test('equipment state accessible via public API', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEquipmentState());

      expect(state).toHaveProperty('selectedSlot');
      expect(state).toHaveProperty('mower');
      expect(state).toHaveProperty('sprinkler');
      expect(state).toHaveProperty('spreader');

      expect(state.mower).toHaveProperty('active');
      expect(state.mower).toHaveProperty('resource');
      expect(state.mower).toHaveProperty('max');
    });

    test('selecting equipment with exactly 0.1 resource allows activation', async ({ page }) => {
      // Ensure game is paused and no equipment is selected to start clean
      // Then atomically set resource and select equipment
      const state = await page.evaluate(() => {
        window.game.pause();
        const current = window.game.getEquipmentState();
        if (current.selectedSlot !== null) {
          window.game.selectEquipment(current.selectedSlot + 1 as 1 | 2 | 3);
        }
        window.game.setEquipmentResource('mower', 0.1);
        window.game.selectEquipment(1);
        return window.game.getEquipmentState();
      });

      // Should be able to activate with minimal resource
      expect(state.selectedSlot).toBe(0);
      expect(state.mower?.active).toBe(true);
    });

    test('pausing game stops resource depletion', async ({ page }) => {
      // Ensure game is unpaused, select equipment
      await page.evaluate(() => {
        window.game.unpause();
        window.game.selectEquipment(1);
      });

      // Wait a bit for initial consumption
      await page.waitForTimeout(100);

      // Atomically capture state AND pause to eliminate race condition
      const before = await page.evaluate(() => {
        const state = window.game.getEquipmentState();
        window.game.pause();
        return state;
      });

      // Wait 2 seconds while paused
      await page.waitForTimeout(2000);

      const after = await page.evaluate(() => window.game.getEquipmentState());

      // Resources should NOT have depleted while paused
      expect(after.mower!.resource).toBeCloseTo(before.mower!.resource, 1);
    });
  });
});
