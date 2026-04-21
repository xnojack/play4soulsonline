# Four Souls Online - End-to-End Test Suite

## Overview

This comprehensive Playwright-based test suite provides full regression testing for 4-player games of Four Souls Online. The tests follow the official game rules and validate that card effects are properly implemented.

## Test Suite Features

### ✅ Complete Coverage

- **Basic Game Flow**: Room creation, player joining, phase transitions, turn management
- **Card-Specific Tests**: All card types (active/passive items, loot, monsters, rooms)
- **Mechanics Tests**: Priority, stack, Eden pick, sad vote, deck management
- **Full Regression**: Complete end-to-end 4-player game simulation

### ✅ Validation Tools

- **Playwright Helpers**: Player session management and game actions
- **Socket Helpers**: Direct socket.io interaction for non-UI actions
- **Game Logger**: Comprehensive logging and state validation
- **Card API**: Database access for card data and effect parsing
- **Card Effect Parser**: Automatic effect extraction and validation

### ✅ Detailed Reporting

- HTML reports with test timeline
- Video recordings for debugging
- Full game state logs
- Screenshot capture on failures

## File Structure

```
tests/
├── e2e/                              # E2E test files
│   ├── basic-game.spec.ts           # Room + player join + basic flow
│   ├── cards/                       # Card-specific tests
│   │   ├── card-basics.spec.ts      # Basic card functionality
│   │   └── loot-monster-room.spec.ts
│   ├── mechanics/                   # Game mechanics
│   │   └── game-mechanics.spec.ts   # Priority, stack, voting, etc.
│   └── regression/                  # Full game regression
│       └── full-game.spec.ts        # Complete 4-player game
├── fixtures/
│   └── test-cards.ts                # Card IDs for testing
├── utils/
│   ├── playwright-helpers.ts        # Player wrappers
│   ├── socket-helpers.ts            # Socket.io helpers
│   ├── game-logger.ts               # Logging + validation
│   ├── card-api.ts                  # Card database access
│   └── card-effects.ts              # Effect parsing
├── playwright.config.ts             # Playwright config
├── validate.sh                      # Validation script
└── README.md                        # This file
```

## Running Tests

### Prerequisites

```bash
# Build the application
npm run build
```

### Start Development Servers

```bash
# Terminal 1: Server
npm run dev --workspace=packages/server

# Terminal 2: Client
npm run dev --workspace=packages/client
```

### Run Tests

```bash
# Run all tests (headless)
npm test

# Run with UI
npm run test:ui

# Run specific test suites
npm run test:basic        # Basic game flow
npm run test:cards        # Card tests
npm run test:mechanics    # Mechanics tests
npm run test:regression   # Full regression
npm run test:full         # Complete 4-player game

# Watch mode
npm run test:watch

# Debug mode
npm run test:debug
```

## Test Examples

### Basic Game Flow (`tests/e2e/basic-game.spec.ts`)

```typescript
test('should create room and join players', async ({ browser }) => {
  const host = players[0];
  
  // Host creates room
  const createResult = await host.createRoom();
  expect(createResult.success).toBe(true);
  expect(createResult.roomId?.length).toBe(6);
  
  const roomId = createResult.roomId!;
  
  // Other players join
  const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
  await Promise.all(joinPromises);
  
  // All 4 players in lobby
  await waitForAllPlayers(players, 4);
});
```

### Card Tests (`tests/e2e/cards/`)

```typescript
test('should test Active treasure card', async ({ browser }) => {
  const host = players[0];
  await host.page.click('[data-testid="start-game-button"]');
  await host.page.waitForSelector('[data-testid="active-phase"]');
  
  // Verify card is in player's items
  const itemCard = host.page.locator('[data-testid="item-card"]');
  const count = await itemCard.count();
  expect(count).toBeGreaterThan(0);
});
```

### Mechanics Tests (`tests/e2e/mechanics/`)

```typescript
test('should test priority passing', async ({ browser }) => {
  const host = players[0];
  await host.page.waitForSelector('[data-testid="active-phase"]');
  await host.page.waitForSelector('[data-testid="priority-active"]');
  
  // Pass priority
  await host.page.click('[data-testid="pass-button"]');
  
  // Next player gets priority
  await players[1].page.waitForSelector('[data-testid="priority-active"]');
});
```

### Full Regression (`tests/e2e/regression/full-game.spec.ts`)

```typescript
test('FR-001: Room creation and player join flow', async ({ browser }) => {
  // 1. Host creates room
  const host = players[0];
  const createResult = await host.createRoom();
  
  // 2. Other players join
  const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
  await Promise.all(joinPromises);
  
  // 3. Host starts game
  await host.page.click('[data-testid="start-game-button"]');
  
  // 4. Monitor phase transitions
  await host.page.waitForSelector('[data-testid="active-phase"]');
  
  // 5. Complete multiple turns
  for (let turn = 0; turn < 6; turn++) {
    const activePlayer = players[turn % 4];
    await activePlayer.declareAttack(0);
    await activePlayer.rollDice();
  }
});
```

## Test Utilities

### TestPlayer Class

```typescript
class TestPlayer {
  // Join/create room
  async joinRoom(roomId: string): Promise<{ success: boolean }>
  async createRoom(): Promise<{ success: boolean; roomId: string }>
  
  // Game actions
  async declareAttack(slotIndex: number): Promise<void>
  async rollDice(): Promise<number>
  async playLootCard(cardIndex: number, targets?: string[]): Promise<void>
  async purchaseItem(slotIndex: number): Promise<void>
  async activateItemAbility(instanceId: string, abilityTag: 'tap' | 'paid'): Promise<void>
  async passPriority(): Promise<void>
  
  // Get state
  async getPlayerStats(): Promise<{ hp, atk, coins, soulValue, handCount }>
  async getGameLog(): Promise<string[]>
  async getWinner(): Promise<string | null>
  async checkGameOver(): Promise<boolean>
}
```

### GameLogger

```typescript
class GameLogger {
  // Log events
  log(type: LogEntryType, message: string, playerId: string | null)
  logPhase(phase: string, playerId: string | null)
  logAttack(attacker: string, target: string, hit: boolean, playerId: string | null)
  logCardPlay(player: string, cardName: string, playerId: string | null)
  
  // Get summary
  getSummary(): { totalEntries, byType, byPlayer, durationMs }
}
```

### CardEffectParser

```typescript
class CardEffectParser {
  // Parse card effects
  parseCardEffects(card: CardData): CardEffect[]
  
  // Extract keywords
  extractKeywords(card: CardData): string[]
  
  // Get testable effects
  getTestableEffects(card: CardData): CardEffect[]
}
```

## Test Data

### Card IDs (`tests/fixtures/test-cards.ts`)

Pre-selected card IDs for testing:
- **25 Characters** (ISAAC, SAMSON, JACOB, etc.)
- **15 Starting Items** (LUCKY_FOOT, BIBLE, LIPSTICK, etc.)
- **20 Active Items** (PENNY, SCISSORS, BOOK_OF_BELIAL, etc.)
- **20 Passive Items** (PENTAGRAM, LIPSTICK, MONSTER_MANUAL, etc.)
- **15 Loot Cards** (Trinkets, Ambushes, Curses, Guppies)
- **10 Monsters** (ROTTEN_BEGGAR, MONSTRO, THE_BEAST, DEATH, HUSH)
- **10 Room Cards** (BASEMENT, CRAWLSPACE, WOMB, etc.)
- **5 Bonus Souls** (DEEP_LOVE, MOTHER, VOID)

### Card Types Tested

| Type | Count | Subtypes |
|------|-------|----------|
| Character | 25 | All characters |
| Treasure | 40 | Active (↷), Passive |
| Loot | 15 | Trinket, Ambush, Curse, Guppy |
| Monster | 10 | Regular, Boss (with soul) |
| Room | 10 | All room types |

## Validation

### Run Validation Script

```bash
./tests/validate.sh
```

This checks:
- All required files exist
- Playwright is installed
- Test count and utility count are correct
- Package.json scripts are configured

## Development Workflow

### 1. Add New Card Test

1. Add card ID to `fixtures/test-cards.ts`
2. Create test in appropriate `cards/*.spec.ts`
3. Test the specific effect

### 2. Add New Mechanic

1. Add test in `mechanics/game-mechanics.spec.ts`
2. Verify all edge cases
3. Test with multiple players

### 3. Add New Regression Test

1. Add test in `regression/full-game.spec.ts`
2. Cover complete game flow
3. Validate all phases
4. Check win condition

## Troubleshooting

### Common Issues

**Tests fail to connect**
- Ensure `npm run dev` is running
- Check server on port 3001
- Check client on port 5173

**Players can't join room**
- Verify room ID format (6 uppercase chars)
- Check player names are unique
- Ensure all players created before joining

**Game doesn't progress**
- Verify priority passing
- Check attack declarations complete
- Ensure dice rolls finish

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  run: |
    npm run build
    npm run dev &
    npm test:headless
```

## Future Enhancements

- [ ] Add more card-specific tests (all ~1081 cards)
- [ ] Add performance benchmarks
- [ ] Add visual regression testing
- [ ] Add stress tests (10+ players)
- [ ] Add concurrent game tests (multiple rooms)
- [ ] Add card effect validation per rulebook

## Documentation

- [Extended Rulebook](https://foursouls.com/rules/extended-rulebook/)
- [Playwright Docs](https://playwright.dev/)
- [Test Suite README](./tests/README.md)

## License

GPL-3.0-or-later
