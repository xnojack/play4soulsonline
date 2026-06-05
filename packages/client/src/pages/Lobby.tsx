import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore, GameMode } from '../store/gameStore';
import { connectSocket, getSocket } from '../socket/client';
import { Button } from '../components/ui/Button';
import { AttributionFooter } from '../components/ui/AttributionFooter';
import { HowToPlayModal } from '../components/ui/HowToPlayModal';
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
    if (!trimmed) return setErr('Please enter your display name');
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold text-fs-gold mb-1">Join Lobby</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-fs-parchment/40 text-sm">Room:</span>
            <span className="font-display text-fs-link-hover text-2xl tracking-widest font-bold">
              {roomId}
            </span>
          </div>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-400 text-sm">
            {err}
          </div>
        )}

        <div className="panel p-8 space-y-4">
          <div>
            <label className="block text-sm text-fs-parchment/60 mb-1.5 font-display">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name…"
              maxLength={32}
              autoFocus
              className="w-full bg-fs-darker border border-fs-link/30 rounded px-4 py-3 text-base text-fs-parchment placeholder-fs-parchment/30 focus:outline-none focus:border-fs-link"
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
  const [gameVariant, setGameVariant] = useState<'standard' | 'outside' | 'challenge'>('standard');
  const [challengeName, setChallengeName] = useState<string>('');
  const [challengeDifficulty, setChallengeDifficulty] = useState<'normal' | 'hard' | 'ultra'>('normal');
  const [excludeNeverPrinted, setExcludeNeverPrinted] = useState(true);
  const [priorityTimeoutSeconds, setPriorityTimeoutSeconds] = useState(30);
  const [gameMode, setGameMode] = useState<GameMode>('competitive');
  const [deckMode, setDeckMode] = useState<'balanced' | 'all' | 'custom'>('balanced');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const inRoom = game?.roomId === roomId;

  // Custom ratios state
  const [deckCategories, setDeckCategories] = useState<Record<string, Record<string, { count: number; unique: number }>> | null>(null);
  const [customRatios, setCustomRatios] = useState<{
    loot: Record<string, number>;
    monster: Record<string, number>;
    treasure: Record<string, number>;
  }>({ loot: {}, monster: {}, treasure: {} });
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    sets: true,
    loot: true,
    monster: true,
    treasure: true,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

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

  // Fetch deck categories when custom mode is selected or sets change
  useEffect(() => {
    if (deckMode !== 'custom') return;
    const params = new URLSearchParams();
    if (selectedSets && selectedSets.length > 0) params.set('sets', selectedSets.join(','));
    if (excludeNeverPrinted) params.set('excludeNeverPrinted', 'true');
    const queryString = params.toString();
    fetch(`${SERVER_URL}/api/deck-categories${queryString ? '?' + queryString : ''}`)
      .then((r) => r.json())
      .then((data) => {
        setDeckCategories(data);
        // Pre-fill with official balanced ratios if not already set
        if (Object.keys(customRatios.loot).length === 0) {
          setCustomRatios({
            loot: { Tarot: 23, Trinket: 11, Pill: 3, Rune: 3, ButterBean: 5, Bomb: 6, Battery: 6, DiceShard: 3, SoulHeart: 2, BlackHeart: 0, LostSoul: 1, Nickel: 6, Coin4: 12, Coin3: 11, Coin2: 6, Coin1: 2 },
            monster: { EpicBoss: 1, Boss: 30, BasicMonster: 30, CursedMonster: 9, HolyMonster: 9, GoodEvent: 8, BadEvent: 8, Curse: 5 },
            treasure: { Active: 40, Passive: 44, Paid: 10, OneUse: 5, Soul: 1 },
          });
        }
      })
      .catch(() => {
        setDeckCategories(null);
      });
  }, [deckMode, selectedSets, excludeNeverPrinted]);

  const handleRatioChange = (deck: 'loot' | 'monster' | 'treasure', category: string, value: number) => {
    setCustomRatios(prev => ({
      ...prev,
      [deck]: { ...(prev as any)[deck], [category]: Math.max(0, value) },
    }));
  };

  const handleMaxCategory = (deck: 'loot' | 'monster' | 'treasure', category: string) => {
    if (!deckCategories?.[deck]?.[category]) return;
    setCustomRatios(prev => ({
      ...prev,
      [deck]: { ...(prev as any)[deck], [category]: deckCategories[deck][category].count },
    }));
  };

  const handleLoadBalanced = () => {
    setCustomRatios({
      loot: { Tarot: 23, Trinket: 11, Pill: 3, Rune: 3, ButterBean: 5, Bomb: 6, Battery: 6, DiceShard: 3, SoulHeart: 2, BlackHeart: 0, LostSoul: 1, Nickel: 6, Coin4: 12, Coin3: 11, Coin2: 6, Coin1: 2 },
      monster: { EpicBoss: 1, Boss: 30, BasicMonster: 30, CursedMonster: 9, HolyMonster: 9, GoodEvent: 8, BadEvent: 8, Curse: 5 },
      treasure: { Active: 40, Passive: 44, Paid: 10, OneUse: 5, Soul: 1 },
    });
  };

  const handleMaxAll = () => {
    if (!deckCategories) return;
    const maxRatios: any = { loot: {}, monster: {}, treasure: {} };
    for (const deck of ['loot', 'monster', 'treasure']) {
      for (const [cat, info] of Object.entries(deckCategories[deck] || {})) {
        maxRatios[deck][cat] = info.count;
      }
    }
    setCustomRatios(maxRatios);
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStart = () => {
    setStarting(true);
    setStartError(null);
    const socket = getSocket();

    // Listen for game:error from the server
    const onErr = (payload: { message: string }) => {
      setStartError(payload.message);
      setStarting(false);
      socket.off('game:error', onErr);
      setTimeout(() => setStartError(null), 5000);
    };

    // Listen for game:state confirming the game started
    const onState = (state: { phase: string }) => {
      if (state.phase === 'active' || state.phase === 'eden_pick' || state.phase === 'sad_vote') {
        setStarting(false);
        socket.off('game:state', onState);
        socket.off('game:error', onErr);
      }
    };

    socket.on('game:error', onErr);
    socket.on('game:state', onState);

    socket.emit('action:start_game', {
      deckMode,
      activeSets: selectedSets ?? [],
      includeBonusSouls,
      bonusSoulCount,
      includeRooms,
      includeChallenges: gameVariant === 'challenge',
      includeOutside: gameVariant === 'outside',
      challengeName: gameVariant === 'challenge' ? challengeName || null : null,
      challengeDifficulty: gameVariant === 'challenge' ? challengeDifficulty : null,
      excludeNeverPrinted,
      priorityTimeoutMs: priorityTimeoutSeconds * 1000,
      gameMode,
      ...(deckMode === 'custom' ? { customRatios, allowDuplicates } : {}),
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl pb-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold text-fs-gold mb-1">Game Lobby</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-fs-parchment/40 text-sm">Room Code:</span>
            <span className="font-display text-fs-link-hover text-2xl tracking-widest font-bold">
              {roomId}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(roomId ?? '')}
              className="text-xs text-fs-parchment/30 hover:text-fs-link transition-colors"
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
          <div className="panel p-6 mb-4">
          <div className="section-title mb-3">Players ({nonSpectators.length}) <span className="text-xs text-fs-parchment/30 font-normal">(1&ndash;4+ players)</span></div>
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
                    <span className="text-xs text-fs-link/60">(host)</span>
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
        <div className="panel p-4 mb-4 text-center text-sm text-fs-parchment/50">
          Share the room code <span className="text-fs-link font-display tracking-widest">{roomId}</span>{' '}
          or send this link:{' '}
          <button
            onClick={() =>
              navigator.clipboard.writeText(window.location.href)
            }
            className="underline hover:text-fs-link transition-colors"
          >
            Copy lobby link
          </button>
          <span className="mx-2 text-fs-parchment/20">·</span>
          <button
            onClick={() => setHowToPlayOpen(true)}
            className="underline hover:text-fs-link transition-colors"
          >
            How to Play
          </button>
        </div>

        {/* Host settings */}
        {isHost && (
          <>
            {/* Quick Start — always visible */}
            <div className="panel p-6 mb-4">
              <div className="section-title mb-3">Deck Mode</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { value: 'balanced' as const, label: 'Balanced', desc: 'Official ratios' },
                  { value: 'all' as const, label: 'All Cards', desc: 'Every card' },
                  { value: 'custom' as const, label: 'Custom', desc: 'Set ratios manually' },
                ].map((m) => (
                  <label
                    key={m.value}
                    className={`cursor-pointer rounded-lg border-2 px-3 py-2 text-center transition-all ${
                      deckMode === m.value
                        ? 'border-fs-gold bg-fs-gold/10 shadow-sm'
                        : 'border-fs-gold/10 bg-fs-darker/50 hover:border-fs-gold/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deckMode"
                      value={m.value}
                      checked={deckMode === m.value}
                      onChange={() => setDeckMode(m.value)}
                      className="sr-only"
                    />
                    <div className={`text-sm font-medium ${deckMode === m.value ? 'text-fs-gold' : 'text-fs-parchment/80'}`}>
                      {m.label}
                    </div>
                    <div className="text-[10px] text-fs-parchment/40 mt-0.5">{m.desc}</div>
                  </label>
                ))}
              </div>

              {/* Game mode selector */}
              <div className="text-xs text-fs-parchment/60 mb-2 font-medium">Game Mode</div>
              <div className="flex gap-2">
                {[
                  { value: 'competitive' as GameMode, label: 'Competitive', desc: 'Normal multiplayer' },
                  { value: 'solitaire' as GameMode, label: 'Solitaire', desc: '1 player, 2 characters, D8 timer' },
                  { value: 'coop' as GameMode, label: 'Co-op', desc: '2 players, shared souls, D8 timer' },
                ].map((m) => {
                  const disabled = m.value === 'solitaire' && nonSpectators.length > 1
                    || m.value === 'coop' && nonSpectators.length < 2;
                  return (
                    <label
                      key={m.value}
                      className={`flex-1 cursor-pointer rounded-lg border-2 px-3 py-2 text-center transition-all ${
                        disabled
                          ? 'border-fs-gold/5 bg-fs-darker/30 opacity-40 cursor-not-allowed'
                          : gameMode === m.value
                          ? 'border-fs-gold bg-fs-gold/10 shadow-sm'
                          : 'border-fs-gold/10 bg-fs-darker/50 hover:border-fs-gold/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gameMode"
                        value={m.value}
                        checked={gameMode === m.value}
                        onChange={() => !disabled && setGameMode(m.value)}
                        disabled={disabled}
                        className="sr-only"
                      />
                      <div className={`text-sm font-medium ${gameMode === m.value ? 'text-fs-gold' : 'text-fs-parchment/80'}`}>
                        {m.label}
                      </div>
                      <div className="text-[10px] text-fs-parchment/40 mt-0.5">{m.desc}</div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Advanced Settings — collapsible */}
            <div className="panel mb-4">
              <button
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-fs-darker/30 transition-colors"
              >
                <span className="text-sm font-medium text-fs-gold">Advanced Settings</span>
                <span className={`text-xs text-fs-parchment/40 transition-transform ${advancedOpen ? 'rotate-90' : ''}`}>▶</span>
              </button>
              {advancedOpen && (
                <div className="px-6 pb-6 space-y-4">
                  {/* Card Sets */}
                  <div className="border border-fs-gold/10 rounded-lg">
                    <button
                      onClick={() => setCollapsedSections(prev => ({ ...prev, sets: !prev.sets }))}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-fs-darker/30 transition-colors"
                    >
                      <span className="text-sm font-medium text-fs-gold">Card Sets</span>
                      <span className={`text-xs text-fs-parchment/40 transition-transform ${collapsedSections.sets ? '' : 'rotate-90'}`}>▶</span>
                    </button>
                    {!collapsedSections.sets && (
                      <div className="px-3 pb-2">
                        <div className="flex gap-2 mb-2">
                          <button onClick={handleSelectAll} className="text-xs text-fs-parchment/50 hover:text-fs-link transition-colors">All</button>
                          <button onClick={handleSelectNone} className="text-xs text-fs-parchment/50 hover:text-fs-link transition-colors">None</button>
                        </div>
                        {availableSets.length === 0 ? (
                          <div className="text-xs text-fs-parchment/30 italic">Loading sets…</div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {availableSets.map((set) => (
                              <label key={set} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(selectedSets ?? []).includes(set)}
                                  onChange={() => handleToggleSet(set)}
                                  className="accent-fs-gold flex-shrink-0"
                                />
                                <span className="text-xs text-fs-parchment/70 truncate">{set}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom Ratios — only shown when custom mode is selected */}
                  {deckMode === 'custom' && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="section-title">Custom Ratios</div>
                        <div className="flex gap-2">
                          <button onClick={handleLoadBalanced} className="text-xs text-fs-parchment/50 hover:text-fs-link transition-colors">Balanced</button>
                          <button onClick={handleMaxAll} className="text-xs text-fs-parchment/50 hover:text-fs-link transition-colors">Max All</button>
                        </div>
                      </div>

                      {/* Ratio sections */}
                      {deckCategories ? (
                        <div className="space-y-2 mb-3">
                          {(['loot', 'monster', 'treasure'] as const).map(deck => (
                            <div key={deck} className="border border-fs-gold/10 rounded-lg">
                              <button
                                onClick={() => toggleSection(deck)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-fs-darker/30 transition-colors"
                              >
                                <span className="text-sm font-medium text-fs-gold capitalize">{deck} Deck</span>
                                <span className={`text-xs text-fs-parchment/40 transition-transform ${collapsedSections[deck] ? '' : 'rotate-90'}`}>▶</span>
                              </button>
                              {!collapsedSections[deck] && (
                                <div className="px-3 pb-2 space-y-1">
                                  {Object.entries(deckCategories[deck]).map(([cat, info]) => (
                                    <div key={cat} className="flex items-center gap-2">
                                      <span className="text-xs text-fs-parchment/60 flex-1 truncate">{cat}</span>
                                      <input
                                        type="number"
                                        value={customRatios[deck][cat] ?? 0}
                                        onChange={(e) => handleRatioChange(deck, cat, parseInt(e.target.value, 10) || 0)}
                                        className="w-16 bg-fs-darker border border-fs-gold/20 rounded px-2 py-1 text-xs text-fs-parchment focus:outline-none focus:border-fs-gold"
                                        min="0"
                                      />
                                      <span className="text-[10px] text-fs-parchment/30">/ {info.count}</span>
                                      <button
                                        onClick={() => handleMaxCategory(deck, cat)}
                                        className="text-[10px] text-fs-parchment/40 hover:text-fs-link transition-colors"
                                      >
                                        Max
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-fs-parchment/30 italic mb-3">Loading categories…</div>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={allowDuplicates}
                          onChange={(e) => setAllowDuplicates(e.target.checked)}
                          className="accent-fs-gold"
                        />
                        <span className="text-xs text-fs-parchment/60">Allow duplicates (copy cards when target exceeds available)</span>
                      </label>
                    </>
                  )}

                  {/* Bonus Souls + Room Deck */}
                  <div className="flex gap-4 flex-wrap items-center">
                    {gameMode === 'competitive' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeBonusSouls}
                          onChange={(e) => setIncludeBonusSouls(e.target.checked)}
                          className="accent-fs-gold"
                        />
                        <span className="text-sm text-fs-parchment/80">Bonus Souls</span>
                      </label>
                    )}
                    {includeBonusSouls && gameMode === 'competitive' && (
                      <label className="flex items-center gap-1.5">
                        <span className="text-xs text-fs-parchment/60">Count:</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={bonusSoulCount}
                          onChange={(e) => setBonusSoulCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                          className="w-14 bg-fs-darker border border-fs-link/30 rounded px-2 py-1 text-fs-parchment text-sm focus:outline-none focus:border-fs-link"
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
                  </div>

                  {/* Variant selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-fs-parchment/80">Variant:</span>
                    <div className="flex gap-1">
                      {[
                        { value: 'standard', label: 'Standard' },
                        { value: 'outside', label: 'Outside' },
                        { value: 'challenge', label: 'Challenge' },
                      ].map((v) => (
                        <button
                          key={v.value}
                          onClick={() => setGameVariant(v.value as 'standard' | 'outside' | 'challenge')}
                          className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                            gameVariant === v.value
                              ? 'bg-fs-gold/20 border border-fs-gold text-fs-gold'
                              : 'bg-fs-darker/50 border border-fs-gold/10 text-fs-parchment/60 hover:border-fs-gold/30 hover:text-fs-parchment/80'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Challenge picker */}
                  {gameVariant === 'challenge' && (
                    <>
                      <div className="flex flex-col gap-2 w-full">
                        <span className="text-sm text-fs-parchment/80">Challenge:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: '', label: 'Random' },
                            { value: "Resurrection Day", label: 'Resurrection Day' },
                            { value: "Greed's Gamble", label: "Greed's Gamble" },
                            { value: 'Masquerade', label: 'Masquerade' },
                            { value: 'Delirious', label: 'Delirious' },
                            { value: 'Lord of the Flies', label: 'Lord of the Flies' },
                            { value: 'Trick/Treat', label: 'Trick/Treat' },
                            { value: "Fatty's Feast", label: "Fatty's Feast" },
                            { value: 'How the Krampus Stole Christmas', label: 'Krampus' },
                            { value: 'Live, Laugh, Lust', label: 'Live, Laugh, Lust' },
                            { value: 'Day of the Doodler', label: 'Day of the Doodler' },
                            { value: 'Motherly Love', label: 'Motherly Love' },
                            { value: 'Stomping Ground', label: 'Stomping Ground' },
                          ].map((c) => (
                            <button
                              key={c.value}
                              onClick={() => setChallengeName(c.value)}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                challengeName === c.value
                                  ? 'bg-purple-900/40 border border-purple-500 text-purple-300'
                                  : 'bg-fs-darker/50 border border-fs-gold/10 text-fs-parchment/50 hover:border-fs-gold/30 hover:text-fs-parchment/80'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-fs-parchment/80">Difficulty:</span>
                        <div className="flex gap-1">
                          {[
                            { value: 'normal', label: 'Normal' },
                            { value: 'hard', label: 'Hard' },
                            { value: 'ultra', label: 'Ultra' },
                          ].map((d) => (
                            <button
                              key={d.value}
                              onClick={() => setChallengeDifficulty(d.value as 'normal' | 'hard' | 'ultra')}
                              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                challengeDifficulty === d.value
                                  ? d.value === 'normal'
                                    ? 'bg-green-900/40 border border-green-500 text-green-300'
                                    : d.value === 'hard'
                                    ? 'bg-orange-900/40 border border-orange-500 text-orange-300'
                                    : 'bg-red-900/40 border border-red-500 text-red-300'
                                  : 'bg-fs-darker/50 border border-fs-gold/10 text-fs-parchment/50 hover:border-fs-gold/30 hover:text-fs-parchment/80'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Exclude unreleased + Priority timeout */}
                  <div className="flex gap-4 flex-wrap items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeNeverPrinted}
                        onChange={(e) => setExcludeNeverPrinted(e.target.checked)}
                        className="accent-fs-gold"
                      />
                      <span className="text-sm text-fs-parchment/80 flex items-center gap-1">
                        Exclude unreleased cards
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-fs-parchment/10 text-fs-parchment/40 text-[10px] font-bold cursor-help" title="Cards that haven't been physically printed in a product yet">?</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-xs text-fs-parchment/60">Priority timeout (s, 0 = off):</span>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={priorityTimeoutSeconds}
                        onChange={(e) => setPriorityTimeoutSeconds(Math.max(0, Math.min(120, Number(e.target.value))))}
                        className="w-16 bg-fs-darker border border-fs-link/30 rounded px-2 py-1 text-fs-parchment text-sm focus:outline-none focus:border-fs-link"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Start button */}
        {isHost ? (
          <>
            {startError && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2 text-sm text-red-300 text-center mb-2">
                {startError}
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={handleStart}
              disabled={starting || nonSpectators.length < 1}
            >
              {starting ? 'Starting…' : 'Start Game'}
            </Button>
          </>
        ) : (
          <div className="text-center text-fs-parchment/50 text-sm panel p-5">
            Waiting for the host to start the game…
          </div>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 py-2 px-4 bg-black/60 backdrop-blur-sm border-t border-fs-gold/10">
        <AttributionFooter compact />
      </div>

      <HowToPlayModal isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
    </div>
  );
}
