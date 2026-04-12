import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { PORT, NODE_ENV, ALLOWED_ORIGIN, DATA_DIR } from './config';
import apiRouter from './routes/api';
import { registerHandlers } from './socket/handlers';
import { getDb } from './db/connection';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN || false,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 50 * 1024, // 50 KB — prevent oversized payloads
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN || false }));
app.use(express.json());

// ─── Static files (card images) ───────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use('/cards', express.static(path.join(publicDir, 'cards')));

// Also serve from data/cards — DATA_DIR defaults to /app/data (absolute path)
app.use('/cards', express.static(path.join(DATA_DIR, 'cards')));

// ─── REST API ─────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: NODE_ENV });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  if (NODE_ENV === 'development') {
    console.log(`Socket connected: ${socket.id}`);
  }
  registerHandlers(io, socket);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function main() {
  // Initialize DB connection (will warn if no cards DB found)
  try {
    getDb();
    console.log('Database connected.');
  } catch (err) {
    console.warn('Database warning:', err);
  }

  httpServer.listen(PORT, () => {
    console.log(`Four Souls server running on port ${PORT} (${NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
