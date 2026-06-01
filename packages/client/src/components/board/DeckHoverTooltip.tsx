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
      className="bg-fs-darker/95 border-2 border-fs-gold/40 rounded-lg p-2.5 shadow-xl backdrop-blur-sm select-none"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
    >
      <div className="text-xs font-display text-fs-gold uppercase tracking-wider text-center pb-1.5 border-b border-fs-gold/20">
        {label}
      </div>
      <div className="flex flex-col gap-1 pt-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-fs-gold w-5">1-9</span>
          <span className="text-xs text-fs-parchment/60">Draw N cards</span>
        </div>
        {isDeck && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-fs-gold w-5">S</span>
            <span className="text-xs text-fs-parchment/60">Shuffle deck</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-fs-gold w-5">R</span>
          <span className="text-xs text-fs-parchment/60">Return card to deck</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-fs-gold w-5">D</span>
          <span className="text-xs text-fs-parchment/60">Discard card</span>
        </div>
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
