/**
 * Returns the starting item card ID for a character card.
 *
 * The data comes from the `starting_item_id` column in the SQLite DB,
 * which is populated by the scraper from the #CharitemBox section on
 * each character's foursouls.com page.
 *
 * Returns:
 *   string    — the starting item card ID
 *   null      — character picks from top 3 of treasure deck (Eden variants)
 *   undefined — character not found in DB (treat as no starting item)
 */

import { getCardById } from '../db/cards';

export function getStartingItemId(characterCardId: string): string | null | undefined {
  const card = getCardById(characterCardId);
  if (!card) return undefined;
  // card.startingItemId is null for Eden-type chars, string for everyone else,
  // and null for non-character cards (which shouldn't reach here anyway)
  return card.startingItemId;
}
