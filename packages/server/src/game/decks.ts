import { v4 as uuidv4 } from 'uuid';
import { CardInPlay } from './types';

/** Fisher-Yates shuffle (mutates array) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Draw N card IDs from the top of a deck (last element = top).
 *  Automatically refills from discard if deck runs out. */
export function drawFromDeck(
  deck: string[],
  discard: string[],
  count: number
): { drawn: string[]; newDeck: string[]; newDiscard: string[] } {
  let currentDeck = [...deck];
  let currentDiscard = [...discard];
  const drawn: string[] = [];

  for (let i = 0; i < count; i++) {
    if (currentDeck.length === 0) {
      if (currentDiscard.length === 0) break; // no cards anywhere
      // Shuffle discard to form new deck
      currentDeck = shuffle([...currentDiscard]);
      currentDiscard = [];
    }
    drawn.push(currentDeck.pop()!);
  }

  return { drawn, newDeck: currentDeck, newDiscard: currentDiscard };
}

/** Put a card ID on top of a deck */
export function putOnTopOfDeck(deck: string[], cardId: string): string[] {
  return [...deck, cardId];
}

/** Put a card ID on the bottom of a deck */
export function putOnBottomOfDeck(deck: string[], cardId: string): string[] {
  return [cardId, ...deck];
}

/** Create a fresh CardInPlay instance from a card ID */
export function createCardInPlay(cardId: string, charged = true): CardInPlay {
  return {
    instanceId: uuidv4(),
    cardId,
    charged,
    damageCounters: 0,
    hpCounters: 0,
    atkCounters: 0,
    genericCounters: 0,
    namedCounters: {},
    flipped: false,
  };
}

/** Peek at top N cards of a deck without drawing */
export function peekDeck(deck: string[], count: number): string[] {
  return deck.slice(-count).reverse();
}
