/**
 * Test card definitions
 * These are specific card IDs that will be used in test scenarios
 */

// Character cards (for testing starting items)
export const TEST_CHARACTERS = {
  ISAAC: 'isaac',
  SAMSON: 'samson',
  JACOB: 'jacob',
  ESAY: 'esay',
  MAGDALENE: 'magdalene',
  CAIN: 'ain',
  JUDAS: 'judas',
  BLACK_JUDAS: 'black_judas',
  THEDAMNED: 'theden',
  BETTY: 'betty',
  EVA: 'eva',
  NOAH: 'noah',
  LAZARUS: 'lazarus',
  LILITH: 'lilith',
  APOLLYON: 'apollyon',
  THEFORGOTTEN: 'theforgotten',
  BETHANY: 'bethany',
  JACOBSEYE: 'jacobs_eye',
  ASHA: 'asha',
  AZazel: 'azazel',
  EVE: 'eve',
  LAMASTU: 'lamastu',
  EDEN: 'eden',
  LOST: 'lost',
  LAMASHTU: 'lamashtu'
};

// Starting items to test
export const STARTING_ITEMS = {
  LUCKY_FOOT: 'lucky_foot',
  BIBLE: 'bible',
  LIPSTICK: 'lipstick',
  PENTAGRAM: 'pentagram',
  JESUS_CHILD: 'jesus_child',
  MONSTER_MANUAL: 'monster_manual',
  TECHNIQUE_POSTER: 'technique_poster',
  PAPER_CLIP: 'paper_clip',
  TUNING_FORK: 'tuning_fork',
  LUCKY_CHARMS: 'lucky_charms',
  RAZOR_BLADE: 'razor_blade',
  BOOK_OF_BELIAL: 'book_of_belial',
  BOOK_OF_SIN: 'book_of_sin',
  BOOK_OF_JEHOVAH: 'book_of_jehovah',
  PEGASUS_BOOTS: 'pegasus_boots',
  CUPID_ARROW: 'cupid_arrow'
};

// Treasure cards - Active items (with ↷ ability)
export const TEST_ACTIVE_ITEMS = {
  PENNY: 'b2-penny',
  PENNY_CLASSIC: 'penny',
  SCISSORS: 'scissors',
  SCISSORS_CLASSIC: 'b2-scissors',
  BOOK_OF_BELIAL: 'book_of_belial',
  BOOK_OF_BELIAL_CLASSIC: 'b2-book_of_belial',
  BOOK_OF_SIN: 'book_of_sin',
  BOOK_OF_SIN_CLASSIC: 'b2-book_of_sin',
  BOOK_OF_JEHOVAH: 'book_of_jehovah',
  BOOK_OF_JEHOVAH_CLASSIC: 'b2-book_of_jehovah',
  RAZOR_BLADE: 'razor_blade',
  RAZOR_BLADE_CLASSIC: 'b2-razor_blade',
  CUPID_ARROW: 'cupid_arrow',
  CUPID_ARROW_CLASSIC: 'b2-cupid_arrow',
  JESUS_CHILD: 'jesus_child',
  JESUS_CHILD_CLASSIC: 'b2-jesus_child',
  LUCKY_FOOT: 'lucky_foot',
  LUCKY_FOOT_CLASSIC: 'b2-lucky_foot',
  BIBLE: 'bible',
  BIBLE_CLASSIC: 'b2-bible'
};

// Treasure cards - Passive items
export const TEST_PASSIVE_ITEMS = {
  PENTAGRAM: 'pentagram',
  PENTAGRAM_CLASSIC: 'b2-pentagram',
  LIPSTICK: 'lipstick',
  LIPSTICK_CLASSIC: 'b2-lipstick',
  MONSTER_MANUAL: 'monster_manual',
  MONSTER_MANUAL_CLASSIC: 'b2-monster_manual',
  TECHNIQUE_POSTER: 'technique_poster',
  TECHNIQUE_POSTER_CLASSIC: 'b2-technique_poster',
  TUNING_FORK: 'tuning_fork',
  TUNING_FORK_CLASSIC: 'b2-tuning_fork',
  LUCKY_CHARMS: 'lucky_charms',
  LUCKY_CHARMS_CLASSIC: 'b2-lucky_charms',
  PAPER_CLIP: 'paper_clip',
  PAPER_CLIP_CLASSIC: 'b2-paper_clip',
  PEGASUS_BOOTS: 'pegasus_boots',
  PEGASUS_BOOTS_CLASSIC: 'b2-pegasus_boots'
};

// Loot cards - Various subtypes
export const TEST_LOOT = {
  // Trinket
  TINKERER_BAG: 'tinkerer_bag',
  TINKERER_BAG_CLASSIC: 'b2-tinkerer_bag',
  BAG_OF_PACKING: 'bag_of_packing',
  BAG_OF_PACKING_CLASSIC: 'b2-bag_of_packing',
  
  // Ambush
  AMBUSH: 'ambush',
  AMBUSH_CLASSIC: 'b2-ambush',
  TRAP: 'trap',
  TRAP_CLASSIC: 'b2-trap',
  
  // Curse
  CURSE_OF_DARKNESS: 'curse_of_darkness',
  CURSE_OF_DARKNESS_CLASSIC: 'b2-curse_of_darkness',
  CURSE_OF_THE_TOWER: 'curse_of_the_tower',
  CURSE_OF_THE_TOWER_CLASSIC: 'b2-curse_of_the_tower',
  
  // Guppy
  GUPPY_HEAD: 'guppy_head',
  GUPPY_HEAD_CLASSIC: 'b2-guppy_head',
  GUPPY_TAIL: 'guppy_tail',
  GUPPY_TAIL_CLASSIC: 'b2-guppy_tail'
};

// Monster cards
export const TEST_MONSTERS = {
  // Regular monsters
  ROTTEN_BEGGAR: 'rotten_beggar',
  ROTTEN_BEGGAR_CLASSIC: 'b2-rotten_beggar',
  DICKENS: 'dickens',
  DICKENS_CLASSIC: 'b2-dickens',
  BLOATED_ACQUAINTANCE: 'bloated_acquaintance',
  BLOATED_ACQUAINTANCE_CLASSIC: 'b2-bloated_acquaintance',
  CACODAEMON: 'cacodaeomon',
  CACODAEMON_CLASSIC: 'b2-cacodaeomon',
  
  // Bosses (with soul icon)
  MONSTRO: 'monstro',
  MONSTRO_CLASSIC: 'b2-monstro',
  THE_BEAST: 'the_beast',
  THE_BEAST_CLASSIC: 'b2-the_beast',
  DEATH: 'death',
  DEATH_CLASSIC: 'b2-death',
  HUSH: 'hush',
  HUSH_CLASSIC: 'b2-hush'
};

// Room cards
export const TEST_ROOMS = {
  BASEMENT: 'basement',
  BASEMENT_CLASSIC: 'b2-basement',
  CRAWLSPACE: 'crawlspace',
  CRAWLSPACE_CLASSIC: 'b2-crawlspace',
  WOMB: 'womb',
  WOMB_CLASSIC: 'b2-womb',
  UTERUS: 'uterus',
  UTERUS_CLASSIC: 'b2-uterus',
  CATHEDRAL: 'cathedral',
  CATHEDRAL_CLASSIC: 'b2-cathedral'
};

// Bonus souls
export const BONUS_SOULS = {
  DEEP_LOVE: 'deep_love',
  DEEP_LOVE_CLASSIC: 'b2-deep_love',
  MOTHER: 'mother',
  MOTHER_CLASSIC: 'b2-mother',
  VOID: 'void',
  VOID_CLASSIC: 'b2-void'
};

/**
 * Get all test card IDs
 */
export const ALL_TEST_CARDS = [
  ...Object.values(TEST_CHARACTERS),
  ...Object.values(STARTING_ITEMS),
  ...Object.values(TEST_ACTIVE_ITEMS),
  ...Object.values(TEST_PASSIVE_ITEMS),
  ...Object.values(TEST_LOOT),
  ...Object.values(TEST_MONSTERS),
  ...Object.values(TEST_ROOMS),
  ...Object.values(BONUS_SOULS)
];

/**
 * Get cards by type
 */
export function getCardsByType(type: string): string[] {
  switch (type) {
    case 'Character':
      return Object.values(TEST_CHARACTERS);
    case 'Treasure':
      return [
        ...Object.values(STARTING_ITEMS),
        ...Object.values(TEST_ACTIVE_ITEMS),
        ...Object.values(TEST_PASSIVE_ITEMS)
      ];
    case 'Loot':
      return Object.values(TEST_LOOT);
    case 'Monster':
      return Object.values(TEST_MONSTERS);
    case 'Room':
      return Object.values(TEST_ROOMS);
    case 'BonusSoul':
      return Object.values(BONUS_SOULS);
    default:
      return [];
  }
}

/**
 * Check if a card has a soul icon (soul value > 0)
 */
export function hasSoulIcon(cardId: string): boolean {
  const bossCards = [
    ...Object.values(TEST_MONSTERS).filter(id => id.includes('monstro') || 
                                                    id.includes('the_beast') || 
                                                    id.includes('death') || 
                                                    id.includes('hush'))
  ];
  return bossCards.includes(cardId);
}

/**
 * Get soul value for a card
 */
export function getSoulValue(cardId: string): number {
  if (hasSoulIcon(cardId)) {
    return 1; // All tested bosses give 1 soul
  }
  
  // Check if it's a bonus soul
  const bonusSoulIds = Object.values(BONUS_SOULS);
  if (bonusSoulIds.includes(cardId)) {
    return 1;
  }
  
  return 0;
}
