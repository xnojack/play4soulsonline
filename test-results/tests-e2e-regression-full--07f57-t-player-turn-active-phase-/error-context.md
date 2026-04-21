# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/regression/full-game.spec.ts >> Full Regression Test Suite >> FR-005: First player turn (active phase)
- Location: tests/e2e/regression/full-game.spec.ts:178:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="active-phase"]') to be visible

```

# Test source

```ts
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
  170 |       // Verify transition to active
  171 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
  172 |       console.log('✓ Sad vote resolved');
  173 |     } catch {
  174 |       console.log('No sad_vote phase (solo game or skipped)');
  175 |     }
  176 |   });
  177 | 
  178 |   test('FR-005: First player turn (active phase)', async ({ browser }) => {
  179 |     console.log('\n--- Test FR-005: First Player Turn ---');
  180 |     const activePlayer = players[0];
  181 |     
  182 |     // Wait for active player
> 183 |     await activePlayer.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
      |                             ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  184 |     await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });
  185 |     
  186 |     console.log(`${activePlayer.name} has priority`);
  187 |     
  188 |     // Record initial stats
  189 |     const initialStats = await activePlayer.getPlayerStats();
  190 |     console.log(`Initial stats: HP=${initialStats.hp}, ATK=${initialStats.atk}, Souls=${initialStats.soulValue}`);
  191 |     
  192 |     // Verify hand count (should be 3 starting loot)
  193 |     expect(initialStats.handCount).toBe(3);
  194 |     console.log('✓ Starting loot dealt (3 cards)');
  195 |     
  196 |     // Attack monster
  197 |     await activePlayer.declareAttack(0);
  198 |     console.log('Declared attack on monster');
  199 |     
  200 |     // Roll dice
  201 |     const roll = await activePlayer.rollDice();
  202 |     expect(roll).toBeGreaterThanOrEqual(1);
  203 |     expect(roll).toBeLessThanOrEqual(6);
  204 |     console.log(`Rolled ${roll}`);
  205 |     
  206 |     // Wait for damage resolution
  207 |     await activePlayer.page.waitForTimeout(1500);
  208 |     
  209 |     // Check for loot phase
  210 |     try {
  211 |       await activePlayer.page.waitForSelector('[data-testid="loot-phase"]', { timeout: 3000 });
  212 |       console.log('Loot phase started');
  213 |       
  214 |       // Draw loot
  215 |       await activePlayer.page.click('[data-testid="draw-loot-button"]');
  216 |       await activePlayer.page.waitForTimeout(1000);
  217 |       
  218 |       const finalStats = await activePlayer.getPlayerStats();
  219 |       expect(finalStats.handCount).toBeGreaterThan(initialStats.handCount);
  220 |       console.log(`Hand increased: ${initialStats.handCount} → ${finalStats.handCount}`);
  221 |     } catch {
  222 |       console.log('No loot phase');
  223 |     }
  224 |     
  225 |     // Pass priority
  226 |     await activePlayer.passPriority();
  227 |     console.log(`${activePlayer.name} passed priority`);
  228 |   });
  229 | 
  230 |   test('FR-006: Subsequent player turns', async ({ browser }) => {
  231 |     console.log('\n--- Test FR-006: Subsequent Turns ---');
  232 |     const maxTurns = 6; // 6 turns total (1.5 per player)
  233 |     let currentTurn = 0;
  234 |     
  235 |     while (currentTurn < maxTurns) {
  236 |       const activePlayer = players[currentTurn % 4];
  237 |       
  238 |       // Wait for active player
  239 |       try {
  240 |         await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 10000 });
  241 |       } catch {
  242 |         // Player may have disconnected or game ended
  243 |         break;
  244 |       }
  245 |       
  246 |       console.log(`Turn ${currentTurn + 1}: ${activePlayer.name}'s turn`);
  247 |       
  248 |       // Get stats
  249 |       const stats = await activePlayer.getPlayerStats();
  250 |       console.log(`  Stats: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}, Hand=${stats.handCount}`);
  251 |       
  252 |       // Do basic action
  253 |       if (currentTurn % 2 === 0) {
  254 |         // Every other turn: attack
  255 |         try {
  256 |           await activePlayer.declareAttack(0);
  257 |           await activePlayer.rollDice();
  258 |         } catch {
  259 |           // No monster to attack
  260 |         }
  261 |       }
  262 |       
  263 |       // Check for win
  264 |       const gameOver = await activePlayer.checkGameOver();
  265 |       if (gameOver) {
  266 |         const winner = await activePlayer.getWinner();
  267 |         console.log(`Game ended! Winner: ${winner}`);
  268 |         break;
  269 |       }
  270 |       
  271 |       currentTurn++;
  272 |       
  273 |       // Small delay between turns
  274 |       await activePlayer.page.waitForTimeout(1000);
  275 |     }
  276 |     
  277 |     console.log(`Completed ${currentTurn} turns`);
  278 |   });
  279 | 
  280 |   test('FR-007: Game log validation', async ({ browser }) => {
  281 |     console.log('\n--- Test FR-007: Game Log Validation ---');
  282 |     const host = players[0];
  283 |     
```