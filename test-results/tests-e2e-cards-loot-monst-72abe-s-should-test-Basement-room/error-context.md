# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/cards/loot-monster-room.spec.ts >> Room Card Tests >> should test Basement room
- Location: tests/e2e/cards/loot-monster-room.spec.ts:277:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  180 |     const roll = await host.rollDice();
  181 |     
  182 |     expect(roll).toBeGreaterThanOrEqual(1);
  183 |     expect(roll).toBeLessThanOrEqual(6);
  184 |     
  185 |     // Wait for soul gain
  186 |     await host.page.waitForTimeout(1500);
  187 |     
  188 |     const soulValue = await host.page.textContent('[data-testid="soul-value-display"]');
  189 |     console.log(`Monstro attack: soul value = ${soulValue}`);
  190 |   });
  191 | 
  192 |   test('should attack The Beast (boss with soul)', async ({ browser }) => {
  193 |     const host = players[0];
  194 |     
  195 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  196 |     await host.page.click('[data-testid="start-game-button"]');
  197 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  198 |     
  199 |     await host.declareAttack(0);
  200 |     const roll = await host.rollDice();
  201 |     
  202 |     expect(roll).toBeGreaterThanOrEqual(1);
  203 |     expect(roll).toBeLessThanOrEqual(6);
  204 |     
  205 |     console.log(`The Beast attack: rolled ${roll}`);
  206 |   });
  207 | 
  208 |   test('should test Monster with evasion', async ({ browser }) => {
  209 |     const host = players[0];
  210 |     
  211 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  212 |     await host.page.click('[data-testid="start-game-button"]');
  213 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  214 |     
  215 |     // Some monsters have high evasion
  216 |     // Attack requires rolling >= evasion
  217 |     await host.declareAttack(0);
  218 |     const roll = await host.rollDice();
  219 |     
  220 |     // Evasion is typically 1-3 for monsters
  221 |     const evasion = 1; // Default
  222 |     const hit = roll >= evasion;
  223 |     
  224 |     console.log(`Evasion test: rolled ${roll}, hit = ${hit}`);
  225 |   });
  226 | 
  227 |   test('should test Death (boss with soul)', async ({ browser }) => {
  228 |     const host = players[0];
  229 |     
  230 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  231 |     await host.page.click('[data-testid="start-game-button"]');
  232 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  233 |     
  234 |     await host.declareAttack(0);
  235 |     const roll = await host.rollDice();
  236 |     
  237 |     expect(roll).toBeGreaterThanOrEqual(1);
  238 |     expect(roll).toBeLessThanOrEqual(6);
  239 |     
  240 |     console.log(`Death attack: rolled ${roll}`);
  241 |   });
  242 | 
  243 |   test('should test Hush (boss with soul)', async ({ browser }) => {
  244 |     const host = players[0];
  245 |     
  246 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  247 |     await host.page.click('[data-testid="start-game-button"]');
  248 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  249 |     
  250 |     await host.declareAttack(0);
  251 |     const roll = await host.rollDice();
  252 |     
  253 |     expect(roll).toBeGreaterThanOrEqual(1);
  254 |     expect(roll).toBeLessThanOrEqual(6);
  255 |     
  256 |     console.log(`Hush attack: rolled ${roll}`);
  257 |   });
  258 | });
  259 | 
  260 | test.describe('Room Card Tests', () => {
  261 |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  262 |   let players: TestPlayer[] = [];
  263 | 
  264 |   test.beforeAll(async ({ browser }) => {
  265 |     for (const name of playerNames) {
  266 |       const context = await createPlayerContext(browser, name);
  267 |       players.push(context);
  268 |     }
  269 |   });
  270 | 
  271 |   test.afterAll(async () => {
  272 |     for (const player of players) {
  273 |       await player.close();
  274 |     }
  275 |   });
  276 | 
  277 |   test('should test Basement room', async ({ browser }) => {
  278 |     const host = players[0];
  279 |     
> 280 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                     ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  281 |     await host.page.click('[data-testid="start-game-button"]');
  282 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  283 |     
  284 |     // Room cards are in room slots
  285 |     const roomSlot = host.page.locator('[data-testid="room-slot"]');
  286 |     const hasRoom = await roomSlot.count() > 0;
  287 |     
  288 |     console.log(`Basement room: room slot available = ${hasRoom}`);
  289 |   });
  290 | 
  291 |   test('should test Womb room', async ({ browser }) => {
  292 |     const host = players[0];
  293 |     
  294 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  295 |     await host.page.click('[data-testid="start-game-button"]');
  296 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  297 |     
  298 |     console.log('Womb room: Room mechanics ready');
  299 |   });
  300 | 
  301 |   test('should test Cathedral room', async ({ browser }) => {
  302 |     const host = players[0];
  303 |     
  304 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  305 |     await host.page.click('[data-testid="start-game-button"]');
  306 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  307 |     
  308 |     console.log('Cathedral room: Room mechanics ready');
  309 |   });
  310 | });
  311 | 
```