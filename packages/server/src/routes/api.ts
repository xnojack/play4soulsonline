import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { gameStore } from '../game/GameStore';
import { generateRoomCode } from '../game/RoomCode';
import { getAllSets, searchCards } from '../db/cards';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Rate limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Stricter limiter for room creation to prevent abuse
const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 5,                // 5 room creations per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many room creation requests' },
});

router.use(apiLimiter);

/** Create a new game room */
router.post('/rooms', createRoomLimiter, (req: Request, res: Response) => {
  if (!gameStore.canCreate()) {
    return res.status(503).json({ error: 'Server is at maximum room capacity' });
  }

  const hostPlayerId = uuidv4();
  const roomId = generateRoomCode();
  gameStore.create(roomId, hostPlayerId);

  return res.json({ roomId, hostPlayerId });
});

/** Get room info */
router.get('/rooms/:roomId', (req: Request, res: Response) => {
  const room = gameStore.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const state = room.getState();
  return res.json({
    roomId: state.roomId,
    phase: state.phase,
    playerCount: state.players.filter((p) => !p.isSpectator).length,
    spectatorCount: state.players.filter((p) => p.isSpectator).length,
    activeSets: state.activeSets,
  });
});

/** List all rooms */
// Removed: this endpoint publicly exposed all active room codes.

/** Get all available card sets */
router.get('/sets', (_req: Request, res: Response) => {
  const sets = getAllSets();
  return res.json({ sets });
});

/** Card search endpoint */
router.get('/cards', (req: Request, res: Response) => {
  const {
    q,
    type,
    set,
    limit = '50',
    offset = '0',
  } = req.query as Record<string, string>;

  const result = searchCards({
    query: q,
    cardType: type,
    setName: set,
    limit: Math.min(200, Math.max(0, parseInt(limit, 10) || 50)),
    offset: Math.max(0, parseInt(offset, 10) || 0),
  });

  return res.json(result);
});

/** Get a specific card */
router.get('/cards/:id', (req: Request, res: Response) => {
  const { getCardById } = require('../db/cards');
  const card = getCardById(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  return res.json(card);
});

export default router;
