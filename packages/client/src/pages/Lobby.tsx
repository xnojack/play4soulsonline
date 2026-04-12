import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { connectSocket, getSocket } from '../socket/client';
import { Button } from '../components/ui/Button';
import { AttributionFooter } from '../components/ui/AttributionFooter';
import { useIsHost } from '../hooks/useMyPlayer';
import { SERVER_URL } from '../config';

/** Join the room via socket, returns an error string or null on success */
function emitJoin(
  roomId: string,
  name: string,
  asSpectator: boolean,
  onSuccess: () => void,
  onError: (msg: string) => void,
  reconnectToken?: string
) {
  const socket = connectSocket();

  const doJoin = () => {
    // Listen for game:state confirming we're in the room
    const onState = (state: { roomId: string; phase: string }) => {
      if (state.roomId === roomId) {
        socket.off('game:state', onState);
        socket.off('game:error', onErr);
        onSuccess();
      }
    };
    const onErr = (payload: { message: string }) => {
      socket.off('game:state', onState);
      socket.off('game:error', onErr);
      onError(payload.message);
    };

    socket.on('game:state', onState);
    socket.on('game:error', onErr);

    socket.emit('action:join', { roomId, name, asSpectator, reconnectToken });

    // Timeout guard
    setTimeout(() => {
      socket.off('game:state', onState);
      socket.off('game:error', onErr);
      onError('No response from server — check the room code and try again.');
    }, 6000);
  };

  if (socket.connected) {
    doJoin();
  } else {
    socket.once('connect', doJoin);
  }
}

// ─── Join form shown when we arrive without an active session ──────────────────

interface JoinFormProps {
  roomId: string;
  onJoined: () => void;
}

function JoinForm({ roomId, onJoined }: JoinFormProps) {
  const { setRoomId, setPlayerName } = useGameStore();
  const [name, setName] = useState(
    () => sessionStorage.getItem('fs_player_name') ?? ''
  );
  const [asSpectator, setAsSpectator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) return setErr('Enter your name');
    setLoading(true);
    setErr(null);

    emitJoin(
      roomId,
      trimmed,
      asSpectator,
      () => {
        setRoomId(roomId);
        setPlayerName(trimmed);
        sessionStorage.setItem('fs_player_name', trimmed);
        sessionStorage.setItem('fs_room_id', roomId);
        setLoading(false);
        onJoined();
      },
      (msg) => {
        setErr(msg);
        setLoading(false);
      },
      sessionStorage.getItem('fs_reconnect_token') ?? undefined
    );
  };

  return (
    <div className="min-h-screen bg-fs-darker flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold text-fs-gold mb-1">Join Lobby</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-fs-parchment/40 text-sm">Room:</span>
            <span className="font-display text-fs-gold-light text-xl tracking-widest font-bold">
              {roomId}
            </span>
          </div>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-400 text-sm">
            {err}
          </div>
        )}

        <div className="panel p-6 space-y-4">
          <div>
            <label className="block text-xs text-fs-parchment/60 mb-1 font-display">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name…"
              maxLength={32}
              autoFocus
              className="w-full bg-fs-darker border border-fs-gold/30 rounded px-3 py-2 text-fs-parchment placeholder-fs-parchment/30 focus:outline-none focus:border-fs-gold"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={asSpectator}
              onChange={(e) => setAsSpectator(e.target.checked)}
              className="accent-fs-gold"
            />
            <span className="text-sm text-fs-parchment/70">Join as spectator</span>
          </label>

          <Button className="w-full" onClick={handleJoin} disabled={loading}>
            {loading ? 'Joining…' : 'Join Room'}
          </Button>

          <a
            href="/"
            className="block text-center text-xs text-fs-parchment/40 hover:text-fs-parchment transition-colors"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Lobby page ────────────────────────────────────────────────────────────────

export function Lobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game);
  const error = useGameStore((s) => s.error);
  const isHost = useIsHost();

  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[] | null>(null); // null = not yet loaded
  const [includeBonusSouls, setIncludeBonusSouls] = useState(true);
  const [bonusSoulCount, setBonusSoulCount] = useState(3);
  const [includeRooms, setIncludeRooms] = useState(true);
  const [excludeNeverPrinted, setExcludeNeverPrinted] = useState(true);
  const [starting, setStarting] = useState(false);
  const inRoom = game?.roomId === roomId;

  // Fetch available sets from server and default to all selected
  useEffect(() => {
    fetch(`${SERVER_URL}/api/sets`)
      .then((r) => r.json())
      .then((data: { sets: string[] }) => {
        const sets = data.sets.filter(Boolean);
        setAvailableSets(sets);
        // Default: all sets selected
        if (selectedSets === null) setSelectedSets(sets);
      })
      .catch(() => {
        // Fallback to known sets if fetch fails
        const fallback = ['Base Game V2', 'Requiem', 'Gold Box V2', 'Four Souls+ V2', 'Summer of Isaac', '10th Anniversary', 'Alt Art'];
        setAvailableSets(fallback);
        if (selectedSets === null) setSelectedSets(fallback);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If game has started (or is in eden_pick phase), go to game
  useEffect(() => {
    if ((game?.phase === 'active' || game?.phase === 'eden_pick' || game?.phase === 'sad_vote') && game.roomId === roomId) {
      navigate(`/game/${game.roomId}`);
    }
  }, [game?.phase, game?.roomId, navigate, roomId]);

  // Auto-rejoin on reconnect if we have session data and aren't in room yet
  useEffect(() => {
    if (inRoom) return;
    const savedRoom = sessionStorage.getItem('fs_room_id');
    const savedName = sessionStorage.getItem('fs_player_name');
    const savedToken = sessionStorage.getItem('fs_reconnect_token') ?? undefined;
    if (savedRoom === roomId && savedName) {
      emitJoin(roomId!, savedName, false, () => {}, () => {}, savedToken);
    }
  }, [inRoom, roomId]);

  const handleToggleSet = (set: string) => {
    setSelectedSets((prev) =>
      (prev ?? []).includes(set) ? (prev ?? []).filter((s) => s !== set) : [...(prev ?? []), set]
    );
  };

  const handleSelectAll = () => setSelectedSets([...availableSets]);
  const handleSelectNone = () => setSelectedSets([]);

  const handleStart = () => {
    setStarting(true);
    getSocket().emit('action:start_game', {
      activeSets: selectedSets ?? [],
      includeBonusSouls,
      bonusSoulCount,
      includeRooms,
      excludeNeverPrinted,
    });
  };

  // Not yet in this room → show join form
  if (!inRoom) {
    return (
      <JoinForm
        roomId={roomId!}
        onJoined={() => {
          // state will arrive via socket and re-render with inRoom = true
        }}
      />
    );
  }

  const players = game?.players ?? [];
  const nonSpectators = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

  return (
    <div className="min-h-screen bg-fs-darker flex items-center justify-center p-4">
      <div className="w-full max-w-xl pb-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold text-fs-gold mb-1">Game Lobby</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-fs-parchment/40 text-sm">Room Code:</span>
            <span className="font-display text-fs-gold-light text-xl tracking-widest font-bold">
              {roomId}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(roomId ?? '')}
              className="text-xs text-fs-parchment/30 hover:text-fs-parchment transition-colors"
              title="Copy room code"
            >
              Copy
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Players */}
        <div className="panel p-4 mb-4">
          <div className="section-title mb-3">Players ({nonSpectators.length})</div>
          {nonSpectators.length === 0 ? (
            <div className="text-fs-parchment/30 text-sm italic">Waiting for players…</div>
          ) : (
            <div className="space-y-2">
              {nonSpectators.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${p.connected ? 'bg-green-500' : 'bg-yellow-600'}`}
                  />
                  <span className="text-fs-parchment">{p.name}</span>
                  {p.id === game?.hostPlayerId && (
                    <span className="text-xs text-fs-gold/60">(host)</span>
                  )}
                  {!p.connected && (
                    <span className="text-xs text-yellow-600/70">disconnected</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {spectators.length > 0 && (
            <>
              <div className="section-title mt-3 mb-2">Spectators ({spectators.length})</div>
              <div className="space-y-1">
                {spectators.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                    <span className="text-fs-parchment/60 text-sm">{p.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Invite hint */}
        <div className="panel p-3 mb-4 text-center text-xs text-fs-parchment/40">
          Share the room code <span className="text-fs-gold font-display tracking-widest">{roomId}</span>{' '}
          or send this link:{' '}
          <button
            onClick={() =>
              navigator.clipboard.writeText(window.location.href)
            }
            className="underline hover:text-fs-parchment transition-colors"
          >
            Copy lobby link
          </button>
        </div>

        {/* Card sets (host only) */}
        {isHost && (
          <div className="panel p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="section-title">Card Sets</div>
              <div className="flex gap-2">
                <button onClick={handleSelectAll} className="text-xs text-fs-parchment/50 hover:text-fs-parchment transition-colors">All</button>
                <button onClick={handleSelectNone} className="text-xs text-fs-parchment/50 hover:text-fs-parchment transition-colors">None</button>
              </div>
            </div>
            {availableSets.length === 0 ? (
              <div className="text-xs text-fs-parchment/30 italic">Loading sets…</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-56 overflow-y-auto pr-1">
                {availableSets.map((set) => (
                  <label key={set} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(selectedSets ?? []).includes(set)}
                      onChange={() => handleToggleSet(set)}
                      className="accent-fs-gold flex-shrink-0"
                    />
                    <span className="text-sm text-fs-parchment/80 truncate">{set}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-4 flex-wrap items-center border-t border-fs-gold/10 pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBonusSouls}
                  onChange={(e) => setIncludeBonusSouls(e.target.checked)}
                  className="accent-fs-gold"
                />
                <span className="text-sm text-fs-parchment/80">Bonus Souls</span>
              </label>
              {includeBonusSouls && (
                <label className="flex items-center gap-1.5">
                  <span className="text-xs text-fs-parchment/60">Count:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={bonusSoulCount}
                    onChange={(e) => setBonusSoulCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                    className="w-14 bg-fs-darker border border-fs-gold/30 rounded px-2 py-0.5 text-fs-parchment text-sm focus:outline-none focus:border-fs-gold"
                  />
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRooms}
                  onChange={(e) => setIncludeRooms(e.target.checked)}
                  className="accent-fs-gold"
                />
                <span className="text-sm text-fs-parchment/80">Room Deck</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeNeverPrinted}
                  onChange={(e) => setExcludeNeverPrinted(e.target.checked)}
                  className="accent-fs-gold"
                />
                <span className="text-sm text-fs-parchment/80">Exclude Unprinted Cards</span>
              </label>
            </div>
          </div>
        )}

        {/* Start button */}
        {isHost ? (
          <Button
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={starting || nonSpectators.length < 1}
          >
            {starting ? 'Starting…' : 'Start Game'}
          </Button>
        ) : (
          <div className="text-center text-fs-parchment/40 text-sm panel p-4">
            Waiting for the host to start the game…
          </div>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 py-2 px-4 bg-fs-darker/80 backdrop-blur-sm border-t border-fs-gold/10">
        <AttributionFooter compact />
      </div>
    </div>
  );
}
