import path from 'path';
import fs from 'fs';
import { scrapeCardList } from './scrapeCardList';
import { scrapeCardDetail } from './scrapeCardDetail';
import { downloadImages } from './downloadImages';
import { seedDatabase, writeJson } from './seedDatabase';
import { ScrapedCard } from './types';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'cards.db');
const JSON_PATH = path.join(DATA_DIR, 'cards.json');
const IMAGES_DIR = path.join(DATA_DIR, 'cards');
// Also write images to server's public dir if it exists
const SERVER_IMAGES_DIR = path.resolve(__dirname, '../../server/public/cards');

const DETAIL_DELAY_MS = 300;
const CHECKPOINT_INTERVAL = 50; // Write cards.json every N cards to allow resumption

async function main() {
  console.log('=== Four Souls Card Scraper ===\n');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  if (fs.existsSync(path.dirname(SERVER_IMAGES_DIR))) {
    fs.mkdirSync(SERVER_IMAGES_DIR, { recursive: true });
  }

  // Load existing cards from JSON if available (to resume interrupted runs)
  let existingCards: ScrapedCard[] = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      existingCards = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) as ScrapedCard[];
      console.log(`Loaded ${existingCards.length} existing cards from cache.\n`);
    } catch {
      existingCards = [];
    }
  }
  const existingIds = new Set(existingCards.map((c) => c.id));

  // Step 1: Scrape card list
  console.log('Step 1: Scraping card list...');
  const cardEntries = await scrapeCardList();
  console.log(`  Total cards found: ${cardEntries.length}\n`);

  const newEntries = cardEntries.filter((e) => {
    const id = e.url.replace(/\/$/, '').split('/').pop() || e.url;
    return !existingIds.has(id);
  });
  console.log(`  New cards to scrape: ${newEntries.length}\n`);

  // Step 2: Download images
  console.log('Step 2: Downloading card images...');
  const imageMap = await downloadImages(newEntries, IMAGES_DIR, 300);
  // Also copy to server public dir
  if (fs.existsSync(SERVER_IMAGES_DIR)) {
    for (const [id, localPath] of imageMap.entries()) {
      const filename = path.basename(localPath);
      const src = path.join(IMAGES_DIR, filename);
      const dst = path.join(SERVER_IMAGES_DIR, filename);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }
  }
  console.log();

  // Step 3: Scrape card details
  console.log('Step 3: Scraping card details...');
  const newCards: ScrapedCard[] = [];

  for (let i = 0; i < newEntries.length; i++) {
    const entry = newEntries[i];
    const id = entry.url.replace(/\/$/, '').split('/').pop() || entry.url;
    process.stdout.write(`  [${i + 1}/${newEntries.length}] ${entry.name} (${id})...`);

    try {
      const detail = await scrapeCardDetail(entry);
      const localImagePath = imageMap.get(id) || `/cards/${id}.png`;
      newCards.push({ ...detail, localImagePath });
      console.log(' OK');
    } catch (err) {
      console.log(` ERROR: ${err}`);
      // Add a minimal entry so we don't keep retrying
      newCards.push({
        id,
        name: entry.name,
        sourceUrl: entry.url,
        imageUrl: entry.imageUrl,
        localImagePath: imageMap.get(id) || `/cards/${id}.png`,
        cardType: 'Unknown',
        subType: '',
        set: 'Unknown',
        hp: null,
        atk: null,
        evasion: null,
        soulValue: 0,
        rewardText: '',
        abilityText: '',
        threePlayerOnly: false,
        isEternal: false,
        origin: 'Unknown',
        printStatus: 'unknown',
        startingItemId: undefined,
      });
    }

    // Checkpoint: write progress to JSON every N cards so interrupted runs can resume
    if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
      writeJson([...existingCards, ...newCards], JSON_PATH);
      process.stdout.write(`  [checkpoint saved at ${i + 1}]\n`);
    }

    await new Promise((r) => setTimeout(r, DETAIL_DELAY_MS));
  }

  const allCards = [...existingCards, ...newCards];

  // Step 4: Write JSON
  console.log('\nStep 4: Writing cards.json...');
  writeJson(allCards, JSON_PATH);

  // Step 5: Seed database
  console.log('\nStep 5: Seeding SQLite database...');
  seedDatabase(allCards, DB_PATH);

  console.log('\n=== Scrape complete! ===');
  console.log(`Total cards: ${allCards.length}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`JSON: ${JSON_PATH}`);
  console.log(`Images: ${IMAGES_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
