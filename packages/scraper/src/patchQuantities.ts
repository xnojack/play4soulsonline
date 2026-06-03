/**
 * Spreadsheet quantity patching
 *
 * After scraping from the website, use the official spreadsheet CSVs as the
 * authoritative source for card quantities. The website's quantity search
 * counts reprints across sets, which inflates the numbers.
 *
 * Each row in the spreadsheet represents one physical card copy. We count
 * occurrences per card name to get the authoritative quantity, then assign
 * that total to the base variant (first variant by set priority).
 */
import fs from 'fs';
import path from 'path';
import { ScrapedCard } from './types';

const LOOT_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Loot Deck.csv';
const MONSTER_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Monster Deck.csv';
const TREASURE_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Treasure Deck.csv';
const OUTSIDE_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Outside.csv';

// ─── CSV Parser ─────────────────────────────────────────────────────────────

function parseCSV(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      current += ch;
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          i++;
        } else {
          inQuotes = false;
        }
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += ch;
      } else if (ch === '\n') {
        rows.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Name normalization ─────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .replace(/['\u2019\u2018]/g, "'") // unify all apostrophe variants
    .replace(/['']/g, "'") // curly single quotes
    .replace(/[\u201c\u201d]/g, '"') // curly double quotes → straight
    .replace(/[""]/g, '') // strip remaining double quotes
    .replace(/[-/]/g, ' ') // hyphens and slashes → spaces
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\?$/g, '') // strip trailing ?
    .replace(/!$/g, '') // strip trailing !
    .toLowerCase()
    .trim();
}

// ─── Spreadsheet parsing ────────────────────────────────────────────────────

const SKIP_NAMES = new Set([
  'FALSE', 'TRUE', 'Set Name', 'Cards', 'Unique', 'TOTAL', 'Category',
]);
const SKIP_CATEGORIES = new Set([
  'Base Game', 'Gold Box', 'Four Souls+', 'Star Promos', 'Tapeworm',
  'The Unboxing of Isaac', 'Requiem', 'Warp Zone', 'Alt Art',
  'The Summer of Isaac', 'Anniversary', 'Gish', 'Dick Knots', 'Target',
  'Retro', 'G-Fuel', 'The Legend of Bum-bo!', 'Nendoroid', 'Mewgenics',
  'Promos', 'Challenges', '10th Anniversary',
]);

function parseSheetQuantities(csvPath: string, categoryCol: number): Map<string, number> {
  if (!fs.existsSync(csvPath)) return new Map();
  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text).map((r) => parseRow(r));
  const counts = new Map<string, number>();

  for (const row of rows) {
    const name = row[0];
    const category = row[categoryCol];
    if (!name || name.length < 2) continue;
    if (SKIP_NAMES.has(name)) continue;
    if (!category || SKIP_CATEGORIES.has(category)) continue;

    const key = normalizeName(name);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

/**
 * Load the set of known monster names from the Monster Deck CSV.
 * Returns a Set of normalized card names. Used by scrapeCardDetail.ts
 * to classify cards that lack an HTML type label.
 * Falls back to a hardcoded set if the CSV is not available.
 */
export function loadMonsterNames(spreadsheetDir: string): Set<string> {
  const quantities = parseSheetQuantities(path.join(spreadsheetDir, MONSTER_CSV), 3);
  if (quantities.size > 0) {
    return new Set(quantities.keys());
  }
  // Fallback: hardcoded set of known monster names
  return KNOWN_MONSTER_NAMES;
}

/**
 * Load the set of known Outside card names from the Outside CSV.
 * Returns a Set of normalized card names.
 * Falls back to a hardcoded set if the CSV is not available.
 */
export function loadOutsideNames(spreadsheetDir: string): Set<string> {
  const csvPath = path.join(spreadsheetDir, OUTSIDE_CSV);
  if (!fs.existsSync(csvPath)) {
    return KNOWN_OUTSIDE_NAMES;
  }
  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text).map((r) => parseRow(r));
  const names = new Set<string>();
  for (const row of rows) {
    const name = row[0];
    if (!name || name.length < 2) continue;
    if (SKIP_NAMES.has(name)) continue;
    // For dual-named cards like "The Harbingers / The Beast!", only use the front name
    // (before "/") to avoid matching unrelated cards with the same back name.
    const frontName = name.split('/')[0].trim();
    names.add(normalizeName(frontName));
  }
  if (names.size > 0) return names;
  return KNOWN_OUTSIDE_NAMES;
}

/**
 * Hardcoded fallback set of known monster names (normalized).
 * Used when the spreadsheet CSV is not available during scraping.
 */
const KNOWN_MONSTER_NAMES = new Set([
  'the bloat', 'charmed vis', 'blank canvas', 'stoney', 'greed',
  'mother', 'shopkeeper', 'chest', 'dark chest', 'gold chest',
  'mega satan', 'ultra greed',
]);

const KNOWN_OUTSIDE_NAMES = new Set([
  'the harbingers',
]);

/**
 * Reclassify cards that were scraped as Unknown but should be Challenge or Monster.
 * Challenge cards are classified by origin (Challenges set).
 * Monster cards are classified by name lookup from the spreadsheet.
 * Returns the number of cards that were reclassified.
 */
export function reclassifyCards(cards: ScrapedCard[]): number {
  const spreadsheetDir = path.resolve(__dirname, '../../../card-spreadsheet');
  const monsterNames = loadMonsterNames(spreadsheetDir);
  const outsideNames = loadOutsideNames(spreadsheetDir);
  let reclassified = 0;

  for (const card of cards) {
    // Process Unknown, Challenge, and Outside cards (reclassification can override)
    if (!['Unknown', 'Challenge', 'Outside', 'Monster'].includes(card.cardType)) continue;

    // Normalize name for lookup
    const normName = card.name
      .replace(/['\u2019\u2018]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[""]/g, '')
      .replace(/[-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\?$/g, '')
      .replace(/!$/g, '')
      .toLowerCase()
      .trim();

    // Outside cards (highest priority — overrides everything)
    if (outsideNames.has(normName)) {
      if (card.cardType !== 'Outside') {
        card.cardType = 'Outside';
        reclassified++;
      }
      continue;
    }

    // Known monster name → Monster (overrides Challenge for Blank Canvas, etc.)
    if (monsterNames.has(normName)) {
      if (card.cardType !== 'Monster') {
        card.cardType = 'Monster';
        reclassified++;
      }
      continue;
    }

    // Challenges set → Challenge (only if not already Monster from name lookup)
    if (card.origin === 'Challenges') {
      if (card.cardType !== 'Challenge') {
        card.cardType = 'Challenge';
        reclassified++;
      }
      continue;
    }

    // Fallback: if has monster stats (hp, atk, evasion), classify as Monster
    if (card.hp !== null || card.atk !== null || card.evasion !== null) {
      if (card.cardType !== 'Monster') {
        card.cardType = 'Monster';
        reclassified++;
      }
      continue;
    }

    // Otherwise: Loot (default for Unknown with no stats)
    if (card.cardType === 'Unknown') {
      card.cardType = 'Loot';
      reclassified++;
    }
  }

  return reclassified;
}

// ─── Set priority for base variant selection ────────────────────────────────

const SET_PRIORITY: Record<string, number> = {
  'Base Game V2': 1,
  'Gold Box V2': 2,
  'Four Souls+ V2': 3,
  'Requiem': 4,
  'The Summer of Isaac': 5,
  '10th Anniversary': 6,
  'Requiem Warp Zone': 7,
  'Alt Art': 90,
  'Target': 91,
  'Gish': 92,
  'Tapeworm': 93,
  'Dick Knots': 94,
  'Retro': 95,
  'G-Fuel': 96,
  'The Legend of Bum-bo!': 97,
  'The Unboxing of Isaac': 98,
  'Nendoroid': 99,
  'Mewgenics': 100,
  'Promos': 101,
  'Challenges': 200,
};

function setPriority(setName: string): number {
  return SET_PRIORITY[setName] ?? 50;
}

// ─── Main patch function ────────────────────────────────────────────────────

/**
 * Read spreadsheet CSVs and update card quantities where they differ from
 * the website-scraped quantities.
 *
 * For each card name, the total quantity across all variants is set to match
 * the spreadsheet. The base variant (highest-priority set) gets the bulk;
 * alt-art variants keep quantity 1 each.
 *
 * Returns the number of cards that were patched.
 */
export function patchQuantitiesFromSpreadsheet(
  cards: ScrapedCard[],
  spreadsheetDir: string
): number {
  const lootSs = parseSheetQuantities(path.join(spreadsheetDir, LOOT_CSV), 3);
  const monsterSs = parseSheetQuantities(path.join(spreadsheetDir, MONSTER_CSV), 3);
  const treasureSs = parseSheetQuantities(path.join(spreadsheetDir, TREASURE_CSV), 5);

  const ssMaps: Record<string, Map<string, number>> = {
    Loot: lootSs,
    Monster: monsterSs,
    Treasure: treasureSs,
  };

  // Group cards by (cardType, normalized name)
  const groups = new Map<string, ScrapedCard[]>();
  for (const card of cards) {
    if (!ssMaps[card.cardType]) continue;
    const key = `${card.cardType}::${normalizeName(card.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }

  let patched = 0;

  for (const [groupKey, groupCards] of groups) {
    const [cardType, normName] = groupKey.split('::');
    const ssMap = ssMaps[cardType];
    const ssQty = ssMap.get(normName);
    if (ssQty === undefined) continue;

    const currentTotal = groupCards.reduce((sum, c) => sum + c.quantity, 0);
    if (currentTotal === ssQty) continue;

    // Sort by set priority (base set first, alt-art last)
    groupCards.sort((a, b) => setPriority(a.origin) - setPriority(b.origin));

    const baseCard = groupCards[0];
    const altCards = groupCards.slice(1);
    const altTotal = altCards.length; // Each alt-art variant gets qty 1
    const baseQty = Math.max(1, ssQty - altTotal);

    if (baseCard.quantity !== baseQty) {
      console.log(`    Patch: "${baseCard.name}" (${cardType}) — ${baseCard.id} qty ${baseCard.quantity} → ${baseQty} (SS total: ${ssQty}, alts: ${altTotal})`);
      baseCard.quantity = baseQty;
      patched++;
    }

    // Ensure alt-art variants have qty 1
    for (const alt of altCards) {
      if (alt.quantity !== 1) {
        console.log(`    Patch: "${alt.name}" (${cardType}) — ${alt.id} qty ${alt.quantity} → 1 (alt-art)`);
        alt.quantity = 1;
        patched++;
      }
    }
  }

  return patched;
}
