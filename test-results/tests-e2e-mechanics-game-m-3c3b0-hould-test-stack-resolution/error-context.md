# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/mechanics/game-mechanics.spec.ts >> Mechanics Tests >> Priority and Stack >> should test stack resolution
- Location: tests/e2e/mechanics/game-mechanics.spec.ts:42:9

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
  3   | 
  4   | test.describe('Mechanics Tests', () => {
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
  21  |   test.describe('Priority and Stack', () => {
  22  |     test('should test priority passing', async ({ browser }) => {
  23  |       const host = players[0];
  24  |       
  25  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
  26  |       await host.page.click('[data-testid="start-game-button"]');
  27  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  28  |       
  29  |       // Active player should have priority
  30  |       await host.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });
  31  |       
  32  |       // Pass priority
  33  |       await host.page.click('[data-testid="pass-button"]');
  34  |       
  35  |       // Next player should have priority
  36  |       const nextPlayer = players[1];
  37  |       await nextPlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });
  38  |       
  39  |       console.log('Priority passing: Working correctly');
  40  |     });
  41  | 
  42  |     test('should test stack resolution', async ({ browser }) => {
  43  |       const host = players[0];
  44  |       
> 45  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                       ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  46  |       await host.page.click('[data-testid="start-game-button"]');
  47  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  48  |       
  49  |       // Play a loot card
  50  |       await host.page.waitForSelector('[data-testid="hand-card"]', { timeout: 5000 });
  51  |       
  52  |       const handCard = host.page.locator('[data-testid="hand-card"]');
  53  |       const count = await handCard.count();
  54  |       
  55  |       if (count > 0) {
  56  |         // Play first card in hand
  57  |         await handCard.nth(0).click();
  58  |         await host.page.click('[data-testid="confirm-play-button"]');
  59  |         
  60  |         // Card should go to stack
  61  |         const stack = host.page.locator('[data-testid="stack-item"]');
  62  |         const stackCount = await stack.count();
  63  |         
  64  |         console.log(`Stack resolution: ${stackCount} item(s) on stack`);
  65  |       }
  66  |     });
  67  | 
  68  |     test('should test reaction timing', async ({ browser }) => {
  69  |       const host = players[0];
  70  |       
  71  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  72  |       await host.page.click('[data-testid="start-game-button"]');
  73  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  74  |       
  75  |       // Attack and see if players can react
  76  |       await host.declareAttack(0);
  77  |       
  78  |       // Wait for priority to pass to other players
  79  |       await host.page.waitForTimeout(2000);
  80  |       
  81  |       // Check if other players have priority
  82  |       const otherPlayers = players.slice(1);
  83  |       let hasReactions = false;
  84  |       
  85  |       for (const player of otherPlayers) {
  86  |         try {
  87  |           await player.page.waitForSelector('[data-testid="priority-active"]', { timeout: 1000 });
  88  |           hasReactions = true;
  89  |           console.log(`Player ${player.name} has priority`);
  90  |         } catch {
  91  |           // No priority, continue
  92  |         }
  93  |       }
  94  |       
  95  |       console.log(`Reactions available: ${hasReactions}`);
  96  |     });
  97  |   });
  98  | 
  99  |   test.describe('Eden Pick', () => {
  100 |     test('should handle Eden character starting item pick', async ({ browser }) => {
  101 |       const host = players[0];
  102 |       
  103 |       // Eden characters (like Lost) pick starting items from treasure deck
  104 |       // This happens in eden_pick phase
  105 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  106 |       await host.page.click('[data-testid="start-game-button"]');
  107 |       
  108 |       // Check if we're in eden_pick phase
  109 |       try {
  110 |         await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
  111 |         
  112 |         // Eden player should see pick modal
  113 |         await host.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 5000 });
  114 |         
  115 |         // Pick a card
  116 |         const pickCard = host.page.locator('[data-testid="eden-pick-card"]');
  117 |         const cardCount = await pickCard.count();
  118 |         
  119 |         if (cardCount > 0) {
  120 |           await pickCard.nth(0).click();
  121 |         }
  122 |         
  123 |         console.log(`Eden pick: ${cardCount} options available`);
  124 |       } catch {
  125 |         // Not an Eden game
  126 |         console.log('Eden pick: Not an Eden character game');
  127 |       }
  128 |     });
  129 | 
  130 |     test('should validate Eden pick options', async ({ browser }) => {
  131 |       const host = players[0];
  132 |       
  133 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  134 |       await host.page.click('[data-testid="start-game-button"]');
  135 |       
  136 |       try {
  137 |         await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
  138 |         
  139 |         // Eden pick should offer 3 cards
  140 |         const pickCard = host.page.locator('[data-testid="eden-pick-card"]');
  141 |         const cardCount = await pickCard.count();
  142 |         
  143 |         expect(cardCount).toBe(3);
  144 |         console.log(`Eden options: ${cardCount} cards`);
  145 |       } catch {
```