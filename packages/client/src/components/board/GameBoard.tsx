import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { SharedTable } from './SharedTable';
import { PlayerArea } from '../player/PlayerArea';
import { OpponentArea } from '../player/OpponentArea';
import { TheStack } from '../stack/TheStack';
import { GameLog } from '../log/GameLog';
import { CardSearch } from '../cards/CardSearch';
import { CardModal } from '../cards/CardModal';
import { DiceResultToast } from '../dice/DiceRoller';
import { Button } from '../ui/Button';
import { AttributionFooter } from '../ui/AttributionFooter';
import { useIsHost } from '../../hooks/useMyPlayer';

export function GameBoard() {
  const game = useGameStore((s) => s.game);
  const setCardSearchOpen = useGameStore((s) => s.setCardSearchOpen);
  const isHost = useIsHost();
  const [showHint, setShowHint] = React.useState(() => !localStorage.getItem('hideCardHint'));

  const dismissHint = () => {
    localStorage.setItem('hideCardHint', '1');
    setShowHint(false);
  };

  if (!game) return null;

  const myPlayer = game.players.find((p) => p.id === game.myPlayerId);
  const opponents = game.players.filter(
    (p) => p.id !== game.myPlayerId && !p.isSpectator
  );
  const spectators = game.players.filter((p) => p.isSpectator);

  const activePlayer = game.players.find((p) => p.id === game.turn.activePlayerId);
  const isMyTurn = game.turn.activePlayerId === game.myPlayerId;

  // Guidance text shown in the topbar
  const turnHint = isMyTurn
    ? 'Your turn — loot, attack a monster, buy an item, or end turn'
    : `${activePlayer?.name ?? '?'}'s turn`;

  const handleRestart = () => {
    if (!confirm('Reset game to lobby? All game state will be lost.')) return;
    getSocket().emit('action:restart_game');
  };

  return (
    <div className="h-screen flex flex-col bg-fs-darker overflow-hidden">
      {/* Top bar */}
      <div className="bg-fs-dark border-b border-fs-gold/20 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-fs-gold font-bold">Four Souls</span>
          <span className="text-sm text-fs-parchment/40">Room: {game.roomId}</span>
          <span className={`text-sm px-2 py-0.5 rounded ${isMyTurn ? 'bg-fs-gold/20 text-fs-gold' : 'text-fs-parchment/40'}`}>
            {turnHint}
          </span>
          <span className="text-sm text-fs-parchment/30">
            ¢ Pool: {game.coinPool}
          </span>
          {showHint && (
            <span className="flex items-center gap-1.5 text-sm text-fs-parchment/40 italic border-l border-fs-gold/20 pl-3 ml-1">
              Tip: Click any card to view it or take actions. Your cards are at the bottom.
              <button
                onClick={dismissHint}
                className="text-fs-parchment/30 hover:text-fs-parchment/70 transition-colors leading-none not-italic flex-shrink-0"
                title="Dismiss"
              >✕</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://foursouls.com/rules/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-fs-parchment/20 hover:text-fs-parchment/50 transition-colors"
            title="Official Four Souls rules"
          >
            Rules
          </a>
          <span className="text-fs-parchment/10 text-[10px]">|</span>
          <a
            href="https://foursouls.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-fs-parchment/20 hover:text-fs-parchment/50 transition-colors"
            title="Card data & artwork © Edmund McMillen / Maestro Media — unofficial fan companion"
          >
            foursouls.com
          </a>
          <Button size="sm" variant="ghost" onClick={() => setCardSearchOpen(true)}>
            Card Search
          </Button>
          {isHost && (
            <Button size="sm" variant="ghost" onClick={handleRestart}>
              Restart
            </Button>
          )}
          {spectators.length > 0 && (
            <span className="text-sm text-fs-parchment/30">
              {spectators.length} watching
            </span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: opponents — hidden when no opponents */}
        {opponents.length > 0 && (
          <div className="w-80 flex-shrink-0 overflow-y-auto p-2 space-y-2 border-r border-fs-gold/10">
            <div className="section-title px-1">Opponents</div>
            {opponents.map((p) => (
              <OpponentArea
                key={p.id}
                player={p}
                isActiveTurn={game.turn.activePlayerId === p.id}
              />
            ))}
          </div>
        )}

        {/* Center: table + player area scroll together as one column */}
        <div className="flex-1 overflow-y-auto min-w-0 min-h-0">
          <div className="pt-2 px-2">
            <SharedTable />
          </div>
          {myPlayer && (
            <div className="border-t border-fs-gold/20 mt-2 px-2 pb-2">
              <PlayerArea player={myPlayer} isMe={true} />
            </div>
          )}
        </div>

        {/* Right: stack + log — full height */}
          <div className="w-72 flex-shrink-0 flex flex-col border-l border-fs-gold/10 overflow-hidden">
          <div className="h-1/2 overflow-hidden border-b border-fs-gold/10">
            <TheStack />
          </div>
          <div className="flex-1 overflow-hidden">
            <GameLog />
          </div>
          <div className="flex-shrink-0 px-2 py-1 border-t border-fs-gold/10">
            <AttributionFooter compact />
          </div>
        </div>
      </div>

      {/* Global overlays */}
      <DiceResultToast />
      <CardModal />
      <CardSearch />
    </div>
  );
}
