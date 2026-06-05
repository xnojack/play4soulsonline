import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useGameStore } from '../store/gameStore';
import { connectSocket, getSocket } from '../socket/client';
import { AttributionFooter } from '../components/ui/AttributionFooter';

export function Home() {
  const navigate = useNavigate();
  const { setRoomId, setPlayerName, setError, error } = useGameStore();

  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [asSpectator, setAsSpectator] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    setMode(null);
    setError('');
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError('Please enter your display name');
    setLoading(true);

    try {
      const socket = connectSocket();
      await new Promise<void>((resolve) => {
        if (socket.connected) return resolve();
        socket.once('connect', resolve);
      });

      socket.once('room:created', ({ roomId }: { roomId: string }) => {
        setRoomId(roomId);
        setPlayerName(name.trim());
        sessionStorage.setItem('fs_player_name', name.trim());
        sessionStorage.setItem('fs_room_id', roomId);
        navigate(`/lobby/${roomId}`);
        setLoading(false);
      });

      socket.emit('action:create_room', { name: name.trim() });
    } catch (e) {
      setError('Could not create room. Check your connection and try again.');
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError('Please enter your display name');
    if (!roomCode.trim()) return setError('Enter the 6-character room code shared by your host');
    setLoading(true);

    try {
      const code = roomCode.trim().toUpperCase();
      setRoomId(code);
      setPlayerName(name.trim());

      const socket = connectSocket();
      await new Promise<void>((resolve) => {
        if (socket.connected) return resolve();
        socket.once('connect', resolve);
      });

      // Listen for state to confirm join
      let joinTimeout: ReturnType<typeof setTimeout>;
      const onState = (state: { roomId: string; phase: string }) => {
        if (state.roomId === code) {
          socket.off('game:state', onState);
          clearTimeout(joinTimeout);
          sessionStorage.setItem('fs_player_name', name.trim());
          sessionStorage.setItem('fs_room_id', code);
          setLoading(false);
          navigate(asSpectator || state.phase === 'active' ? `/game/${code}` : `/lobby/${code}`);
        }
      };
      socket.on('game:state', onState);

      socket.emit('action:join', {
        roomId: code,
        name: name.trim(),
        asSpectator,
        reconnectToken: sessionStorage.getItem('fs_reconnect_token') ?? undefined,
      });

      // Timeout if no response
      joinTimeout = setTimeout(() => {
        socket.off('game:state', onState);
        setLoading(false);
        setError('Room not found. Check the room code with your host or ask them to share the lobby link.');
      }, 5000);
    } catch (e) {
      setError('Could not connect to the server. Check your internet connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/foursouls-logo.png"
            alt="The Binding of Isaac: Four Souls"
            className="mx-auto max-h-40 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            draggable={false}
          />
          <p className="text-fs-parchment/40 text-sm mt-2 font-display tracking-widest uppercase">
            Unofficial Online Companion
          </p>
          <p className="text-fs-parchment/30 text-xs mt-1">Play 1&ndash;4+ players online</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Landing — pick a mode */}
        {mode === null && (
          <div className="panel p-8 space-y-3">
            <Button className="w-full" onClick={() => setMode('create')}>
              Create Game
            </Button>
            <Button className="w-full" variant="ghost" onClick={() => setMode('join')}>
              Join Game
            </Button>
          </div>
        )}

        {/* Create Game */}
        {mode === 'create' && (
          <div className="panel p-8 space-y-4">
            <div>
              <label className="block text-sm text-fs-parchment/60 mb-1.5 font-display">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={32}
                autoFocus
                className="w-full bg-fs-darker border border-fs-link/30 rounded px-4 py-3 text-base text-fs-parchment placeholder-fs-parchment/30 focus:outline-none focus:border-fs-link"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : 'Create Room'}
            </Button>
            <button
              onClick={handleBack}
              className="w-full text-xs text-fs-parchment/40 hover:text-fs-parchment transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* Join Game */}
        {mode === 'join' && (
          <div className="panel p-8 space-y-4">
            <div>
              <label className="block text-sm text-fs-parchment/60 mb-1.5 font-display">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABCDEF"
                maxLength={6}
                autoFocus
                className="w-full bg-fs-darker border border-fs-link/30 rounded px-4 py-3 text-fs-parchment placeholder-fs-parchment/30 focus:outline-none focus:border-fs-link font-display text-2xl tracking-widest text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div>
              <label className="block text-sm text-fs-parchment/60 mb-1.5 font-display">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={32}
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
            <button
              onClick={handleBack}
              className="w-full text-xs text-fs-parchment/40 hover:text-fs-parchment transition-colors"
            >
              Back
            </button>
          </div>
        )}

        <AttributionFooter compact />
      </div>
    </div>
  );
}
