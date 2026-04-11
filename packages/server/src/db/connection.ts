import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DB_PATH } from '../config';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Try configured path first, fall back to local data dir for dev
  const dbPaths = [
    DB_PATH,
    path.resolve(process.cwd(), '../../data/cards.db'),
    path.resolve(process.cwd(), 'data/cards.db'),
  ];

  let dbPath: string | null = null;
  for (const p of dbPaths) {
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  }

  if (!dbPath) {
    console.warn(
      `Warning: No cards database found. Run 'make setup' or 'npm run scrape' first.\n` +
        `Searched: ${dbPaths.join(', ')}`
    );
    // Create an empty DB so the server can still start
    dbPath = DB_PATH;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  _db = new Database(dbPath, { readonly: false });

  // Ensure schema exists
  _db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT,
      image_url TEXT,
      local_image_path TEXT,
      card_type TEXT NOT NULL DEFAULT 'Unknown',
      sub_type TEXT DEFAULT '',
      set_name TEXT DEFAULT 'Unknown',
      hp INTEGER,
      atk INTEGER,
      evasion INTEGER,
      soul_value INTEGER NOT NULL DEFAULT 0,
      reward_text TEXT DEFAULT '',
      ability_text TEXT DEFAULT '',
      three_player_only INTEGER NOT NULL DEFAULT 0,
      is_eternal INTEGER NOT NULL DEFAULT 0,
      origin TEXT DEFAULT 'Unknown',
      print_status TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add print_status column if it doesn't exist (for existing DBs)
  const cols = (_db.prepare(`PRAGMA table_info(cards)`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('print_status')) {
    _db.exec(`ALTER TABLE cards ADD COLUMN print_status TEXT NOT NULL DEFAULT 'unknown'`);
  }

  return _db;
}
