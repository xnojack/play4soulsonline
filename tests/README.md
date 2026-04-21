# Four Souls Online - End-to-End Testing

This directory contains a comprehensive Playwright-based end-to-end test suite for testing full 4-player games of Four Souls Online.

## Test Suite Structure

```
tests/
├── e2e/                          # E2E test files
│   ├── basic-game.spec.ts        # Basic room creation and flow
│   ├── cards/                    # Card-specific tests
│   │   ├── card-basics.spec.ts   # Basic card functionality
│   │   └── loot-monster-room.spec.ts  # Loot/Monster/Room tests
│   ├── mechanics/                # Game mechanics tests
│   │   └── game-mechanics.spec.ts  # Priority, stack, voting, etc.
│   └── regression/               # Full game regression tests
│       └── full-game.spec.ts     # Complete 4-player game flow
├── fixtures/                     # Test fixtures and data
│   └── test-cards.ts             # Card IDs for testing
├── utils/                        # Test utilities
│   ├── playwright-helpers.ts     # Playwright helpers and player wrappers
│   ├── socket-helpers.ts         # Socket.io helpers for multiplayer
│   ├── game-logger.ts            # Game state logging and validation
│   └── card-api.ts               # Card database access
├── playwright.config.ts          # Playwright configuration
└── reports/                      # Test output (generated)
```

## Running Tests

### Prerequisites

1. Build the server and client:
```bash
npm run build
```

2. Start the dev servers (in separate terminals):
```bash
# Terminal 1: Start server
npm run dev --workspace=packages/server

# Terminal 2: Start client
npm run dev --workspace=packages/client
```

### Test Commands

Run all tests:
```bash
npm test
```

Run specific test files:
```bash
npm run test:basic       # Basic game flow tests
npm run test:cards       # Card-specific tests
npm run test:mechanics   # Game mechanics tests
npm run test:regression  # Full regression tests
npm run test:full        # Complete 4-player game test
```

### Test Modes

```bash
npm run test:headless    # Run tests in headless mode (default)
npm run test:headed      # Run tests with browser visible
npm run test:ui          # Run with Playwright UI
npm run test:debug       # Run in debug mode
npm run test:watch       # Watch mode (auto-rerun on changes)
npm run test:report      # Open test report
```

## Test Coverage

### Basic Game Flow (`tests/e2e/basic-game.spec.ts`)
- Room creation
- Player joining (4 players)
- Game start
- Phase transitions (lobby → eden_pick/sad_vote → active)
- Turn flow
- Attack resolution
- Loot drawing
- Win condition

### Card Tests (`tests/e2e/cards/`)
- **Active items** (with ↷ abilities)
- **Passive items**
- **Loot cards**:
  - Trinkets
  - Curses
  - Ambushes
  - Guppy cards
- **Monsters** (regular and bosses with souls)
- **Room cards**

### Mechanics Tests (`tests/e2e/mechanics/game-mechanics.spec.ts`)
- **Priority and stack**:
  - Priority passing
  - Stack resolution
  - Reaction timing
- **Eden pick**: Starting item selection
- **Sad vote**: Saddest character voting
- **Deck management**:
  - Card drawing
  - Deck exhaustion/reshuffle
  - Item purchase
  - Shop refill
- **Item activation**:
  - Tap abilities (↷)
  - Paid abilities ($)
- **Win condition**: Soul value tracking

### Full Regression (`tests/e2e/regression/full-game.spec.ts`)
Complete end-to-end 4-player game:
1. Room creation and 4-player join
2. Game start with phase transitions
3. Eden pick (if applicable)
4. Sad vote
5. Multiple turns with attacks
6. Deck management
7. Shop and items
8. Win condition verification
9. Game log validation
10. Player stats validation

## Test Helpers

### TestPlayer (`playwright-helpers.ts`)
Wrapper for managing player browser sessions:
- `joinRoom(roomId)` - Join existing room
- `createRoom()` - Create new room
- `declareAttack(slot)` - Attack monster
- `rollDice()` - Roll attack dice
- `playLootCard(index)` - Play loot from hand
- `purchaseItem(slot)` - Buy from shop
- `passPriority()` - Pass turn
- `getPlayerStats()` - Get HP, ATK, souls, hand count
- `getGameLog()` - Get game event log

### GameLogger (`game-logger.ts`)
Comprehensive game logging and validation:
- Event logging with timestamps
- Phase tracking
- Player stat validation
- Card effect validation

### CardApiClient (`card-api.ts`)
Access card database:
- `getCardById(id)` - Get single card
- `getCardsByType(type)` - Get all cards of type
- `filterCards(cards, criteria)` - Filter cards

## Writing New Tests

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';
import { TestPlayer, createPlayerContext } from '../utils/playwright-helpers';

test.describe('Test Suite Name', () => {
  let players: TestPlayer[] = [];

  test.beforeAll(async ({ browser }) => {
    // Create 4 player contexts
    for (const name of ['Alice', 'Bob', 'Charlie', 'Diana']) {
      const context = await createPlayerContext(browser, name);
      players.push(context);
    }
  });

  test.afterAll(async () => {
    // Clean up
    for (const player of players) {
      await player.close();
    }
  });

  test('should do something', async ({ browser }) => {
    const host = players[0];
    // Test logic here
  });
});
```

### Test Flow Pattern
1. Create 4 player contexts
2. Host creates room
3. Other players join
4. Host starts game
5. Monitor phase transitions
6. Execute game actions
7. Validate results
8. Clean up

## Test Data

### Card IDs (`fixtures/test-cards.ts`)
Pre-selected card IDs for testing:
- Characters
- Starting items
- Active items
- Passive items
- Loot (Trinkets, Curses, Ambushes, Guppies)
- Monsters (regular and bosses)
- Rooms
- Bonus souls

## Debugging Tests

### Playwright UI
```bash
npm run test:ui
```

### Debug Mode
```bash
npm run test:debug
```

### View Reports
```bash
npm run test:report
```

## Troubleshooting

### Tests fail to connect
- Ensure dev servers are running: `npm run dev`
- Check server is on port 3001
- Check client is on port 5173

### Players can't join
- Verify room ID matches
- Check player names are unique
- Ensure all players are created before joining

### Game doesn't progress
- Check priority is being passed
- Verify attack declarations
- Ensure dice rolls complete

## CI/CD Integration

Tests are designed to run in CI with:
```bash
# Headless mode for CI
npm run test:headless

# Generate report for upload
npm run test -- --reporter=html,json
```

## Future Enhancements

- Add more card-specific tests
- Add performance benchmarks
- Add visual regression testing
- Add stress tests (10+ players)
- Add concurrent game tests (multiple rooms)
