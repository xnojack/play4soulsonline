# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/mechanics/game-mechanics.spec.ts >> Mechanics Tests >> Deck Management >> should test deck drawing
- Location: tests/e2e/mechanics/game-mechanics.spec.ts:215:9

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
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
  146 |         // Not an Eden game
  147 |         console.log('Eden options: Not applicable');
  148 |       }
  149 |     });
  150 |   });
  151 | 
  152 |   test.describe('Sad Vote', () => {
  153 |     test('should handle saddest character voting', async ({ browser }) => {
  154 |       const host = players[0];
  155 |       
  156 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  157 |       await host.page.click('[data-testid="start-game-button"]');
  158 |       
  159 |       // Wait for sad_vote phase
  160 |       try {
  161 |         await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
  162 |         
  163 |         // Each player votes for saddest character
  164 |         for (const player of players) {
  165 |           await player.page.waitForSelector('[data-testid="sad-vote-modal"]', { timeout: 5000 });
  166 |           
  167 |           // Vote for first player
  168 |           const voteButton = player.page.locator('[data-testid="sad-vote-player"]');
  169 |           const voteCount = await voteButton.count();
  170 |           
  171 |           if (voteCount > 0) {
  172 |             await voteButton.nth(0).click();
  173 |           }
  174 |           
  175 |           console.log(`Player ${player.name} voted`);
  176 |         }
  177 |         
  178 |         // Wait for vote resolution
  179 |         await host.page.waitForTimeout(1000);
  180 |         
  181 |         console.log('Sad vote: All players voted');
  182 |       } catch {
  183 |         // Not in sad_vote phase (maybe solo game)
  184 |         console.log('Sad vote: Not applicable');
  185 |       }
  186 |     });
  187 | 
  188 |     test('should validate sad vote winner', async ({ browser }) => {
  189 |       const host = players[0];
  190 |       
  191 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  192 |       await host.page.click('[data-testid="start-game-button"]');
  193 |       
  194 |       try {
  195 |         await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
  196 |         
  197 |         // All players vote
  198 |         for (const player of players) {
  199 |           await player.page.waitForSelector('[data-testid="sad-vote-modal"]', { timeout: 5000 });
  200 |           await player.page.click('[data-testid="sad-vote-player"]');
  201 |         }
  202 |         
  203 |         // Wait for resolution
  204 |         await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  205 |         
  206 |         console.log('Sad vote: Winner selected');
  207 |       } catch {
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
> 218 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                       ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
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
  308 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
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
```