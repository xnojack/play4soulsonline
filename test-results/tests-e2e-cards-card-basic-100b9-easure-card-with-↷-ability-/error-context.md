# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/cards/card-basics.spec.ts >> Card Tests >> should test Active treasure card (with ↷ ability)
- Location: tests/e2e/cards/card-basics.spec.ts:21:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="set-selector"]') to be visible

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../../utils/playwright-helpers';
  3   | 
  4   | test.describe('Card Tests', () => {
  5   |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  6   |   let players: TestPlayer[] = [];
  7   | 
  8   |   test.beforeAll(async ({ browser }) => {
  9   |     for (const name of playerNames) {
  10  |       const context = await createPlayerContext(browser, name);
  11  |       players.push(context);
  12  |     }
  13  |   });
  14  | 
  15  |   test.afterAll(async () => {
  16  |     for (const player of players) {
  17  |       await player.close();
  18  |     }
  19  |   });
  20  | 
  21  |   test('should test Active treasure card (with ↷ ability)', async ({ browser }) => {
  22  |     const host = players[0];
  23  | 
  24  |     // Select a set that includes active items
> 25  |     await host.page.waitForSelector('[data-testid="set-selector"]', { timeout: 5000 });
      |                     ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  26  |     
  27  |     // For testing, we'll use a specific card: Book of Belial
  28  |     // This card has a ↷ ability that adds +3 ATK
  29  |     const bookOfBelialId = 'book_of_belial';
  30  | 
  31  |     // Create room and start game
  32  |     const createResult = await host.createRoom();
  33  |     expect(createResult.success).toBe(true);
  34  |     const roomId = createResult.roomId!;
  35  | 
  36  |     // Other players join
  37  |     const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
  38  |     await Promise.all(joinPromises);
  39  | 
  40  |     // Host starts game
  41  |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
  42  |     await host.page.click('[data-testid="start-game-button"]');
  43  | 
  44  |     // Wait for game to start
  45  |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  46  | 
  47  |     // Test card: Book of Belial
  48  |     // Active players can tap it to gain +3 ATK
  49  |     await host.page.waitForTimeout(2000);
  50  | 
  51  |     // Verify card is in player's items
  52  |     const itemCard = host.page.locator('[data-testid="item-card"]');
  53  |     const count = await itemCard.count();
  54  |     expect(count).toBeGreaterThan(0);
  55  | 
  56  |     console.log(`Player has ${count} card(s) in play`);
  57  |   });
  58  | 
  59  |   test('should test Passive treasure card', async ({ browser }) => {
  60  |     // Test a passive item like Pentagram
  61  |     // Pentagram: +15¢ when you buy an item
  62  |     const pentagramId = 'pentagram';
  63  | 
  64  |     // This test verifies passive item effects
  65  |     // (hard to test fully without specific setup)
  66  |     
  67  |     const host = players[0];
  68  |     
  69  |     // Get shop items
  70  |     const shopSlots = await host.page.locator('[data-testid="shop-slot"]');
  71  |     const count = await shopSlots.count();
  72  |     expect(count).toBeGreaterThan(0);
  73  | 
  74  |     console.log(`Shop has ${count} item(s) available`);
  75  |   });
  76  | 
  77  |   test('should test Trinket loot card', async ({ browser }) => {
  78  |     // Test Trinket: when played, becomes an item
  79  |     // Example: Tinkerer's Bag
  80  |     
  81  |     const host = players[0];
  82  |     
  83  |     // Start game
  84  |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  85  |     await host.page.click('[data-testid="start-game-button"]');
  86  |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  87  | 
  88  |     // Wait for turn
  89  |     await host.page.waitForSelector('[data-testid="priority-active"]', { timeout: 10000 });
  90  | 
  91  |     // Check hand for trinkets
  92  |     const handCard = host.page.locator('[data-testid="hand-card"]');
  93  |     const handCount = await handCard.count();
  94  |     expect(handCount).toBeGreaterThan(0);
  95  | 
  96  |     console.log(`Player has ${handCount} card(s) in hand`);
  97  | 
  98  |     // Try to play a trinket (if available)
  99  |     // Trinkets automatically become items when resolved
  100 |   });
  101 | 
  102 |   test('should test Ambush loot card', async ({ browser }) => {
  103 |     // Test Ambush: when played, becomes a monster in a slot
  104 |     // Example: Ambush card
  105 |     
  106 |     const host = players[0];
  107 |     
  108 |     // Start game
  109 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  110 |     await host.page.click('[data-testid="start-game-button"]');
  111 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  112 | 
  113 |     // Ambush cards can be played from hand
  114 |     // They go to a monster slot and must be attacked
  115 | 
  116 |     console.log('Ambush test: Card type ready for testing');
  117 |   });
  118 | 
  119 |   test('should test Curse loot card', async ({ browser }) => {
  120 |     // Test Curse: when played, affects player
  121 |     // Example: Curse of Darkness
  122 |     
  123 |     const host = players[0];
  124 |     
  125 |     // Start game
```