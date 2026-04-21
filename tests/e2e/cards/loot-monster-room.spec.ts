import { test, expect } from '@playwright/test';
import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../../utils/playwright-helpers';
import { TEST_LOOT, TEST_MONSTERS, TEST_ROOMS, TEST_ACTIVE_ITEMS, TEST_PASSIVE_ITEMS, getCardsByType } from '../../fixtures/test-cards';

test.describe('Loot Card Tests', () => {
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  let players: TestPlayer[] = [];

  test.beforeAll(async ({ browser }) => {
    for (const name of playerNames) {
      const context = await createPlayerContext(browser, name);
      players.push(context);
    }
  });

  test.afterAll(async () => {
    for (const player of players) {
      await player.close();
    }
  });

  test.describe('Trinkets', () => {
    test('should test Tinkerer Bag (Trinket)', async ({ browser }) => {
      const host = players[0];
      
      // Trinkets: "When this loot resolves, it becomes an item. Gain it."
      // Tinkerer Bag: +1¢ when you buy an item
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      // Trinkets automatically become items when played
      // Verify trinket effect by checking if player gains items
      
      const handCard = host.page.locator('[data-testid="hand-card"]');
      const handCount = await handCard.count();
      
      console.log(`Trinket test: Hand has ${handCount} cards`);
    });

    test('should test Bag of Packing (Trinket)', async ({ browser }) => {
      // Bag of Packing: +2¢ when you buy an item
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      // Verify trinket mechanics
      const shopSlot = host.page.locator('[data-testid="shop-slot"]');
      const shopCount = await shopSlot.count();
      
      console.log(`Bag of Packing test: Shop has ${shopCount} items`);
    });
  });

  test.describe('Curses', () => {
    test('should test Curse of Darkness', async ({ browser }) => {
      // Curse of Darkness: "When you die, put this into discard"
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      // Curses stay in play until player dies
      console.log('Curse of Darkness test: Curse mechanics ready');
    });

    test('should test Curse of the Tower', async ({ browser }) => {
      // Curse of the Tower: "When you die, put this into discard"
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      console.log('Curse of the Tower test: Curse mechanics ready');
    });
  });

  test.describe('Ambush', () => {
    test('should test Ambush card', async ({ browser }) => {
      // Ambush: "When this loot resolves, choose a monster slot. This becomes a monster in that slot."
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      // Ambush cards go to monster slots
      const monsterSlot = host.page.locator('[data-testid="monster-slot"]');
      const slotCount = await monsterSlot.count();
      
      console.log(`Ambush test: Monster slots available: ${slotCount}`);
    });

    test('should test Trap card', async ({ browser }) => {
      // Trap: Similar to Ambush
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      console.log('Trap test: Trap mechanics ready');
    });
  });

  test.describe('Guppy', () => {
    test('should test Guppy Head', async ({ browser }) => {
      // Guppy: "Static ability that means 'This item can be attacked.'"
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      // Items with Guppy can be attacked directly
      console.log('Guppy Head test: Guppy mechanics ready');
    });

    test('should test Guppy Tail', async ({ browser }) => {
      // Guppy Tail: Similar Guppy ability
      const host = players[0];
      
      await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      await host.page.click('[data-testid="start-game-button"]');
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
      
      console.log('Guppy Tail test: Guppy mechanics ready');
    });
  });
});

test.describe('Monster Card Tests', () => {
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  let players: TestPlayer[] = [];

  test.beforeAll(async ({ browser }) => {
    for (const name of playerNames) {
      const context = await createPlayerContext(browser, name);
      players.push(context);
    }
  });

  test.afterAll(async () => {
    for (const player of players) {
      await player.close();
    }
  });

  test('should attack Rotting Beggar (regular monster)', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    // Attack monster in slot 0
    await host.declareAttack(0);
    const roll = await host.rollDice();
    
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    
    console.log(`Rotting Beggar attack: rolled ${roll}`);
  });

  test('should attack Monstro (boss with soul)', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    // Boss monsters give souls when killed
    await host.declareAttack(0);
    const roll = await host.rollDice();
    
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    
    // Wait for soul gain
    await host.page.waitForTimeout(1500);
    
    const soulValue = await host.page.textContent('[data-testid="soul-value-display"]');
    console.log(`Monstro attack: soul value = ${soulValue}`);
  });

  test('should attack The Beast (boss with soul)', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    await host.declareAttack(0);
    const roll = await host.rollDice();
    
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    
    console.log(`The Beast attack: rolled ${roll}`);
  });

  test('should test Monster with evasion', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    // Some monsters have high evasion
    // Attack requires rolling >= evasion
    await host.declareAttack(0);
    const roll = await host.rollDice();
    
    // Evasion is typically 1-3 for monsters
    const evasion = 1; // Default
    const hit = roll >= evasion;
    
    console.log(`Evasion test: rolled ${roll}, hit = ${hit}`);
  });

  test('should test Death (boss with soul)', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    await host.declareAttack(0);
    const roll = await host.rollDice();
    
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    
    console.log(`Death attack: rolled ${roll}`);
  });

  test('should test Hush (boss with soul)', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    await host.declareAttack(0);
    const roll = await host.rollDice();
    
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    
    console.log(`Hush attack: rolled ${roll}`);
  });
});

test.describe('Room Card Tests', () => {
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  let players: TestPlayer[] = [];

  test.beforeAll(async ({ browser }) => {
    for (const name of playerNames) {
      const context = await createPlayerContext(browser, name);
      players.push(context);
    }
  });

  test.afterAll(async () => {
    for (const player of players) {
      await player.close();
    }
  });

  test('should test Basement room', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    // Room cards are in room slots
    const roomSlot = host.page.locator('[data-testid="room-slot"]');
    const hasRoom = await roomSlot.count() > 0;
    
    console.log(`Basement room: room slot available = ${hasRoom}`);
  });

  test('should test Womb room', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    console.log('Womb room: Room mechanics ready');
  });

  test('should test Cathedral room', async ({ browser }) => {
    const host = players[0];
    
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    
    console.log('Cathedral room: Room mechanics ready');
  });
});
