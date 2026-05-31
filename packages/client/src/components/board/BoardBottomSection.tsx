import React from 'react';
import { ClientPlayer, useGameStore } from '../../store/gameStore';
import { PlayerExpandedPanel } from '../player/PlayerExpandedPanel';
import { TurnActionBar } from './TurnActionBar';
import { Button } from '../ui/Button';
import { getSocket } from '../../socket/client';
import { useIsHost } from '../../hooks/useMyPlayer';

interface BoardBottomSectionProps {
  myPlayer: ClientPlayer | null;
}

/**
 * Bottom 1/3: local player's expanded panel only.
 * The BottomBar is rendered as a sibling outside the 3-band layout in GameBoard.
 */
export function BoardBottomSection({ myPlayer }: BoardBottomSectionProps) {
  return (
    <div className="h-full min-h-0 px-2 py-1 pb-1.5">
      {myPlayer ? (
        <PlayerExpandedPanel
          player={myPlayer}
          isMe
          showHand
          label="YOU"
          labelColor="gold"
        />
      ) : (
        <div className="h-full flex items-center justify-center text-fs-parchment/40 text-sm italic">
          Spectating
        </div>
      )}
    </div>
  );
}

export function BottomBar() {
  const game = useGameStore((s) => s.game);
  const setCardSearchOpen = useGameStore((s) => s.setCardSearchOpen);
  const showLog = useGameStore((s) => s.showLog);
  const setShowLog = useGameStore((s) => s.setShowLog);
  const isHost = useIsHost();

  const handleRestart = () => {
    if (!confirm('Reset game to lobby? All game state will be lost.')) return;
    getSocket().emit('action:restart_game');
  };

  const spectators = game?.players.filter((p) => p.isSpectator) ?? [];

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-fs-dark/80 backdrop-blur-sm border-t border-fs-gold/20 text-xs min-w-0">

      {/* Left zone — game info */}
      <div className="flex items-center gap-2 flex-shrink-0 text-fs-parchment/40 whitespace-nowrap">
        <span className="font-display text-fs-gold/80 font-bold text-sm">Four Souls</span>
        {game && (
          <>
            <span className="text-fs-parchment/30">|</span>
            <span>Room: <span className="text-fs-parchment/60">{game.roomId}</span></span>
            <span className="text-fs-parchment/30">|</span>
            <span>¢ pool: <span className="text-fs-parchment/60">{game.coinPool}</span></span>
          </>
        )}
        {spectators.length > 0 && (
          <>
            <span className="text-fs-parchment/30">|</span>
            <span className="hidden md:inline">{spectators.length} watching</span>
          </>
        )}
        <span className="text-fs-parchment/20 hidden md:inline">|</span>
        <a
          href="https://foursouls.com/rules/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline text-fs-parchment/25 hover:text-fs-parchment/60 transition-colors"
          title="Official Four Souls rules"
        >
          Rules
        </a>
        <span className="text-fs-parchment/20 hidden md:inline">·</span>
        <a
          href="https://foursouls.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline text-fs-parchment/25 hover:text-fs-parchment/60 transition-colors"
          title="Card data & artwork © Edmund McMillen / Maestro Media — unofficial fan companion"
        >
          foursouls.com
        </a>
      </div>

      {/* Center zone — turn actions, expands to fill remaining space */}
      <div className="flex-1 flex items-center justify-center min-w-0 overflow-hidden">
        <TurnActionBar bare />
      </div>

      {/* Right zone — controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
        <Button size="sm" variant="ghost" onClick={() => setCardSearchOpen(true)}>
          <span className="hidden sm:inline">Card Search</span>
          <span className="sm:hidden">🔍</span>
        </Button>
        {isHost && (
          <Button size="sm" variant="ghost" onClick={handleRestart} title="Restart game (host only)">
            Restart
          </Button>
        )}
        <button
          onClick={() => setShowLog(!showLog)}
          className="text-xs px-2 py-0.5 rounded border border-fs-gold/30 text-fs-parchment/60 hover:text-fs-parchment hover:border-fs-gold/60 transition-colors"
          title={showLog ? 'Hide log' : 'Show game log'}
        >
          📜 Log
        </button>
      </div>
    </div>
  );
}
