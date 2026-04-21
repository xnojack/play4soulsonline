# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/cards/loot-monster-room.spec.ts >> Loot Card Tests >> Curses >> should test Curse of Darkness
- Location: tests/e2e/cards/loot-monster-room.spec.ts:59:9

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../../utils/playwright-helpers';
  3   | import { TEST_LOOT, TEST_MONSTERS, TEST_ROOMS, TEST_ACTIVE_ITEMS, TEST_PASSIVE_ITEMS, getCardsByType } from '../../fixtures/test-cards';
  4   | 
  5   | test.describe('Loot Card Tests', () => {
  6   |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  7   |   let players: TestPlayer[] = [];
  8   | 
  9   |   test.beforeAll(async ({ browser }) => {
  10  |     for (const name of playerNames) {
  11  |       const context = await createPlayerContext(browser, name);
  12  |       players.push(context);
  13  |     }
  14  |   });
  15  | 
  16  |   test.afterAll(async () => {
  17  |     for (const player of players) {
  18  |       await player.close();
  19  |     }
  20  |   });
  21  | 
  22  |   test.describe('Trinkets', () => {
  23  |     test('should test Tinkerer Bag (Trinket)', async ({ browser }) => {
  24  |       const host = players[0];
  25  |       
  26  |       // Trinkets: "When this loot resolves, it becomes an item. Gain it."
  27  |       // Tinkerer Bag: +1¢ when you buy an item
  28  |       
  29  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
  30  |       await host.page.click('[data-testid="start-game-button"]');
  31  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  32  |       
  33  |       // Trinkets automatically become items when played
  34  |       // Verify trinket effect by checking if player gains items
  35  |       
  36  |       const handCard = host.page.locator('[data-testid="hand-card"]');
  37  |       const handCount = await handCard.count();
  38  |       
  39  |       console.log(`Trinket test: Hand has ${handCount} cards`);
  40  |     });
  41  | 
  42  |     test('should test Bag of Packing (Trinket)', async ({ browser }) => {
  43  |       // Bag of Packing: +2¢ when you buy an item
  44  |       const host = players[0];
  45  |       
  46  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  47  |       await host.page.click('[data-testid="start-game-button"]');
  48  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  49  |       
  50  |       // Verify trinket mechanics
  51  |       const shopSlot = host.page.locator('[data-testid="shop-slot"]');
  52  |       const shopCount = await shopSlot.count();
  53  |       
  54  |       console.log(`Bag of Packing test: Shop has ${shopCount} items`);
  55  |     });
  56  |   });
  57  | 
  58  |   test.describe('Curses', () => {
  59  |     test('should test Curse of Darkness', async ({ browser }) => {
  60  |       // Curse of Darkness: "When you die, put this into discard"
  61  |       const host = players[0];
  62  |       
> 63  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                       ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  64  |       await host.page.click('[data-testid="start-game-button"]');
  65  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  66  |       
  67  |       // Curses stay in play until player dies
  68  |       console.log('Curse of Darkness test: Curse mechanics ready');
  69  |     });
  70  | 
  71  |     test('should test Curse of the Tower', async ({ browser }) => {
  72  |       // Curse of the Tower: "When you die, put this into discard"
  73  |       const host = players[0];
  74  |       
  75  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  76  |       await host.page.click('[data-testid="start-game-button"]');
  77  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  78  |       
  79  |       console.log('Curse of the Tower test: Curse mechanics ready');
  80  |     });
  81  |   });
  82  | 
  83  |   test.describe('Ambush', () => {
  84  |     test('should test Ambush card', async ({ browser }) => {
  85  |       // Ambush: "When this loot resolves, choose a monster slot. This becomes a monster in that slot."
  86  |       const host = players[0];
  87  |       
  88  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  89  |       await host.page.click('[data-testid="start-game-button"]');
  90  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  91  |       
  92  |       // Ambush cards go to monster slots
  93  |       const monsterSlot = host.page.locator('[data-testid="monster-slot"]');
  94  |       const slotCount = await monsterSlot.count();
  95  |       
  96  |       console.log(`Ambush test: Monster slots available: ${slotCount}`);
  97  |     });
  98  | 
  99  |     test('should test Trap card', async ({ browser }) => {
  100 |       // Trap: Similar to Ambush
  101 |       const host = players[0];
  102 |       
  103 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  104 |       await host.page.click('[data-testid="start-game-button"]');
  105 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  106 |       
  107 |       console.log('Trap test: Trap mechanics ready');
  108 |     });
  109 |   });
  110 | 
  111 |   test.describe('Guppy', () => {
  112 |     test('should test Guppy Head', async ({ browser }) => {
  113 |       // Guppy: "Static ability that means 'This item can be attacked.'"
  114 |       const host = players[0];
  115 |       
  116 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  117 |       await host.page.click('[data-testid="start-game-button"]');
  118 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  119 |       
  120 |       // Items with Guppy can be attacked directly
  121 |       console.log('Guppy Head test: Guppy mechanics ready');
  122 |     });
  123 | 
  124 |     test('should test Guppy Tail', async ({ browser }) => {
  125 |       // Guppy Tail: Similar Guppy ability
  126 |       const host = players[0];
  127 |       
  128 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  129 |       await host.page.click('[data-testid="start-game-button"]');
  130 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  131 |       
  132 |       console.log('Guppy Tail test: Guppy mechanics ready');
  133 |     });
  134 |   });
  135 | });
  136 | 
  137 | test.describe('Monster Card Tests', () => {
  138 |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  139 |   let players: TestPlayer[] = [];
  140 | 
  141 |   test.beforeAll(async ({ browser }) => {
  142 |     for (const name of playerNames) {
  143 |       const context = await createPlayerContext(browser, name);
  144 |       players.push(context);
  145 |     }
  146 |   });
  147 | 
  148 |   test.afterAll(async () => {
  149 |     for (const player of players) {
  150 |       await player.close();
  151 |     }
  152 |   });
  153 | 
  154 |   test('should attack Rotting Beggar (regular monster)', async ({ browser }) => {
  155 |     const host = players[0];
  156 |     
  157 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
  158 |     await host.page.click('[data-testid="start-game-button"]');
  159 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  160 |     
  161 |     // Attack monster in slot 0
  162 |     await host.declareAttack(0);
  163 |     const roll = await host.rollDice();
```