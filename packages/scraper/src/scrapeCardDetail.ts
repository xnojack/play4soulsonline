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
  const cleaned = text.trim().replace(/^:\s*/, '').replace(/[^0-9\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function inferCardType(
  raw: string
): { cardType: string; subType: string } {
  const lower = raw.toLowerCase();

  if (lower.includes('character')) return { cardType: 'Character', subType: '' };
  if (lower.includes('bonus soul')) return { cardType: 'BonusSoul', subType: '' };
  if (lower.includes('room')) return { cardType: 'Room', subType: '' };

  // Monster subtypes
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

  // --- Card image ---
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

  // --- Set and card type ---
  // Structure: <div id="OriginSet" class="b2">
  //   <p>Base Game V2</p>
  //   <div class="originIndicator" ...></div>
  //   <p>Character Card</p>   ← may be absent for some card variants
  // </div>
  const originSetDiv = $('#OriginSet');
  const paragraphs = originSetDiv.find('p');
  const origin = paragraphs.first().text().trim();
  // If there are 2+ paragraphs, second is the type; if only 1, no explicit type
  const rawType = paragraphs.length >= 2 ? paragraphs.last().text().trim() : '';

  const { cardType, subType } = inferCardType(rawType);

  // --- Stats from #StatTable ---
  // Each row: <tr><td><img alt="HP" ...></td><td class="value">: 2</td></tr>
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
  // .effectOutcome contains the ability text (may contain inline icons)
  const effectOutcomes: string[] = [];
  $('.effectOutcome').each((_i, el) => {
    // Replace inline icons with their alt text in brackets
    $(el).find('img.inlineIcon, img.effectIcon').each((_j, img) => {
      const alt = $(img).attr('alt') || '';
      $(img).replaceWith(`[${alt}]`);
    });
    const txt = $(el).text().trim();
    if (txt) effectOutcomes.push(txt);
  });
  const abilityText = effectOutcomes.join('\n');

  // --- Quote / flavor text ---
  const quoteText = $('.quoteText').first().text().trim();

  // --- Reward text (monsters) ---
  // "Potential Rewards" section within #CardInfo
  let rewardText = '';
  const cardInfoText = $('#CardInfo').text();
  const rewardMatch = cardInfoText.match(/Potential Rewards(.*?)(?:$|\n)/s);
  if (rewardMatch) {
    rewardText = rewardMatch[1].trim();
  }

  // Soul value from rewards section for monsters
  if (soulValue === 0 && rewardText) {
    const soulRewardMatch = rewardText.match(/(\d+)x?\s*soul/i);
    if (soulRewardMatch) soulValue = parseInt(soulRewardMatch[1], 10);
  }

  // Soul bonus soul cards always have soulValue >= 1
  if (cardType === 'BonusSoul' && soulValue === 0) soulValue = 1;

  // Fallback: cards with no explicit type label and no monster stats are likely Loot cards
  // (numbered variants of coins, tarot cards, etc.)
  const resolvedCardType =
    cardType === 'Unknown' && hp === null && atk === null ? 'Loot' : cardType;

  // --- Print status ---
  // #CardTrivia contains a <p> with human-readable print status text.
  let printStatus = 'unknown';
  const triviaText = $('#CardTrivia p').first().text().toLowerCase();
  if (triviaText.includes('never been printed') || triviaText.includes('never printed')) {
    printStatus = 'never_printed';
  } else if (triviaText.includes('not currently in print') || triviaText.includes('not in print')) {
    printStatus = 'not_in_print';
  } else if (triviaText.includes('currently in print') || triviaText.includes('in print')) {
    printStatus = 'in_print';
  } else if (triviaText.includes('planned')) {
    printStatus = 'planned';
  }

  // --- Flags ---
  const isEternal = !!$('#CharitemBox').length;
  const threePlayerOnly =
    $('#CardInfo').text().toLowerCase().includes('3+ player') ||
    $('#CardInfo').text().toLowerCase().includes('3p+');

  return {
    id,
    name: entry.name,
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
  };
}
