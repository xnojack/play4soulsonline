import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientCard, CardInPlay } from '../../store/gameStore';
import { useDragState } from '../board/DnDProvider';
import { SERVER_URL } from '../../config';

const TYPE_COLORS: Record<string, string> = {
  Monster: 'text-red-400',
  Treasure: 'text-fs-gold',
  Loot: 'text-green-400',
  Character: 'text-blue-400',
  Room: 'text-orange-400',
  BonusSoul: 'text-purple-400',
};

const PREVIEW_W = 175;
const PREVIEW_H = 240;
const MARGIN = 12;

interface CardHoverPreviewProps {
  card: ClientCard;
  instance?: CardInPlay;
  open: boolean;
  anchorRect: DOMRect | null;
}

export function CardHoverPreview({ card, instance, open, anchorRect }: CardHoverPreviewProps) {
  const { activeDrag } = useDragState();
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const serverUrl = SERVER_URL;

  const isFlipped = instance?.flipped === true;
  const displayImageUrl = isFlipped && card.backImageUrl ? card.backImageUrl : card.imageUrl;
  const displayName = isFlipped && card.flipSideName ? card.flipSideName : card.name;
  const typeColor = TYPE_COLORS[card.cardType] ?? 'text-fs-parchment';

  useEffect(() => {
    if (!open || !anchorRect || !panelRef.current) return;
    const panelEl = panelRef.current;
    const panelWidth = panelEl.offsetWidth || 340;
    const panelHeight = panelEl.offsetHeight || PREVIEW_H + 32;

    const spaceRight = window.innerWidth - anchorRect.right - MARGIN;
    const spaceLeft = anchorRect.left - MARGIN;

    let left: number;
    if (spaceRight >= panelWidth) {
      left = anchorRect.right + MARGIN;
    } else if (spaceLeft >= panelWidth) {
      left = anchorRect.left - panelWidth - MARGIN;
    } else {
      left = Math.max(MARGIN, (window.innerWidth - panelWidth) / 2);
    }

    let top = anchorRect.top + anchorRect.height / 2 - panelHeight / 2;
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - panelHeight - MARGIN));
    setCoords({ top, left });
  }, [open, anchorRect]);

  if (activeDrag || !open || !anchorRect) return null;

  const hasText = !!(card.abilityText || card.rewardText);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          className="fixed z-[9998] flex gap-3 bg-fs-dark border border-fs-gold/40 rounded-lg shadow-2xl p-3 pointer-events-none"
          style={coords ? { top: coords.top, left: coords.left } : { visibility: 'hidden', top: 0, left: 0 }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
          {/* Card image */}
          <div className="flex-shrink-0">
            <img
              src={`${serverUrl}${displayImageUrl}`}
              alt={displayName}
              className="rounded card-shadow"
              style={{ width: PREVIEW_W, height: PREVIEW_H, objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
              draggable={false}
            />
          </div>

          {/* Text panel — only if there's something to show */}
          {hasText && (
            <div className="flex flex-col min-w-0" style={{ width: 200 }}>
              <div className="font-display font-semibold text-fs-gold-light text-base mb-0.5 leading-tight">
                {displayName}
              </div>
              <div className={`text-sm mb-2 ${typeColor}`}>
                {card.cardType}{card.subType ? ` — ${card.subType}` : ''}
                <span className="text-fs-parchment/40 ml-1.5 text-xs">({card.set})</span>
              </div>

              {(card.hp !== null || card.atk !== null || card.evasion !== null) && (
                <div className="flex gap-3 mb-2 text-sm flex-wrap">
                  {card.hp !== null && (
                    <span className="text-pink-400">
                      ❤ {card.hp}{instance?.hpCounters ? `+${instance.hpCounters}` : ''}
                      {instance?.damageCounters ? ` (${(card.hp + (instance?.hpCounters ?? 0)) - instance.damageCounters} left)` : ''}
                    </span>
                  )}
                  {card.atk !== null && (
                    <span className="text-orange-400">
                      🗡 {card.atk}{instance?.atkCounters ? `+${instance.atkCounters}` : ''}
                    </span>
                  )}
                  {card.evasion !== null && (
                    <span className="text-blue-400">DC {card.evasion}</span>
                  )}
                </div>
              )}

              {card.soulValue > 0 && (
                <div className="text-sm text-purple-400 mb-2">Soul Value: {card.soulValue}</div>
              )}

              {card.abilityText && (
                <div className="flex-1 overflow-y-auto text-sm text-fs-parchment/90 whitespace-pre-line leading-relaxed border-t border-fs-gold/20 pt-2 mt-1">
                  {card.abilityText}
                </div>
              )}

              {card.rewardText && (
                <div className="text-sm text-fs-gold/70 italic border-t border-fs-gold/10 pt-1 mt-1 flex-shrink-0">
                  Reward: {card.rewardText}
                </div>
              )}

              {(card.isEternal || card.threePlayerOnly) && (
                <div className="flex gap-2 mt-1 flex-wrap flex-shrink-0">
                  {card.isEternal && <span className="text-xs text-amber-400">Eternal</span>}
                  {card.threePlayerOnly && <span className="text-xs text-gray-400">3+ Players</span>}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
