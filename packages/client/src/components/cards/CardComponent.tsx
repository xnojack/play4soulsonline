import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ClientCard, CardInPlay } from '../../store/gameStore';
import { useGameStore } from '../../store/gameStore';
import { SERVER_URL } from '../../config';
import { isTouchDevice } from '../../hooks/useIsTouchDevice';
import { useDragState } from '../board/DnDProvider';
import { CardHoverPreview } from './CardHoverPreview';

export interface CardAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'soul' | 'ghost';
}

interface CardComponentProps {
  card: ClientCard;
  instance?: CardInPlay;
  size?: '2xs' | '3xs' | 'xs' | 'sm' | 'md' | 'lg';
  showCounters?: boolean;
  /** Reserved for future automation — not wired to UI */
  actions?: CardAction[];
  /** 1-2 primary actions shown as buttons below the card */
  primaryActions?: CardAction[];
  /** Fallback click handler (if no actions, click opens modal) */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  faceDown?: boolean;
  /** Reserved — kept for API compat */
  popoverBelow?: boolean;
  /** Reserved for future automation — not wired to UI */
  alwaysPopover?: boolean;
  /** If true, swaps width and height so the card occupies a landscape footprint */
  landscape?: boolean;
}

const CARD_SIZES = {
   '3xs': { width: 26, height: 35 },
  '2xs': { width: 52, height: 71 },
  xs: { width: 104, height: 142 },
  sm: { width: 156, height: 214 },
  md: { width: 234, height: 320 },
  lg: { width: 364, height: 498 },
};

const ACTION_COLORS: Record<string, string> = {
  default: 'bg-fs-brown hover:bg-fs-brown/80 text-fs-parchment border-fs-gold/30',
  danger: 'bg-red-900/70 hover:bg-red-800 text-red-300 border-red-700/50',
  soul: 'bg-purple-900/70 hover:bg-purple-800 text-purple-300 border-purple-700/50',
  ghost: 'bg-transparent hover:bg-fs-darker text-fs-parchment/70 border-fs-gold/20',
};

const HOVER_OPEN_DELAY = 120;

export function CardComponent({
  card,
  instance,
  size = 'md',
  showCounters = true,
  actions: _actions,
  primaryActions,
  onClick,
  selected = false,
  className = '',
  faceDown = false,
  popoverBelow: _popoverBelow,
  alwaysPopover: _alwaysPopover,
  landscape = false,
}: CardComponentProps) {
  const { setModalCard, setHoveredCard, setHoveredCardInstance } = useGameStore();
  const { activeDrag } = useDragState();
  const dim = CARD_SIZES[size];
  const containerWidth = landscape ? dim.height : dim.width;
  const containerHeight = landscape ? dim.width : dim.height;
  const isSpent = instance?.charged === false;
  const isFlipped = instance?.flipped === true;
  const isTouch = isTouchDevice();

  const containerRef = useRef<HTMLDivElement>(null);
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const displayImageUrl = isFlipped && card.backImageUrl ? card.backImageUrl : card.imageUrl;
  const displayName = isFlipped && card.flipSideName ? card.flipSideName : card.name;

  const clearTimers = useCallback(() => {
    if (hoverOpenTimer.current) { clearTimeout(hoverOpenTimer.current); hoverOpenTimer.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Close preview immediately when a drag starts
  useEffect(() => {
    if (activeDrag) {
      clearTimers();
      setPreviewOpen(false);
    }
  }, [activeDrag, clearTimers]);

  const handleMouseEnter = useCallback(() => {
    if (faceDown || isTouch || activeDrag) return;
    if (!previewOpen && !hoverOpenTimer.current) {
      hoverOpenTimer.current = setTimeout(() => {
        hoverOpenTimer.current = null;
        if (containerRef.current) {
          setAnchorRect(containerRef.current.getBoundingClientRect());
        }
        setPreviewOpen(true);
      }, HOVER_OPEN_DELAY);
    }
  }, [faceDown, isTouch, activeDrag, previewOpen]);

  const handleMouseLeave = useCallback(() => {
    if (isTouch) return;
    clearTimers();
    setPreviewOpen(false);
  }, [isTouch, clearTimers]);

  const handleClick = () => {
    if (faceDown) return;
    if (onClick) {
      onClick();
    } else {
      setModalCard(card);
    }
  };

  const serverUrl = SERVER_URL;

  return (
    <>
      <div
        style={primaryActions && primaryActions.length > 0 ? { paddingBottom: '64px' } : undefined}
      >
        <div
          ref={containerRef}
          className={`relative inline-block select-none ${className}`}
          style={{ width: containerWidth, height: containerHeight }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <motion.div
            className="w-full h-full cursor-pointer"
            style={{ rotate: isSpent ? 90 : 0 }}
            animate={{ rotate: isSpent ? 90 : 0 }}
            transition={{ duration: 0.25, type: 'spring', stiffness: 200, damping: 25 }}
            onClick={handleClick}
            onMouseEnter={() => {
              if (!isTouch && !faceDown) {
                setHoveredCard(card);
                if (instance) setHoveredCardInstance({ cardId: card.id, instanceId: instance.instanceId });
              }
            }}
            onMouseLeave={() => { if (!isTouch) { setHoveredCard(null); setHoveredCardInstance(null); } }}
            whileHover={isTouch ? {} : { scale: 1.05, zIndex: 10 }}
          >
            <img
              src={faceDown ? '/card-back.png' : `${serverUrl}${displayImageUrl}`}
              alt={faceDown ? 'Card' : displayName}
              className={`w-full h-full object-cover rounded-sm card-shadow ${
                selected ? 'ring-2 ring-fs-gold-light ring-offset-1 ring-offset-fs-darker' : ''
              } ${isSpent ? 'card-spent' : ''}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-card.png';
              }}
              draggable={false}
            />

            {showCounters && instance && (
              <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-2 p-1">
                {instance.damageCounters > 0 && (
                  <CounterBadge label={`${instance.damageCounters}`} color="bg-red-700" title="Damage" />
                )}
                {instance.hpCounters > 0 && (
                  <CounterBadge label={`+${instance.hpCounters}HP`} color="bg-pink-700" title="HP Counters" />
                )}
                {instance.atkCounters > 0 && (
                  <CounterBadge label={`+${instance.atkCounters}ATK`} color="bg-orange-700" title="ATK Counters" />
                )}
                {instance.genericCounters > 0 && (
                  <CounterBadge label={`${instance.genericCounters}`} color="bg-gray-600" title="Counters" />
                )}
                {Object.entries(instance.namedCounters).map(([name, count]) =>
                  count > 0 ? (
                    <CounterBadge key={name} label={`${count} ${name}`} color="bg-purple-700" title={name} />
                  ) : null
                )}
              </div>
            )}

            {card.soulValue > 0 && !faceDown && (
              <div className="absolute top-0 right-0 w-8 h-8 bg-fs-soul rounded-full text-white text-lg flex items-center justify-center font-bold shadow-lg">
                {card.soulValue}
              </div>
            )}

            {card.backImageUrl && !faceDown && (
              <div
                className="absolute top-0 left-0 w-8 h-8 bg-fs-dark/80 border-2 border-fs-gold/40 rounded-sm text-fs-gold text-lg flex items-center justify-center leading-none shadow"
                title="Dual-sided card"
              >
                ↕
              </div>
            )}

            {!faceDown && card.isEternal && (
              <div
                className="absolute bottom-0 left-0 px-2 py-1 bg-amber-900/80 border-t border-r border-amber-700/50 rounded-br-sm text-amber-400 text-lg leading-none pointer-events-none"
                title="Eternal — cannot be destroyed"
              >
                ETR
              </div>
            )}
          </motion.div>

          {primaryActions && primaryActions.length > 0 && (
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center gap-2">
              {primaryActions.map((action, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                  className={`text-2xl px-3 py-1 rounded border transition-colors ${
                    ACTION_COLORS[action.variant ?? 'default']
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!faceDown && (
        <CardHoverPreview
          card={card}
          instance={instance}
          open={previewOpen}
          anchorRect={anchorRect}
          landscape={landscape}
        />
      )}
    </>
  );
}

function CounterBadge({ label, color, title }: { label: string; color: string; title: string }) {
  return (
    <span
      className={`${color} text-white text-xl px-1 rounded-sm leading-tight font-mono`}
      title={title}
    >
      {label}
    </span>
  );
}
