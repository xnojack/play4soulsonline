# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/mechanics/game-mechanics.spec.ts >> Mechanics Tests >> Item Activation >> should test item paid ability (dollar)
- Location: tests/e2e/mechanics/game-mechanics.spec.ts:305:9

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  208 |         // Not applicable
  209 |         console.log('Sad vote winner: Not applicable');
  210 |       }
  211 |     });
  212 |   });
  213 | 
  214 |   test.describe('Deck Management', () => {
  215 |     test('should test deck drawing', async ({ browser }) => {
  216 |       const host = players[0];
  217 |       
  218 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  219 |       await host.page.click('[data-testid="start-game-button"]');
  220 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  221 |       
  222 |       // Get initial deck counts
  223 |       const deckCount = await host.page.textContent('[data-testid="loot-deck-count"]');
  224 |       
  225 |       console.log(`Deck draw: Loot deck count = ${deckCount}`);
  226 |     });
  227 | 
  228 |     test('should test deck exhaustion and reshuffle', async ({ browser }) => {
  229 |       const host = players[0];
  230 |       
  231 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  232 |       await host.page.click('[data-testid="start-game-button"]');
  233 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  234 |       
  235 |       // Draw all cards from deck (hard to do in test, but we can verify logic)
  236 |       // When deck is empty, it should reshuffle from discard
  237 |       
  238 |       const deckCount = await host.page.textContent('[data-testid="loot-deck-count"]');
  239 |       const discardCount = await host.page.textContent('[data-testid="loot-discard-count"]');
  240 |       
  241 |       console.log(`Deck exhaustion: Deck = ${deckCount}, Discard = ${discardCount}`);
  242 |     });
  243 | 
  244 |     test('should test item purchase', async ({ browser }) => {
  245 |       const host = players[0];
  246 |       
  247 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  248 |       await host.page.click('[data-testid="start-game-button"]');
  249 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  250 |       
  251 |       // Check shop slots
  252 |       const shopSlot = host.page.locator('[data-testid="shop-slot"]');
  253 |       const shopCount = await shopSlot.count();
  254 |       
  255 |       expect(shopCount).toBe(2); // Always 2 shop slots
  256 |       
  257 |       console.log(`Item purchase: ${shopCount} shop slots available`);
  258 |     });
  259 | 
  260 |     test('should test shop refill', async ({ browser }) => {
  261 |       const host = players[0];
  262 |       
  263 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  264 |       await host.page.click('[data-testid="start-game-button"]');
  265 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  266 |       
  267 |       // Purchase an item to trigger refill
  268 |       const shopSlot = host.page.locator('[data-testid="shop-slot"]');
  269 |       const count = await shopSlot.count();
  270 |       
  271 |       if (count > 0) {
  272 |         // Purchase first item
  273 |         await shopSlot.nth(0).click();
  274 |         await host.page.click('[data-testid="confirm-purchase-button"]');
  275 |         
  276 |         // Wait for refill
  277 |         await host.page.waitForTimeout(1000);
  278 |         
  279 |         // Shop should have 2 slots filled
  280 |         const newCount = await shopSlot.count();
  281 |         expect(newCount).toBe(2);
  282 |       }
  283 |       
  284 |       console.log('Shop refill: Tested');
  285 |     });
  286 |   });
  287 | 
  288 |   test.describe('Item Activation', () => {
  289 |     test('should test item tap ability (tap)', async ({ browser }) => {
  290 |       const host = players[0];
  291 |       
  292 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  293 |       await host.page.click('[data-testid="start-game-button"]');
  294 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  295 |       
  296 |       // Items with tap ability need to be tapped (deactivated)
  297 |       const itemCard = host.page.locator('[data-testid="item-card"]');
  298 |       const itemCount = await itemCard.count();
  299 |       
  300 |       if (itemCount > 0) {
  301 |         console.log(`Item tap: ${itemCount} items available`);
  302 |       }
  303 |     });
  304 | 
  305 |     test('should test item paid ability (dollar)', async ({ browser }) => {
  306 |       const host = players[0];
  307 |       
> 308 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                       ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  309 |       await host.page.click('[data-testid="start-game-button"]');
  310 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  311 |       
  312 |       // Items with dollar ability cost coins
  313 |       console.log('Item paid ability: Items with $ abilities ready');
  314 |     });
  315 |   });
  316 | 
  317 |   test.describe('Win Condition', () => {
  318 |     test('should track soul value toward win', async ({ browser }) => {
  319 |       const host = players[0];
  320 |       
  321 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  322 |       await host.page.click('[data-testid="start-game-button"]');
  323 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  324 |       
  325 |       // Win at 4 soul value
  326 |       const soulValue = await host.page.textContent('[data-testid="soul-value-display"]');
  327 |       const currentSoul = parseInt(soulValue || '0', 10);
  328 |       
  329 |       console.log(`Win condition: Current soul value = ${currentSoul}, Need 4 to win`);
  330 |       
  331 |       // Verify win condition logic
  332 |       const winThreshold = 4;
  333 |       const needsMore = currentSoul < winThreshold;
  334 |       
  335 |       console.log(`Still playing: ${needsMore}`);
  336 |     });
  337 | 
  338 |     test('should detect winner when 4 souls reached', async ({ browser }) => {
  339 |       const host = players[0];
  340 |       
  341 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  342 |       await host.page.click('[data-testid="start-game-button"]');
  343 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  344 |       
  345 |       // Play through game until someone wins
  346 |       // This is a long test, so we'll just verify the win detection mechanism
  347 |       
  348 |       const gameOver = await host.checkGameOver();
  349 |       console.log(`Game over check: ${gameOver ? 'Game ended' : 'Game still in progress'}`);
  350 |     });
  351 |   });
  352 | });
  353 | 
```