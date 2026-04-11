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
}
