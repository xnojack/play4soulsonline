# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/basic-game.spec.ts >> Basic Game Flow >> should handle multiple turns and win condition
- Location: tests/e2e/basic-game.spec.ts:111:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.textContent: Target page, context or browser has been closed
Call log:
  - waiting for locator('[data-testid="hp-display"]')

```

# Test source

```ts
  92  |     await this.page.waitForSelector('[data-testid="sad-vote-modal"]', { timeout: 10000 });
  93  |     
  94  |     const players = await this.page.locator('[data-testid="sad-vote-player"]');
  95  |     if (targetPlayerIndex < (await players.count())) {
  96  |       await players.nth(targetPlayerIndex).click();
  97  |       await this.page.waitForSelector('[data-testid="sad-vote-modal"]', { state: 'detached', timeout: 5000 });
  98  |     }
  99  |   }
  100 | 
  101 |   /**
  102 |    * Declare attack on monster slot
  103 |    */
  104 |   async declareAttack(slotIndex: number): Promise<void> {
  105 |     const monsterSlot = this.page.locator(`[data-testid="monster-slot-${slotIndex}"]`);
  106 |     await monsterSlot.click({ timeout: 5000 });
  107 |   }
  108 | 
  109 |   /**
  110 |    * Roll attack dice
  111 |    */
  112 |   async rollDice(): Promise<number> {
  113 |     await this.page.waitForSelector('[data-testid="dice-roller"]', { timeout: 5000 });
  114 |     await this.page.click('[data-testid="roll-dice-button"]');
  115 |     
  116 |     // Wait for dice roll result
  117 |     await this.page.waitForSelector('[data-testid="dice-result"]', { timeout: 5000 });
  118 |     
  119 |     const result = await this.page.textContent('[data-testid="dice-result"]');
  120 |     return parseInt(result || '0', 10);
  121 |   }
  122 | 
  123 |   /**
  124 |    * Play a loot card from hand
  125 |    */
  126 |   async playLootCard(cardIndex: number, targets: string[] = []): Promise<void> {
  127 |     const handCard = this.page.locator(`[data-testid="hand-card-${cardIndex}"]`);
  128 |     await handCard.click({ timeout: 5000 });
  129 |     
  130 |     // Handle target selection if needed
  131 |     if (targets.length > 0) {
  132 |       for (const targetId of targets) {
  133 |         await this.page.click(`[data-testid="target-${targetId}"]`, { timeout: 5000 });
  134 |       }
  135 |     }
  136 |     
  137 |     // Confirm card play
  138 |     await this.page.click('[data-testid="confirm-play-button"]', { timeout: 5000 });
  139 |   }
  140 | 
  141 |   /**
  142 |    * Purchase item from shop
  143 |    */
  144 |   async purchaseItem(slotIndex: number): Promise<void> {
  145 |     const shopSlot = this.page.locator(`[data-testid="shop-slot-${slotIndex}"]`);
  146 |     await shopSlot.click({ timeout: 5000 });
  147 |     await this.page.click('[data-testid="confirm-purchase-button"]', { timeout: 5000 });
  148 |   }
  149 | 
  150 |   /**
  151 |    * Activate an item ability
  152 |    */
  153 |   async activateItemAbility(instanceId: string, abilityTag: 'tap' | 'paid'): Promise<void> {
  154 |     const item = this.page.locator(`[data-testid="item-${instanceId}"]`);
  155 |     await item.click({ timeout: 5000 });
  156 |     
  157 |     const abilityButton = this.page.locator(`[data-testid="ability-${abilityTag}"]`);
  158 |     await abilityButton.click({ timeout: 5000 });
  159 |   }
  160 | 
  161 |   /**
  162 |    * Pass priority (skip turn/next action)
  163 |    */
  164 |   async passPriority(): Promise<void> {
  165 |     await this.page.click('[data-testid="pass-button"]', { timeout: 5000 });
  166 |   }
  167 | 
  168 |   /**
  169 |    * Get current game state for validation
  170 |    */
  171 |   async getGameState(): Promise<Record<string, unknown>> {
  172 |     return await this.page.evaluate(() => {
  173 |       // Access game store via window object or DOM
  174 |       const stateEl = document.querySelector('[data-testid="game-state"]');
  175 |       if (stateEl) {
  176 |         return JSON.parse(stateEl.textContent || '{}');
  177 |       }
  178 |       return {};
  179 |     });
  180 |   }
  181 | 
  182 |   /**
  183 |    * Get player stats
  184 |    */
  185 |   async getPlayerStats(): Promise<{
  186 |     hp: number;
  187 |     atk: number;
  188 |     coins: number;
  189 |     soulValue: number;
  190 |     handCount: number;
  191 |   }> {
> 192 |     const hp = await this.page.textContent('[data-testid="hp-display"]');
      |                                ^ Error: page.textContent: Target page, context or browser has been closed
  193 |     const atk = await this.page.textContent('[data-testid="atk-display"]');
  194 |     const coins = await this.page.textContent('[data-testid="coins-display"]');
  195 |     const souls = await this.page.textContent('[data-testid="soul-value-display"]');
  196 |     const handCount = await this.page.textContent('[data-testid="hand-count"]');
  197 | 
  198 |     return {
  199 |       hp: parseInt(hp || '0', 10),
  200 |       atk: parseInt(atk || '0', 10),
  201 |       coins: parseInt(coins || '0', 10),
  202 |       soulValue: parseInt(souls || '0', 10),
  203 |       handCount: parseInt(handCount || '0', 10)
  204 |     };
  205 |   }
  206 | 
  207 |   /**
  208 |    * Check if game has ended
  209 |    */
  210 |   async checkGameOver(): Promise<boolean> {
  211 |     try {
  212 |       await this.page.waitForSelector('[data-testid="game-over-modal"]', { timeout: 2000 });
  213 |       return true;
  214 |     } catch {
  215 |       return false;
  216 |     }
  217 |   }
  218 | 
  219 |   /**
  220 |    * Get winner if game has ended
  221 |    */
  222 |   async getWinner(): Promise<string | null> {
  223 |     try {
  224 |       await this.page.waitForSelector('[data-testid="winner-name"]', { timeout: 2000 });
  225 |       return await this.page.textContent('[data-testid="winner-name"]');
  226 |     } catch {
  227 |       return null;
  228 |     }
  229 |   }
  230 | 
  231 |   /**
  232 |    * Get game log entries
  233 |    */
  234 |   async getGameLog(): Promise<string[]> {
  235 |     const logItems = await this.page.locator('[data-testid="game-log-entry"]');
  236 |     const count = await logItems.count();
  237 |     
  238 |     const logs: string[] = [];
  239 |     for (let i = 0; i < count; i++) {
  240 |       const text = await logItems.nth(i).textContent();
  241 |       if (text) logs.push(text);
  242 |     }
  243 |     
  244 |     return logs;
  245 |   }
  246 | 
  247 |   /**
  248 |    * Wait for specific game phase
  249 |    */
  250 |   async waitForPhase(phase: 'lobby' | 'eden_pick' | 'sad_vote' | 'active' | 'ended'): Promise<void> {
  251 |     const phaseMap = {
  252 |       lobby: 'lobby-phase',
  253 |       eden_pick: 'eden-phase',
  254 |       sad_vote: 'sad-vote-phase',
  255 |       active: 'active-phase',
  256 |       ended: 'ended-phase'
  257 |     };
  258 |     
  259 |     await this.page.waitForSelector(`[data-testid="${phaseMap[phase]}"]`, { timeout: 10000 });
  260 |   }
  261 | 
  262 |   /**
  263 |    * Close player session
  264 |    */
  265 |   async close(): Promise<void> {
  266 |     await this.page.close();
  267 |   }
  268 | }
  269 | 
  270 | /**
  271 |  * Create a test browser context with authentication
  272 |  */
  273 | export async function createPlayerContext(
  274 |   browser: Browser,
  275 |   name: string
  276 | ): Promise<TestPlayer> {
  277 |   const context = await browser.newContext({
  278 |     viewport: { width: 1280, height: 720 }
  279 |   });
  280 |   
  281 |   const page = await context.newPage();
  282 |   const player = new TestPlayer(name, page, context);
  283 |   
  284 |   return player;
  285 | }
  286 | 
  287 | /**
  288 |  * Wait for all players to have joined
  289 |  */
  290 | export async function waitForAllPlayers(
  291 |   players: TestPlayer[],
  292 |   expectedCount: number
```