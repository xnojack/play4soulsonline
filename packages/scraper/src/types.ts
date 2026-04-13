export interface ScrapedCard {
  id: string;
  name: string;
  sourceUrl: string;
  imageUrl: string;
  localImagePath: string;
  cardType: string;
  subType: string;
  set: string;
  hp: number | null;
  atk: number | null;
  evasion: number | null;
  soulValue: number;
  rewardText: string;
  abilityText: string;
  threePlayerOnly: boolean;
  isEternal: boolean;
  origin: string;
  /** 'in_print' | 'not_in_print' | 'never_printed' | 'planned' | 'unknown' */
  printStatus: string;
  /** Number of physical copies of this card in the game box (e.g. 6 for A Penny!). Defaults to 1. */
  quantity: number;
  /**
   * For Character cards: the card ID of their eternal starting item, as linked
   * in #CharitemBox on foursouls.com. null if the character has no fixed starting
   * item (Eden variants who choose from the treasure deck). undefined / absent for
   * non-character cards.
   */
  startingItemId?: string | null;
  /**
   * For dual-sided (flip) cards: the CDN URL of the back face image.
   * null for single-sided cards.
   */
  backImageUrl?: string | null;
  /** Local path for the back face image (e.g. /cards/r-the_enigma_back.png). */
  backLocalImagePath?: string | null;
  /** Display name of the back face (e.g. "amginE ehT"). null for single-sided cards. */
  flipSideName?: string | null;
}
