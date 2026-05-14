import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useCard } from './CardResolver';
import { getSocket } from '../../socket/client';
import { SERVER_URL } from '../../config';

type DeckType = 'loot' | 'treasure' | 'monster' | 'room' | 'eternal';
type TabKey = DeckType | `discard_${DeckType}`;

const DECK_LABEL: Record<DeckType, string> = {
  loot: 'Loot',
  treasure: 'Treasure',
  monster: 'Monster',
  room: 'Room',
  eternal: 'Eternal',
};

const REORDERABLE: DeckType[] = ['loot', 'treasure', 'monster'];
const DEFAULT_PEEK_COUNT = 3;

function DeckCardRow({
  cardId,
  position,
  isDiscard,
  canReorder,
  onMoveTop,
  onMoveBottom,
}: {
  cardId: string;
  position: number;
  isDiscard: boolean;
  canReorder: boolean;
  onMoveTop?: () => void;
  onMoveBottom?: () => void;
}) {
  const card = useCard(cardId);
  const serverUrl = SERVER_URL;

  return (
    <div className="flex items-center gap-2 px-2 py-1 hover:bg-fs-darker/40 rounded group">
      <span className="text-sm text-fs-parchment/30 w-5 text-right shrink-0">
        {isDiscard ? '' : position}
      </span>
      <div className="w-12 h-16 shrink-0 rounded overflow-hidden bg-fs-darker border border-fs-gold/10">
        {card ? (
          <img
            src={`${serverUrl}${card.imageUrl}`}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fs-parchment/20 text-sm">
            …
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-fs-parchment truncate font-medium">
          {card ? card.name : cardId}
        </div>
        {card && (
          <div className="text-sm text-fs-parchment/40 truncate">
            {card.subType || card.cardType}
          </div>
        )}
      </div>
      {!isDiscard && canReorder && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onMoveTop}
            title="Move to top of deck"
            className="text-sm px-1.5 py-0.5 rounded bg-fs-brown border border-fs-gold/30 hover:bg-fs-gold/20 text-fs-gold transition-colors"
          >
            ↑ Top
          </button>
          <button
            onClick={onMoveBottom}
            title="Move to bottom of deck"
            className="text-sm px-1.5 py-0.5 rounded bg-fs-brown border border-fs-gold/30 hover:bg-fs-gold/20 text-fs-gold transition-colors"
          >
            ↓ Bot
          </button>
        </div>
      )}
    </div>
  );
}

export function InlineDeckBrowser({
  deckType,
  onClose,
  initialTab,
}: {
  deckType: DeckType;
  onClose: () => void;
  initialTab?: TabKey;
}) {
  const deckContents = useGameStore((s) => s.deckContents);
  const canReorder = REORDERABLE.includes(deckType);
  const label = DECK_LABEL[deckType];

  const [peekCount, setPeekCount] = useState(DEFAULT_PEEK_COUNT);
  const [peekInput, setPeekInput] = useState(String(DEFAULT_PEEK_COUNT));
  const [activeTab, setActiveTab] = useState<TabKey>(deckType);

  useEffect(() => {
    if (initialTab && (initialTab as string).startsWith('discard_')) {
      setActiveTab(initialTab);
      getSocket().emit('action:peek_deck', { deckType: initialTab });
    } else {
      setPeekCount(DEFAULT_PEEK_COUNT);
      setPeekInput(String(DEFAULT_PEEK_COUNT));
      setActiveTab(deckType);
    }
  }, [deckType, initialTab]);

  const requestDeck = (dt: TabKey, count?: number) => {
    const isDiscard = (dt as string).startsWith('discard_');
    if (isDiscard) {
      getSocket().emit('action:peek_deck', { deckType: dt });
    } else {
      getSocket().emit('action:peek_deck', { deckType: dt, count: count ?? peekCount });
    }
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    requestDeck(tab, peekCount);
  };

  const discardKey = `discard_${deckType}` as TabKey;
  const deckCards = deckContents[deckType] ?? [];
  const discardCards = deckContents[discardKey] ?? [];
  const displayCards = activeTab === deckType ? deckCards : discardCards;
  const isDiscard = activeTab !== deckType;

  const handleReorder = (cardId: string, position: 'top' | 'bottom') => {
    if (!canReorder) return;
    getSocket().emit('action:reorder_deck', { deckType, cardId, position });
    setTimeout(() => requestDeck(deckType, peekCount), 150);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <div className="bg-fs-darker/60 border border-fs-gold/20 rounded p-3 mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="section-title text-sm">{label} Deck</span>
          <button
            onClick={onClose}
            className="text-fs-parchment/40 hover:text-fs-parchment text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between mb-3 border-b border-fs-gold/20 pb-2">
          <div className="flex gap-1">
            <InlineTabButton
              label={`Deck (${deckCards.length} shown)`}
              active={activeTab === deckType}
              onClick={() => handleTabChange(deckType)}
            />
            <InlineTabButton
              label={`Discard (${discardCards.length})`}
              active={activeTab === discardKey}
              onClick={() => handleTabChange(discardKey)}
            />
          </div>
          {activeTab === deckType && (
            <div className="flex items-center gap-1 text-xs text-fs-parchment/50">
              <span>Showing top</span>
              <input
                type="number"
                min={1}
                max={999}
                value={peekInput}
                onChange={(e) => setPeekInput(e.target.value)}
                onBlur={() => {
                  const n = parseInt(peekInput, 10);
                  if (!isNaN(n) && n > 0) {
                    setPeekCount(n);
                    requestDeck(deckType, n);
                  } else {
                    setPeekInput(String(peekCount));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = parseInt(peekInput, 10);
                    if (!isNaN(n) && n > 0) {
                      setPeekCount(n);
                      requestDeck(deckType, n);
                    }
                  }
                }}
                className="w-12 bg-fs-darker border border-fs-gold/30 rounded px-1 text-center text-fs-parchment focus:outline-none focus:border-fs-gold"
              />
              <span>cards</span>
            </div>
          )}
        </div>

        {!isDiscard && deckCards.length > 0 && (
          <p className="text-xs text-fs-parchment/40 mb-2 italic">
            Card #1 is on top.{canReorder ? ' Hover a card to reveal reorder buttons.' : ''}
            {' '}Viewing is logged to all players.
          </p>
        )}

        <div className="overflow-y-auto max-h-[50vh] space-y-0.5">
          <AnimatePresence mode="wait">
            {displayCards.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-fs-parchment/30 py-8 text-sm"
              >
                {isDiscard ? 'Discard pile is empty' : 'Deck is empty'}
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                {displayCards.map((cardId, i) => (
                  <DeckCardRow
                    key={`${cardId}-${i}`}
                    cardId={cardId}
                    position={i + 1}
                    isDiscard={isDiscard}
                    canReorder={canReorder}
                    onMoveTop={() => handleReorder(cardId, 'top')}
                    onMoveBottom={() => handleReorder(cardId, 'bottom')}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function InlineTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-3 py-1 rounded-t transition-colors ${
        active
          ? 'text-fs-gold border-b-2 border-fs-gold font-semibold'
          : 'text-fs-parchment/50 hover:text-fs-parchment'
      }`}
    >
      {label}
    </button>
  );
}
