import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DnDProvider } from './DnDProvider';
import { CardFlightLayer } from './CardFlightLayer';
import { useCardFlightDetector } from '../../hooks/useCardFlightDetector';
import { LogToast } from '../log/LogToast';
import { GameLog } from '../log/GameLog';
import { ChatInput } from '../log/ChatInput';
import { CardSearch } from '../cards/CardSearch';
import { CardModal } from '../cards/CardModal';
import { DiceResultToast } from '../dice/DiceRoller';
import { AttributionFooter } from '../ui/AttributionFooter';
import { SoundManager } from '../audio/SoundManager';
import { PriorityBanner } from './PriorityBanner';
import { D8Timer } from '../ui/D8Timer';
import { BoardTopSection } from '../player/BoardTopSection';
import { BoardMiddleSection } from './BoardMiddleSection';
import { BoardBottomSection, BottomBar } from './BoardBottomSection';
import { BoardScaleProvider } from '../../context/BoardScaleContext';
import { BoardCanvas } from './BoardCanvas';
import { useDeckKeyboardShortcuts } from '../../hooks/useDeckKeyboardShortcuts';
import { useRightClickContextMenu } from '../../hooks/useRightClickContextMenu';
import { DropContextMenu } from './DropContextMenu';

export function GameBoard() {
  const game = useGameStore((s) => s.game);
  const showLog = useGameStore((s) => s.showLog);
  const contextMenu = useGameStore((s) => s.contextMenu);
  const setContextMenu = useGameStore((s) => s.setContextMenu);
  useCardFlightDetector();
  useDeckKeyboardShortcuts();
  useRightClickContextMenu();
  const [isPortrait, setIsPortrait] = useState(() => window.innerWidth < window.innerHeight);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  React.useEffect(() => {
    const checkOrientation = () => setIsPortrait(window.innerWidth < window.innerHeight);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (!game) return null;

  const isSplitMode = game.gameMode === 'solitaire' || game.gameMode === 'coop';

  // During eden_pick / sad_vote the board overlay modals handle interaction;
  // render a simple waiting screen so we don't try to map over uninitialized slots.
  const boardReady = game.phase === 'active' || game.phase === 'ended';

  const myPlayer = game.players.find((p) => p.id === game.myPlayerId) ?? null;
  const showPortraitOverlay = isPortrait && !portraitDismissed && game.phase === 'active' && myPlayer && !myPlayer.isSpectator;
  const setShowLog = useGameStore((s) => s.setShowLog);

  return (
    <BoardScaleProvider>
    <DnDProvider>
      <div className="h-screen flex flex-col overflow-hidden bg-black">
        {/* Portrait overlay */}
        {showPortraitOverlay && (
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-6xl">↻</div>
              <div className="font-display text-fs-gold text-2xl font-bold">Rotate to Landscape</div>
              <div className="text-fs-parchment/60 text-sm">This app works best in landscape mode.</div>
              <button
                onClick={() => setPortraitDismissed(true)}
                className="mt-4 px-4 py-2 rounded border border-fs-gold/30 text-fs-parchment/60 hover:text-fs-parchment hover:border-fs-gold/60 transition-colors text-sm"
              >
                Continue (Spectate)
              </button>
            </div>
          </div>
        )}

        {/* Board area — fixed-size virtual table (4000x2000), auto-fitted to viewport */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden bg-black">
          {/* Three-band column — wrapped in BoardCanvas for zoom/pan */}
          <BoardCanvas className="relative flex-1 min-w-0">
            <div className="relative flex flex-col w-full h-full">
            {!boardReady ? (
              /* eden_pick / sad_vote — modals overlay on top; just show the table */
              <div className="flex-1" />
            ) : (
              <>
                {/* Top 1/3 — hidden in solitaire/co-op (players are at bottom) */}
                {!isSplitMode && (
                  <div className="h-[30%] min-h-0 relative">
                    <BoardTopSection myPlayerId={game.myPlayerId} />
                  </div>
                )}

                {/* Middle — takes remaining space */}
                <div className={`${isSplitMode ? 'flex-[2]' : 'flex-1'} min-h-0 relative border-t-2 border-b-2 border-fs-gold/10`}>
                  <BoardMiddleSection />
                  {/* D8 Timer overlay — centered at top of middle section */}
                  {game.d8Timer !== null && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                      <D8Timer value={game.d8Timer} />
                    </div>
                  )}
                </div>

                {/* Bottom — player panel (expanded in solitaire/co-op) */}
                <div className={`${isSplitMode ? 'flex-[2]' : 'h-1/4'} min-h-0 relative`}>
                  <BoardBottomSection myPlayer={myPlayer} />
                </div>
              </>
            )}
            </div>
          </BoardCanvas>

          {/* Collapsible log panel (right edge) */}
          {showLog && (
            <div className="relative flex-shrink-0 w-72 flex flex-col border-l border-fs-gold/20 bg-fs-dark/85 backdrop-blur-sm z-10">
              <div className="flex items-center justify-between px-2 py-1 border-b border-fs-gold/20">
                <span className="font-display text-fs-gold text-xs uppercase tracking-wider">Game Log</span>
                <button
                  onClick={() => setShowLog(false)}
                  className="text-fs-parchment/40 hover:text-fs-parchment text-sm leading-none"
                  title="Collapse"
                >
                  ›
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <GameLog />
              </div>
              <ChatInput />
              <div className="flex-shrink-0 px-2 py-1 border-t border-fs-gold/10">
                <AttributionFooter compact />
              </div>
            </div>
          )}
        </div>

        {/* Global overlays */}
        <DiceResultToast />
        <CardModal />
        <CardSearch />
        <PriorityBanner />
        <CardFlightLayer />
        <LogToast />
        <SoundManager />
        {contextMenu && (
          <DropContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={contextMenu.actions}
            stackSource={!!contextMenu.stackSourceId}
            stackItemId={contextMenu.stackSourceId}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Bottom utility bar — outside the 3-band board area, flush at screen bottom */}
        <BottomBar />
      </div>
    </DnDProvider>
    </BoardScaleProvider>
  );
}
