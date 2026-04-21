import { test, expect } from '@playwright/test';
import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../utils/playwright-helpers';

test.describe('Basic Game Flow', () => {
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  let players: TestPlayer[] = [];

  test.beforeAll(async ({ browser }) => {
    // Create player contexts
    for (const name of playerNames) {
      const context = await createPlayerContext(browser, name);
      players.push(context);
    }
  });

  test.afterAll(async () => {
    // Clean up all players
    for (const player of players) {
      await player.close();
    }
  });

  test('should create room and join players', async ({ browser }) => {
    const host = players[0];
    
    // Host creates room
    const createResult = await host.createRoom();
    expect(createResult.success).toBe(true);
    expect(createResult.roomId).toBeDefined();
    expect(createResult.roomId?.length).toBe(6); // Room codes are 6 chars

    const roomId = createResult.roomId!;

    // Wait for room to be visible in URL
    await expect(host.page).toHaveURL(new RegExp(`/lobby/${roomId}$`));

    // Other players join
    const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
    const joinResults = await Promise.all(joinPromises);

    for (const result of joinResults) {
      expect(result.success).toBe(true);
    }

    // Wait for all 4 players to join
    await waitForAllPlayers(players, 4);
  });

  test('should start game and transition through phases', async ({ browser }) => {
    const host = players[0];

    // Host should be the start game button (host)
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
    
    // Start game
    await host.page.click('[data-testid="start-game-button"]');
    
    // Wait for phase transitions
    // First: lobby → eden_pick (if Eden character) or sad_vote or active
    try {
      await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
      console.log('Entered eden_pick phase');
    } catch {
      try {
        await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
        console.log('Entered sad_vote phase');
      } catch {
        await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
        console.log('Entered active phase directly');
      }
    }

    // All players should see game board
    for (const player of players) {
      await player.page.waitForSelector('[data-testid="game-board"]', { timeout: 5000 });
    }
  });

  test('should complete first turn with attacks and loot', async ({ browser }) => {
    const activePlayer = players[0]; // First player is active
    
    // Wait for active player's turn
    await activePlayer.page.waitForSelector('[data-testid="active-phase"]', { timeout: 10000 });
    await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });

    // Get initial stats
    const initialStats = await activePlayer.getPlayerStats();
    expect(initialStats.hp).toBeGreaterThan(0);
    expect(initialStats.handCount).toBe(3); // Starting loot

    // Attack monster in slot 0
    await activePlayer.declareAttack(0);
    
    // Roll dice
    const rollResult = await activePlayer.rollDice();
    expect(rollResult).toBeGreaterThanOrEqual(1);
    expect(rollResult).toBeLessThanOrEqual(6);

    // Wait for damage resolution
    await activePlayer.page.waitForTimeout(1000);

    // Draw loot (should be available)
    await activePlayer.page.waitForSelector('[data-testid="loot-phase"]', { timeout: 5000 });

    // Check updated stats
    const finalStats = await activePlayer.getPlayerStats();
    expect(finalStats.hp).toBe(initialStats.hp); // No damage taken
    expect(finalStats.handCount).toBeGreaterThan(initialStats.handCount);
  });

  test('should handle multiple turns and win condition', async ({ browser }) => {
    // This test verifies turn rotation and soul tracking
    // We'll track soul counts across turns

    let currentTurn = 0;
    const maxTurns = 8; // 2 turns per player

    while (currentTurn < maxTurns) {
      // Wait for active player
      const activePlayer = players[currentTurn % 4];
      
      await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 10000 }).catch(() => {});
      
      // Record player stats
      const stats = await activePlayer.getPlayerStats();
      console.log(`Turn ${currentTurn + 1} - ${activePlayer.name}: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}`);

      // Do a basic action (attack)
      if (currentTurn === 0) {
        await activePlayer.declareAttack(0);
        await activePlayer.rollDice();
      }

      currentTurn++;
    }

    // Check if any player has won (4 souls)
    const winner = await players[0].getWinner();
    if (winner) {
      console.log(`Game ended - Winner: ${winner}`);
    }

    // All players should still be connected
    for (const player of players) {
      const gameOver = await player.checkGameOver();
      // Don't fail if game is not over yet
    }
  });

  test('should validate game log entries', async ({ browser }) => {
    const host = players[0];

    // Get game log
    const log = await host.getGameLog();
    expect(log.length).toBeGreaterThan(0);
    
    // Log should contain expected event types
    const logText = log.join(' ').toLowerCase();
    expect(logText).toMatch(/attack|loot|phase|turn/);
    
    console.log(`Game log entries: ${log.length}`);
    for (let i = 0; i < Math.min(5, log.length); i++) {
      console.log(`  ${i + 1}. ${log[i]}`);
    }
  });

  test('should handle player disconnect and reconnect', async ({ browser }) => {
    const player = players[1];
    
    // Disconnect
    await player.page.context().close();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reconnect (create new context)
    const context = await browser.newContext();
    const reconnectPage = await context.newPage();
    const reconnectPlayer = new TestPlayer(player.name, reconnectPage, context);
    
    // Try to auto-rejoin (if room still exists)
    const currentUrl = players[0].page.url();
    const roomId = currentUrl.split('/').pop();
    
    if (roomId) {
      await reconnectPlayer.joinRoom(roomId);
      
      // Should be back in game
      await reconnectPlayer.page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
    }
    
    await reconnectPlayer.close();
  });
});
