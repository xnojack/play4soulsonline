# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/cards/card-basics.spec.ts >> Card Tests >> should test Room card placement
- Location: tests/e2e/cards/card-basics.spec.ts:185:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  92  |     const handCard = host.page.locator('[data-testid="hand-card"]');
  93  |     const handCount = await handCard.count();
  94  |     expect(handCount).toBeGreaterThan(0);
  95  | 
  96  |     console.log(`Player has ${handCount} card(s) in hand`);
  97  | 
  98  |     // Try to play a trinket (if available)
  99  |     // Trinkets automatically become items when resolved
  100 |   });
  101 | 
  102 |   test('should test Ambush loot card', async ({ browser }) => {
  103 |     // Test Ambush: when played, becomes a monster in a slot
  104 |     // Example: Ambush card
  105 |     
  106 |     const host = players[0];
  107 |     
  108 |     // Start game
  109 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  110 |     await host.page.click('[data-testid="start-game-button"]');
  111 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  112 | 
  113 |     // Ambush cards can be played from hand
  114 |     // They go to a monster slot and must be attacked
  115 | 
  116 |     console.log('Ambush test: Card type ready for testing');
  117 |   });
  118 | 
  119 |   test('should test Curse loot card', async ({ browser }) => {
  120 |     // Test Curse: when played, affects player
  121 |     // Example: Curse of Darkness
  122 |     
  123 |     const host = players[0];
  124 |     
  125 |     // Start game
  126 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  127 |     await host.page.click('[data-testid="start-game-button"]');
  128 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  129 | 
  130 |     // Curses are played from hand
  131 |     // They affect the player who played them
  132 | 
  133 |     console.log('Curse test: Card type ready for testing');
  134 |   });
  135 | 
  136 |   test('should test Regular monster attack', async ({ browser }) => {
  137 |     const host = players[0];
  138 | 
  139 |     // Start game
  140 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  141 |     await host.page.click('[data-testid="start-game-button"]');
  142 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  143 | 
  144 |     // Attack monster in slot 0
  145 |     await host.page.waitForSelector('[data-testid="monster-slot-0"]', { timeout: 5000 });
  146 |     
  147 |     await host.declareAttack(0);
  148 |     
  149 |     const rollResult = await host.rollDice();
  150 |     expect(rollResult).toBeGreaterThanOrEqual(1);
  151 |     expect(rollResult).toBeLessThanOrEqual(6);
  152 | 
  153 |     // Wait for damage resolution
  154 |     await host.page.waitForTimeout(1000);
  155 | 
  156 |     console.log(`Monster attack: rolled ${rollResult}`);
  157 |   });
  158 | 
  159 |   test('should test Boss monster (with soul icon)', async ({ browser }) => {
  160 |     const host = players[0];
  161 | 
  162 |     // Start game
  163 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  164 |     await host.page.click('[data-testid="start-game-button"]');
  165 |     await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  166 | 
  167 |     // Boss monsters have soul icons and give souls when killed
  168 |     // We'll test that killing a monster works
  169 | 
  170 |     await host.declareAttack(0);
  171 |     await host.rollDice();
  172 | 
  173 |     // Wait for death and soul gain
  174 |     await host.page.waitForTimeout(1500);
  175 | 
  176 |     // Check if soul was gained
  177 |     const soulDisplay = host.page.locator('[data-testid="soul-value-display"]');
  178 |     const soulValue = await soulDisplay.textContent();
  179 |     
  180 |     console.log(`Soul value after battle: ${soulValue}`);
  181 | 
  182 |     // If a soul was gained, player should have at least 1 soul
  183 |   });
  184 | 
  185 |   test('should test Room card placement', async ({ browser }) => {
  186 |     // Test room slot mechanics
  187 |     // Rooms are placed in room slots and can be discarded after monster death
  188 |     
  189 |     const host = players[0];
  190 | 
  191 |     // Start game with rooms enabled
> 192 |     await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                     ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  193 |     
  194 |     // Check if room slots are present
  195 |     const roomSlot = host.page.locator('[data-testid="room-slot"]');
  196 |     const hasRoomSlot = await roomSlot.count() > 0;
  197 | 
  198 |     if (hasRoomSlot) {
  199 |       console.log('Room slot available');
  200 |     } else {
  201 |       console.log('Room slots not enabled in this game');
  202 |     }
  203 | 
  204 |     // Room cards go in room slots
  205 |     // Active player can discard room after monster death
  206 |   });
  207 | });
  208 | 
```