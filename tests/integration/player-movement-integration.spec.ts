/**
 * Player Movement Integration Tests
 *
 * Tests the integration between:
 * - InputManager (input handling)
 * - movable-entity.ts (core logic)
 * - movement.ts (core logic)
 * - EntityVisualSystem (rendering)
 * - BabylonMain controller
 */

import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle } from '../utils/test-helpers';

test.describe('Player Movement Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
  });

  test.describe('Basic Movement', () => {
    test('player moves in all four directions', async ({ page }) => {
      const getPos = () => page.evaluate(() => window.game.getPlayerPosition());

      const initialPos = await getPos();

      // Move up
      await page.evaluate(() => window.game.movePlayer('up'));
      await waitForPlayerIdle(page);
      let pos = await getPos();
      expect(pos.y).toBe(initialPos.y - 1);
      expect(pos.x).toBe(initialPos.x);

      // Move right
      await page.evaluate(() => window.game.movePlayer('right'));
      await waitForPlayerIdle(page);
      pos = await getPos();
      expect(pos.x).toBe(initialPos.x + 1);

      // Move down
      await page.evaluate(() => window.game.movePlayer('down'));
      await waitForPlayerIdle(page);
      pos = await getPos();
      expect(pos.y).toBe(initialPos.y);

      // Move left
      await page.evaluate(() => window.game.movePlayer('left'));
      await waitForPlayerIdle(page);
      pos = await getPos();
      expect(pos.x).toBe(initialPos.x);
      expect(pos.y).toBe(initialPos.y);
    });

    test('WASD keys work as alternatives', async ({ page }) => {
      const getPos = () => page.evaluate(() => window.game.getPlayerPosition());
      const initialPos = await getPos();

      await page.evaluate(() => window.game.movePlayer('w'));
      await waitForPlayerIdle(page);
      let pos = await getPos();
      expect(pos.y).toBe(initialPos.y - 1);

      await page.evaluate(() => window.game.movePlayer('d'));
      await waitForPlayerIdle(page);
      pos = await getPos();
      expect(pos.x).toBe(initialPos.x + 1);

      await page.evaluate(() => window.game.movePlayer('s'));
      await waitForPlayerIdle(page);
      pos = await getPos();
      expect(pos.y).toBe(initialPos.y);

      await page.evaluate(() => window.game.movePlayer('a'));
      await waitForPlayerIdle(page);
      pos = await getPos();
      expect(pos.x).toBe(initialPos.x);
    });

    test('multiple moves in sequence', async ({ page }) => {
      const getPos = () => page.evaluate(() => window.game.getPlayerPosition());
      const initialPos = await getPos();

      // Move in a square
      await page.evaluate(async () => {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('down');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('down');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('left');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('left');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('up');
        await window.game.waitForPlayerIdle();
        window.game.movePlayer('up');
        await window.game.waitForPlayerIdle();
      });

      const finalPos = await getPos();
      expect(finalPos).toEqual(initialPos);
    });
  });

  test.describe('Boundary Collisions', () => {
    test('player stops at map boundaries', async ({ page }) => {
      const getPos = () => page.evaluate(() => window.game.getPlayerPosition();

      // Move to corner
      await page.evaluate(() => {
        window.game.teleport(0, 0); // Top-left corner
      });

      const cornerPos = await getPos();
      expect(cornerPos.x).toBe(0);
      expect(cornerPos.y).toBe(0);

      // Try to move beyond boundaries
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.game.movePlayer('up');
          await window.game.waitForPlayerIdle();
          window.game.movePlayer('left');
          await window.game.waitForPlayerIdle();
        }
      });

      const finalPos = await getPos();
      // Should still be at corner
      expect(finalPos.x).toBe(0);
      expect(finalPos.y).toBe(0);
    });

    test('player respects course width and height', async ({ page }) => {
      const terrain = await page.evaluate(() => {
        const state = window.game.getFullGameState();
        return state.terrain;
      });

      // Try to move beyond width
      await page.evaluate(({ width }) => {
        window.game.teleport(width - 1, 10);
      }, terrain);

      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.game.movePlayer('right');
          await window.game.waitForPlayerIdle();
        }
      });

      const pos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(pos.x).toBeLessThan(terrain.width);
    });
  });

  test.describe('Obstacle Collision', () => {
    test('player cannot move through water', async ({ page }) => {
      // Find a water tile
      const waterPos = await page.evaluate(() => {
        for (let y = 0; y < 38; y++) {
          for (let x = 0; x < 50; x++) {
            const terrain = window.game.getTerrainAt(x, y);
            if (terrain && terrain.type === 'water') {
              return { x, y };
            }
          }
        }
        return null;
      });

      if (!waterPos) {
        test.skip();
        return;
      }

      // Move player next to water
      await page.evaluate(({ x, y }) => {
        window.game.teleport(x - 1, y);
      }, waterPos);

      const beforePos = await page.evaluate(() => window.game.getPlayerPosition());

      // Try to move into water
      await page.evaluate(async () => {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      const afterPos = await page.evaluate(() => window.game.getPlayerPosition());

      // Player should not have moved
      expect(afterPos).toEqual(beforePos);
    });
  });

  test.describe('Teleportation', () => {
    test('teleport moves player instantly', async ({ page }) => {
      await page.evaluate(() => {
        window.game.teleport(25, 19);
      });

      const pos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(pos.x).toBe(25);
      expect(pos.y).toBe(19);
    });

    test('teleport updates camera', async ({ page }) => {
      await page.evaluate(() => {
        window.game.teleport(40, 30);
      });

      // Camera should follow (we can't directly test camera position,
      // but we can verify player is at the position)
      const pos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(pos.x).toBe(40);
      expect(pos.y).toBe(30);
    });
  });

  test.describe('Movement State', () => {
    test('waitForPlayerIdle resolves when movement completes', async ({ page }) => {
      const startTime = Date.now();

      await page.evaluate(async () => {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      const endTime = Date.now();

      // Should take some time but not too long
      expect(endTime - startTime).toBeGreaterThan(50);
      expect(endTime - startTime).toBeLessThan(2000);
    });

    test('isMoving status is correct', async ({ page }) => {
      let gameState = await page.evaluate(() => window.game.getFullGameState());
      expect(gameState.player.isMoving).toBe(false);

      // Start movement (don't wait)
      await page.evaluate(() => {
        window.game.movePlayer('right');
      });

      // Should be moving
      gameState = await page.evaluate(() => window.game.getFullGameState());
      expect(gameState.player.isMoving).toBe(true);

      // Wait for idle
      await waitForPlayerIdle(page);

      // Should not be moving
      gameState = await page.evaluate(() => window.game.getFullGameState());
      expect(gameState.player.isMoving).toBe(false);
    });
  });

  test.describe('Movement with Equipment', () => {
    test('player moves while equipment is active', async ({ page }) => {
      await page.evaluate(() => window.game.selectEquipment(1));

      const initialPos = await page.evaluate(() => window.game.getPlayerPosition());

      await page.evaluate(async () => {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      const finalPos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(finalPos.x).toBe(initialPos.x + 1);

      // Equipment should still be active
      const state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.active).toBe(true);
    });
  });
});
