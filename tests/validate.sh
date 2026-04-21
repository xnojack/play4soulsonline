#!/bin/bash
# Validation script for Playwright test setup
# This script checks if all necessary files exist and can be built

set -e

echo "=== Four Souls E2E Test Setup Validation ==="
echo

# Check if tests directory exists
if [ ! -d "tests" ]; then
    echo "❌ tests directory not found"
    exit 1
fi
echo "✓ tests directory exists"

# Check Playwright config
if [ ! -f "tests/playwright.config.ts" ]; then
    echo "❌ tests/playwright.config.ts not found"
    exit 1
fi
echo "✓ Playwright config exists"

# Check test utilities
if [ ! -f "tests/utils/playwright-helpers.ts" ]; then
    echo "❌ tests/utils/playwright-helpers.ts not found"
    exit 1
fi
echo "✓ playwright-helpers.ts exists"

if [ ! -f "tests/utils/socket-helpers.ts" ]; then
    echo "❌ tests/utils/socket-helpers.ts not found"
    exit 1
fi
echo "✓ socket-helpers.ts exists"

if [ ! -f "tests/utils/game-logger.ts" ]; then
    echo "❌ tests/utils/game-logger.ts not found"
    exit 1
fi
echo "✓ game-logger.ts exists"

# Check fixtures
if [ ! -f "tests/fixtures/test-cards.ts" ]; then
    echo "❌ tests/fixtures/test-cards.ts not found"
    exit 1
fi
echo "✓ test-cards.ts exists"

# Check test files
if [ ! -f "tests/e2e/basic-game.spec.ts" ]; then
    echo "❌ tests/e2e/basic-game.spec.ts not found"
    exit 1
fi
echo "✓ basic-game.spec.ts exists"

if [ ! -f "tests/e2e/cards/card-basics.spec.ts" ]; then
    echo "❌ tests/e2e/cards/card-basics.spec.ts not found"
    exit 1
fi
echo "✓ card-basics.spec.ts exists"

if [ ! -f "tests/e2e/cards/loot-monster-room.spec.ts" ]; then
    echo "❌ tests/e2e/cards/loot-monster-room.spec.ts not found"
    exit 1
fi
echo "✓ loot-monster-room.spec.ts exists"

if [ ! -f "tests/e2e/mechanics/game-mechanics.spec.ts" ]; then
    echo "❌ tests/e2e/mechanics/game-mechanics.spec.ts not found"
    exit 1
fi
echo "✓ game-mechanics.spec.ts exists"

if [ ! -f "tests/e2e/regression/full-game.spec.ts" ]; then
    echo "❌ tests/e2e/regression/full-game.spec.ts not found"
    exit 1
fi
echo "✓ full-game.spec.ts exists"

# Check README
if [ ! -f "tests/README.md" ]; then
    echo "❌ tests/README.md not found"
    exit 1
fi
echo "✓ README.md exists"

# Check package.json scripts
if ! grep -q "test" package.json; then
    echo "❌ test scripts not found in package.json"
    exit 1
fi
echo "✓ test scripts in package.json"

# Check if Playwright is installed
if ! npx playwright --version > /dev/null 2>&1; then
    echo "❌ Playwright not installed"
    exit 1
fi
echo "✓ Playwright installed"

# Count test files
TEST_COUNT=$(find tests/e2e -name "*.spec.ts" | wc -l)
echo "✓ Found $TEST_COUNT test files"

# Count utility files
UTIL_COUNT=$(find tests/utils -name "*.ts" | wc -l)
echo "✓ Found $UTIL_COUNT utility files"

echo
echo "=== All validation checks passed! ==="
echo
echo "Next steps:"
echo "1. Build the server: npm run build --workspace=packages/server"
echo "2. Build the client: npm run build --workspace=packages/client"
echo "3. Start dev servers: npm run dev"
echo "4. Run tests: npm test"
echo "   or: npm run test:ui (for UI mode)"
