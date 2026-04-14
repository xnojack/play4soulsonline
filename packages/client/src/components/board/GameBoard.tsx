import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { SharedTable } from './SharedTable';
import { TurnActionBar } from './TurnActionBar';
import { PlayerArea } from '../player/PlayerArea';
import { OpponentArea } from '../player/OpponentArea';
import { CompactOpponent } from '../player/CompactOpponent';
import { TheStack } from '../stack/TheStack';
import { GameLog } from '../log/GameLog';
import { CardSearch } from '../cards/CardSearch';
import { CardModal } from '../cards/CardModal';
import { DiceResultToast } from '../dice/DiceRoller';
import { Button } from '../ui/Button';
import { AttributionFooter } from '../ui/AttributionFooter';
import { useIsHost, useIsMyTurn, useHasPriority } from '../../hooks/useMyPlayer';

export function GameBoard() {
  const game = useGameStore((s) => s.game);
  const setCardSearchOpen = useGameStore((s) => s.setCardSearchOpen);
  const isHost = useIsHost();
  const isMyTurn = useIsMyTurn();
  const hasPriority = useHasPriority();
  const [showHint, setShowHint] = React.useState(() => !localStorage.getItem('hideCardHint'));
  const [showOpponents, setShowOpponents] = React.useState(true);
  const [showStackLog, setShowStackLog] = React.useState(true);

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

  // Guidance text shown in the topbar
  const turnHint = isMyTurn
    ? 'Your turn'
    : `${activePlayer?.name ?? '?'}'s turn`;

  // Bottom bar is visible when it's your turn or you have priority
  const showBottomBar = game.phase === 'active' && (isMyTurn || hasPriority);

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
              Tip: Hover over cards to see actions. Click to view full details.
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

      {/* Mobile opponents bar — horizontal scrollable, visible only on small screens */}
      {opponents.length > 0 && (
        <div className="lg:hidden flex-shrink-0 border-b border-fs-gold/10 bg-fs-dark/50">
          <div className="flex gap-2 p-2 overflow-x-auto">
            {opponents.map((p) => (
              <CompactOpponent
                key={p.id}
                player={p}
                isActiveTurn={game.turn.activePlayerId === p.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: opponents sidebar — desktop only, collapsible */}
        {opponents.length > 0 && (
          <div className={`hidden lg:block flex-shrink-0 overflow-y-auto border-r border-fs-gold/10 transition-all duration-200 ${showOpponents ? 'w-80' : 'w-0'}`}>
            <div className="p-2 space-y-2 w-80">
              <div className="section-title px-1">Opponents</div>
              {opponents.map((p) => (
                <OpponentArea
                  key={p.id}
                  player={p}
                  isActiveTurn={game.turn.activePlayerId === p.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Left sidebar toggle tab — desktop only, shown when there are opponents */}
        {opponents.length > 0 && (
          <button
            onClick={() => setShowOpponents((v) => !v)}
            className="hidden lg:flex flex-shrink-0 items-center justify-center w-4 self-stretch bg-fs-dark hover:bg-fs-brown/40 border-r border-fs-gold/10 text-fs-parchment/30 hover:text-fs-parchment/70 transition-colors z-10"
            title={showOpponents ? 'Hide opponents panel' : 'Show opponents panel'}
          >
            <span className="text-[10px] leading-none">{showOpponents ? '‹' : '›'}</span>
          </button>
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
          {/* Bottom padding when action bar is visible so content isn't hidden */}
          {showBottomBar && <div className="h-14" />}
        </div>

        {/* Right stack+log toggle tab — desktop only */}
        <button
          onClick={() => setShowStackLog((v) => !v)}
          className="hidden lg:flex flex-shrink-0 items-center justify-center w-4 self-stretch bg-fs-dark hover:bg-fs-brown/40 border-l border-fs-gold/10 text-fs-parchment/30 hover:text-fs-parchment/70 transition-colors z-10"
          title={showStackLog ? 'Hide stack/log panel' : 'Show stack/log panel'}
        >
          <span className="text-[10px] leading-none">{showStackLog ? '›' : '‹'}</span>
        </button>

        {/* Right: stack + log — collapsible, sections scroll independently with min-height */}
        <div className={`flex-shrink-0 flex flex-col border-l border-fs-gold/10 overflow-y-auto transition-all duration-200 ${showStackLog ? 'w-72' : 'w-0 overflow-hidden'}`}>
          <div className="w-72 flex flex-col">
            <div className="min-h-[200px] max-h-[50vh] overflow-y-auto border-b border-fs-gold/10 flex-shrink-0">
              <TheStack />
            </div>
            <div className="min-h-[160px] overflow-y-auto flex-shrink-0">
              <GameLog />
            </div>
            <div className="flex-shrink-0 px-2 py-1 border-t border-fs-gold/10">
              <AttributionFooter compact />
            </div>
          </div>
        </div>
      </div>

      {/* Global overlays */}
      <DiceResultToast />
      <CardModal />
      <CardSearch />
      <TurnActionBar />
    </div>
  );
}
