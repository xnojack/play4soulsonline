import React, { useState, useRef, useEffect } from 'react';
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
    <div className="h-full min-h-0 px-4 py-2 pb-3">
      {myPlayer ? (
        <PlayerExpandedPanel
          player={myPlayer}
          isMe
          showHand
          label="YOU"
          labelColor="gold"
        />
      ) : (
        <div className="h-full flex items-center justify-center text-fs-parchment/40 text-xl italic">
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  const handleRestart = () => {
    if (!confirm('Reset game to lobby? All game state will be lost.')) return;
    getSocket().emit('action:restart_game');
  };

  // Close shortcuts on outside click
  useEffect(() => {
    if (!showShortcuts) return;
    const handler = (e: MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showShortcuts]);

  const spectators = game?.players.filter((p) => p.isSpectator) ?? [];

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-fs-dark/80 backdrop-blur-sm border-t border-fs-gold/20 text-xs min-w-0">

      {/* Left zone — game info (hidden below large screens) */}
      <div className="hidden lg:flex items-center gap-2 flex-shrink-0 text-fs-parchment/40 whitespace-nowrap">
        <span className="font-display text-fs-gold/80 font-bold text-sm">Four Souls</span>
        {game && (
          <>
            <span className="text-fs-parchment/30">|</span>
            <span>Room: <span className="text-fs-parchment/60">{game.roomId}</span></span>
            <span className="text-fs-parchment/30">|</span>
            <span>¢ pool: <span className={`${game.sharedCoinPool ? 'text-yellow-400 font-bold' : 'text-fs-parchment/60'}`}>
                {game.coinPool}
              </span>
              {game.sharedCoinPool && <span className="text-yellow-400/60 text-[10px] ml-1">SHARED</span>}
            </span>
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

      {/* Right zone — controls (progressive hide: Card Search → Shortcuts → Log) */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
        <div className="hidden lg:flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setCardSearchOpen(true)}>
            🔍 Card Search
          </Button>
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          <div ref={shortcutsRef} className="relative" data-tutorial="shortcuts">
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="text-xs px-2 py-0.5 rounded border border-fs-gold/30 text-fs-parchment/60 hover:text-fs-parchment hover:border-fs-gold/60 transition-colors"
              title="Keyboard shortcuts"
            >
              ⌨ Shortcuts
            </button>
          {showShortcuts && (
            <div className="absolute bottom-full right-0 mb-1 bg-fs-darker/95 border border-fs-gold/40 rounded-lg shadow-xl p-3 min-w-[260px] z-[9999]">
              <div className="text-xs text-fs-gold font-display font-bold mb-2">Keyboard Shortcuts</div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-fs-parchment/60 font-semibold mb-0.5">Deck / Discard</div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">1-9</span><span className="text-fs-parchment/50">Draw N cards</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">S</span><span className="text-fs-parchment/50">Shuffle deck</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">R</span><span className="text-fs-parchment/50">Return card to deck</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">D</span><span className="text-fs-parchment/50">Discard card</span></div>
                  </div>
                </div>
                <div className="border-t border-fs-gold/10 pt-2">
                  <div className="text-xs text-fs-parchment/60 font-semibold mb-0.5">Hand Card</div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">E</span><span className="text-fs-parchment/50">Play card to stack</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">R</span><span className="text-fs-parchment/50">Return to deck</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">D</span><span className="text-fs-parchment/50">Discard</span></div>
                  </div>
                </div>
                <div className="border-t border-fs-gold/10 pt-2">
                  <div className="text-xs text-fs-parchment/60 font-semibold mb-0.5">In-Play Card</div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">E</span><span className="text-fs-parchment/50">Interact</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">C</span><span className="text-fs-parchment/50">Add counter</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">Shift+C</span><span className="text-fs-parchment/50">Remove counter</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">R</span><span className="text-fs-parchment/50">Return to deck</span></div>
                    <div className="flex gap-2 text-xs"><span className="text-fs-gold font-mono w-16">D</span><span className="text-fs-parchment/50">Discard</span></div>
                  </div>
                </div>
                <div className="border-t border-fs-gold/10 pt-2">
                  <div className="text-xs text-fs-parchment/60 font-semibold mb-0.5">Right-Click</div>
                  <div className="text-xs text-fs-parchment/50">Quick-action menu on cards & decks</div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-xs px-2 py-0.5 rounded border border-fs-gold/30 text-fs-parchment/60 hover:text-fs-parchment hover:border-fs-gold/60 transition-colors"
            title={showLog ? 'Hide log' : 'Show game log'}
          >
            📜 Log
          </button>
        </div>
      </div>
    </div>
  );
}
