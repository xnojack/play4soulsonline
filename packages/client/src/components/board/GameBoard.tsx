import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { SharedTable } from './SharedTable';
import { TurnActionBar } from './TurnActionBar';
import { PriorityBanner } from './PriorityBanner';
import { DnDProvider } from './DnDProvider';
import { CardFlightLayer } from './CardFlightLayer';
import { useCardFlightDetector } from '../../hooks/useCardFlightDetector';
import { PlayerArea } from '../player/PlayerArea';
import { OpponentArea } from '../player/OpponentArea';
import { MobileOpponentList } from '../player/MobileOpponentList';
import { LogToast } from '../log/LogToast';
import { TheStack } from '../stack/TheStack';
import { GameLog } from '../log/GameLog';
import { ChatInput } from '../log/ChatInput';
import { CardSearch } from '../cards/CardSearch';
import { CardModal } from '../cards/CardModal';
import { DiceResultToast } from '../dice/DiceRoller';
import { Button } from '../ui/Button';
import { AttributionFooter } from '../ui/AttributionFooter';
import { ActionGuidance } from './ActionGuidance';
import { SoundManager } from '../audio/SoundManager';
import { useIsHost, useIsMyTurn, useHasPriority } from '../../hooks/useMyPlayer';

export function GameBoard() {
  const game = useGameStore((s) => s.game);
  const setCardSearchOpen = useGameStore((s) => s.setCardSearchOpen);
  const isHost = useIsHost();
  const isMyTurn = useIsMyTurn();
  const hasPriority = useHasPriority();
  useCardFlightDetector();
  const [showHint, setShowHint] = useState(() => !localStorage.getItem('hideCardHint'));
  const [showOpponents, setShowOpponents] = useState(true);
  const [showStackLog, setShowStackLog] = useState(() => window.innerWidth >= 768);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(() => window.innerWidth < window.innerHeight);
  const [helpMode, setHelpMode] = useState(() => localStorage.getItem('helpMode') === '1');

  const dismissHint = () => {
    localStorage.setItem('hideCardHint', '1');
    setShowHint(false);
  };

  useEffect(() => {
    const checkOrientation = () => setIsPortrait(window.innerWidth < window.innerHeight);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (!game) return null;

  const myPlayer = game.players.find((p) => p.id === game.myPlayerId);
  const spectators = game.players.filter((p) => p.isSpectator);
  const allPlayers = game.players.filter((p) => !p.isSpectator);
  const activePlayerId = game.turn.activePlayerId;
  const priorityPlayerId = game.priorityQueue[0] ?? null;

  // Sort all players: active player first, then by priorityQueue order
  const sortedPlayers = [...allPlayers].sort((a, b) => {
    if (a.id === activePlayerId) return -1;
    if (b.id === activePlayerId) return 1;
    const ai = game.priorityQueue.indexOf(a.id);
    const bi = game.priorityQueue.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const activePlayer = game.players.find((p) => p.id === activePlayerId);

  const turnHint = isMyTurn
    ? 'Your turn'
    : `${activePlayer?.name ?? '?'}'s turn`;

  const showBottomBar = game.phase === 'active' && (isMyTurn || hasPriority);

  const handleRestart = () => {
    if (!confirm('Reset game to lobby? All game state will be lost.')) return;
    getSocket().emit('action:restart_game');
  };

  return (
    <DnDProvider>
    <div className="h-screen flex flex-col bg-fs-darker overflow-hidden">
      {/* Portrait overlay — blocks everything */}
      {isPortrait && (
        <div className="fixed inset-0 z-[9999] bg-fs-darker flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-6xl">↻</div>
            <div className="font-display text-fs-gold text-2xl font-bold">
              Rotate to Landscape
            </div>
            <div className="text-fs-parchment/60 text-sm">
              This app works best in landscape mode.
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-fs-dark border-b border-fs-gold/20 px-3 md:px-4 py-2 flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <span className="font-display text-fs-gold font-bold text-sm md:text-base">Four Souls</span>
          <span className="text-xs md:text-sm text-fs-parchment/40">Room: {game.roomId}</span>
          <span className={`text-xs md:text-sm px-2 py-0.5 rounded ${isMyTurn ? 'bg-fs-gold/20 text-fs-gold' : 'text-fs-parchment/40'}`}>
            {turnHint}
          </span>
          <span className="text-xs md:text-sm text-fs-parchment/30">
            ¢ {game.coinPool}
          </span>
          {showHint && (
            <span className="flex items-center gap-1.5 text-xs md:text-sm text-fs-parchment/40 italic border-l border-fs-gold/20 pl-2 md:pl-3 ml-0 md:ml-1">
              Tip: Hover cards for actions.
              <button
                onClick={dismissHint}
                className="text-fs-parchment/30 hover:text-fs-parchment/70 transition-colors leading-none flex-shrink-0"
                title="Dismiss"
              >✕</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          <a
            href="https://foursouls.com/rules/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline text-[10px] text-fs-parchment/20 hover:text-fs-parchment/50 transition-colors"
            title="Official Four Souls rules"
          >
            Rules
          </a>
          <span className="hidden md:inline text-fs-parchment/10 text-[10px]">|</span>
          <a
            href="https://foursouls.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline text-[10px] text-fs-parchment/20 hover:text-fs-parchment/50 transition-colors"
            title="Card data & artwork © Edmund McMillen / Maestro Media — unofficial fan companion"
          >
            foursouls.com
          </a>
          <Button size="sm" variant="ghost" onClick={() => setCardSearchOpen(true)}>
            <span className="hidden sm:inline">Card Search</span>
            <span className="sm:hidden">🔍</span>
          </Button>
          <button
            onClick={() => {
              const next = !helpMode;
              setHelpMode(next);
              localStorage.setItem('helpMode', next ? '1' : '0');
            }}
            className={`text-xs px-2 py-1 rounded border transition-colors ${helpMode ? 'bg-fs-gold/20 border-fs-gold/40 text-fs-gold' : 'text-fs-parchment/30 border-fs-gold/10 hover:text-fs-parchment/60'}`}
            title="Keep guidance visible"
          >
            ?
          </button>
          {isHost && (
            <Button size="sm" variant="ghost" onClick={handleRestart}>
              Restart
            </Button>
          )}
          {spectators.length > 0 && (
            <span className="hidden md:inline text-sm text-fs-parchment/30">
              {spectators.length} watching
            </span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: all players sidebar — condensed on mobile, full on desktop */}
        {sortedPlayers.length > 0 && (
          <div className={`flex flex-shrink-0 overflow-y-auto border-r border-fs-gold/10 transition-all duration-200 ${showOpponents ? 'w-40 lg:w-80' : 'w-0 lg:w-0'}`}>
            <div className="p-2 space-y-2 w-40 lg:w-80">
              <div className="section-title px-1 text-xs sm:text-sm">Players</div>
              {/* Desktop: full OpponentArea */}
              <div className="hidden lg:block">
                {sortedPlayers.map((p) => (
                  <OpponentArea
                    key={p.id}
                    player={p}
                    isActiveTurn={activePlayerId === p.id}
                    hasPriority={priorityPlayerId === p.id && priorityPlayerId !== activePlayerId}
                  />
                ))}
              </div>
              {/* Mobile: condensed list with tap-to-expand */}
              <div className="lg:hidden">
                <MobileOpponentList
                  players={sortedPlayers}
                  activePlayerId={activePlayerId}
                  priorityPlayerId={priorityPlayerId}
                  onSelectPlayer={setSelectedOpponentId}
                />
              </div>
            </div>
          </div>
        )}

        {/* Left sidebar toggle tab — desktop only */}
        {sortedPlayers.length > 0 && (
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
          {showBottomBar && <div className="h-14" />}
        </div>

        {/* Right stack+log toggle tab — visible on mobile and desktop */}
        <button
          onClick={() => setShowStackLog((v) => !v)}
          className="hidden sm:flex flex-shrink-0 items-center justify-center w-8 lg:w-5 self-stretch bg-fs-dark hover:bg-fs-brown/60 border-l border-fs-gold/40 text-fs-parchment/60 hover:text-fs-parchment transition-colors z-10"
          title={showStackLog ? 'Hide stack/log panel' : 'Show stack/log panel'}
        >
          <span className="text-lg leading-none">{showStackLog ? '›' : '‹'}</span>
        </button>

        {/* Right: stack + log — visible on mobile landscape+, togglable */}
        <div className={`hidden sm:flex flex-shrink-0 flex flex-col border-l border-fs-gold/10 overflow-hidden overflow-y-auto transition-all duration-200 ${showStackLog ? 'w-40 lg:w-72' : 'w-0 overflow-hidden'}`}>
          <div className="w-40 lg:w-72 flex flex-col min-h-screen">
            <div className="min-h-[200px] flex-1 overflow-y-auto border-b border-fs-gold/10">
              <TheStack />
            </div>
            <div className="min-h-[160px] flex-1 overflow-y-auto">
              <GameLog />
            </div>
            <ChatInput />
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
      <PriorityBanner />
      <ActionGuidance helpMode={helpMode} />
      <TurnActionBar />
      <CardFlightLayer />
      <LogToast />
      <SoundManager />

      {/* Mobile opponent detail modal */}
      {selectedOpponentId && (
        <div className="lg:hidden fixed inset-0 z-50 bg-fs-darker/95 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-fs-gold/20 bg-fs-dark flex-shrink-0">
            <span className="font-display text-fs-gold text-sm">Player Detail</span>
            <button
              onClick={() => setSelectedOpponentId(null)}
              className="text-fs-parchment/50 hover:text-fs-parchment text-xl px-2 py-1"
            >
              ✕
            </button>
          </div>
          <div className="p-3">
            {(() => {
              const opp = game.players.find((p) => p.id === selectedOpponentId);
              if (!opp) return null;
              return (
                <OpponentArea
                  player={opp}
                  isActiveTurn={game.turn.activePlayerId === opp.id}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
    </DnDProvider>
  );
}
