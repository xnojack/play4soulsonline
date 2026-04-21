# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/basic-game.spec.ts >> Basic Game Flow >> should handle player disconnect and reconnect
- Location: tests/e2e/basic-game.spec.ts:167:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-testid="game-board"]') to be visible

```

# Test source

```ts
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
  129 |       if (currentTurn === 0) {
  130 |         await activePlayer.declareAttack(0);
  131 |         await activePlayer.rollDice();
  132 |       }
  133 | 
  134 |       currentTurn++;
  135 |     }
  136 | 
  137 |     // Check if any player has won (4 souls)
  138 |     const winner = await players[0].getWinner();
  139 |     if (winner) {
  140 |       console.log(`Game ended - Winner: ${winner}`);
  141 |     }
  142 | 
  143 |     // All players should still be connected
  144 |     for (const player of players) {
  145 |       const gameOver = await player.checkGameOver();
  146 |       // Don't fail if game is not over yet
  147 |     }
  148 |   });
  149 | 
  150 |   test('should validate game log entries', async ({ browser }) => {
  151 |     const host = players[0];
  152 | 
  153 |     // Get game log
  154 |     const log = await host.getGameLog();
  155 |     expect(log.length).toBeGreaterThan(0);
  156 |     
  157 |     // Log should contain expected event types
  158 |     const logText = log.join(' ').toLowerCase();
  159 |     expect(logText).toMatch(/attack|loot|phase|turn/);
  160 |     
  161 |     console.log(`Game log entries: ${log.length}`);
  162 |     for (let i = 0; i < Math.min(5, log.length); i++) {
  163 |       console.log(`  ${i + 1}. ${log[i]}`);
  164 |     }
  165 |   });
  166 | 
  167 |   test('should handle player disconnect and reconnect', async ({ browser }) => {
  168 |     const player = players[1];
  169 |     
  170 |     // Disconnect
  171 |     await player.page.context().close();
  172 |     
  173 |     // Wait a moment
  174 |     await new Promise(resolve => setTimeout(resolve, 2000));
  175 |     
  176 |     // Reconnect (create new context)
  177 |     const context = await browser.newContext();
  178 |     const reconnectPage = await context.newPage();
  179 |     const reconnectPlayer = new TestPlayer(player.name, reconnectPage, context);
  180 |     
  181 |     // Try to auto-rejoin (if room still exists)
  182 |     const currentUrl = players[0].page.url();
  183 |     const roomId = currentUrl.split('/').pop();
  184 |     
  185 |     if (roomId) {
  186 |       await reconnectPlayer.joinRoom(roomId);
  187 |       
  188 |       // Should be back in game
> 189 |       await reconnectPlayer.page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
      |                                  ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  190 |     }
  191 |     
  192 |     await reconnectPlayer.close();
  193 |   });
  194 | });
  195 | 
```