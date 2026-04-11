import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { connectSocket, getSocket } from '../socket/client';
import { GameBoard } from '../components/board/GameBoard';
import { EdenPickModal } from '../components/board/EdenPickModal';
import { SadVoteModal } from '../components/board/SadVoteModal';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { useIsHost } from '../hooks/useMyPlayer';

/** Attempt to rejoin a room using saved session data. */
function tryAutoRejoin(roomId: string) {
  const savedRoom = sessionStorage.getItem('fs_room_id');
  const savedName = sessionStorage.getItem('fs_player_name');
  if (savedRoom !== roomId || !savedName) return;

  const socket = connectSocket();
  const doJoin = () => {
    socket.emit('action:join', {
      roomId,
      name: savedName,
      asSpectator: false,
      reconnectToken: sessionStorage.getItem('fs_reconnect_token') ?? undefined,
    });
  };
  if (socket.connected) doJoin();
  else socket.once('connect', doJoin);
}

export function Game() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game);
  const gameOverInfo = useGameStore((s) => s.gameOverInfo);
  const setGameOver = useGameStore((s) => s.setGameOver);
  const error = useGameStore((s) => s.error);
  const isHost = useIsHost();

  // Whether we've given up waiting and should show the rejoin prompt
  const [showRejoin, setShowRejoin] = useState(false);

  const inRoom = game?.roomId === roomId;

  useEffect(() => {
    if (inRoom) return; // already in room

    // Try silent auto-rejoin first (works on page refresh)
    if (roomId) tryAutoRejoin(roomId);

    // After 4 s with no state, show the manual rejoin prompt
    const timer = setTimeout(() => {
      if (!useGameStore.getState().game) {
        setShowRejoin(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [inRoom, roomId]);

  // If game is in lobby phase, redirect there
  useEffect(() => {
    if (inRoom && game?.phase === 'lobby') {
      navigate(`/lobby/${roomId}`);
    }
  }, [inRoom, game?.phase, roomId, navigate]);

  if (!inRoom) {
    if (showRejoin) {
      return (
        <div className="min-h-screen bg-fs-darker flex items-center justify-center p-4">
          <div className="panel p-8 max-w-sm w-full text-center space-y-4">
            <h2 className="font-display text-fs-gold text-2xl font-bold">Rejoin Game</h2>
            <p className="text-fs-parchment/50 text-sm">
              Room{' '}
              <span className="font-display text-fs-gold tracking-widest">{roomId}</span>
            </p>
            <p className="text-fs-parchment/40 text-xs">
              Your session was lost. Go back to the lobby to rejoin.
            </p>
            <Button
              className="w-full"
              onClick={() => navigate(`/lobby/${roomId}`)}
            >
              Go to Lobby
            </Button>
            <button
              onClick={() => navigate('/')}
              className="block w-full text-xs text-fs-parchment/30 hover:text-fs-parchment transition-colors"
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-fs-darker flex items-center justify-center">
        <div className="text-fs-parchment/40 font-display text-sm">
          Reconnecting to room {roomId}…
        </div>
      </div>
    );
  }

  return (
    <>
      <GameBoard />

      {/* Eden starting-item pick — blocks interaction until all Edens have chosen */}
      <EdenPickModal />

      {/* Saddest character vote — blocks interaction until resolved */}
      <SadVoteModal />

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-700 rounded-lg px-4 py-2 text-red-200 text-sm shadow-2xl">
          {error}
        </div>
      )}

      {/* Game over modal */}
      <Modal
        isOpen={!!gameOverInfo}
        onClose={() => setGameOver(null)}
        title="Game Over!"
      >
        {gameOverInfo && (
          <div className="text-center space-y-4">
            <div className="text-6xl">🏆</div>
            <div className="font-display text-fs-gold-light text-2xl font-bold">
              {gameOverInfo.winnerName} wins!
            </div>
            <div className="text-fs-parchment/60 text-sm">
              They collected 4 souls and emerged victorious.
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {isHost && (
                <Button
                  onClick={() => {
                    setGameOver(null);
                    getSocket().emit('action:restart_game');
                  }}
                >
                  Restart Game
                </Button>
              )}
              <Button
                variant={isHost ? 'ghost' : 'primary'}
                onClick={() => { setGameOver(null); navigate('/'); }}
              >
                Back to Home
              </Button>
              <Button variant="ghost" onClick={() => setGameOver(null)}>
                Keep Watching
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
