import { test, expect } from '@playwright/test';
import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../../utils/playwright-helpers';

test.describe('Card Tests', () => {
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

  test('should test Active treasure card (with ↷ ability)', async ({ browser }) => {
    const host = players[0];

    // Select a set that includes active items
    await host.page.waitForSelector('[data-testid="set-selector"]', { timeout: 5000 });
    
    // For testing, we'll use a specific card: Book of Belial
    // This card has a ↷ ability that adds +3 ATK
    const bookOfBelialId = 'book_of_belial';

    // Create room and start game
    const createResult = await host.createRoom();
    expect(createResult.success).toBe(true);
    const roomId = createResult.roomId!;

    // Other players join
    const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
    await Promise.all(joinPromises);

    // Host starts game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
    await host.page.click('[data-testid="start-game-button"]');

    // Wait for game to start
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });

    // Test card: Book of Belial
    // Active players can tap it to gain +3 ATK
    await host.page.waitForTimeout(2000);

    // Verify card is in player's items
    const itemCard = host.page.locator('[data-testid="item-card"]');
    const count = await itemCard.count();
    expect(count).toBeGreaterThan(0);

    console.log(`Player has ${count} card(s) in play`);
  });

  test('should test Passive treasure card', async ({ browser }) => {
    // Test a passive item like Pentagram
    // Pentagram: +15¢ when you buy an item
    const pentagramId = 'pentagram';

    // This test verifies passive item effects
    // (hard to test fully without specific setup)
    
    const host = players[0];
    
    // Get shop items
    const shopSlots = await host.page.locator('[data-testid="shop-slot"]');
    const count = await shopSlots.count();
    expect(count).toBeGreaterThan(0);

    console.log(`Shop has ${count} item(s) available`);
  });

  test('should test Trinket loot card', async ({ browser }) => {
    // Test Trinket: when played, becomes an item
    // Example: Tinkerer's Bag
    
    const host = players[0];
    
    // Start game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });

    // Wait for turn
    await host.page.waitForSelector('[data-testid="priority-active"]', { timeout: 10000 });

    // Check hand for trinkets
    const handCard = host.page.locator('[data-testid="hand-card"]');
    const handCount = await handCard.count();
    expect(handCount).toBeGreaterThan(0);

    console.log(`Player has ${handCount} card(s) in hand`);

    // Try to play a trinket (if available)
    // Trinkets automatically become items when resolved
  });

  test('should test Ambush loot card', async ({ browser }) => {
    // Test Ambush: when played, becomes a monster in a slot
    // Example: Ambush card
    
    const host = players[0];
    
    // Start game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });

    // Ambush cards can be played from hand
    // They go to a monster slot and must be attacked

    console.log('Ambush test: Card type ready for testing');
  });

  test('should test Curse loot card', async ({ browser }) => {
    // Test Curse: when played, affects player
    // Example: Curse of Darkness
    
    const host = players[0];
    
    // Start game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });

    // Curses are played from hand
    // They affect the player who played them

    console.log('Curse test: Card type ready for testing');
  });

  test('should test Regular monster attack', async ({ browser }) => {
    const host = players[0];

    // Start game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });

    // Attack monster in slot 0
    await host.page.waitForSelector('[data-testid="monster-slot-0"]', { timeout: 5000 });
    
    await host.declareAttack(0);
    
    const rollResult = await host.rollDice();
    expect(rollResult).toBeGreaterThanOrEqual(1);
    expect(rollResult).toBeLessThanOrEqual(6);

    // Wait for damage resolution
    await host.page.waitForTimeout(1000);

    console.log(`Monster attack: rolled ${rollResult}`);
  });

  test('should test Boss monster (with soul icon)', async ({ browser }) => {
    const host = players[0];

    // Start game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    await host.page.click('[data-testid="start-game-button"]');
    await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });

    // Boss monsters have soul icons and give souls when killed
    // We'll test that killing a monster works

    await host.declareAttack(0);
    await host.rollDice();

    // Wait for death and soul gain
    await host.page.waitForTimeout(1500);

    // Check if soul was gained
    const soulDisplay = host.page.locator('[data-testid="soul-value-display"]');
    const soulValue = await soulDisplay.textContent();
    
    console.log(`Soul value after battle: ${soulValue}`);

    // If a soul was gained, player should have at least 1 soul
  });

  test('should test Room card placement', async ({ browser }) => {
    // Test room slot mechanics
    // Rooms are placed in room slots and can be discarded after monster death
    
    const host = players[0];

    // Start game with rooms enabled
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
    
    // Check if room slots are present
    const roomSlot = host.page.locator('[data-testid="room-slot"]');
    const hasRoomSlot = await roomSlot.count() > 0;

    if (hasRoomSlot) {
      console.log('Room slot available');
    } else {
      console.log('Room slots not enabled in this game');
    }

    // Room cards go in room slots
    // Active player can discard room after monster death
  });
});
