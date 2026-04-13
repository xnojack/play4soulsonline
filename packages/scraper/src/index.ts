import path from 'path';
import fs from 'fs';
import { scrapeCardList, scrapeCardQuantities } from './scrapeCardList';
import { scrapeCardDetail } from './scrapeCardDetail';
import { downloadImages, downloadBackImage } from './downloadImages';
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

  // Step 2: Download front-face images for new cards
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
        backImageUrl: null,
        backLocalImagePath: null,
        flipSideName: null,
        quantity: 1,
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

  // Step 3b: Download back-face images for flip cards (all cards, not just new ones)
  // This handles the case where cards.json already existed but back images weren't downloaded yet.
  console.log('\nStep 3b: Downloading flip card back images...');
  let backDownloaded = 0;
  for (const card of allCards) {
    if (!card.backImageUrl) continue;
    const localPath = await downloadBackImage(card.id, card.backImageUrl, IMAGES_DIR, 300);
    if (localPath && card.backLocalImagePath !== localPath) {
      card.backLocalImagePath = localPath;
      backDownloaded++;
      // Also copy to server public dir
      if (fs.existsSync(SERVER_IMAGES_DIR)) {
        const filename = path.basename(localPath);
        const src = path.join(IMAGES_DIR, filename);
        const dst = path.join(SERVER_IMAGES_DIR, filename);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  }
  if (backDownloaded === 0) {
    console.log('  No new back images to download.');
  }
  console.log();

  // Step 4: Scrape physical quantities (identical=no pass — fast, no detail fetches)
  console.log('Step 4: Scraping card quantities (identical=no)...');
  const quantityMap = await scrapeCardQuantities();
  // Merge quantities into all cards; default to 1 for any card not found in the map
  for (const card of allCards) {
    // The quantity map is keyed by base ID (numeric suffix stripped, either _ or - separator).
    // Strip the same way to match: b2-a_penny_6 → b2-a_penny, b2-bomb-2 → b2-bomb, etc.
    const baseId = card.id.replace(/[-_]\d+$/, '');
    card.quantity = quantityMap[baseId] ?? 1;
  }
  console.log();

  // Step 5: Write JSON
  console.log('Step 5: Writing cards.json...');
  writeJson(allCards, JSON_PATH);

  // Step 6: Seed database
  console.log('\nStep 6: Seeding SQLite database...');
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
