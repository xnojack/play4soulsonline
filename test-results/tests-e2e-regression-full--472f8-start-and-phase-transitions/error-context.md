# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/regression/full-game.spec.ts >> Full Regression Test Suite >> FR-002: Game start and phase transitions
- Location: tests/e2e/regression/full-game.spec.ts:64:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../../utils/playwright-helpers';
  3   | 
  4   | /**
  5   |  * Full Regression Test Suite
  6   |  * Tests a complete 4-player game through all phases
  7   |  */
  8   | 
  9   | test.describe('Full Regression Test Suite', () => {
  10  |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  11  |   let players: TestPlayer[] = [];
  12  | 
  13  |   test.beforeAll(async ({ browser }) => {
  14  |     console.log('=== Setting up full regression test ===');
  15  |     for (const name of playerNames) {
  16  |       const context = await createPlayerContext(browser, name);
  17  |       players.push(context);
  18  |     }
  19  |     console.log(`Created ${players.length} player contexts`);
  20  |   });
  21  | 
  22  |   test.afterAll(async () => {
  23  |     console.log('=== Cleaning up test players ===');
  24  |     for (const player of players) {
  25  |       try {
  26  |         await player.close();
  27  |       } catch (e) {
  28  |         console.log(`Error closing player ${player.name}: ${e}`);
  29  |       }
  30  |     }
  31  |     console.log('Test cleanup complete');
  32  |   });
  33  | 
  34  |   test('FR-001: Room creation and player join flow', async ({ browser }) => {
  35  |     console.log('\n--- Test FR-001: Room Creation and Join ---');
  36  |     const host = players[0];
  37  |     
  38  |     // Host creates room
  39  |     const createResult = await host.createRoom();
  40  |     expect(createResult.success).toBe(true);
  41  |     expect(createResult.roomId).toBeDefined();
  42  |     expect(createResult.roomId?.length).toBe(6);
  43  |     
  44  |     const roomId = createResult.roomId!;
  45  |     console.log(`Room created: ${roomId}`);
  46  |     
  47  |     // Other players join
  48  |     const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
  49  |     const joinResults = await Promise.all(joinPromises);
  50  |     
  51  |     for (const result of joinResults) {
  52  |       expect(result.success).toBe(true);
  53  |     }
  54  |     console.log('All players joined successfully');
  55  |     
  56  |     // Verify all 4 players in lobby
  57  |     await waitForAllPlayers(players, 4);
  58  |     
  59  |     // Check lobby UI
  60  |     await host.page.waitForSelector('[data-testid="lobby-page"]', { timeout: 5000 });
  61  |     console.log('Lobby UI verified');
  62  |   });
  63  | 
  64  |   test('FR-002: Game start and phase transitions', async ({ browser }) => {
  65  |     console.log('\n--- Test FR-002: Game Start and Phase Transitions ---');
  66  |     const host = players[0];
  67  |     
  68  |     // Host starts game
> 69  |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
      |                     ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  70  |     await host.page.click('[data-testid="start-game-button"]');
  71  |     console.log('Game started by host');
  72  |     
  73  |     // Monitor phase transitions
  74  |     let phaseCount = 0;
  75  |     
  76  |     try {
  77  |       await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
  78  |       console.log('✓ Transitioned to eden_pick phase');
  79  |       phaseCount++;
  80  |     } catch {
  81  |       try {
  82  |         await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
  83  |         console.log('✓ Transitioned to sad_vote phase');
  84  |         phaseCount++;
  85  |       } catch {
  86  |         await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
  87  |         console.log('✓ Transitioned to active phase');
  88  |         phaseCount++;
  89  |       }
  90  |     }
  91  |     
  92  |     // Verify all players see game board
  93  |     for (const player of players) {
  94  |       await player.page.waitForSelector('[data-testid="game-board"]', { timeout: 5000 });
  95  |     }
  96  |     console.log('All players see game board');
  97  |   });
  98  | 
  99  |   test('FR-003: Eden pick phase (if applicable)', async ({ browser }) => {
  100 |     console.log('\n--- Test FR-003: Eden Pick Phase ---');
  101 |     const host = players[0];
  102 |     
  103 |     try {
  104 |       await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 3000 });
  105 |       
  106 |       // Eden players should see pick modal
  107 |       await host.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 5000 });
  108 |       
  109 |       // Get number of pick options
  110 |       const pickCard = host.page.locator('[data-testid="eden-pick-card"]');
  111 |       const cardCount = await pickCard.count();
  112 |       
  113 |       expect(cardCount).toBe(3);
  114 |       console.log(`✓ Eden pick: ${cardCount} options available`);
  115 |       
  116 |       // Each Eden player picks
  117 |       for (const player of players) {
  118 |         try {
  119 |           await player.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 2000 });
  120 |           await player.page.click('[data-testid="eden-pick-card"]:first-child');
  121 |           console.log(`Player ${player.name} picked starting item`);
  122 |         } catch {
  123 |           // Not an Eden player
  124 |         }
  125 |       }
  126 |       
  127 |       await host.page.waitForTimeout(1000);
  128 |       
  129 |       // Verify exit from eden phase
  130 |       try {
  131 |         await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
  132 |         console.log('✓ Exited eden_pick phase');
  133 |       } catch {
  134 |         await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
  135 |         console.log('✓ Exited eden_pick phase (no sad vote needed)');
  136 |       }
  137 |     } catch {
  138 |       console.log('No eden_pick phase (no Eden characters)');
  139 |     }
  140 |   });
  141 | 
  142 |   test('FR-004: Sad vote phase', async ({ browser }) => {
  143 |     console.log('\n--- Test FR-004: Sad Vote Phase ---');
  144 |     const host = players[0];
  145 |     
  146 |     try {
  147 |       await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 3000 });
  148 |       console.log('Entered sad_vote phase');
  149 |       
  150 |       // All players vote
  151 |       for (const player of players) {
  152 |         try {
  153 |           await player.page.waitForSelector('[data-testid="sad-vote-modal"]', { timeout: 2000 });
  154 |           
  155 |           const voteButton = player.page.locator('[data-testid="sad-vote-player"]');
  156 |           const voteCount = await voteButton.count();
  157 |           
  158 |           if (voteCount > 0) {
  159 |             await voteButton.nth(0).click();
  160 |             console.log(`Player ${player.name} voted`);
  161 |           }
  162 |         } catch {
  163 |           // Player already voted or not applicable
  164 |         }
  165 |       }
  166 |       
  167 |       // Wait for resolution
  168 |       await host.page.waitForTimeout(1000);
  169 |       
```