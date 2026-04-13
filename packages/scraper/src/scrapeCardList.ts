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

        counts[slug] = (counts[slug] ?? 0) + 1;
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

  return allCards;
}
