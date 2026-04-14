import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientCard, CardInPlay } from '../../store/gameStore';
import { CardTooltip } from './CardTooltip';
import { useGameStore } from '../../store/gameStore';
import { Tooltip } from '../ui/Tooltip';
import { getSocket } from '../../socket/client';
import { SERVER_URL } from '../../config';
import { isTouchDevice } from '../../hooks/useIsTouchDevice';

export interface CardAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'soul' | 'ghost';
}

interface CardComponentProps {
  card: ClientCard;
  instance?: CardInPlay;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCounters?: boolean;
  /** If provided, hovering shows an action popover with these options */
  actions?: CardAction[];
  /** Fallback click handler (if no actions, click opens modal) */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  faceDown?: boolean;
  /** If true, the action popover opens below the card instead of above */
  popoverBelow?: boolean;
  /** If true, the popover opens on hover even with no game actions — enables counter row */
  alwaysPopover?: boolean;
  /** If true, swaps width and height so the card occupies a landscape footprint (for pre-rotated images) */
  landscape?: boolean;
}

const CARD_SIZES = {
  xs: { width: 52, height: 71 },
  sm: { width: 78, height: 107 },
  md: { width: 117, height: 160 },
  lg: { width: 182, height: 249 },
};

const ACTION_COLORS: Record<string, string> = {
  default: 'bg-fs-brown hover:bg-fs-brown/80 text-fs-parchment border-fs-gold/30',
  danger: 'bg-red-900/70 hover:bg-red-800 text-red-300 border-red-700/50',
  soul: 'bg-purple-900/70 hover:bg-purple-800 text-purple-300 border-purple-700/50',
  ghost: 'bg-transparent hover:bg-fs-darker text-fs-parchment/70 border-fs-gold/20',
};

const HOVER_OPEN_DELAY = 200;  // ms before popover appears on hover
const HOVER_CLOSE_DELAY = 150; // ms before popover closes when mouse leaves

export function CardComponent({
  card,
  instance,
  size = 'md',
  showCounters = true,
  actions,
  onClick,
  selected = false,
  className = '',
  faceDown = false,
  popoverBelow = false,
  alwaysPopover = false,
  landscape = false,
}: CardComponentProps) {
  const { setModalCard, setHoveredCard } = useGameStore();
  const dim = CARD_SIZES[size];
  const containerWidth  = landscape ? dim.height : dim.width;
  const containerHeight = landscape ? dim.width  : dim.height;
  const isSpent = instance?.charged === false;
  const isFlipped = instance?.flipped === true;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evaluate once per render — pointer type doesn't change mid-session
  const isTouch = isTouchDevice();

  const hasPopoverContent = alwaysPopover || (actions && actions.length > 0);

  // When flipped, substitute the back-face image and name
  const displayImageUrl = isFlipped && card.backImageUrl ? card.backImageUrl : card.imageUrl;
  const displayName = isFlipped && card.flipSideName ? card.flipSideName : card.name;

  const clearTimers = useCallback(() => {
    if (hoverOpenTimer.current) { clearTimeout(hoverOpenTimer.current); hoverOpenTimer.current = null; }
    if (hoverCloseTimer.current) { clearTimeout(hoverCloseTimer.current); hoverCloseTimer.current = null; }
  }, []);

  // Close popover when clicking/tapping outside
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        clearTimers();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [popoverOpen, clearTimers]);

  // Clean up timers on unmount
  useEffect(() => clearTimers, [clearTimers]);

  // Hover handlers on the entire container (card + popover)
  const handleMouseEnter = useCallback(() => {
    if (faceDown || !hasPopoverContent || isTouch) return;
    // Cancel any pending close
    if (hoverCloseTimer.current) { clearTimeout(hoverCloseTimer.current); hoverCloseTimer.current = null; }
    // Start open delay
    if (!popoverOpen && !hoverOpenTimer.current) {
      hoverOpenTimer.current = setTimeout(() => {
        setPopoverOpen(true);
        hoverOpenTimer.current = null;
      }, HOVER_OPEN_DELAY);
    }
  }, [faceDown, hasPopoverContent, isTouch, popoverOpen]);

  const handleMouseLeave = useCallback(() => {
    if (!hasPopoverContent || isTouch) return;
    // Cancel any pending open
    if (hoverOpenTimer.current) { clearTimeout(hoverOpenTimer.current); hoverOpenTimer.current = null; }
    // Start close delay
    if (popoverOpen && !hoverCloseTimer.current) {
      hoverCloseTimer.current = setTimeout(() => {
        setPopoverOpen(false);
        hoverCloseTimer.current = null;
      }, HOVER_CLOSE_DELAY);
    }
  }, [hasPopoverContent, isTouch, popoverOpen]);

  const handleClick = () => {
    if (faceDown) return;
    // On touch: tap toggles the action popover; the "View card" button inside opens the modal
    if (isTouch && hasPopoverContent) {
      setPopoverOpen((v) => !v);
      return;
    }
    // On mouse: click always opens the full card modal
    if (onClick) {
      onClick();
    } else {
      setModalCard(card);
    }
  };

  const serverUrl = SERVER_URL;

  return (
    <Tooltip
      content={!faceDown && !popoverOpen ? <CardTooltip card={card} instance={instance} /> : null}
      delay={500}
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
          onMouseEnter={() => { if (!isTouch && !faceDown) setHoveredCard(card); }}
          onMouseLeave={() => { if (!isTouch) setHoveredCard(null); }}
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

          {/* Counters overlay */}
          {showCounters && instance && (
            <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-0.5 p-0.5">
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

          {/* Soul value badge */}
          {card.soulValue > 0 && !faceDown && (
            <div className="absolute top-0 right-0 w-4 h-4 bg-fs-soul rounded-full text-white text-xs flex items-center justify-center font-bold shadow-lg">
              {card.soulValue}
            </div>
          )}

          {/* Flip card indicator badge */}
          {card.backImageUrl && !faceDown && (
            <div
              className="absolute top-0 left-0 w-4 h-4 bg-fs-dark/80 border border-fs-gold/40 rounded-sm text-fs-gold text-xs flex items-center justify-center leading-none shadow"
              title="Dual-sided card"
            >
              ↕
            </div>
          )}

          {/* Eternal badge */}
          {!faceDown && card.isEternal && (
            <div
              className="absolute bottom-0 left-0 px-1 py-0.5 bg-amber-900/80 border-t border-r border-amber-700/50 rounded-br-sm text-amber-400 text-xs leading-none pointer-events-none"
              title="Eternal — cannot be destroyed"
            >
              ETR
            </div>
          )}
        </motion.div>

        {/* Action popover — shown on hover (desktop) or tap (touch) */}
        <AnimatePresence>
          {popoverOpen && hasPopoverContent && (
            <motion.div
              className={`absolute z-50 ${popoverBelow ? 'top-full mt-1' : 'bottom-full mb-1'} left-1/2 -translate-x-1/2 bg-fs-dark border border-fs-gold/40 rounded-lg shadow-2xl p-1.5 min-w-[140px]`}
              initial={{ opacity: 0, y: popoverBelow ? -6 : 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverBelow ? -6 : 6, scale: 0.95 }}
              transition={{ duration: 0.12 }}
            >
              {/* Card name header */}
              <div className="text-sm text-fs-gold font-display font-semibold px-1 pb-1 mb-1 border-b border-fs-gold/20 truncate">
                {displayName}
              </div>
              <div className="flex flex-col gap-0.5">
                {(actions ?? []).map((action, i) => (
                  <button
                    key={i}
                    className={`text-sm px-2 py-1.5 rounded border text-left transition-colors ${
                      ACTION_COLORS[action.variant ?? 'default']
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverOpen(false);
                      clearTimers();
                      action.onClick();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
                {/* Generic counter row */}
                {instance && (
                  <div className="flex items-center justify-between px-1 pt-1 mt-0.5 border-t border-fs-gold/10">
                    <span className="text-xs text-fs-parchment/40">
                      Counters: {instance.genericCounters}
                    </span>
                    <div className="flex gap-1">
                      <button
                        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold leading-none"
                        title="Remove counter"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (instance.genericCounters > 0) {
                            getSocket().emit('action:remove_counter', {
                              instanceId: instance.instanceId,
                              counterType: 'generic',
                              amount: 1,
                            });
                          }
                        }}
                      >−</button>
                      <button
                        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold leading-none"
                        title="Add counter"
                        onClick={(e) => {
                          e.stopPropagation();
                          getSocket().emit('action:add_counter', {
                            instanceId: instance.instanceId,
                            counterType: 'generic',
                            amount: 1,
                          });
                        }}
                      >+</button>
                    </div>
                  </div>
                )}
                {/* View card link */}
                <button
                  className="text-sm px-2 py-1 rounded border text-left transition-colors text-fs-parchment/50 border-fs-gold/10 hover:text-fs-parchment hover:bg-fs-darker"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverOpen(false);
                    clearTimers();
                    setModalCard(card);
                  }}
                >
                  View card
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Tooltip>
  );
}

function CounterBadge({ label, color, title }: { label: string; color: string; title: string }) {
  return (
    <span
      className={`${color} text-white text-sm px-1 rounded-sm leading-tight font-mono`}
      title={title}
    >
      {label}
    </span>
  );
}
