import { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Test player session with page and socket connections
 */
export class TestPlayer {
  readonly name: string;
  readonly page: Page;
  readonly context: BrowserContext;
  
  // Game state tracking
  playerId: string | null = null;
  socketConnected = false;
  
  constructor(name: string, page: Page, context: BrowserContext) {
    this.name = name;
    this.page = page;
    this.context = context;
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.page.goto(`/lobby/${roomId}`);
      
      // Wait for lobby to load
      await this.page.waitForSelector('[data-testid="lobby-page"]', { timeout: 10000 });
      
      // Enter name and join
      await this.page.fill('[data-testid="player-name-input"]', this.name);
      await this.page.click('[data-testid="join-room-button"]');
      
      // Wait for game state
      await this.page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to join room ${roomId} as ${this.name}: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Create a new room
   */
  async createRoom(): Promise<{ success: boolean; roomId?: string; error?: string }> {
    try {
      await this.page.goto('/');
      await this.page.waitForSelector('[data-testid="home-page"]', { timeout: 10000 });
      
      // Enter name
      await this.page.fill('[data-testid="player-name-input"]', this.name);
      
      // Create room
      await this.page.click('[data-testid="create-room-button"]');
      
      // Wait for room creation and capture room ID from URL
      await this.page.waitForURL(/\/lobby\/[A-Z0-9]{6}/);
      
      const roomId = this.page.url().split('/').pop() || '';
      
      return { success: true, roomId };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to create room for ${this.name}: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Select starting item during Eden pick phase
   */
  async selectEdenPick(cardIndex: number): Promise<void> {
    await this.page.waitForSelector('[data-testid="eden-pick-modal"]', { timeout: 10000 });
    
    const cards = await this.page.locator('[data-testid="eden-pick-card"]');
    if (cardIndex < (await cards.count())) {
      await cards.nth(cardIndex).click();
      await this.page.waitForSelector('[data-testid="eden-pick-modal"]', { state: 'detached', timeout: 5000 });
    }
  }

  /**
   * Vote for saddest character
   */
  async voteForSaddest(targetPlayerIndex: number): Promise<void> {
    await this.page.waitForSelector('[data-testid="sad-vote-modal"]', { timeout: 10000 });
    
    const players = await this.page.locator('[data-testid="sad-vote-player"]');
    if (targetPlayerIndex < (await players.count())) {
      await players.nth(targetPlayerIndex).click();
      await this.page.waitForSelector('[data-testid="sad-vote-modal"]', { state: 'detached', timeout: 5000 });
    }
  }

  /**
   * Declare attack on monster slot
   */
  async declareAttack(slotIndex: number): Promise<void> {
    const monsterSlot = this.page.locator(`[data-testid="monster-slot-${slotIndex}"]`);
    await monsterSlot.click({ timeout: 5000 });
  }

  /**
   * Roll attack dice
   */
  async rollDice(): Promise<number> {
    await this.page.waitForSelector('[data-testid="dice-roller"]', { timeout: 5000 });
    await this.page.click('[data-testid="roll-dice-button"]');
    
    // Wait for dice roll result
    await this.page.waitForSelector('[data-testid="dice-result"]', { timeout: 5000 });
    
    const result = await this.page.textContent('[data-testid="dice-result"]');
    return parseInt(result || '0', 10);
  }

  /**
   * Play a loot card from hand
   */
  async playLootCard(cardIndex: number, targets: string[] = []): Promise<void> {
    const handCard = this.page.locator(`[data-testid="hand-card-${cardIndex}"]`);
    await handCard.click({ timeout: 5000 });
    
    // Handle target selection if needed
    if (targets.length > 0) {
      for (const targetId of targets) {
        await this.page.click(`[data-testid="target-${targetId}"]`, { timeout: 5000 });
      }
    }
    
    // Confirm card play
    await this.page.click('[data-testid="confirm-play-button"]', { timeout: 5000 });
  }

  /**
   * Purchase item from shop
   */
  async purchaseItem(slotIndex: number): Promise<void> {
    const shopSlot = this.page.locator(`[data-testid="shop-slot-${slotIndex}"]`);
    await shopSlot.click({ timeout: 5000 });
    await this.page.click('[data-testid="confirm-purchase-button"]', { timeout: 5000 });
  }

  /**
   * Activate an item ability
   */
  async activateItemAbility(instanceId: string, abilityTag: 'tap' | 'paid'): Promise<void> {
    const item = this.page.locator(`[data-testid="item-${instanceId}"]`);
    await item.click({ timeout: 5000 });
    
    const abilityButton = this.page.locator(`[data-testid="ability-${abilityTag}"]`);
    await abilityButton.click({ timeout: 5000 });
  }

  /**
   * Pass priority (skip turn/next action)
   */
  async passPriority(): Promise<void> {
    await this.page.click('[data-testid="pass-button"]', { timeout: 5000 });
  }

  /**
   * Get current game state for validation
   */
  async getGameState(): Promise<Record<string, unknown>> {
    return await this.page.evaluate(() => {
      // Access game store via window object or DOM
      const stateEl = document.querySelector('[data-testid="game-state"]');
      if (stateEl) {
        return JSON.parse(stateEl.textContent || '{}');
      }
      return {};
    });
  }

  /**
   * Get player stats
   */
  async getPlayerStats(): Promise<{
    hp: number;
    atk: number;
    coins: number;
    soulValue: number;
    handCount: number;
  }> {
    const hp = await this.page.textContent('[data-testid="hp-display"]');
    const atk = await this.page.textContent('[data-testid="atk-display"]');
    const coins = await this.page.textContent('[data-testid="coins-display"]');
    const souls = await this.page.textContent('[data-testid="soul-value-display"]');
    const handCount = await this.page.textContent('[data-testid="hand-count"]');

    return {
      hp: parseInt(hp || '0', 10),
      atk: parseInt(atk || '0', 10),
      coins: parseInt(coins || '0', 10),
      soulValue: parseInt(souls || '0', 10),
      handCount: parseInt(handCount || '0', 10)
    };
  }

  /**
   * Check if game has ended
   */
  async checkGameOver(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="game-over-modal"]', { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get winner if game has ended
   */
  async getWinner(): Promise<string | null> {
    try {
      await this.page.waitForSelector('[data-testid="winner-name"]', { timeout: 2000 });
      return await this.page.textContent('[data-testid="winner-name"]');
    } catch {
      return null;
    }
  }

  /**
   * Get game log entries
   */
  async getGameLog(): Promise<string[]> {
    const logItems = await this.page.locator('[data-testid="game-log-entry"]');
    const count = await logItems.count();
    
    const logs: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await logItems.nth(i).textContent();
      if (text) logs.push(text);
    }
    
    return logs;
  }

  /**
   * Wait for specific game phase
   */
  async waitForPhase(phase: 'lobby' | 'eden_pick' | 'sad_vote' | 'active' | 'ended'): Promise<void> {
    const phaseMap = {
      lobby: 'lobby-phase',
      eden_pick: 'eden-phase',
      sad_vote: 'sad-vote-phase',
      active: 'active-phase',
      ended: 'ended-phase'
    };
    
    await this.page.waitForSelector(`[data-testid="${phaseMap[phase]}"]`, { timeout: 10000 });
  }

  /**
   * Close player session
   */
  async close(): Promise<void> {
    await this.page.close();
  }
}

/**
 * Create a test browser context with authentication
 */
export async function createPlayerContext(
  browser: Browser,
  name: string
): Promise<TestPlayer> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  const player = new TestPlayer(name, page, context);
  
  return player;
}

/**
 * Wait for all players to have joined
 */
export async function waitForAllPlayers(
  players: TestPlayer[],
  expectedCount: number
): Promise<boolean> {
  for (const player of players) {
    try {
      await player.page.waitForSelector(
        `[data-testid="player-count"][data-count="${expectedCount}"]`,
        { timeout: 10000 }
      );
    } catch {
      return false;
    }
  }
  
  return true;
}

/**
 * Wait for a specific player to have priority
 */
export async function waitForPlayerPriority(
  player: TestPlayer,
  timeout: number = 10000
): Promise<boolean> {
  try {
    await player.page.waitForSelector('[data-testid="priority-active"]', { timeout });
    return true;
  } catch {
    return false;
  }
}
