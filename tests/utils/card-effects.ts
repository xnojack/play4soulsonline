/**
 * Card effect validator that parses and validates card abilities
 */

import { CardData } from './card-api';

export interface CardEffect {
  type: 'damage' | 'heal' | 'draw' | 'gain' | 'modify' | 'trigger' | 'other';
  description: string;
  targets?: string[];
  value?: number;
  condition?: string;
}

/**
 * Parser for Four Souls card ability text
 * Extracts card effects for testing validation
 */
export class CardEffectParser {
  /**
   * Parse a card's ability text into structured effect data
   */
  parseCardEffects(card: CardData): CardEffect[] {
    const effects: CardEffect[] = [];
    
    // Skip empty ability text
    if (!card.abilityText || card.abilityText.trim() === '') {
      return effects;
    }
    
    // Split by periods and newlines to get individual effects
    const rawEffects = card.abilityText.split(/[.]\s+/);
    
    for (const effectText of rawEffects) {
      const effect = this.parseSingleEffect(effectText, card);
      if (effect && effect.type !== 'other') {
        effects.push(effect);
      }
    }
    
    return effects;
  }

  /**
   * Parse a single effect string
   */
  private parseSingleEffect(text: string, card: CardData): CardEffect | null {
    const lowerText = text.toLowerCase();
    
    // Damage effects
    if (this.containsDamageEffect(lowerText)) {
      return this.parseDamageEffect(text);
    }
    
    // Heal effects
    if (this.containsHealEffect(lowerText)) {
      return this.parseHealEffect(text);
    }
    
    // Draw/Loot effects
    if (this.containsDrawEffect(lowerText)) {
      return this.parseDrawEffect(text);
    }
    
    // Gain effects (coins, items)
    if (this.containsGainEffect(lowerText)) {
      return this.parseGainEffect(text);
    }
    
    // Modify effects (stats)
    if (this.containsModifyEffect(lowerText)) {
      return this.parseModifyEffect(text);
    }
    
    // Triggered abilities (when/whenever/at)
    if (this.containsTriggerEffect(lowerText)) {
      return this.parseTriggerEffect(text);
    }
    
    // Activated abilities (tap, paid)
    if (this.containsActivatedAbility(card)) {
      return this.parseActivatedAbility(card);
    }
    
    // Passive abilities (static)
    if (this.containsPassiveAbility(lowerText)) {
      return this.parsePassiveAbility(text);
    }
    
    return null;
  }

  /**
   * Check for damage keywords
   */
  private containsDamageEffect(text: string): boolean {
    const keywords = ['deal', 'damage', 'hurts', 'injure', 'strike'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse damage effect
   */
  private parseDamageEffect(text: string): CardEffect | null {
    const match = text.match(/deal (\d+) damage|damage (\d+)/i);
    const value = match ? parseInt(match[1] || match[2] || '1', 10) : 1;
    
    return {
      type: 'damage',
      description: text.trim(),
      targets: ['monster', 'player'],
      value
    };
  }

  /**
   * Check for heal keywords
   */
  private containsHealEffect(text: string): boolean {
    const keywords = ['heal', 'recover', 'restore'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse heal effect
   */
  private parseHealEffect(text: string): CardEffect | null {
    const match = text.match(/heal (\d+)/i);
    const value = match ? parseInt(match[1], 10) : 1;
    
    return {
      type: 'heal',
      description: text.trim(),
      targets: ['player'],
      value
    };
  }

  /**
   * Check for draw/loot keywords
   */
  private containsDrawEffect(text: string): boolean {
    const keywords = ['loot', 'draw', 'gain a card', 'take a card'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse draw effect
   */
  private parseDrawEffect(text: string): CardEffect | null {
    const match = text.match(/loot (\d+)|draw (\d+)/i);
    const value = match ? parseInt(match[1] || match[2] || '1', 10) : 1;
    
    return {
      type: 'draw',
      description: text.trim(),
      targets: ['player'],
      value
    };
  }

  /**
   * Check for gain keywords
   */
  private containsGainEffect(text: string): boolean {
    const keywords = ['gain', 'get', 'receive', 'collect'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse gain effect
   */
  private parseGainEffect(text: string): CardEffect | null {
    // Coins
    const coinMatch = text.match(/(\d+)\s*¢/i);
    if (coinMatch) {
      const value = parseInt(coinMatch[1], 10);
      return {
        type: 'gain',
        description: text.trim(),
        targets: ['player'],
        value
      };
    }
    
    // Generic gain
    return {
      type: 'gain',
      description: text.trim(),
      targets: ['player']
    };
  }

  /**
   * Check for modify keywords
   */
  private containsModifyEffect(text: string): boolean {
    const keywords = ['+1', '+2', '+3', 'increase', 'reduce', 'add', 'subtract'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse modify effect
   */
  private parseModifyEffect(text: string): CardEffect | null {
    // ATK modifier
    const atkMatch = text.match(/\+1 ATK|\+1 to your attack/i);
    if (atkMatch) {
      return {
        type: 'modify',
        description: text.trim(),
        targets: ['character'],
        value: 1
      };
    }
    
    // HP modifier
    const hpMatch = text.match(/\+1 HP|\+1 to your health/i);
    if (hpMatch) {
      return {
        type: 'modify',
        description: text.trim(),
        targets: ['character'],
        value: 1
      };
    }
    
    // Generic modifier
    return {
      type: 'modify',
      description: text.trim(),
      targets: ['character', 'item']
    };
  }

  /**
   * Check for triggered ability keywords
   */
  private containsTriggerEffect(text: string): boolean {
    const keywords = ['when', 'whenever', 'at'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse triggered effect
   */
  private parseTriggerEffect(text: string): CardEffect | null {
    return {
      type: 'trigger',
      description: text.trim(),
      condition: text.trim()
    };
  }

  /**
   * Check for activated abilities
   */
  private containsActivatedAbility(card: CardData): boolean {
    // Check ability text for tap ($) or paid (↷) symbols
    return card.abilityText.includes('↷') || card.abilityText.includes('$');
  }

  /**
   * Parse activated ability
   */
  private parseActivatedAbility(card: CardData): CardEffect | null {
    const hasTap = card.abilityText.includes('↷');
    const hasPaid = card.abilityText.includes('$');
    
    return {
      type: 'trigger',
      description: hasTap ? 'Tap ability' : 'Paid ability',
      targets: ['item']
    };
  }

  /**
   * Check for passive abilities
   */
  private containsPassiveAbility(text: string): boolean {
    const keywords = ['always', 'permanently', 'while'];
    return keywords.some(k => text.includes(k));
  }

  /**
   * Parse passive ability
   */
  private parsePassiveAbility(text: string): CardEffect | null {
    return {
      type: 'other',
      description: text.trim()
    };
  }

  /**
   * Extract all keywords from a card
   */
  extractKeywords(card: CardData): string[] {
    const keywords: string[] = [];
    const text = card.abilityText.toLowerCase();
    
    if (text.includes('eternal')) keywords.push('eternal');
    if (text.includes('trinket')) keywords.push('trinket');
    if (text.includes('ambush')) keywords.push('ambush');
    if (text.includes('curse')) keywords.push('curse');
    if (text.includes('guppy')) keywords.push('guppy');
    if (text.includes('team up')) keywords.push('team up');
    if (text.includes('familiar')) keywords.push('familiar');
    if (text.includes('indomitable')) keywords.push('indomitable');
    
    return keywords;
  }

  /**
   * Check if card has a soul icon (soul value > 0)
   */
  hasSoulIcon(card: CardData): boolean {
    return card.soulValue > 0;
  }

  /**
   * Validate that a card effect can be tested
   */
  canTestEffect(effect: CardEffect): {
    testable: boolean;
    reason?: string;
  } {
    const testableTypes = ['damage', 'heal', 'draw', 'gain', 'modify', 'trigger'];
    
    if (!testableTypes.includes(effect.type)) {
      return {
        testable: false,
        reason: `Effect type '${effect.type}' not yet implemented`
      };
    }
    
    return { testable: true };
  }

  /**
   * Get all testable effects from a card
   */
  getTestableEffects(card: CardData): CardEffect[] {
    const effects = this.parseCardEffects(card);
    return effects.filter(effect => this.canTestEffect(effect).testable);
  }
}

/**
 * Validate that card data is complete for testing
 */
export function validateCardForTesting(card: CardData): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!card.id) {
    issues.push('Missing card ID');
  }
  
  if (!card.name) {
    issues.push('Missing card name');
  }
  
  if (!card.cardType) {
    issues.push('Missing card type');
  }
  
  if (card.cardType === 'Monster' && !card.hp) {
    issues.push('Monster missing HP stat');
  }
  
  if (card.cardType === 'Monster' && !card.atk) {
    issues.push('Monster missing ATK stat');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
