# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/regression/full-game.spec.ts >> Full Regression Test Suite >> FR-012: Full game completion
- Location: tests/e2e/regression/full-game.spec.ts:390:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForTimeout: Target page, context or browser has been closed
```

# Test source

```ts
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
  387 |     console.log('✓ All players have valid stats');
  388 |   });
  389 | 
  390 |   test('FR-012: Full game completion', async ({ browser }) => {
  391 |     console.log('\n--- Test FR-012: Full Game Completion ---');
  392 |     const host = players[0];
  393 |     
  394 |     // Wait for game to complete (timeout after 60 seconds)
  395 |     let gameOver = await host.checkGameOver();
  396 |     let elapsed = 0;
  397 |     const maxWait = 60000; // 60 seconds
  398 |     const checkInterval = 2000;
  399 |     
  400 |     while (!gameOver && elapsed < maxWait) {
> 401 |       await host.page.waitForTimeout(checkInterval);
      |                       ^ Error: page.waitForTimeout: Target page, context or browser has been closed
  402 |       elapsed += checkInterval;
  403 |       gameOver = await host.checkGameOver();
  404 |       console.log(`Waiting for game end... (${elapsed / 1000}s)`);
  405 |     }
  406 |     
  407 |     if (gameOver) {
  408 |       const winner = await host.getWinner();
  409 |       expect(winner).toBeDefined();
  410 |       console.log(`✓ Game completed! Winner: ${winner}`);
  411 |       
  412 |       // Final stats
  413 |       for (const player of players) {
  414 |         const stats = await player.getPlayerStats();
  415 |         console.log(`Final - ${player.name}: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}`);
  416 |       }
  417 |     } else {
  418 |       console.log('Game did not complete within timeout (still in progress)');
  419 |     }
  420 |   });
  421 | });
  422 | 
```