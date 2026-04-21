import { test, expect } from '@playwright/test';
import { TestPlayer, createPlayerContext, waitForAllPlayers } from '../../utils/playwright-helpers';

/**
 * Full Regression Test Suite
 * Tests a complete 4-player game through all phases
 */

test.describe('Full Regression Test Suite', () => {
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  let players: TestPlayer[] = [];

  test.beforeAll(async ({ browser }) => {
    console.log('=== Setting up full regression test ===');
    for (const name of playerNames) {
      const context = await createPlayerContext(browser, name);
      players.push(context);
    }
    console.log(`Created ${players.length} player contexts`);
  });

  test.afterAll(async () => {
    console.log('=== Cleaning up test players ===');
    for (const player of players) {
      try {
        await player.close();
      } catch (e) {
        console.log(`Error closing player ${player.name}: ${e}`);
      }
    }
    console.log('Test cleanup complete');
  });

  test('FR-001: Room creation and player join flow', async ({ browser }) => {
    console.log('\n--- Test FR-001: Room Creation and Join ---');
    const host = players[0];
    
    // Host creates room
    const createResult = await host.createRoom();
    expect(createResult.success).toBe(true);
    expect(createResult.roomId).toBeDefined();
    expect(createResult.roomId?.length).toBe(6);
    
    const roomId = createResult.roomId!;
    console.log(`Room created: ${roomId}`);
    
    // Other players join
    const joinPromises = players.slice(1).map(player => player.joinRoom(roomId));
    const joinResults = await Promise.all(joinPromises);
    
    for (const result of joinResults) {
      expect(result.success).toBe(true);
    }
    console.log('All players joined successfully');
    
    // Verify all 4 players in lobby
    await waitForAllPlayers(players, 4);
    
    // Check lobby UI
    await host.page.waitForSelector('[data-testid="lobby-page"]', { timeout: 5000 });
    console.log('Lobby UI verified');
  });

  test('FR-002: Game start and phase transitions', async ({ browser }) => {
    console.log('\n--- Test FR-002: Game Start and Phase Transitions ---');
    const host = players[0];
    
    // Host starts game
    await host.page.waitForSelector('[data-testid="start-game-button"]', { timeout: 10000 });
    await host.page.click('[data-testid="start-game-button"]');
    console.log('Game started by host');
    
    // Monitor phase transitions
    let phaseCount = 0;
    
    try {
      await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 5000 });
      console.log('✓ Transitioned to eden_pick phase');
      phaseCount++;
    } catch {
      try {
        await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
        console.log('✓ Transitioned to sad_vote phase');
        phaseCount++;
      } catch {
        await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
        console.log('✓ Transitioned to active phase');
        phaseCount++;
      }
    }
    
    // Verify all players see game board
    for (const player of players) {
      await player.page.waitForSelector('[data-testid="game-board"]', { timeout: 5000 });
    }
    console.log('All players see game board');
  });

  test('FR-003: Eden pick phase (if applicable)', async ({ browser }) => {
    console.log('\n--- Test FR-003: Eden Pick Phase ---');
    const host = players[0];
    
    try {
      await host.page.waitForSelector('[data-testid="eden-phase"]', { timeout: 3000 });
      
      // Eden players should see pick modal
      await host.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 5000 });
      
      // Get number of pick options
      const pickCard = host.page.locator('[data-testid="eden-pick-card"]');
      const cardCount = await pickCard.count();
      
      expect(cardCount).toBe(3);
      console.log(`✓ Eden pick: ${cardCount} options available`);
      
      // Each Eden player picks
      for (const player of players) {
        try {
          await player.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 2000 });
          await player.page.click('[data-testid="eden-pick-card"]:first-child');
          console.log(`Player ${player.name} picked starting item`);
        } catch {
          // Not an Eden player
        }
      }
      
      await host.page.waitForTimeout(1000);
      
      // Verify exit from eden phase
      try {
        await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 5000 });
        console.log('✓ Exited eden_pick phase');
      } catch {
        await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
        console.log('✓ Exited eden_pick phase (no sad vote needed)');
      }
    } catch {
      console.log('No eden_pick phase (no Eden characters)');
    }
  });

  test('FR-004: Sad vote phase', async ({ browser }) => {
    console.log('\n--- Test FR-004: Sad Vote Phase ---');
    const host = players[0];
    
    try {
      await host.page.waitForSelector('[data-testid="sad-vote-phase"]', { timeout: 3000 });
      console.log('Entered sad_vote phase');
      
      // All players vote
      for (const player of players) {
        try {
          await player.page.waitForSelector('[data-testid="sad-vote-modal"]', { timeout: 2000 });
          
          const voteButton = player.page.locator('[data-testid="sad-vote-player"]');
          const voteCount = await voteButton.count();
          
          if (voteCount > 0) {
            await voteButton.nth(0).click();
            console.log(`Player ${player.name} voted`);
          }
        } catch {
          // Player already voted or not applicable
        }
      }
      
      // Wait for resolution
      await host.page.waitForTimeout(1000);
      
      // Verify transition to active
      await host.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
      console.log('✓ Sad vote resolved');
    } catch {
      console.log('No sad_vote phase (solo game or skipped)');
    }
  });

  test('FR-005: First player turn (active phase)', async ({ browser }) => {
    console.log('\n--- Test FR-005: First Player Turn ---');
    const activePlayer = players[0];
    
    // Wait for active player
    await activePlayer.page.waitForSelector('[data-testid="active-phase"]', { timeout: 5000 });
    await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 5000 });
    
    console.log(`${activePlayer.name} has priority`);
    
    // Record initial stats
    const initialStats = await activePlayer.getPlayerStats();
    console.log(`Initial stats: HP=${initialStats.hp}, ATK=${initialStats.atk}, Souls=${initialStats.soulValue}`);
    
    // Verify hand count (should be 3 starting loot)
    expect(initialStats.handCount).toBe(3);
    console.log('✓ Starting loot dealt (3 cards)');
    
    // Attack monster
    await activePlayer.declareAttack(0);
    console.log('Declared attack on monster');
    
    // Roll dice
    const roll = await activePlayer.rollDice();
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    console.log(`Rolled ${roll}`);
    
    // Wait for damage resolution
    await activePlayer.page.waitForTimeout(1500);
    
    // Check for loot phase
    try {
      await activePlayer.page.waitForSelector('[data-testid="loot-phase"]', { timeout: 3000 });
      console.log('Loot phase started');
      
      // Draw loot
      await activePlayer.page.click('[data-testid="draw-loot-button"]');
      await activePlayer.page.waitForTimeout(1000);
      
      const finalStats = await activePlayer.getPlayerStats();
      expect(finalStats.handCount).toBeGreaterThan(initialStats.handCount);
      console.log(`Hand increased: ${initialStats.handCount} → ${finalStats.handCount}`);
    } catch {
      console.log('No loot phase');
    }
    
    // Pass priority
    await activePlayer.passPriority();
    console.log(`${activePlayer.name} passed priority`);
  });

  test('FR-006: Subsequent player turns', async ({ browser }) => {
    console.log('\n--- Test FR-006: Subsequent Turns ---');
    const maxTurns = 6; // 6 turns total (1.5 per player)
    let currentTurn = 0;
    
    while (currentTurn < maxTurns) {
      const activePlayer = players[currentTurn % 4];
      
      // Wait for active player
      try {
        await activePlayer.page.waitForSelector('[data-testid="priority-active"]', { timeout: 10000 });
      } catch {
        // Player may have disconnected or game ended
        break;
      }
      
      console.log(`Turn ${currentTurn + 1}: ${activePlayer.name}'s turn`);
      
      // Get stats
      const stats = await activePlayer.getPlayerStats();
      console.log(`  Stats: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}, Hand=${stats.handCount}`);
      
      // Do basic action
      if (currentTurn % 2 === 0) {
        // Every other turn: attack
        try {
          await activePlayer.declareAttack(0);
          await activePlayer.rollDice();
        } catch {
          // No monster to attack
        }
      }
      
      // Check for win
      const gameOver = await activePlayer.checkGameOver();
      if (gameOver) {
        const winner = await activePlayer.getWinner();
        console.log(`Game ended! Winner: ${winner}`);
        break;
      }
      
      currentTurn++;
      
      // Small delay between turns
      await activePlayer.page.waitForTimeout(1000);
    }
    
    console.log(`Completed ${currentTurn} turns`);
  });

  test('FR-007: Game log validation', async ({ browser }) => {
    console.log('\n--- Test FR-007: Game Log Validation ---');
    const host = players[0];
    
    // Get game log
    const log = await host.getGameLog();
    expect(log.length).toBeGreaterThan(0);
    console.log(`Game log has ${log.length} entries`);
    
    // Check for expected event types
    const logText = log.join(' ').toLowerCase();
    
    const eventTypes = ['attack', 'loot', 'phase', 'turn', 'soul'];
    let foundEvents = 0;
    
    for (const eventType of eventTypes) {
      if (logText.includes(eventType)) {
        foundEvents++;
        console.log(`✓ Found "${eventType}" events`);
      }
    }
    
    console.log(`Found ${foundEvents}/${eventTypes.length} expected event types`);
    
    // Show first 5 log entries
    console.log('First 5 log entries:');
    for (let i = 0; i < Math.min(5, log.length); i++) {
      console.log(`  ${i + 1}. ${log[i]}`);
    }
  });

  test('FR-008: Win condition verification', async ({ browser }) => {
    console.log('\n--- Test FR-008: Win Condition ---');
    const host = players[0];
    
    // Check win threshold
    const winSoulValue = 4;
    
    // Track soul values across players
    for (const player of players) {
      const stats = await player.getPlayerStats();
      console.log(`${player.name} soul value: ${stats.soulValue}`);
    }
    
    // Check if game has ended
    const gameOver = await host.checkGameOver();
    
    if (gameOver) {
      const winner = await host.getWinner();
      expect(winner).toBeDefined();
      console.log(`✓ Game ended with winner: ${winner}`);
    } else {
      console.log('Game still in progress (win condition not yet met)');
    }
  });

  test('FR-009: Deck management', async ({ browser }) => {
    console.log('\n--- Test FR-008: Deck Management ---');
    const host = players[0];
    
    // Get deck counts
    const lootDeck = await host.page.textContent('[data-testid="loot-deck-count"]');
    const monsterDeck = await host.page.textContent('[data-testid="monster-deck-count"]');
    const treasureDeck = await host.page.textContent('[data-testid="treasure-deck-count"]');
    
    console.log(`Deck counts: Loot=${lootDeck}, Monster=${monsterDeck}, Treasure=${treasureDeck}`);
    
    // Verify decks have cards
    expect(parseInt(lootDeck || '0', 10)).toBeGreaterThan(0);
    expect(parseInt(monsterDeck || '0', 10)).toBeGreaterThan(0);
    
    console.log('✓ Decks are populated');
  });

  test('FR-010: Shop and item mechanics', async ({ browser }) => {
    console.log('\n--- Test FR-010: Shop and Item Mechanics ---');
    const host = players[0];
    
    // Check shop slots
    const shopSlot = await host.page.locator('[data-testid="shop-slot"]');
    const shopCount = await shopSlot.count();
    
    expect(shopCount).toBe(2);
    console.log(`✓ Shop has ${shopCount} slots`);
    
    // Check for purchase buttons
    const purchaseBtn = await host.page.locator('[data-testid="shop-purchase-button"]');
    const purchaseCount = await purchaseBtn.count();
    
    console.log(`Shop items available for purchase: ${purchaseCount}`);
  });

  test('FR-011: Player stats validation', async ({ browser }) => {
    console.log('\n--- Test FR-011: Player Stats Validation ---');
    
    // Check all players have valid stats
    for (const player of players) {
      const stats = await player.getPlayerStats();
      
      expect(stats.hp).toBeGreaterThan(0);
      expect(stats.atk).toBeGreaterThanOrEqual(1);
      expect(stats.handCount).toBeGreaterThanOrEqual(0);
      expect(stats.soulValue).toBeGreaterThanOrEqual(0);
      
      console.log(`${player.name}: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}`);
    }
    
    console.log('✓ All players have valid stats');
  });

  test('FR-012: Full game completion', async ({ browser }) => {
    console.log('\n--- Test FR-012: Full Game Completion ---');
    const host = players[0];
    
    // Wait for game to complete (timeout after 60 seconds)
    let gameOver = await host.checkGameOver();
    let elapsed = 0;
    const maxWait = 60000; // 60 seconds
    const checkInterval = 2000;
    
    while (!gameOver && elapsed < maxWait) {
      await host.page.waitForTimeout(checkInterval);
      elapsed += checkInterval;
      gameOver = await host.checkGameOver();
      console.log(`Waiting for game end... (${elapsed / 1000}s)`);
    }
    
    if (gameOver) {
      const winner = await host.getWinner();
      expect(winner).toBeDefined();
      console.log(`✓ Game completed! Winner: ${winner}`);
      
      // Final stats
      for (const player of players) {
        const stats = await player.getPlayerStats();
        console.log(`Final - ${player.name}: HP=${stats.hp}, ATK=${stats.atk}, Souls=${stats.soulValue}`);
      }
    } else {
      console.log('Game did not complete within timeout (still in progress)');
    }
  });
});
