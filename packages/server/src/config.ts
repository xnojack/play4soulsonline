export const PORT = parseInt(process.env.PORT || '3001', 10);
export const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '10', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DATA_DIR = process.env.DATA_DIR || '/app/data';
export const DB_PATH = `${DATA_DIR}/cards.db`;
export const CARDS_DIR = `${DATA_DIR}/cards`;
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || false as string | false;

// Default game setup
export const DEFAULT_SHOP_SLOTS = 2;
export const DEFAULT_MONSTER_SLOTS = 2;
export const DEFAULT_COIN_POOL = 100;
export const DEFAULT_STARTING_COINS = 3;
export const DEFAULT_STARTING_LOOT = 3;
export const WINNING_SOUL_VALUE = 4;

// Room cleanup timeouts (milliseconds)
// A room is cleaned up when all non-spectator players disconnect, or immediately
// after the game ends, using the phase-appropriate delay below.
// ROOM_TIMEOUT_CREATED_MS applies to rooms where nobody has ever joined (host
// closed the tab before entering the lobby).
export const ROOM_TIMEOUT_LOBBY_MS   = parseInt(process.env.ROOM_TIMEOUT_LOBBY_MS   || '300000',  10); // 5 min
export const ROOM_TIMEOUT_ACTIVE_MS  = parseInt(process.env.ROOM_TIMEOUT_ACTIVE_MS  || '1800000', 10); // 30 min
export const ROOM_TIMEOUT_ENDED_MS   = parseInt(process.env.ROOM_TIMEOUT_ENDED_MS   || '600000',  10); // 10 min
export const ROOM_TIMEOUT_CREATED_MS = parseInt(process.env.ROOM_TIMEOUT_CREATED_MS || '1800000', 10); // 30 min
