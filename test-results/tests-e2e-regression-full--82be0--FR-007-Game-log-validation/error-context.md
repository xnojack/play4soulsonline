# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/regression/full-game.spec.ts >> Full Regression Test Suite >> FR-007: Game log validation
- Location: tests/e2e/regression/full-game.spec.ts:280:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
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
  284 |     // Get game log
  285 |     const log = await host.getGameLog();
> 286 |     expect(log.length).toBeGreaterThan(0);
      |                        ^ Error: expect(received).toBeGreaterThan(expected)
  287 |     console.log(`Game log has ${log.length} entries`);
  288 |     
  289 |     // Check for expected event types
  290 |     const logText = log.join(' ').toLowerCase();
  291 |     
  292 |     const eventTypes = ['attack', 'loot', 'phase', 'turn', 'soul'];
  293 |     let foundEvents = 0;
  294 |     
  295 |     for (const eventType of eventTypes) {
  296 |       if (logText.includes(eventType)) {
  297 |         foundEvents++;
  298 |         console.log(`✓ Found "${eventType}" events`);
  299 |       }
  300 |     }
  301 |     
  302 |     console.log(`Found ${foundEvents}/${eventTypes.length} expected event types`);
  303 |     
  304 |     // Show first 5 log entries
  305 |     console.log('First 5 log entries:');
  306 |     for (let i = 0; i < Math.min(5, log.length); i++) {
  307 |       console.log(`  ${i + 1}. ${log[i]}`);
  308 |     }
  309 |   });
  310 | 
  311 |   test('FR-008: Win condition verification', async ({ browser }) => {
  312 |     console.log('\n--- Test FR-008: Win Condition ---');
  313 |     const host = players[0];
  314 |     
  315 |     // Check win threshold
  316 |     const winSoulValue = 4;
  317 |     
  318 |     // Track soul values across players
  319 |     for (const player of players) {
  320 |       const stats = await player.getPlayerStats();
  321 |       console.log(`${player.name} soul value: ${stats.soulValue}`);
  322 |     }
  323 |     
  324 |     // Check if game has ended
  325 |     const gameOver = await host.checkGameOver();
  326 |     
  327 |     if (gameOver) {
  328 |       const winner = await host.getWinner();
  329 |       expect(winner).toBeDefined();
  330 |       console.log(`✓ Game ended with winner: ${winner}`);
  331 |     } else {
  332 |       console.log('Game still in progress (win condition not yet met)');
  333 |     }
  334 |   });
  335 | 
  336 |   test('FR-009: Deck management', async ({ browser }) => {
  337 |     console.log('\n--- Test FR-008: Deck Management ---');
  338 |     const host = players[0];
  339 |     
  340 |     // Get deck counts
  341 |     const lootDeck = await host.page.textContent('[data-testid="loot-deck-count"]');
  342 |     const monsterDeck = await host.page.textContent('[data-testid="monster-deck-count"]');
  343 |     const treasureDeck = await host.page.textContent('[data-testid="treasure-deck-count"]');
  344 |     
  345 |     console.log(`Deck counts: Loot=${lootDeck}, Monster=${monsterDeck}, Treasure=${treasureDeck}`);
  346 |     
  347 |     // Verify decks have cards
  348 |     expect(parseInt(lootDeck || '0', 10)).toBeGreaterThan(0);
  349 |     expect(parseInt(monsterDeck || '0', 10)).toBeGreaterThan(0);
  350 |     
  351 |     console.log('✓ Decks are populated');
  352 |   });
  353 | 
  354 |   test('FR-010: Shop and item mechanics', async ({ browser }) => {
  355 |     console.log('\n--- Test FR-010: Shop and Item Mechanics ---');
  356 |     const host = players[0];
  357 |     
  358 |     // Check shop slots
  359 |     const shopSlot = await host.page.locator('[data-testid="shop-slot"]');
  360 |     const shopCount = await shopSlot.count();
  361 |     
  362 |     expect(shopCount).toBe(2);
  363 |     console.log(`✓ Shop has ${shopCount} slots`);
  364 |     
  365 |     // Check for purchase buttons
  366 |     const purchaseBtn = await host.page.locator('[data-testid="shop-purchase-button"]');
  367 |     const purchaseCount = await purchaseBtn.count();
  368 |     
  369 |     console.log(`Shop items available for purchase: ${purchaseCount}`);
  370 |   });
  371 | 
  372 |   test('FR-011: Player stats validation', async ({ browser }) => {
  373 |     console.log('\n--- Test FR-011: Player Stats Validation ---');
  374 |     
  375 |     // Check all players have valid stats
  376 |     for (const player of players) {
  377 |       const stats = await player.getPlayerStats();
  378 |       
  379 |       expect(stats.hp).toBeGreaterThan(0);
  380 |       expect(stats.atk).toBeGreaterThanOrEqual(1);
  381 |       expect(stats.handCount).toBeGreaterThanOrEqual(0);
  382 |       expect(stats.soulValue).toBeGreaterThanOrEqual(0);
  383 |       
  384 |       console.log(`${player.name}: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}`);
  385 |     }
  386 |     
```