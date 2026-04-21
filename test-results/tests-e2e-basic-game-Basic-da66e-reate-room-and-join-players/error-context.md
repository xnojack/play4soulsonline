# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/basic-game.spec.ts >> Basic Game Flow >> should create room and join players
- Location: tests/e2e/basic-game.spec.ts:23:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../utils/playwright-helpers';
  3   | 
  4   | test.describe('Basic Game Flow', () => {
  5   |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  6   |   let players: TestPlayer[] = [];
  7   | 
  8   |   test.beforeAll(async ({ browser }) => {
  9   |     // Create player contexts
  10  |     for (const name of playerNames) {
  11  |       const context = await createPlayerContext(browser, name);
  12  |       players.push(context);
  13  |     }
  14  |   });
  15  | 
  16  |   test.afterAll(async () => {
  17  |     // Clean up all players
  18  |     for (const player of players) {
  19  |       await player.close();
  20  |     }
  21  |   });
  22  | 
  23  |   test('should create room and join players', async ({ browser }) => {
  24  |     const host = players[0];
  25  |     
  26  |     // Host creates room
  27  |     const createResult = await host.createRoom();
> 28  |     expect(createResult.success).toBe(true);
      |                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  29  |     expect(createResult.roomId).toBeDefined();
  30  |     expect(createResult.roomId?.length).toBe(6); // Room codes are 6 chars
  31  | 
  32  |     const roomId = createResult.roomId!;
  33  | 
  34  |     // Wait for room to be visible in URL
  35  |     await expect(host.page).toHaveURL(new RegExp(`/lobby/${roomId}$`));
  36  | 
  37  |     // Other players join
  38  |     const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
  39  |     const joinResults = await Promise.all(joinPromises);
  40  | 
  41  |     for (const result of joinResults) {
  42  |       expect(result.success).toBe(true);
  43  |     }
  44  | 
  45  |     // Wait for all 4 players to join
  46  |     await waitForAllPlayers(players, 4);
  47  |   });
  48  | 
  49  |   test('should start game and transition through phases', async ({ browser }) => {
  50  |     const host = players[0];
  51  | 
  52  |     // Host should be the start game button (host)
  53  |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
  54  |     
  55  |     // Start game
  56  |     await host.page.click('[data-testid="start-game-button"]');
  57  |     
  58  |     // Wait for phase transitions
  59  |     // First: lobby → eden_pick (if Eden character) or sad_vote or active
  60  |     try {
  61  |       await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
  62  |       console.log('Entered eden_pick phase');
  63  |     } catch {
  64  |       try {
  65  |         await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
  66  |         console.log('Entered sad_vote phase');
  67  |       } catch {
  68  |         await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
  69  |         console.log('Entered active phase directly');
  70  |       }
  71  |     }
  72  | 
  73  |     // All players should see game board
  74  |     for (const player of players) {
  75  |       await player.page.waitForSelector('[data-testid="game-board"]', { timeout: 5000 });
  76  |     }
  77  |   });
  78  | 
  79  |   test('should complete first turn with attacks and loot', async ({ browser }) => {
  80  |     const activePlayer = players[0]; // First player is active
  81  |     
  82  |     // Wait for active player's turn
  83  |     await activePlayer.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  84  |     await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });
  85  | 
  86  |     // Get initial stats
  87  |     const initialStats = await activePlayer.getPlayerStats();
  88  |     expect(initialStats.hp).toBeGreaterThan(0);
  89  |     expect(initialStats.handCount).toBe(3); // Starting loot
  90  | 
  91  |     // Attack monster in slot 0
  92  |     await activePlayer.declareAttack(0);
  93  |     
  94  |     // Roll dice
  95  |     const rollResult = await activePlayer.rollDice();
  96  |     expect(rollResult).toBeGreaterThanOrEqual(1);
  97  |     expect(rollResult).toBeLessThanOrEqual(6);
  98  | 
  99  |     // Wait for damage resolution
  100 |     await activePlayer.page.waitForTimeout(1000);
  101 | 
  102 |     // Draw loot (should be available)
  103 |     await activePlayer.page.waitForSelector('[data-testid="loot-phase"]', { timeout: 5000 });
  104 | 
  105 |     // Check updated stats
  106 |     const finalStats = await activePlayer.getPlayerStats();
  107 |     expect(finalStats.hp).toBe(initialStats.hp); // No damage taken
  108 |     expect(finalStats.handCount).toBeGreaterThan(initialStats.handCount);
  109 |   });
  110 | 
  111 |   test('should handle multiple turns and win condition', async ({ browser }) => {
  112 |     // This test verifies turn rotation and soul tracking
  113 |     // We'll track soul counts across turns
  114 | 
  115 |     let currentTurn = 0;
  116 |     const maxTurns = 8; // 2 turns per player
  117 | 
  118 |     while (currentTurn < maxTurns) {
  119 |       // Wait for active player
  120 |       const activePlayer = players[currentTurn % 4];
  121 |       
  122 |       await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 10000 }).catch(() => {});
  123 |       
  124 |       // Record player stats
  125 |       const stats = await activePlayer.getPlayerStats();
  126 |       console.log(`Turn ${currentTurn + 1} - ${activePlayer.name}: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}`);
  127 | 
  128 |       // Do a basic action (attack)
```