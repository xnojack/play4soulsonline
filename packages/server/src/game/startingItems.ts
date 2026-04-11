/**
 * Maps each character card ID to its starting eternal item card ID.
 *
 * Sources:
 *  - Base Game 2nd Edition (b2): official card backs / rulebook
 *  - Requiem (r): official card backs
 *  - Gold/Silver promos (g2): official promo sheets
 *  - Fan-made & crossover sets (rwz, fsp2, soi, anni, bum, mew, nen, tw, ytz): card images
 *
 * Characters with no fixed starting item (e.g. Eden variants who choose from the top of
 * the treasure deck) are mapped to `null` — the game will handle them specially.
 *
 * The `aa-*` prefix are alternate-art reprints from the "All-In" Kickstarter; their
 * starting items are the same card with the matching canonical set prefix.
 */

export const CHARACTER_STARTING_ITEM: Record<string, string | null> = {
  // ─── Base Game 2nd Edition ────────────────────────────────────────────────
  'b2-isaac':       'b2-the_d6',
  'b2-maggy':       'b2-yum_heart',
  'b2-cain':        'b2-sleight_of_hand',
  'b2-judas':       'b2-book_of_belial',
  'b2-eve':         'b2-the_curse',
  'b2-samson':      'b2-blood_lust',
  'b2-blue_baby':   'b2-forever_alone',
  'b2-lilith':      'b2-incubus',
  'b2-lazarus':     'b2-lazarus_rags',
  'b2-the_forgotten': 'b2-the_bone',
  'b2-eden':        null, // chooses from top 3 treasure

  // ─── Requiem (r) ──────────────────────────────────────────────────────────
  'r-bethany':      'r-book_of_virtues',
  'r-jacob_and_esau': 'r-sibling_rivalry',
  'r-flash_isaac':  'r-glitch',
  'r-eden':         null, // chooses from top 3 treasure
  'r-eden_2':       null,
  // Requiem "The" characters → matching item by name/card-back
  'r-the_baleful':  'r-berserk',
  'r-the_benighted': 'r-dead_weight',
  'r-the_broken':   'r-ibs',
  'r-the_capricious': 'r-flip',
  'r-the_curdled':  'r-hypercoagulation',
  'r-the_dauntless': 'r-soulbond',
  'r-the_deceiver': 'r-lemegeton',
  'r-the_deserter': 'r-abyss',
  'r-the_empty':    'g2-void',          // g2-void is the eternal item
  'r-the_enigma':   'r-glitch',        // The Enigma / amginE ehT
  'r-the_fettered': 'r-anima_sola',
  'r-the_harlot':   'r-gello',
  'r-the_hoarder':  'r-sumptorium',
  'r-the_miser':    'r-keepers_bargain',
  'r-the_savage':   'r-bag_of_crafting',
  'r-the_soiled':   'r-hemoptysis',
  'r-the_zealot':   'r-ceremonial_blade',
  // Spindown Dice / Lemegeton leftover; assigned to The Deceiver above

  // ─── Gold 2nd Edition (g2) ────────────────────────────────────────────────
  'g2-apollyon':    'g2-void',
  'g2-azazel':      'g2-lord_of_the_pit',
  'g2-the_keeper':  'g2-wooden_nickel',
  'g2-the_lost':    'g2-holy_mantle',

  // ─── All-In alternate-art (aa) ────────────────────────────────────────────
  // Same characters as b2 / g2 — use the same starting items
  'aa-isaac':       'b2-the_d6',
  'aa-judas':       'b2-book_of_belial',
  'aa-maggy':       'b2-yum_heart',        // aa-maggy not in DB but guard for it
  'aa-cain':        'b2-sleight_of_hand',
  'aa-eve':         'b2-the_curse',
  'aa-samson':      'b2-blood_lust',
  'aa-blue_baby':   'b2-forever_alone',
  'aa-lilith':      'b2-incubus',
  'aa-lazarus':     'b2-lazarus_rags',
  'aa-the_forgotten': 'b2-the_bone',
  'aa-guppy':       'nen-guppys-head',
  'aa-eden':        null,
  'aa-eden_2':      null,
  'aa-azazel':      'g2-lord_of_the_pit',
  'aa-the_keeper':  'g2-wooden_nickel',
  'aa-the_lost':    'g2-holy_mantle',
  'aa-the_capricious': 'r-flip',
  'aa-the_harlot':  'r-gello',
  'aa-the_savage':  'r-bag_of_crafting',

  // ─── Original Box (box) ───────────────────────────────────────────────────
  'box-isaac':      'b2-the_d6',
  'box-cain':       'b2-sleight_of_hand',
  'box-the_lost':   'g2-holy_mantle',

  // ─── Bum-bo (bum) ─────────────────────────────────────────────────────────
  'bum-bum_bo':     'bum-bag_o_trash',

  // ─── Four Souls+ 2 (fsp2) ─────────────────────────────────────────────────
  'fsp2-bum_bo':          'fsp2-bag_o_trash',
  'fsp2-dark_judas':      'fsp2-dark_arts',
  'fsp2-guppy':           'fsp2-infestation',
  'fsp2-whore_of_babylon': 'fsp2-gimpy',

  // ─── Sins of Isaac (soi) ──────────────────────────────────────────────────
  'soi-gish':           'soi-ball_of_tar',
  'soi-stacy':          'soi-club',
  'soi-the_hoarder':    'soi-unstable_dna',
  'soi-the_miser':      'soi-unstable_dna',  // both share unstable_dna? check
  'soi-clubby_the_seal': 'soi-club',

  // ─── Anniverary Set (anni) ────────────────────────────────────────────────
  'anni-bumbo_the_stout': 'anni-bag_o_holes',
  'anni-florian':         'anni-game_squid',
  'anni-level_one_isaac': 'b2-the_d6',

  // ─── Tapeworm (tw) ────────────────────────────────────────────────────────
  'tw-tapeworm':    'tw-pink_proglottid',

  // ─── Nighten Edition (nen) ────────────────────────────────────────────────
  'nen-isaac':      'nen-guppys-head',

  // ─── Mew (mew) ────────────────────────────────────────────────────────────
  'mew-stacy-704891': 'mew-stacys-extra-head',

  // ─── Promo Edens (p) ──────────────────────────────────────────────────────
  'p-eden':   null,
  'p-eden_2': null,
  'p-eden_3': null,
  'p-eden_4': null,

  // ─── Retro Eden (ret) ─────────────────────────────────────────────────────
  'ret-eden': null,

  // ─── Yeet Zone Guppy (ytz) ────────────────────────────────────────────────
  'ytz-guppy': 'nen-guppys-head',

  // ─── Roguelike Worlds Zine (rwz) ──────────────────────────────────────────
  'rwz-abe':            'rwz-football',
  'rwz-ash':            'rwz-rusty_spoons',
  'rwz-baba':           'rwz-is_you',
  'rwz-blind_johnny':   'rwz-johnnys_knives',
  'rwz-blue_archer':    'rwz-bow_and_arrow',
  'rwz-boyfriend':      'rwz-girlfriend',
  'rwz-bum_bo_the_weird': 'rwz-ball_of_tumors',
  'rwz-captain_viridian': 'rwz-gravity',
  'rwz-crewmate':       'rwz-emergency_meeting',
  'rwz-edmund':         'rwz-strange_marble',
  'rwz-guy_spelunky':   'rwz-spelunking_pack',
  'rwz-johnny':         'rwz-johnnys_knives',
  'rwz-pink_knight':    'rwz-lollypop',
  'rwz-psycho_goreman': 'rwz-ring_of_the_snake',
  'rwz-quote':          'rwz-polar_star',
  'rwz-salad_fingers':  'rwz-the_real_left_hand',
  'rwz-steven':         'rwz-lil_steven',
  'rwz-the_knight':     'rwz-hunky_boys',
  'rwz-the_silent':     'rwz-pop_pop',
  'rwz-yung_venuz':     'rwz-focus',
};

/**
 * Returns the starting item card ID for a character, or null if the character
 * chooses their own starting item (Eden variants).
 * Falls back to undefined (caller should handle gracefully) if not in the map.
 */
export function getStartingItemId(characterCardId: string): string | null | undefined {
  return CHARACTER_STARTING_ITEM[characterCardId];
}
