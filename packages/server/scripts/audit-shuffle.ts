/**
 * Shuffle bias audit script.
 *
 * Phase 1: Fisher-Yates correctness (100k shuffles of [0..99])
 * Phase 2: Deck assembly per type (100k iterations each)
 * Phase 3: Discard reshuffle (10k cycles)
 *
 * Usage:
 *   npx tsx scripts/audit-shuffle.ts              # all phases
 *   npx tsx scripts/audit-shuffle.ts --deck loot  # single deck only
 */

import { shuffle, drawFromDeck } from '../src/game/decks';
import { getCardsByType } from '../src/db/cards';
import { Card } from '../src/game/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const ITERATIONS = 100_000;
const RESHUFFLE_CYCLES = 10_000;
const ARRAY_SIZE = 100;

const ETERNAL_IN_TREASURE = new Set(['keep-sack']);
const ETERNAL_IN_LOOT = new Set(['tick']);

// ── Helpers ────────────────────────────────────────────────────────────────────

function chiSquareTest(observed: number[], expected: number): { stat: number; pApprox: string } {
  let chi2 = 0;
  for (const o of observed) {
    chi2 += ((o - expected) ** 2) / expected;
  }
  // Approximate p-value from chi-square distribution (large df, normal approx)
  const df = observed.length - 1;
  const z = Math.sqrt(2 * chi2) - Math.sqrt(2 * df - 1);
  const p = 0.5 * (1 + erf(z / Math.sqrt(2)));
  return { stat: chi2, pApprox: p.toFixed(6) };
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function sigmaOutliers(observed: number[], expected: number): { maxPos: number; maxNeg: number; outliers: string[] } {
  const variance = expected; // binomial approximation for large N
  const stdDev = Math.sqrt(variance);
  let maxPos = 0, maxNeg = 0;
  const outliers: string[] = [];
  for (let i = 0; i < observed.length; i++) {
    const sigma = (observed[i] - expected) / stdDev;
    if (sigma > maxPos) maxPos = sigma;
    if (sigma < maxNeg) maxNeg = sigma;
    if (Math.abs(sigma) > 3) {
      outliers.push(`  idx ${i}: observed ${observed[i]}, expected ${expected.toFixed(1)}, ${sigma.toFixed(2)}σ`);
    }
  }
  return { maxPos, maxNeg, outliers };
}

function labelResult(p: number, chi2: number, df: number): string {
  if (p < 0.01) return `❌ FAIL (χ²=${chi2.toFixed(1)}, df=${df}, p=${p.toFixed(6)})`;
  if (p < 0.05) return `⚠️  WARN (χ²=${chi2.toFixed(1)}, df=${df}, p=${p.toFixed(6)})`;
  return `✓  PASS (χ²=${chi2.toFixed(1)}, df=${df}, p=${p.toFixed(6)})`;
}

function buildDeckCards(cards: Card[], isEternal: boolean): string[] {
  let filtered = cards.filter((c) => !c.threePlayerOnly);
  if (isEternal) {
    // Eternal deck: combine eternal treasure + eternal loot
    return filtered.flatMap((c) => Array(c.quantity).fill(c.id));
  }
  const nonEternal = filtered.filter(
    (c) => !c.isEternal || (c.cardType === 'Treasure' && ETERNAL_IN_TREASURE.has(c.id)) || (c.cardType === 'Loot' && ETERNAL_IN_LOOT.has(c.id))
  );
  return nonEternal.flatMap((c) => Array(c.quantity).fill(c.id));
}

// ── Phase 1: Fisher-Yates ──────────────────────────────────────────────────────

function runPhase1(): void {
  console.log('\n=== Phase 1: Fisher-Yates Shuffle ===');
  console.log(`Iterations: ${ITERATIONS.toLocaleString()} | Array size: ${ARRAY_SIZE}\n`);

  // Track how often each value lands at each position
  const positionCounts: number[][] = Array.from({ length: ARRAY_SIZE }, () => new Array(ARRAY_SIZE).fill(0));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const arr = Array.from({ length: ARRAY_SIZE }, (_, i) => i);
    const shuffled = shuffle(arr);
    for (let pos = 0; pos < ARRAY_SIZE; pos++) {
      positionCounts[pos][shuffled[pos]]++;
    }
  }

  const expected = ITERATIONS / ARRAY_SIZE;
  console.log(`Expected frequency per position/value: ${expected.toFixed(1)}\n`);

  // Report a few sample positions
  const samplePositions = [0, Math.floor(ARRAY_SIZE / 2), ARRAY_SIZE - 1];
  for (const pos of samplePositions) {
    const result = chiSquareTest(positionCounts[pos], expected);
    const sigmas = sigmaOutliers(positionCounts[pos], expected);
    console.log(`Position ${pos}: ${labelResult(+result.pApprox, result.stat, ARRAY_SIZE - 1)}`);
    console.log(`  σ range: [${sigmas.maxNeg.toFixed(2)}σ, +${sigmas.maxPos.toFixed(2)}σ]`);
    if (sigmas.outliers.length > 0) {
      console.log(`  Outliers (>3σ): ${sigmas.outliers.length}`);
      for (const o of sigmas.outliers.slice(0, 5)) console.log(o);
    }
    console.log();
  }
}

// ── Phase 2: Deck Assembly ─────────────────────────────────────────────────────

interface DeckAudit {
  name: string;
  type: string;
  isEternal?: boolean;
}

const DECK_AUDITS: DeckAudit[] = [
  { name: 'LOOT', type: 'Loot' },
  { name: 'TREASURE', type: 'Treasure' },
  { name: 'MONSTER', type: 'Monster' },
  { name: 'ROOM', type: 'Room' },
  { name: 'ETERNAL', type: 'Treasure', isEternal: true },
];

function runPhase2(deckFilter?: string): void {
  const audits = deckFilter
    ? DECK_AUDITS.filter((d) => d.name.toLowerCase() === deckFilter.toLowerCase())
    : DECK_AUDITS;

  if (audits.length === 0) {
    console.error(`Unknown deck type: ${deckFilter}`);
    process.exit(1);
  }

  for (const audit of audits) {
    console.log(`\n=== Phase 2: ${audit.name} DECK ===`);
    console.log(`Iterations: ${ITERATIONS.toLocaleString()}\n`);

    // Load cards
    let cards: Card[];
    if (audit.isEternal) {
      const treasure = getCardsByType('Treasure').filter((c) => c.isEternal && !ETERNAL_IN_TREASURE.has(c.id));
      const loot = getCardsByType('Loot').filter((c) => c.isEternal && !ETERNAL_IN_LOOT.has(c.id));
      cards = [...treasure, ...loot];
    } else {
      cards = getCardsByType(audit.type);
    }

    // Build deck array (cards × quantities)
    const deckCards = buildDeckCards(cards, !!audit.isEternal);
    const uniqueCards = new Set(deckCards);
    const deckSize = deckCards.length;

    console.log(`Unique cards: ${uniqueCards.size}`);
    console.log(`Deck size (with quantities): ${deckSize}`);
    console.log(`Cards with qty > 1: ${cards.filter((c) => c.quantity > 1).length}`);
    console.log();

    // Track top card frequency (position deckSize - 1) and bottom card (position 0)
    const topCounts = new Map<string, number>();
    const bottomCounts = new Map<string, number>();
    for (const id of uniqueCards) {
      topCounts.set(id, 0);
      bottomCounts.set(id, 0);
    }

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const deck = shuffle([...deckCards]);
      topCounts.set(deck[deck.length - 1], (topCounts.get(deck[deck.length - 1]) ?? 0) + 1);
      bottomCounts.set(deck[0], (bottomCounts.get(deck[0]) ?? 0) + 1);
    }

    // Expected frequency: each card appears qty times in a deck of deckSize
    // Probability of landing on top = qty / deckSize
    // Expected = ITERATIONS * qty / deckSize
    const cardQty = new Map<string, number>();
    for (const c of cards) {
      if (cardQty.has(c.id)) {
        cardQty.set(c.id, cardQty.get(c.id)! + c.quantity);
      } else {
        cardQty.set(c.id, c.quantity);
      }
    }

    // Top card distribution — per-card expected based on quantity
    const topObs: number[] = [];
    const topExp: number[] = [];
    for (const [id, count] of topCounts) {
      topObs.push(count);
      const qty = cardQty.get(id) ?? 1;
      topExp.push(ITERATIONS * qty / deckSize);
    }

    // Chi-square with per-card expected values
    let topChi2 = 0;
    for (let i = 0; i < topObs.length; i++) {
      topChi2 += ((topObs[i] - topExp[i]) ** 2) / topExp[i];
    }
    const topZ = Math.sqrt(2 * topChi2) - Math.sqrt(2 * topObs.length - 1);
    const topP = 0.5 * (1 + erf(topZ / Math.sqrt(2)));

    // Per-card σ
    let topMaxPos = 0, topMaxNeg = 0;
    const topOutliers: string[] = [];
    for (let i = 0; i < topObs.length; i++) {
      const stdDev = Math.sqrt(topExp[i]);
      const sigma = (topObs[i] - topExp[i]) / stdDev;
      if (sigma > topMaxPos) topMaxPos = sigma;
      if (sigma < topMaxNeg) topMaxNeg = sigma;
      if (Math.abs(sigma) > 3) {
        const id = Array.from(topCounts.keys())[i];
        topOutliers.push(`  "${id}": observed ${topObs[i]}, expected ${topExp[i].toFixed(1)}, ${sigma.toFixed(2)}σ`);
      }
    }

    console.log('Top card distribution (per-card expected by quantity):');
    console.log(`  ${labelResult(topP, topChi2, topObs.length - 1)}`);
    console.log(`  σ range: [${topMaxNeg.toFixed(2)}σ, +${topMaxPos.toFixed(2)}σ]`);
    if (topOutliers.length > 0) {
      console.log(`  Outliers (>3σ): ${topOutliers.length}`);
      for (const o of topOutliers.slice(0, 5)) console.log(o);
    }

    // Bottom card distribution
    const bottomObs: number[] = [];
    const bottomExp: number[] = [];
    for (const [id, count] of bottomCounts) {
      bottomObs.push(count);
      const qty = cardQty.get(id) ?? 1;
      bottomExp.push(ITERATIONS * qty / deckSize);
    }

    let bottomChi2 = 0;
    for (let i = 0; i < bottomObs.length; i++) {
      bottomChi2 += ((bottomObs[i] - bottomExp[i]) ** 2) / bottomExp[i];
    }
    const bottomZ = Math.sqrt(2 * bottomChi2) - Math.sqrt(2 * bottomObs.length - 1);
    const bottomP = 0.5 * (1 + erf(bottomZ / Math.sqrt(2)));

    let bottomMaxPos = 0, bottomMaxNeg = 0;
    const bottomOutliers: string[] = [];
    for (let i = 0; i < bottomObs.length; i++) {
      const stdDev = Math.sqrt(bottomExp[i]);
      const sigma = (bottomObs[i] - bottomExp[i]) / stdDev;
      if (sigma > bottomMaxPos) bottomMaxPos = sigma;
      if (sigma < bottomMaxNeg) bottomMaxNeg = sigma;
      if (Math.abs(sigma) > 3) {
        const id = Array.from(bottomCounts.keys())[i];
        bottomOutliers.push(`  "${id}": observed ${bottomObs[i]}, expected ${bottomExp[i].toFixed(1)}, ${sigma.toFixed(2)}σ`);
      }
    }

    console.log('\nBottom card distribution (per-card expected by quantity):');
    console.log(`  ${labelResult(bottomP, bottomChi2, bottomObs.length - 1)}`);
    console.log(`  σ range: [${bottomMaxNeg.toFixed(2)}σ, +${bottomMaxPos.toFixed(2)}σ]`);
    if (bottomOutliers.length > 0) {
      console.log(`  Outliers (>3σ): ${bottomOutliers.length}`);
      for (const o of bottomOutliers.slice(0, 5)) console.log(o);
    }

    // Quantity verification
    const multiQty = cards.filter((c) => c.quantity > 1);
    if (multiQty.length > 0) {
      console.log('\nQuantity verification:');
      for (const c of multiQty.slice(0, 10)) {
        const topFreq = topCounts.get(c.id) ?? 0;
        const expectedQty = ITERATIONS * c.quantity / deckSize;
        const ratio = topFreq / expectedQty;
        const status = ratio > 0.97 && ratio < 1.03 ? '✓' : '⚠️';
        console.log(`  ${status} "${c.name}" (qty ${c.quantity}): top freq ${topFreq}, expected ${expectedQty.toFixed(0)}, ratio ${ratio.toFixed(3)}`);
      }
    }
  }
}

// ── Phase 3: Discard Reshuffle ─────────────────────────────────────────────────

function runPhase3(): void {
  console.log(`\n=== Phase 3: Discard Reshuffle ===`);
  console.log(`Cycles: ${RESHUFFLE_CYCLES.toLocaleString()} | Deck: loot (sample)\n`);

  const lootCards = getCardsByType('Loot');
  const deckCards = buildDeckCards(lootCards, false);
  const uniqueCards = new Set(deckCards);
  const deckSize = deckCards.length;

  console.log(`Deck size: ${deckSize} (${uniqueCards.size} unique)\n`);

  // Simulate: draw all cards, discard all, reshuffle, repeat
  // Track which card lands on top after each reshuffle
  const reshuffleTopCounts = new Map<string, number>();
  for (const id of uniqueCards) reshuffleTopCounts.set(id, 0);

  let deck = [...deckCards];
  let discard: string[] = [];

  for (let cycle = 0; cycle < RESHUFFLE_CYCLES; cycle++) {
    // Draw all cards from deck
    while (deck.length > 0) {
      discard.push(deck.pop()!);
    }
    // Reshuffle discard into new deck
    deck = shuffle([...discard]);
    discard = [];
    // Record top card of new deck
    if (deck.length > 0) {
      const topCard = deck[deck.length - 1];
      reshuffleTopCounts.set(topCard, (reshuffleTopCounts.get(topCard) ?? 0) + 1);
    }
  }

  // Per-card expected based on quantity
  const lootCardQty = new Map<string, number>();
  for (const c of lootCards) {
    if (lootCardQty.has(c.id)) {
      lootCardQty.set(c.id, lootCardQty.get(c.id)! + c.quantity);
    } else {
      lootCardQty.set(c.id, c.quantity);
    }
  }

  const resObs: number[] = [];
  const resExp: number[] = [];
  for (const [id, count] of reshuffleTopCounts) {
    resObs.push(count);
    const qty = lootCardQty.get(id) ?? 1;
    resExp.push(RESHUFFLE_CYCLES * qty / deckSize);
  }

  let resChi2 = 0;
  for (let i = 0; i < resObs.length; i++) {
    resChi2 += ((resObs[i] - resExp[i]) ** 2) / resExp[i];
  }
  const resZ = Math.sqrt(2 * resChi2) - Math.sqrt(2 * resObs.length - 1);
  const resP = 0.5 * (1 + erf(resZ / Math.sqrt(2)));

  let resMaxPos = 0, resMaxNeg = 0;
  const resOutliers: string[] = [];
  for (let i = 0; i < resObs.length; i++) {
    const stdDev = Math.sqrt(resExp[i]);
    const sigma = (resObs[i] - resExp[i]) / stdDev;
    if (sigma > resMaxPos) resMaxPos = sigma;
    if (sigma < resMaxNeg) resMaxNeg = sigma;
    if (Math.abs(sigma) > 3) {
      const id = Array.from(reshuffleTopCounts.keys())[i];
      resOutliers.push(`  "${id}": observed ${resObs[i]}, expected ${resExp[i].toFixed(1)}, ${sigma.toFixed(2)}σ`);
    }
  }

  console.log('Top card after reshuffle (per-card expected by quantity):');
  console.log(`  ${labelResult(resP, resChi2, resObs.length - 1)}`);
  console.log(`  σ range: [${resMaxNeg.toFixed(2)}σ, +${resMaxPos.toFixed(2)}σ]`);
  if (resOutliers.length > 0) {
    console.log(`  Outliers (>3σ): ${resOutliers.length}`);
    for (const o of resOutliers.slice(0, 5)) console.log(o);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const deckFilter = args.includes('--deck') ? args[args.indexOf('--deck') + 1] : undefined;

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║          SHUFFLE BIAS AUDIT SCRIPT               ║');
  console.log('╚══════════════════════════════════════════════════╝');

  runPhase1();

  if (deckFilter) {
    runPhase2(deckFilter);
  } else {
    runPhase2();
  }

  runPhase3();

  console.log('\n=== AUDIT COMPLETE ===\n');
}

main();
