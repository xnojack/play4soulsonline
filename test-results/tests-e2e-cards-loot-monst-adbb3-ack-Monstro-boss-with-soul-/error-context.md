# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/cards/loot-monster-room.spec.ts >> Monster Card Tests >> should attack Monstro (boss with soul)
- Location: tests/e2e/cards/loot-monster-room.spec.ts:171:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  74  |       
  75  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  76  |       await host.page.click('[data-testid="start-game-button"]');
  77  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  78  |       
  79  |       console.log('Curse of the Tower test: Curse mechanics ready');
  80  |     });
  81  |   });
  82  | 
  83  |   test.describe('Ambush', () => {
  84  |     test('should test Ambush card', async ({ browser }) => {
  85  |       // Ambush: "When this loot resolves, choose a monster slot. This becomes a monster in that slot."
  86  |       const host = players[0];
  87  |       
  88  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  89  |       await host.page.click('[data-testid="start-game-button"]');
  90  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  91  |       
  92  |       // Ambush cards go to monster slots
  93  |       const monsterSlot = host.page.locator('[data-testid="monster-slot"]');
  94  |       const slotCount = await monsterSlot.count();
  95  |       
  96  |       console.log(`Ambush test: Monster slots available: ${slotCount}`);
  97  |     });
  98  | 
  99  |     test('should test Trap card', async ({ browser }) => {
  100 |       // Trap: Similar to Ambush
  101 |       const host = players[0];
  102 |       
  103 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  104 |       await host.page.click('[data-testid="start-game-button"]');
  105 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  106 |       
  107 |       console.log('Trap test: Trap mechanics ready');
  108 |     });
  109 |   });
  110 | 
  111 |   test.describe('Guppy', () => {
  112 |     test('should test Guppy Head', async ({ browser }) => {
  113 |       // Guppy: "Static ability that means 'This item can be attacked.'"
  114 |       const host = players[0];
  115 |       
  116 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  117 |       await host.page.click('[data-testid="start-game-button"]');
  118 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  119 |       
  120 |       // Items with Guppy can be attacked directly
  121 |       console.log('Guppy Head test: Guppy mechanics ready');
  122 |     });
  123 | 
  124 |     test('should test Guppy Tail', async ({ browser }) => {
  125 |       // Guppy Tail: Similar Guppy ability
  126 |       const host = players[0];
  127 |       
  128 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  129 |       await host.page.click('[data-testid="start-game-button"]');
  130 |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  131 |       
  132 |       console.log('Guppy Tail test: Guppy mechanics ready');
  133 |     });
  134 |   });
  135 | });
  136 | 
  137 | test.describe('Monster Card Tests', () => {
  138 |   const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  139 |   let players: TestPlayer[] = [];
  140 | 
  141 |   test.beforeAll(async ({ browser }) => {
  142 |     for (const name of playerNames) {
  143 |       const context = await createPlayerContext(browser, name);
  144 |       players.push(context);
  145 |     }
  146 |   });
  147 | 
  148 |   test.afterAll(async () => {
  149 |     for (const player of players) {
  150 |       await player.close();
  151 |     }
  152 |   });
  153 | 
  154 |   test('should attack Rotting Beggar (regular monster)', async ({ browser }) => {
  155 |     const host = players[0];
  156 |     
  157 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
  158 |     await host.page.click('[data-testid="start-game-button"]');
  159 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  160 |     
  161 |     // Attack monster in slot 0
  162 |     await host.declareAttack(0);
  163 |     const roll = await host.rollDice();
  164 |     
  165 |     expect(roll).toBeGreaterThanOrEqual(1);
  166 |     expect(roll).toBeLessThanOrEqual(6);
  167 |     
  168 |     console.log(`Rotting Beggar attack: rolled ${roll}`);
  169 |   });
  170 | 
  171 |   test('should attack Monstro (boss with soul)', async ({ browser }) => {
  172 |     const host = players[0];
  173 |     
> 174 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
      |                     ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  175 |     await host.page.click('[data-testid="start-game-button"]');
  176 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  177 |     
  178 |     // Boss monsters give souls when killed
  179 |     await host.declareAttack(0);
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
```