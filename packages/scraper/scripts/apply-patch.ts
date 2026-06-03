/**
 * Apply spreadsheet quantity patch to existing cards.json and re-seed DB.
 * Usage: npx ts-node packages/scraper/scripts/apply-patch.ts
 */
import fs from 'fs';
import path from 'path';
import { patchQuantitiesFromSpreadsheet } from '../src/patchQuantities';
import { seedDatabase, writeJson } from '../src/seedDatabase';
import { ScrapedCard } from '../src/types';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'cards.db');
const JSON_PATH = path.join(DATA_DIR, 'cards.json');
const SPREADSHEET_DIR = path.resolve(__dirname, '../../../card-spreadsheet');

function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error('cards.json not found. Run npm run scrape first.');
    process.exit(1);
  }

  const cards = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) as ScrapedCard[];
  console.log(`Loaded ${cards.length} cards from cache.`);

  console.log('\nPatching quantities from spreadsheet...');
  const patched = patchQuantitiesFromSpreadsheet(cards, SPREADSHEET_DIR);
  console.log(`Patched ${patched} cards.\n`);

  // Re-write JSON and DB
  writeJson(cards, JSON_PATH);
  seedDatabase(cards, DB_PATH);

  console.log('Done. Run audit to verify:');
  console.log('  npx ts-node packages/scraper/scripts/audit-quantities.ts');
}

main();
