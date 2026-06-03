import { Card } from './types';
import { shuffle } from './decks';

// Official ratio targets from foursouls.com deckbuilder
export const LOOT_RATIOS: Record<string, number> = {
  Tarot: 23,
  Trinket: 11,
  Pill: 3,
  Rune: 3,
  ButterBean: 5,
  Bomb: 6,
  Battery: 6,
  DiceShard: 3,
  SoulHeart: 2,
  BlackHeart: 0,
  LostSoul: 1,
  Nickel: 6,
  Coin4: 12,
  Coin3: 11,
  Coin2: 6,
  Coin1: 2,
};

export const MONSTER_RATIOS: Record<string, number> = {
  EpicBoss: 1,
  Boss: 30,
  BasicMonster: 30,
  CursedMonster: 9,
  HolyMonster: 9,
  GoodEvent: 8,
  BadEvent: 8,
  Curse: 5,
};

export const TREASURE_RATIOS: Record<string, number> = {
  Active: 40,
  Passive: 44,
  Paid: 10,
  OneUse: 5,
  Soul: 1,
};

/**
 * Map a Card to its ratio category key.
 * Returns null if the card doesn't belong to any ratio category.
 */
export function categoryForCard(card: Card): string | null {
  switch (card.subType) {
    case 'Tarot':
      return 'Tarot';
    case 'Trinket':
      return 'Trinket';
    case 'Pill':
      return 'Pill';
    case 'Rune':
      return 'Rune';
    case 'ButterBean':
      return 'ButterBean';
    case 'Bomb':
      return 'Bomb';
    case 'Battery':
      return 'Battery';
    case 'DiceShard':
      return 'DiceShard';
    case 'SoulHeart':
      return 'SoulHeart';
    case 'BlackHeart':
      return 'BlackHeart';
    case 'LostSoul':
      return 'LostSoul';
    case 'Coin':
      switch (card.coinValue) {
        case 1:
          return 'Coin1';
        case 2:
          return 'Coin2';
        case 3:
          return 'Coin3';
        case 4:
          return 'Coin4';
        case 5:
          return 'Nickel';
        default:
          return 'Nickel'; // Dime, Wooden Nickel, etc.
      }
    case 'Epic Boss':
      return 'EpicBoss';
    case 'Boss':
      return 'Boss';
    case 'Basic Monster':
      return 'BasicMonster';
    case 'Curse':
      return card.hp !== null ? 'CursedMonster' : 'Curse';
    case 'HolyMonster':
      return 'HolyMonster';
    case 'GoodEvent':
      return 'GoodEvent';
    case 'BadEvent':
      return 'BadEvent';
    case 'Active':
      return 'Active';
    case 'Passive':
      return 'Passive';
    case 'Paid':
      return 'Paid';
    case 'One-Use':
      return 'OneUse';
    case 'Soul':
      return 'Soul';
    default:
      return null;
  }
}

/**
 * Build a balanced deck using official ratio targets.
 * For each category, randomly samples N cards from available pool,
 * expands by quantity, then shuffles.
 */
export function buildBalancedDeck(
  cards: Card[],
  ratios: Record<string, number>,
  excludeFilter: (c: Card) => boolean
): string[] {
  // Group cards by ratio category
  const byCategory: Record<string, Card[]> = {};
  for (const card of cards) {
    if (excludeFilter(card)) continue;
    const cat = categoryForCard(card);
    if (!cat) continue;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(card);
  }

  // Random sample from each category to match ratio target
  const result: string[] = [];
  for (const [cat, target] of Object.entries(ratios)) {
    if (target === 0) continue;
    const available = byCategory[cat] || [];
    if (available.length === 0) {
      console.warn(`Balanced deck: no cards available for category "${cat}"`);
      continue;
    }
    if (available.length < target) {
      console.warn(
        `Balanced deck: only ${available.length} cards available for "${cat}", need ${target}`
      );
    }
    const sampled = shuffle([...available]).slice(0, target);
    for (const card of sampled) {
      for (let i = 0; i < card.quantity; i++) {
        result.push(card.id);
      }
    }
  }

  return shuffle(result);
}

/**
 * Build a deck with all available cards (expanded by quantity, shuffled).
 */
export function buildAllCardsDeck(
  cards: Card[],
  excludeFilter: (c: Card) => boolean
): string[] {
  return shuffle(
    cards
      .filter((c) => !excludeFilter(c))
      .flatMap((c) => Array(c.quantity).fill(c.id))
  );
}

/**
 * Build a custom deck using user-defined ratio targets.
 * For each category, randomly samples unique cards from available pool,
 * expands by quantity. If allowDuplicates is true and total < target,
 * randomly duplicates card IDs until target is reached.
 */
export function buildCustomDeck(
  cards: Card[],
  ratios: Record<string, number>,
  excludeFilter: (c: Card) => boolean,
  allowDuplicates: boolean
): string[] {
  // Group cards by ratio category
  const byCategory: Record<string, Card[]> = {};
  for (const card of cards) {
    if (excludeFilter(card)) continue;
    const cat = categoryForCard(card);
    if (!cat) continue;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(card);
  }

  const result: string[] = [];
  for (const [cat, target] of Object.entries(ratios)) {
    if (target === 0) continue;
    const available = byCategory[cat] || [];
    if (available.length === 0) {
      console.warn(`Custom deck: no cards available for category "${cat}"`);
      continue;
    }

    // Sample unique cards, expand by quantity
    const sampled = shuffle([...available]);
    const expanded: string[] = [];
    for (const card of sampled) {
      for (let i = 0; i < card.quantity; i++) {
        expanded.push(card.id);
      }
      if (expanded.length >= target) break;
    }

    const catResult: string[] = [];
    if (expanded.length >= target) {
      catResult.push(...expanded.slice(0, target));
    } else if (allowDuplicates) {
      catResult.push(...expanded);
      while (catResult.length < target) {
        const randomCard = expanded[Math.floor(Math.random() * expanded.length)];
        catResult.push(randomCard);
      }
    } else {
      console.warn(
        `Custom deck: only ${expanded.length} cards available for "${cat}", need ${target}`
      );
      catResult.push(...expanded);
    }
    result.push(...catResult);
  }

  return shuffle(result);
}
