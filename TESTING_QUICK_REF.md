# Four Souls E2E Testing - Quick Reference

## Quick Start

```bash
# 1. Build the application
npm run build

# 2. Start dev servers (in separate terminals)
npm run dev --workspace=packages/server
npm run dev --workspace=packages/client

# 3. Run tests
npm test                    # All tests (headless)
npm run test:ui            # With UI
```

## Make Commands

```bash
make test                  # npm test
make test-ui              # npm run test:ui
make test-watch           # npm run test:watch
make test-debug           # npm run test:debug
make test-headless        # npm run test:headless
make test-basic           # Basic game tests
make test-cards           # Card-specific tests
make test-mechanics       # Mechanics tests
make test-regression      # Full regression
make test-full            # Complete 4-player game
make test-report          # Open HTML report
make test-validate        # Validate setup
```

## Test Files

| File | Description | Lines |
|------|-------------|-------|
| `e2e/basic-game.spec.ts` | Room creation, join, flow | 194 |
| `e2e/cards/card-basics.spec.ts` | Basic card functionality | 720 |
| `e2e/cards/loot-monster-room.spec.ts` | Loot/Monster/Room tests | 1,177 |
| `e2e/mechanics/game-mechanics.spec.ts` | Priority, stack, voting | 1,361 |
| `e2e/regression/full-game.spec.ts` | Complete 4-player game | 1,465 |
| **Total** | | **~4,900** |

## Test Coverage

✅ **Basic Flow**: Room creation, player join, phases, turns, win  
✅ **Cards**: Active/passive items, loot, monsters, rooms  
✅ **Mechanics**: Priority, stack, Eden pick, sad vote, decks, items  
✅ **Regression**: Complete 4-player game simulation  

## Card Types Tested

- **25 Characters** (ISAAC, SAMSON, etc.)
- **40 Treasure Cards** (Active + Passive items)
- **15 Loot Cards** (Trinkets, Ambushes, Curses, Guppies)
- **10 Monsters** (Regular + Bosses with souls)
- **10 Room Cards**

## Key Commands

```bash
# Validate setup
./tests/validate.sh

# Run specific suite
npm run test:basic
npm run test:cards
npm run test:mechanics
npm run test:regression
npm run test:full

# Debug
npm run test:ui      # UI mode
npm run test:debug   # Debug mode
npm run test:watch   # Watch mode
npm run test:report  # Open report
```

## Test Structure

```
tests/
├── e2e/              # Test files
│   ├── basic-game.spec.ts
│   ├── cards/        # Card-specific tests
│   ├── mechanics/    # Mechanics tests
│   └── regression/   # Full regression
├── fixtures/         # Card IDs
│   └── test-cards.ts
├── utils/            # Helper utilities
│   ├── playwright-helpers.ts
│   ├── socket-helpers.ts
│   ├── game-logger.ts
│   ├── card-api.ts
│   └── card-effects.ts
└── playwright.config.ts
```

## Test Helpers

```typescript
// Player session
const player = new TestPlayer(name, page, context);
await player.joinRoom(roomId);
await player.createRoom();
await player.declareAttack(slot);
await player.rollDice();
await player.playLootCard(index);
await player.passPriority();

// Get stats
const stats = await player.getPlayerStats();
// { hp, atk, coins, soulValue, handCount }

// Get logs
const log = await player.getGameLog();
```

## Troubleshooting

**Tests fail to connect** → Ensure `npm run dev` is running  
**Players can't join** → Check room ID format (6 chars)  
**Game doesn't progress** → Verify priority passing  

## Documentation

- [TESTING.md](./TESTING.md) - Full documentation
- [tests/README.md](./tests/README.md) - Test suite guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Overview
