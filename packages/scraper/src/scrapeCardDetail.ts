import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedCard } from './types';
import { CardListEntry } from './scrapeCardList';

const BASE_URL = 'https://foursouls.com';

function extractId(url: string): string {
  // e.g. https://foursouls.com/cards/b2-isaac/ → b2-isaac
  return url.replace(/\/$/, '').split('/').pop() || url;
}

function parseStatValue(text: string): number | null {
  // Strip leading ": " prefix that the site uses
  const cleaned = text.trim().replace(/^:\s*/, '').replace(/[^0-9\/\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  // Dual-sided cards show stats as "front/back" (e.g. "4/6") — take the front (first) value
  const front = cleaned.split('/')[0];
  const n = parseInt(front, 10);
  return isNaN(n) ? null : n;
}

/**
 * Decode common HTML entities that can survive Cheerio's .text() calls
 * when they appear in text nodes (e.g. &amp; in attribute values copied to text).
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, '\u2019') // right single quote
    .replace(/&#8216;/g, '\u2018') // left single quote
    .replace(/&#8220;/g, '\u201c') // left double quote
    .replace(/&#8221;/g, '\u201d') // right double quote
    .replace(/&#8211;/g, '\u2013') // en dash
    .replace(/&#8212;/g, '\u2014') // em dash
    .replace(/\u00a0/g, ' ')       // non-breaking space → regular space
    .replace(/  +/g, ' ')          // collapse multiple spaces
    .trim();
}

function inferCardType(
  raw: string
): { cardType: string; subType: string } {
  const lower = raw.toLowerCase();

  if (lower.includes('character')) return { cardType: 'Character', subType: '' };
  if (lower.includes('bonus soul')) return { cardType: 'BonusSoul', subType: '' };
  if (lower.includes('room')) return { cardType: 'Room', subType: '' };

  // Monster subtypes — check before generic "monster" so specifics win
  if (lower.includes('epic boss')) return { cardType: 'Monster', subType: 'Epic Boss' };
  if (lower.includes('boss')) return { cardType: 'Monster', subType: 'Boss' };
  if (lower.includes('curse')) return { cardType: 'Monster', subType: 'Curse' };
  if (lower.includes('event')) return { cardType: 'Monster', subType: 'Event' };
  if (lower.includes('monster')) return { cardType: 'Monster', subType: 'Basic Monster' };

  // Loot subtypes
  if (lower.includes('trinket')) return { cardType: 'Loot', subType: 'Trinket' };
  if (lower.includes('ambush')) return { cardType: 'Loot', subType: 'Ambush' };
  if (lower.includes('pill')) return { cardType: 'Loot', subType: 'Pill' };
  if (lower.includes('rune')) return { cardType: 'Loot', subType: 'Rune' };
  if (lower.includes('bomb')) return { cardType: 'Loot', subType: 'Bomb' };
  if (lower.includes('battery')) return { cardType: 'Loot', subType: 'Battery' };
  if (lower.includes('key')) return { cardType: 'Loot', subType: 'Key' };
  if (lower.includes('loot')) return { cardType: 'Loot', subType: 'Card' };

  // Treasure subtypes
  if (lower.includes('active')) return { cardType: 'Treasure', subType: 'Active' };
  if (lower.includes('paid')) return { cardType: 'Treasure', subType: 'Paid' };
  if (lower.includes('one-use') || lower.includes('one use'))
    return { cardType: 'Treasure', subType: 'One-Use' };
  if (lower.includes('soul treasure') || lower.includes('treasure soul'))
    return { cardType: 'Treasure', subType: 'Soul' };
  if (lower.includes('passive')) return { cardType: 'Treasure', subType: 'Passive' };
  if (lower.includes('treasure')) return { cardType: 'Treasure', subType: 'Passive' };

  return { cardType: 'Unknown', subType: '' };
}

/**
 * Extract clean text from an .effectOutcome element.
 * - Handles inline icons: if the text node immediately before the <img> already ends with
 *   a "]" (i.e. the site placed a bracketed label before the icon), the img is stripped;
 *   otherwise it is replaced with [alt] so mid-sentence icons are still readable.
 * - Converts <li> elements to newline-prefixed bullet lines so list structure
 *   is preserved in plain text (rather than all items being concatenated).
 * - Returns the cleaned, entity-decoded string.
 */
function extractEffectText($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const elem = $(el);

  // Handle ALL inline images.
  // The site often renders: [Label text node] <img alt="Label"> — a text label followed
  // by a redundant icon image.  In that case stripping the img avoids "[Label][Label]"
  // duplication.  When an img appears mid-sentence without a preceding bracket label
  // (e.g. inline stat icons) we substitute [alt] so the meaning is preserved.
  elem.find('img').each((_j, img) => {
    const alt = $(img).attr('alt') || '';
    const prev = img.previousSibling;
    const prevText = prev && prev.type === 'text' ? prev.data ?? '' : '';
    if (prevText.trimEnd().endsWith(']')) {
      // Preceding text node already has the label — just drop the icon
      $(img).remove();
    } else {
      $(img).replaceWith(`[${alt}]`);
    }
  });

  // Convert <li> elements to newline-prefixed lines before extracting text,
  // so "Choose one-\n- Play an additional loot card..." is readable.
  elem.find('li').each((_j, li) => {
    const liText = $(li).text().trim();
    $(li).replaceWith(`\n- ${liText}`);
  });

  // Remove now-empty <ul>/<ol> wrappers (they'd leave stray whitespace)
  elem.find('ul, ol').each((_j, list) => {
    $(list).replaceWith($(list).text());
  });

  return decodeEntities(elem.text().trim());
}

export async function scrapeCardDetail(
  entry: CardListEntry
): Promise<Omit<ScrapedCard, 'localImagePath'>> {
  const res = await axios.get(entry.url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; FourSoulsOnlineScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 30000,
  });

  const $ = cheerio.load(res.data as string);
  const id = extractId(entry.url);

  // --- Card image (front face) ---
  // The page uses lazy loading: real URL is in data-src on .cardFront img
  let imageUrl = entry.imageUrl;
  const cardFrontImg = $('img.cardFront').first();
  if (cardFrontImg.length) {
    const dataSrc = cardFrontImg.attr('data-src') || '';
    const src = cardFrontImg.attr('src') || '';
    const chosen = dataSrc || src;
    if (chosen && !chosen.startsWith('data:')) {
      imageUrl = chosen.startsWith('http') ? chosen : `${BASE_URL}${chosen}`;
    }
  }

  // --- Back face image (dual-sided / flip cards only) ---
  // Dual-sided cards have a second card image in #CardRight with alt="Alternate Card Back".
  // The back image is in data-src (lazy-loaded), falling back to src.
  let backImageUrl: string | null = null;
  const backImg = $('#CardRight img.cardFront[alt="Alternate Card Back"]');
  if (backImg.length) {
    const dataSrc = backImg.attr('data-src') || '';
    const src = backImg.attr('src') || '';
    const chosen = dataSrc || src;
    if (chosen && !chosen.startsWith('data:')) {
      backImageUrl = chosen.startsWith('http') ? chosen : `${BASE_URL}${chosen}`;
    }
  }

  // --- Flip side name ---
  // The scraper list entry stores dual-sided card names as "Front/Back Card Back".
  // Extract the back name (between "/" and " Card Back") and clean the front name.
  let flipSideName: string | null = null;
  let cleanName = entry.name;
  const flipMatch = entry.name.match(/^(.+?)\/(.+?)\s+Card Back$/i);
  if (flipMatch) {
    cleanName = flipMatch[1].trim();
    flipSideName = flipMatch[2].trim();
  } else if (entry.name.endsWith(' Card Back')) {
    // Fallback: strip " Card Back" suffix alone
    cleanName = entry.name.replace(/\s+Card Back$/i, '').trim();
  }

  // --- Set and card type ---
  // Structure: <div id="OriginSet" class="b2">
  //   <p>Base Game V2</p>
  //   <div class="originIndicator" ...></div>
  //   <p>Character Card</p>   ← may be absent for some card variants
  // </div>
  const originSetDiv = $('#OriginSet');
  const paragraphs = originSetDiv.find('p');
  const origin = decodeEntities(paragraphs.first().text().trim());
  // If there are 2+ paragraphs, second is the type; if only 1, no explicit type
  const rawType = paragraphs.length >= 2 ? paragraphs.last().text().trim() : '';

  const { cardType, subType } = inferCardType(rawType);

  // --- Stats from #StatTable ---
  // Each row: <tr><td><img alt="HP" ...></td><td class="value">: 2</td></tr>
  // Dual-sided cards show slash-separated stats (e.g. "4/6") — parseStatValue takes the front value.
  let hp: number | null = null;
  let atk: number | null = null;
  let evasion: number | null = null;
  let soulValue = 0;

  $('#StatTable tr').each((_i, row) => {
    const statImg = $(row).find('td.statIconContainer img').first();
    const altText = (statImg.attr('alt') || statImg.attr('data-src') || '').toLowerCase();
    const valueCell = $(row).find('td.value').first().text();
    const val = parseStatValue(valueCell);

    if (altText.includes('hp') || altText.includes('heart')) {
      hp = val;
    } else if (altText.includes('atk') || altText.includes('sword') || altText.includes('attack')) {
      atk = val;
    } else if (altText.includes('dc') || altText.includes('dice') || altText.includes('evasion')) {
      evasion = val;
    } else if (altText.includes('soul')) {
      soulValue = val ?? 0;
    }
  });

  // --- Ability text ---
  // .effectOutcome contains the ability text (may contain inline icons and lists)
  const effectOutcomes: string[] = [];
  $('.effectOutcome').each((_i, el) => {
    const txt = extractEffectText($, el);
    if (txt) effectOutcomes.push(txt);
  });
  const abilityText = effectOutcomes.join('\n');

  // --- Quote / flavor text (fallback if no ability text) ---
  const quoteText = decodeEntities($('.quoteText').first().text().trim());

  // --- Reward text (monsters) ---
  // The reward section is a <table> immediately following the
  // <h2>Potential Rewards</h2> heading inside #CardInfo.
  // Each row: <td class="value">Nx</td> <td class="icon"><img alt="Soul|Coin|Loot|Treasure" ...></td>
  let rewardText = '';
  const rewardHeading = $('#CardInfo').find('h2, h3').filter((_i, el) =>
    $(el).text().trim().toLowerCase().includes('potential rewards')
  ).first();
  const rewardTable = rewardHeading.next('table');
  if (rewardTable.length) {
    const parts: string[] = [];
    rewardTable.find('tr').each((_i, row) => {
      const qtyRaw = $(row).find('td.value').text().trim(); // e.g. "1x" or "6x"
      const qty = parseInt(qtyRaw.replace(/[^0-9]/g, ''), 10) || 1;
      // Use data-src filename as fallback when alt is missing (lazy-loaded images)
      const img = $(row).find('td.icon img');
      const alt = img.attr('alt') || '';
      const dataSrc = img.attr('data-src') || '';
      // Derive reward type from alt text; fall back to parsing the data-src filename
      let type = alt.trim();
      if (!type) {
        if (dataSrc.includes('Soul')) type = 'Soul';
        else if (dataSrc.includes('penny') || dataSrc.includes('Coin')) type = 'Coin';
        else if (dataSrc.includes('loot') || dataSrc.includes('Loot')) type = 'Loot';
        else if (dataSrc.includes('Treasure')) type = 'Treasure';
      }
      if (!type) return; // skip unrecognisable rows

      // Accumulate soul value directly from reward rows
      if (type.toLowerCase() === 'soul') {
        soulValue += qty;
      }

      // Pluralise for display (Loot and Treasure don't pluralise)
      let displayType = type;
      if (qty > 1) {
        if (type === 'Soul') displayType = 'Souls';
        else if (type === 'Coin') displayType = 'Coins';
      }
      parts.push(`${qty} ${displayType}`);
    });
    rewardText = parts.join(' · ');
  }

  // Soul bonus soul cards always have soulValue >= 1
  if (cardType === 'BonusSoul' && soulValue === 0) soulValue = 1;

  // Fallback: cards with no explicit type label and no monster stats are likely Loot cards
  // (numbered variants of coins, tarot cards, etc.)
  // Exclude the Challenges set — those are scenario cards, not standard loot.
  const resolvedCardType =
    cardType === 'Unknown' && hp === null && atk === null && origin !== 'Challenges'
      ? 'Loot'
      : cardType;

  // --- Print status ---
  // #CardTrivia contains a <p> with human-readable print status text.
  // Note: the site has a persistent typo "offically" (missing 'i') in some entries.
  let printStatus = 'unknown';
  const triviaText = $('#CardTrivia p').first().text().toLowerCase();
  if (/never\s+\w*\s*print/i.test(triviaText)) {
    // Catches: "never been printed", "never been offically printed", etc.
    printStatus = 'never_printed';
  } else if (
    triviaText.includes('not currently in print') ||
    triviaText.includes('not in print') ||
    triviaText.includes('no longer in print')
  ) {
    printStatus = 'not_in_print';
  } else if (triviaText.includes('currently in print') || triviaText.includes('in print')) {
    printStatus = 'in_print';
  } else if (triviaText.includes('planned')) {
    printStatus = 'planned';
  }

  // --- Flags ---
  const charitemBox = $('#CharitemBox');
  const isEternal = !!charitemBox.length;
  const threePlayerOnly =
    $('#CardInfo').text().toLowerCase().includes('3+ player') ||
    $('#CardInfo').text().toLowerCase().includes('3p+');

  // --- Starting item (characters only) ---
  // #CharitemBox contains a link to the character's eternal starting item.
  // If #CharitemBox exists but has no /cards/ link, the character has no fixed
  // item (Eden variants — they choose from the treasure deck), so startingItemId = null.
  // For non-character cards, startingItemId is undefined (field omitted).
  let startingItemId: string | null | undefined = undefined;
  if (resolvedCardType === 'Character') {
    if (charitemBox.length) {
      // Find the first /cards/ link inside the box — that's the starting item
      const itemLink = charitemBox.find('a[href*="/cards/"]').first().attr('href');
      if (itemLink) {
        startingItemId = extractId(itemLink);
      } else {
        // CharitemBox exists but no card link — treat as Eden (no fixed item)
        startingItemId = null;
      }
    } else {
      // No CharitemBox at all on a character page — Eden or similar (no fixed item)
      startingItemId = null;
    }
  }

  return {
    id,
    name: cleanName,
    sourceUrl: entry.url,
    imageUrl,
    cardType: resolvedCardType,
    subType,
    set: origin || 'Unknown',
    hp,
    atk,
    evasion,
    soulValue,
    rewardText,
    abilityText: abilityText || quoteText,
    threePlayerOnly,
    isEternal,
    origin: origin || 'Unknown',
    printStatus,
    startingItemId,
    backImageUrl: backImageUrl || null,
    backLocalImagePath: null, // populated by downloadImages after downloading
    flipSideName: flipSideName || null,
    quantity: 1, // overwritten by scrapeCardQuantities() post-processing pass
  };
}
