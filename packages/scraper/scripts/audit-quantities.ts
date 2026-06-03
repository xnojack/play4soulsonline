/**
 * Quantity audit script
 *
 * Compares card-spreadsheet CSV data against the SQLite database.
 * Outputs per-name comparison, category breakdown, and mismatches.
 *
 * Usage: npx ts-node packages/scraper/scripts/audit-quantities.ts [spreadsheet-dir]
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_SPREADSHEET_DIR = path.resolve(__dirname, '../../../card-spreadsheet');
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../../data/cards.db');

// ─── CSV Parser (handles multiline quoted fields) ──────────────────────────────

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
          i++; // escaped quote
          current += '"';
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

// ─── Name normalization ────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .replace(/['\u2019\u2018]/g, "'") // unify all apostrophe variants
    .replace(/['']/g, "'") // curly single quotes
    .replace(/[\u201c\u201d]/g, '"') // curly double quotes → straight
    .replace(/[""]/g, '') // strip remaining double quotes (e.g. "Christian Broadcasts")
    .replace(/[-/]/g, ' ') // hyphens and slashes → spaces
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\?$/g, '') // strip trailing ?
    .replace(/!$/g, '') // strip trailing !
    .toLowerCase()
    .trim();
}

// ─── Spreadsheet parsing ───────────────────────────────────────────────────────

const LOOT_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Loot Deck.csv';
const MONSTER_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Monster Deck.csv';
const TREASURE_CSV = '_The Binding of Isaac_ Four Souls_ Card List - Treasure Deck.csv';

interface SheetCard {
  name: string;
  category: string;
}

function parseSheetCards(csvPath: string, categoryCol: number): SheetCard[] {
  if (!fs.existsSync(csvPath)) return [];
  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text).map((r) => parseRow(r));
  const cards: SheetCard[] = [];

  for (const row of rows) {
    const name = row[0];
    const category = row[categoryCol];
    if (!name || name.length < 2) continue;
    if (!category || category.length < 2) continue;
    // Skip metadata rows
    if (['FALSE', 'TRUE', 'Set Name', 'Cards', 'Unique', 'TOTAL'].includes(name)) continue;
    if (['Base Game', 'Gold Box', 'Four Souls+', 'Star Promos', 'Tapeworm', 'The Unboxing of Isaac', 'Requiem', 'Warp Zone', 'Alt Art', 'The Summer of Isaac', 'Anniversary', 'Gish', 'Dick Knots', 'Target', 'Retro', 'G-Fuel', 'The Legend of Bum-bo!', 'Nendoroid', 'Mewgenics', 'Promos', 'Challenges', '10th Anniversary'].includes(category)) continue;
    cards.push({ name, category });
  }
  return cards;
}

// ─── DB comparison ─────────────────────────────────────────────────────────────

interface DbCard {
  name: string;
  totalQty: number;
  variants: string;
}

function getDbCards(db: Database.Database, cardType: string): Map<string, DbCard> {
  // Get rows grouped by raw name first
  const rawRows = db
    .prepare(
      `SELECT name, GROUP_CONCAT(id || ' (' || set_name || ' x' || quantity || ')') as variants, SUM(quantity) as total_qty
       FROM cards WHERE card_type = ? GROUP BY name`
    )
    .all(cardType);

  // Then aggregate by normalized name to catch "MOTHER!" vs "Mother!" etc.
  const result = new Map<string, DbCard>();
  for (const row of rawRows as { name: string; variants: string; total_qty: number }[]) {
    const key = normalizeName(row.name);
    const existing = result.get(key);
    if (!existing) {
      result.set(key, {
        name: row.name,
        totalQty: row.total_qty,
        variants: row.variants,
      });
    } else {
      // Merge: add quantity and append variants
      existing.totalQty += row.total_qty;
      existing.variants += ', ' + row.variants;
    }
  }
  return result;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const spreadsheetDir = process.argv[2] || DEFAULT_SPREADSHEET_DIR;
  const dbPath = DEFAULT_DB_PATH;

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}. Run npm run scrape first.`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Parse spreadsheet
  const lootCards = parseSheetCards(path.join(spreadsheetDir, LOOT_CSV), 3);
  const monsterCards = parseSheetCards(path.join(spreadsheetDir, MONSTER_CSV), 3);
  const treasureCards = parseSheetCards(path.join(spreadsheetDir, TREASURE_CSV), 5);

  // Count by name in spreadsheet
  const lootSs = new Map<string, number>();
  for (const c of lootCards) {
    const key = normalizeName(c.name);
    lootSs.set(key, (lootSs.get(key) || 0) + 1);
  }

  const monsterSs = new Map<string, number>();
  for (const c of monsterCards) {
    const key = normalizeName(c.name);
    monsterSs.set(key, (monsterSs.get(key) || 0) + 1);
  }

  const treasureSs = new Map<string, number>();
  for (const c of treasureCards) {
    const key = normalizeName(c.name);
    treasureSs.set(key, (treasureSs.get(key) || 0) + 1);
  }

  // Get DB counts
  const lootDb = getDbCards(db, 'Loot');
  const monsterDb = getDbCards(db, 'Monster');
  const treasureDb = getDbCards(db, 'Treasure');

  // Compare
  function compareDeck(
    name: string,
    ss: Map<string, number>,
    dbMap: Map<string, DbCard>
  ): { matches: number; mismatches: number; missing: number; extra: number } {
    console.log(`\n=== ${name} DECK Comparison ===`);

    let matches = 0;
    let mismatches = 0;
    let missing = 0;
    let extra = 0;

    // Check spreadsheet cards against DB
    for (const [ssName, ssCount] of ss) {
      const dbEntry = dbMap.get(ssName);
      if (!dbEntry) {
        console.log(`  MISSING: "${ssName}" (spreadsheet: ${ssCount})`);
        missing++;
      } else if (dbEntry.totalQty !== ssCount) {
        console.log(
          `  MISMATCH: "${ssName}" SS:${ssCount} DB:${dbEntry.totalQty} diff:${ssCount - dbEntry.totalQty > 0 ? '+' : ''}${ssCount - dbEntry.totalQty}`
        );
        console.log(`    DB variants: ${dbEntry.variants}`);
        mismatches++;
      } else {
        matches++;
      }
    }

    // Check for extra DB cards not in spreadsheet
    for (const [dbName, dbEntry] of dbMap) {
      if (!ss.has(dbName)) {
        // Only flag if it's a standard card (not Challenges, not Unknown set)
        const hasStandardSets = !dbEntry.variants.includes('Challenges') && !dbEntry.variants.includes('Unknown');
        if (hasStandardSets) {
          console.log(`  EXTRA in DB: "${dbName}" (DB: ${dbEntry.totalQty})`);
          extra++;
        }
      }
    }

    console.log(`  Matches: ${matches} | Mismatches: ${mismatches} | Missing: ${missing} | Extra: ${extra}`);
    return { matches, mismatches, missing, extra };
  }

  const lootResult = compareDeck('LOOT', lootSs, lootDb);
  const monsterResult = compareDeck('MONSTER', monsterSs, monsterDb);
  const treasureResult = compareDeck('TREASURE', treasureSs, treasureDb);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Loot:     ${lootResult.matches} match | ${lootResult.mismatches} mismatch | ${lootResult.missing} missing | ${lootResult.extra} extra`);
  console.log(`Monster:  ${monsterResult.matches} match | ${monsterResult.mismatches} mismatch | ${monsterResult.missing} missing | ${monsterResult.extra} extra`);
  console.log(`Treasure: ${treasureResult.matches} match | ${treasureResult.mismatches} mismatch | ${treasureResult.missing} missing | ${treasureResult.extra} extra`);

  // Category breakdown for Loot
  console.log('\n=== Loot Category Breakdown (Spreadsheet) ===');
  const lootByCategory = new Map<string, number>();
  for (const c of lootCards) {
    lootByCategory.set(c.category, (lootByCategory.get(c.category) || 0) + 1);
  }
  for (const [cat, count] of [...lootByCategory.entries()].sort()) {
    console.log(`  ${cat.padEnd(45)} ${count}`);
  }

  // Coin-specific comparison
  console.log('\n=== Coin Cards Detail ===');
  const coinNames = ['a penny', '2 cents', '3 cents', '4 cents', 'a nickel', 'a dime'];
  for (const coinName of coinNames) {
    const ssCount = lootSs.get(coinName) || 0;
    const dbEntry = lootDb.get(coinName);
    const dbCount = dbEntry?.totalQty || 0;
    const diff = ssCount - dbCount;
    const flag = diff > 0 ? ' <<< MISSING' : diff < 0 ? ' >>> EXTRA' : '';
    console.log(`  ${coinName.padEnd(15)} SS:${String(ssCount).padStart(3)}  DB:${String(dbCount).padStart(3)}  diff:${diff >= 0 ? '+' : ''}${diff}${flag}`);
    if (dbEntry) {
      console.log(`    DB: ${dbEntry.variants}`);
    }
  }

  db.close();
}

main();
