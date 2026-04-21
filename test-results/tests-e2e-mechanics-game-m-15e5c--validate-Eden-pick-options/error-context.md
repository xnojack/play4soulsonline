# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/mechanics/game-mechanics.spec.ts >> Mechanics Tests >> Eden Pick >> should validate Eden pick options
- Location: tests/e2e/mechanics/game-mechanics.spec.ts:130:9

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="start-game-button"]') to be visible

```

# Test source

```ts
  33  |       await host.page.click('[data-testid="pass-button"]');
  34  |       
  35  |       // Next player should have priority
  36  |       const nextPlayer = players[1];
  37  |       await nextPlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });
  38  |       
  39  |       console.log('Priority passing: Working correctly');
  40  |     });
  41  | 
  42  |     test('should test stack resolution', async ({ browser }) => {
  43  |       const host = players[0];
  44  |       
  45  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  46  |       await host.page.click('[data-testid="start-game-button"]');
  47  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  48  |       
  49  |       // Play a loot card
  50  |       await host.page.waitForSelector('[data-testid="hand-card"]', { timeout: 5000 });
  51  |       
  52  |       const handCard = host.page.locator('[data-testid="hand-card"]');
  53  |       const count = await handCard.count();
  54  |       
  55  |       if (count > 0) {
  56  |         // Play first card in hand
  57  |         await handCard.nth(0).click();
  58  |         await host.page.click('[data-testid="confirm-play-button"]');
  59  |         
  60  |         // Card should go to stack
  61  |         const stack = host.page.locator('[data-testid="stack-item"]');
  62  |         const stackCount = await stack.count();
  63  |         
  64  |         console.log(`Stack resolution: ${stackCount} item(s) on stack`);
  65  |       }
  66  |     });
  67  | 
  68  |     test('should test reaction timing', async ({ browser }) => {
  69  |       const host = players[0];
  70  |       
  71  |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  72  |       await host.page.click('[data-testid="start-game-button"]');
  73  |       await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
  74  |       
  75  |       // Attack and see if players can react
  76  |       await host.declareAttack(0);
  77  |       
  78  |       // Wait for priority to pass to other players
  79  |       await host.page.waitForTimeout(2000);
  80  |       
  81  |       // Check if other players have priority
  82  |       const otherPlayers = players.slice(1);
  83  |       let hasReactions = false;
  84  |       
  85  |       for (const player of otherPlayers) {
  86  |         try {
  87  |           await player.page.waitForSelector('[data-testid="priority-active"]', { timeout: 1000 });
  88  |           hasReactions = true;
  89  |           console.log(`Player ${player.name} has priority`);
  90  |         } catch {
  91  |           // No priority, continue
  92  |         }
  93  |       }
  94  |       
  95  |       console.log(`Reactions available: ${hasReactions}`);
  96  |     });
  97  |   });
  98  | 
  99  |   test.describe('Eden Pick', () => {
  100 |     test('should handle Eden character starting item pick', async ({ browser }) => {
  101 |       const host = players[0];
  102 |       
  103 |       // Eden characters (like Lost) pick starting items from treasure deck
  104 |       // This happens in eden_pick phase
  105 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
  106 |       await host.page.click('[data-testid="start-game-button"]');
  107 |       
  108 |       // Check if we're in eden_pick phase
  109 |       try {
  110 |         await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
  111 |         
  112 |         // Eden player should see pick modal
  113 |         await host.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 5000 });
  114 |         
  115 |         // Pick a card
  116 |         const pickCard = host.page.locator('[data-testid="eden-pick-card"]');
  117 |         const cardCount = await pickCard.count();
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
> 133 |       await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 5000 });
      |                       ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
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
```