/**
 * Card database interface
 * Access card data from the server's database
 */

export interface CardData {
  id: string;
  name: string;
  cardType: 'Character' | 'Treasure' | 'Loot' | 'Monster' | 'Room' | 'BonusSoul';
  subType: string;
  set: string;
  hp: number | null;
  atk: number | null;
  evasion: number | null;
  soulValue: number;
  rewardText: string;
  abilityText: string;
  isEternal: boolean;
  threePlayerOnly: boolean;
  quantity: number;
  imageUrl: string;
}

/**
 * API client for card data
 */
export class CardApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get a card by ID
   */
  async getCardById(cardId: string): Promise<CardData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/cards/${cardId}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch card ${cardId}:`, error);
      return null;
    }
  }

  /**
   * Get all cards by type
   */
  async getCardsByType(cardType: string): Promise<CardData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/cards?type=${cardType}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch cards of type ${cardType}:`, error);
      return [];
    }
  }

  /**
   * Get all cards by type and set
   */
  async getCardsByTypeAndSet(
    cardType: string,
    set: string
  ): Promise<CardData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/cards?type=${cardType}&set=${set}`
      );
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch cards of type ${cardType} in set ${set}:`, error);
      return [];
    }
  }

  /**
   * Get all cards
   */
  async getAllCards(): Promise<CardData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/cards`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch all cards:', error);
      return [];
    }
  }

  /**
   * Filter cards by criteria
   */
  filterCards(
    cards: CardData[],
    criteria: {
      cardType?: string;
      set?: string;
      hasSoulIcon?: boolean;
      hasAbility?: string;
    }
  ): CardData[] {
    return cards.filter((card) => {
      if (criteria.cardType && card.cardType !== criteria.cardType) {
        return false;
      }
      if (criteria.set && card.set !== criteria.set) {
        return false;
      }
      if (criteria.hasSoulIcon && card.soulValue === 0) {
        return false;
      }
      if (criteria.hasAbility && !card.abilityText.includes(criteria.hasAbility)) {
        return false;
      }
      return true;
    });
  }
}

/**
 * Card effect parser
 * Extracts and validates card effects from ability text
 */
export class CardEffectParser {
  /**
   * Parse card ability text to extract effect type
   */
  parseAbility(abilityText: string): {
    type: 'damage' | 'heal' | 'draw' | 'gain' | 'modify' | 'other';
    targets?: string[];
    value?: number;
  } {
    const text = abilityText.toLowerCase();

    // Damage effects
    if (text.includes('deal') || text.includes('damage')) {
      const match = text.match(/deal (\d+) damage/);
      return {
        type: 'damage',
        value: match ? parseInt(match[1], 10) : 1,
        targets: ['monster', 'player']
      };
    }

    // Heal effects
    if (text.includes('heal')) {
      const match = text.match(/heal (\d+)/);
      return {
        type: 'heal',
        value: match ? parseInt(match[1], 10) : 1,
        targets: ['player']
      };
    }

    // Draw effects
    if (text.includes('loot')) {
      const match = text.match(/loot (\d+)/);
      return {
        type: 'draw',
        value: match ? parseInt(match[1], 10) : 1,
        targets: ['player']
      };
    }

    // Gain effects (coins, items)
    if (text.includes('gain') || text.includes('get')) {
      if (text.includes('¢') || text.includes('coin')) {
        const match = text.match(/(\d+)\s*¢/);
        return {
          type: 'gain',
          value: match ? parseInt(match[1], 10) : 1,
          targets: ['player']
        };
      }
      return { type: 'gain', targets: ['player'] };
    }

    // Modify effects (stats)
    if (text.includes('+') || text.includes('increase') || text.includes('reduce')) {
      return {
        type: 'modify',
        targets: ['character', 'item']
      };
    }

    return { type: 'other' };
  }

  /**
   * Check if card has a specific keyword
   */
  hasKeyword(card: CardData, keyword: string): boolean {
    const text = card.abilityText.toLowerCase();
    return text.includes(keyword.toLowerCase());
  }

  /**
   * Check if card is an activated ability
   */
  isActivatedAbility(card: CardData): boolean {
    return card.abilityText.includes('↷') || card.abilityText.includes('$');
  }

  /**
   * Check if card is a triggered ability
   */
  isTriggeredAbility(card: CardData): boolean {
    const triggers = ['when', 'whenever', 'at', 'each time', 'every other time'];
    return triggers.some(trigger => card.abilityText.toLowerCase().includes(trigger));
  }
}
