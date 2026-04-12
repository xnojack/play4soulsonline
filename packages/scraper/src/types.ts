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
  /**
   * For Character cards: the card ID of their eternal starting item, as linked
   * in #CharitemBox on foursouls.com. null if the character has no fixed starting
   * item (Eden variants who choose from the treasure deck). undefined / absent for
   * non-character cards.
   */
  startingItemId?: string | null;
}
