import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://foursouls.com';
const SEARCH_URL = `${BASE_URL}/card-search/`;
const DELAY_MS = 1200;

export interface CardListEntry {
  name: string;
  url: string;
  imageUrl: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; FourSoulsOnlineScraper/1.0; +https://github.com/four-souls-online)',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 30000,
  });
  return res.data as string;
}

async function scrapePageCards(pageUrl: string): Promise<CardListEntry[]> {
  const html = await fetchPage(pageUrl);
  const $ = cheerio.load(html);
  const cards: CardListEntry[] = [];

  // Cards are linked images in the search results
  $('a[href*="/cards/"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href || !href.includes('/cards/')) return;

    const img = $(el).find('img').last();
    const name = img.attr('alt') || '';
    const rawSrc = img.attr('data-src') || img.attr('src') || '';

    // Skip placeholder/base64 images and nav images
    if (!name || !href || rawSrc.startsWith('data:')) return;
    // Skip pagination links and nav links
    if (href.includes('/card-search/') || href.includes('/cards/#')) return;

    const imageUrl = rawSrc.startsWith('http') ? rawSrc : `${BASE_URL}${rawSrc}`;
    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

    // Deduplicate by URL
    if (!cards.find((c) => c.url === fullUrl)) {
      cards.push({ name, url: fullUrl, imageUrl });
    }
  });

  return cards;
}

/**
 * Scrapes the card search with identical=no to count physical copies per card.
 * Returns a map of card-id-slug → count (e.g. { "b2-a_penny_6": 6, ... }).
 * Cards not present in the map should default to 1 in the caller.
 */
export async function scrapeCardQuantities(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const pageUrl =
      page === 1
        ? `${SEARCH_URL}?searchtext=&origin=&card_type=&card_footnotes=&competitive_only=&identical=no&cardstatus=cur&holo=&printstatus=&franchise=&fullartist=&charartist=&backartist=`
        : `${SEARCH_URL}page/${page}/?searchtext&origin&card_type&card_footnotes&competitive_only&identical=no&cardstatus=cur&holo&printstatus&franchise&fullartist&charartist&backartist`;

    console.log(`  Scraping quantities page ${page}: ${pageUrl}`);

    try {
      const html = await fetchPage(pageUrl);
      const $ = cheerio.load(html);
      let foundOnPage = 0;

      $('a[href*="/cards/"]').each((_i, el) => {
        const href = $(el).attr('href');
        if (!href || !href.includes('/cards/')) return;
        if (href.includes('/card-search/') || href.includes('/cards/#')) return;

        // Extract slug: last non-empty path segment
        const slug = href.replace(/\/$/, '').split('/').pop();
        if (!slug) return;

        // Skip nav-style links — real card IDs always contain a hyphen
        if (!slug.includes('-')) return;

        // Group by base ID: strip trailing numeric suffix (_2, _3, ... or -2, -3, ...) so that
        // b2-a_penny/_2/.../b2-a_penny_6 and b2-bomb/b2-bomb-2/.../b2-bomb-4 all map to their
        // base key, and the total copy count ends up stored under that base.
        const base = slug.replace(/[-_]\d+$/, '');
        counts[base] = (counts[base] ?? 0) + 1;
        foundOnPage++;
      });

      if (foundOnPage === 0) {
        hasMore = false;
      } else {
        console.log(`    Found ${foundOnPage} entries on page ${page}`);
        page++;
        await sleep(DELAY_MS);
      }
    } catch (err) {
      console.error(`  Error on quantities page ${page}:`, err);
      hasMore = false;
    }
  }

  const totalCards = Object.keys(counts).length;
  const totalCopies = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  Quantities scraped: ${totalCards} unique cards, ${totalCopies} total copies`);
  return counts;
}

/**
 * Origin set values used in foursouls.com card-search URL parameters.
 * Extracted from the site's HTML <select name="origin"> options.
 */
export const SET_ORIGINS = [
  { name: 'Base Game V2', origin: 'b2' },
  { name: 'Four Souls+ V2', origin: 'fsp2' },
  { name: 'Requiem', origin: 'r' },
  { name: 'The Summer of Isaac', origin: 'soi' },
  { name: '10th Anniversary', origin: 'tena' },
  { name: 'Gold Box V2', origin: 'g2' },
  { name: 'Requiem Warp Zone', origin: 'rwz' },
  { name: 'Alt Art', origin: 'aa' },
  { name: 'Target', origin: 't' },
  { name: 'Gish', origin: 'gi' },
  { name: 'Tapeworm', origin: 'tw' },
  { name: 'Dick Knots', origin: 'dk' },
  { name: 'Retro', origin: 'ret' },
  { name: 'G-Fuel', origin: 'gf' },
  { name: 'The Legend of Bum-bo!', origin: 'bum' },
  { name: 'The Unboxing of Isaac', origin: 'box' },
  { name: 'Nendoroid', origin: 'nen' },
  { name: 'Mewgenics', origin: 'mew' },
  { name: 'Promos', origin: 'p' },
  { name: 'Challenges', origin: 'challenge' },
] as const;

/**
 * Normalize a card URL by stripping numeric duplicate suffixes.
 * The website uses /fsp2-a_penny_2/, /fsp2-a_penny_3/ etc. for identical
 * physical copies. We collapse these to /fsp2-a_penny/ so the scraper
 * treats them as one card (quantity is handled by the separate quantity pass).
 */
function normalizeCardUrl(url: string): string {
  // Strip trailing slash, then strip numeric duplicate suffix (_2, -3, etc.), then re-add slash
  const noSlash = url.replace(/\/$/, '');
  const normalized = noSlash.replace(/[-_]\d+$/, '');
  return normalized + '/';
}

/**
 * Scrape each set individually to find cards that the main identical=yes
 * pass misses (alt-art variants, set-specific coins, etc.).
 * Returns CardListEntry[] of cards NOT already in seenUrls.
 */
export async function scrapeSetCards(
  seenUrls: Set<string>
): Promise<CardListEntry[]> {
  const newCards: CardListEntry[] = [];

  for (const { name, origin } of SET_ORIGINS) {
    const url = `${SEARCH_URL}?searchtext=&origin=${origin}&card_type=&card_footnotes=&competitive_only=&identical=no&cardstatus=cur&holo=&printstatus=&franchise=&fullartist=&charartist=&backartist=`;
    console.log(`  Scraping set "${name}" (origin=${origin})...`);

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      let foundOnPage = 0;
      let newOnPage = 0;

      // Track first entry per normalized URL so we use the clean URL (without _N suffix)
      const seenInSet = new Map<string, CardListEntry>();

      $('a[href*="/cards/"]').each((_i, el) => {
        const href = $(el).attr('href');
        if (!href || !href.includes('/cards/')) return;
        if (href.includes('/card-search/') || href.includes('/cards/#')) return;

        const img = $(el).find('img').last();
        const cardName = img.attr('alt') || '';
        const rawSrc = img.attr('data-src') || img.attr('src') || '';

        if (!cardName || rawSrc.startsWith('data:')) return;

        const imageUrl = rawSrc.startsWith('http') ? rawSrc : `${BASE_URL}${rawSrc}`;
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        // Normalize to strip _2, _3 suffixes — those are just duplicate physical copies
        const normalizedUrl = normalizeCardUrl(fullUrl);

        foundOnPage++;

        if (!seenInSet.has(normalizedUrl)) {
          seenInSet.set(normalizedUrl, { name: cardName, url: normalizedUrl, imageUrl });
        }
      });

      // Add cards not already in the global seen set
      for (const entry of seenInSet.values()) {
        if (!seenUrls.has(entry.url)) {
          seenUrls.add(entry.url);
          newCards.push(entry);
          newOnPage++;
        }
      }

      if (newOnPage > 0) {
        console.log(`    Found ${foundOnPage} entries, ${seenInSet.size} unique, ${newOnPage} new`);
      } else {
        console.log(`    ${foundOnPage} entries, ${seenInSet.size} unique, all already known`);
      }
    } catch (err) {
      console.error(`  Error scraping set "${name}":`, err);
    }

    await sleep(DELAY_MS);
  }

  console.log(`  Set-by-set scrape complete: ${newCards.length} new cards found`);
  return newCards;
}

export async function scrapeCardList(): Promise<CardListEntry[]> {
  const allCards: CardListEntry[] = [];
  const seenUrls = new Set<string>();

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const pageUrl =
      page === 1
        ? `${SEARCH_URL}?searchtext=&origin=&card_type=&card_footnotes=&competitive_only=&identical=yes&cardstatus=cur&holo=&printstatus=&franchise=&fullartist=&charartist=&backartist=`
        : `${SEARCH_URL}page/${page}/?searchtext&origin&card_type&card_footnotes&competitive_only&identical=yes&cardstatus=cur&holo&printstatus&franchise&fullartist&charartist&backartist`;

    console.log(`  Scraping card list page ${page}: ${pageUrl}`);

    try {
      const pageCards = await scrapePageCards(pageUrl);
      const newCards = pageCards.filter((c) => !seenUrls.has(c.url));

      if (newCards.length === 0) {
        hasMore = false;
      } else {
        for (const c of newCards) {
          seenUrls.add(c.url);
          allCards.push(c);
        }
        console.log(`    Found ${newCards.length} new cards (total: ${allCards.length})`);
        page++;
        await sleep(DELAY_MS);
      }
    } catch (err) {
      console.error(`  Error on page ${page}:`, err);
      hasMore = false;
    }
  }

  // Step 1b: Scrape each set individually to find cards the main pass missed
  console.log('\nStep 1b: Scraping cards per set to find missing variants...');
  const setCards = await scrapeSetCards(seenUrls);
  allCards.push(...setCards);
  console.log(`  Total cards after set scrape: ${allCards.length}`);

  return allCards;
}
