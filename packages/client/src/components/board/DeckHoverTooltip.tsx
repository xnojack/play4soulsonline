import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';

type DeckType = 'loot' | 'treasure' | 'monster' | 'room';

interface DeckHoverTooltipProps {
  deckType: DeckType;
  pile: 'deck' | 'discard';
  children: React.ReactNode;
}

const HOVER_DELAY_MS = 200;

export function DeckHoverTooltip({ deckType, pile, children }: DeckHoverTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoveredCard = useGameStore((s) => s.hoveredCard);
  const setHoveredDeck = useGameStore((s) => s.setHoveredDeck);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
      }
      setVisible(true);
      setHoveredDeck({ deckType, pile });
    }, HOVER_DELAY_MS);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setHoveredDeck(null);
    }, HOVER_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasHoveredCard = !!hoveredCard;
  const isDeck = pile === 'deck';
  const label = `${deckType} ${pile}`;

  const tooltipContent = (
    <div
      onMouseEnter={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(true);
      }}
      onMouseLeave={() => {
        timerRef.current = setTimeout(() => {
          setVisible(false);
          setHoveredDeck(null);
        }, HOVER_DELAY_MS);
      }}
      className="bg-fs-darker/95 border-2 border-fs-gold/40 rounded-lg p-3 flex flex-col gap-2 shadow-xl backdrop-blur-sm select-none"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        minWidth: 220,
      }}
    >
      <div className="text-sm font-display text-fs-gold uppercase tracking-wider text-center pb-1 border-b border-fs-gold/20">
        {label}
      </div>

      {/* Draw 1-9 */}
      <div className="flex gap-1 justify-center">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className="w-8 h-8 rounded border border-fs-gold/30 text-fs-gold text-sm font-display flex items-center justify-center"
          >
            {n}
          </span>
        ))}
      </div>

      {/* Action labels */}
      <div className="flex gap-2 justify-center pt-1 border-t border-fs-gold/20">
        {isDeck && (
          <span
            className="px-3 h-8 rounded border border-fs-gold/30 text-fs-gold text-sm font-display flex items-center justify-center"
            title={`Shuffle ${deckType} deck`}
          >
            S
          </span>
        )}
        <span
          className={`px-3 h-8 rounded border text-sm font-display flex items-center justify-center ${
            hasHoveredCard
              ? 'border-fs-gold/30 text-fs-gold'
              : 'border-fs-gold/10 text-fs-parchment/20'
          }`}
          title={
            hasHoveredCard
              ? `Return "${hoveredCard.name}" to its deck`
              : 'Hover a card in your hand to return it'
          }
        >
          R
        </span>
        <span
          className={`px-3 h-8 rounded border text-sm font-display flex items-center justify-center ${
            hasHoveredCard
              ? 'border-red-700/40 text-red-400'
              : 'border-fs-gold/10 text-fs-parchment/20'
          }`}
          title={
            hasHoveredCard
              ? `Discard "${hoveredCard.name}"`
              : 'Hover a card in your hand to discard it'
          }
        >
          D
        </span>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="relative"
    >
      {children}
      {visible && createPortal(tooltipContent, document.body)}
    </div>
  );
}
