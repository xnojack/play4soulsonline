import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ScrapedCard } from './types';

export function seedDatabase(cards: ScrapedCard[], dbPath: string): void {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT,
      image_url TEXT,
      local_image_path TEXT,
      card_type TEXT NOT NULL,
      sub_type TEXT,
      set_name TEXT,
      hp INTEGER,
      atk INTEGER,
      evasion INTEGER,
      soul_value INTEGER NOT NULL DEFAULT 0,
      reward_text TEXT,
      ability_text TEXT,
      three_player_only INTEGER NOT NULL DEFAULT 0,
      is_eternal INTEGER NOT NULL DEFAULT 0,
      origin TEXT,
      print_status TEXT NOT NULL DEFAULT 'unknown',
      starting_item_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations — safe to re-run; each is a no-op if the column already exists
  const migrations = [
    `ALTER TABLE cards ADD COLUMN starting_item_id TEXT;`,
    `ALTER TABLE cards ADD COLUMN back_image_url TEXT;`,
    `ALTER TABLE cards ADD COLUMN back_local_image_path TEXT;`,
    `ALTER TABLE cards ADD COLUMN flip_side_name TEXT;`,
    `ALTER TABLE cards ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO cards (
      id, name, source_url, image_url, local_image_path,
      card_type, sub_type, set_name, hp, atk, evasion,
      soul_value, reward_text, ability_text,
      three_player_only, is_eternal, origin, print_status, starting_item_id,
      back_image_url, back_local_image_path, flip_side_name, quantity
    ) VALUES (
      @id, @name, @sourceUrl, @imageUrl, @localImagePath,
      @cardType, @subType, @set, @hp, @atk, @evasion,
      @soulValue, @rewardText, @abilityText,
      @threePlayerOnly, @isEternal, @origin, @printStatus, @startingItemId,
      @backImageUrl, @backLocalImagePath, @flipSideName, @quantity
    )
  `);

  const insertMany = db.transaction((cards: ScrapedCard[]) => {
    for (const card of cards) {
      insert.run({
        id: card.id,
        name: card.name,
        sourceUrl: card.sourceUrl,
        imageUrl: card.imageUrl,
        localImagePath: card.localImagePath,
        cardType: card.cardType,
        subType: card.subType,
        set: card.set,
        hp: card.hp,
        atk: card.atk,
        evasion: card.evasion,
        soulValue: card.soulValue,
        rewardText: card.rewardText,
        abilityText: card.abilityText,
        threePlayerOnly: card.threePlayerOnly ? 1 : 0,
        isEternal: card.isEternal ? 1 : 0,
        origin: card.origin,
        printStatus: card.printStatus ?? 'unknown',
        startingItemId: card.startingItemId ?? null,
        backImageUrl: card.backImageUrl ?? null,
        backLocalImagePath: card.backLocalImagePath ?? null,
        flipSideName: card.flipSideName ?? null,
        quantity: card.quantity ?? 1,
      });
    }
  });

  insertMany(cards);

  const count = (db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number })
    .count;
  console.log(`  Seeded ${count} cards into ${dbPath}`);

  db.close();
}

export function writeJson(cards: ScrapedCard[], jsonPath: string): void {
  const dir = path.dirname(jsonPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(cards, null, 2), 'utf-8');
  console.log(`  Wrote ${cards.length} cards to ${jsonPath}`);
}
