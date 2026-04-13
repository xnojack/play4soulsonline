import { getDb } from './connection';
import { Card, CardType } from '../game/types';

interface DbRow {
  id: string;
  name: string;
  source_url: string;
  image_url: string;
  local_image_path: string;
  card_type: string;
  sub_type: string;
  set_name: string;
  hp: number | null;
  atk: number | null;
  evasion: number | null;
  soul_value: number;
  reward_text: string;
  ability_text: string;
  three_player_only: number;
  is_eternal: number;
  origin: string;
  print_status: string;
  starting_item_id: string | null;
  back_image_url: string | null;
  back_local_image_path: string | null;
  flip_side_name: string | null;
}

function rowToCard(row: DbRow): Card {
  // Prefer the local back image path (served as /cards/{id}_back.png); fall back to remote URL
  const backImageUrl = row.back_local_image_path
    ? `/cards/${row.id}_back.png`
    : row.back_image_url ?? null;
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.local_image_path || `/cards/${row.id}.png`,
    localImagePath: row.local_image_path || `/cards/${row.id}.png`,
    cardType: (row.card_type as CardType) || 'Unknown',
    subType: row.sub_type || '',
    set: row.set_name || 'Unknown',
    hp: row.hp,
    atk: row.atk,
    evasion: row.evasion,
    soulValue: row.soul_value || 0,
    rewardText: row.reward_text || '',
    abilityText: row.ability_text || '',
    threePlayerOnly: row.three_player_only === 1,
    isEternal: row.is_eternal === 1,
    origin: row.origin || 'Unknown',
    printStatus: row.print_status || 'unknown',
    startingItemId: row.starting_item_id ?? null,
    backImageUrl,
    flipSideName: row.flip_side_name ?? null,
  };
}

export function getCardById(id: string): Card | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as DbRow | undefined;
  return row ? rowToCard(row) : null;
}

export function getCardsByIds(ids: string[]): Card[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`)
    .all(...ids) as DbRow[];
  const map = new Map(rows.map((r) => [r.id, rowToCard(r)]));
  // Preserve order
  return ids.map((id) => map.get(id)).filter(Boolean) as Card[];
}

export function getCardsByType(cardType: string): Card[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM cards WHERE card_type = ?')
    .all(cardType) as DbRow[];
  return rows.map(rowToCard);
}

export function getCardsBySet(setName: string): Card[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM cards WHERE set_name = ?')
    .all(setName) as DbRow[];
  return rows.map(rowToCard);
}

export function getAllSets(): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT DISTINCT set_name FROM cards ORDER BY set_name')
    .all() as { set_name: string }[];
  return rows.map((r) => r.set_name).filter(Boolean);
}

export function searchCards(params: {
  query?: string;
  cardType?: string;
  setName?: string;
  threePlayerOnly?: boolean;
  limit?: number;
  offset?: number;
}): { cards: Card[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.query) {
    conditions.push('(name LIKE ? OR ability_text LIKE ?)');
    values.push(`%${params.query}%`, `%${params.query}%`);
  }
  if (params.cardType) {
    conditions.push('card_type = ?');
    values.push(params.cardType);
  }
  if (params.setName) {
    conditions.push('set_name = ?');
    values.push(params.setName);
  }
  if (params.threePlayerOnly !== undefined) {
    conditions.push('three_player_only = ?');
    values.push(params.threePlayerOnly ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM cards ${where}`).get(...values) as {
      count: number;
    }
  ).count;

  const rows = db
    .prepare(`SELECT * FROM cards ${where} ORDER BY name LIMIT ? OFFSET ?`)
    .all(...values, limit, offset) as DbRow[];

  return { cards: rows.map(rowToCard), total };
}

export function getCardsByTypeAndSets(cardType: string, sets: string[]): Card[] {
  if (sets.length === 0) {
    return getCardsByType(cardType);
  }
  const db = getDb();
  const placeholders = sets.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM cards WHERE card_type = ? AND set_name IN (${placeholders})`
    )
    .all(cardType, ...sets) as DbRow[];
  return rows.map(rowToCard);
}
