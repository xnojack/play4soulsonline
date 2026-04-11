import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientCard, CardInPlay } from '../../store/gameStore';
import { CardTooltip } from './CardTooltip';
import { useGameStore } from '../../store/gameStore';
import { Tooltip } from '../ui/Tooltip';
import { getSocket } from '../../socket/client';

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
  /** If provided, clicking opens an action popover with these options instead of the modal */
  actions?: CardAction[];
  /** Fallback: if no actions, click opens modal */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  faceDown?: boolean;
  /** If true, the action popover opens below the card instead of above */
  popoverBelow?: boolean;
  /** If true, clicking always opens the popover (even with no game actions) — enables counter row */
  alwaysPopover?: boolean;
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
}: CardComponentProps) {
  const { setModalCard, setHoveredCard } = useGameStore();
  const dim = CARD_SIZES[size];
  const isSpent = instance?.charged === false;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  const handleClick = () => {
    if (faceDown) return;
    if (alwaysPopover || (actions && actions.length > 0)) {
      setPopoverOpen((v) => !v);
    } else if (onClick) {
      onClick();
    } else {
      setModalCard(card);
    }
  };

  const serverUrl = import.meta.env.VITE_SERVER_URL || '';

  return (
    <Tooltip
      content={!faceDown && !popoverOpen ? <CardTooltip card={card} instance={instance} /> : null}
      delay={500}
    >
      <div
        ref={popoverRef}
        className={`relative inline-block select-none ${className}`}
        style={{ width: dim.width, height: dim.height }}
      >
        <motion.div
          className="w-full h-full cursor-pointer"
          style={{ rotate: isSpent ? 90 : 0 }}
          animate={{ rotate: isSpent ? 90 : 0 }}
          transition={{ duration: 0.25, type: 'spring', stiffness: 200, damping: 25 }}
          onClick={handleClick}
          onMouseEnter={() => !faceDown && setHoveredCard(card)}
          onMouseLeave={() => setHoveredCard(null)}
          whileHover={{ scale: 1.05, zIndex: 10 }}
        >
          <img
            src={faceDown ? '/card-back.png' : `${serverUrl}${card.imageUrl}`}
            alt={faceDown ? 'Card' : card.name}
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

          {/* "Has actions" indicator */}
          {(alwaysPopover || (actions && actions.length > 0)) && !faceDown && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0.5 pointer-events-none">
              <div className="w-1 h-1 rounded-full bg-fs-gold/60" />
            </div>
          )}
        </motion.div>

        {/* Print status badge */}
        {!faceDown && card.printStatus === 'not_in_print' && (
          <div className="absolute -bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-xs px-1 py-0.5 rounded bg-gray-600/80 text-gray-300 leading-none whitespace-nowrap">
              Not in Print
            </span>
          </div>
        )}
        {!faceDown && card.printStatus === 'never_printed' && (
          <div className="absolute -bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-xs px-1 py-0.5 rounded bg-red-900/80 text-red-300 leading-none whitespace-nowrap">
              Never Printed
            </span>
          </div>
        )}

        {/* Action popover */}
        <AnimatePresence>
          {popoverOpen && (alwaysPopover || actions) && (
            <motion.div
              className={`absolute z-50 ${popoverBelow ? 'top-full mt-1' : 'bottom-full mb-1'} left-1/2 -translate-x-1/2 bg-fs-dark border border-fs-gold/40 rounded-lg shadow-2xl p-1.5 min-w-[130px]`}
              initial={{ opacity: 0, y: popoverBelow ? -6 : 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverBelow ? -6 : 6, scale: 0.95 }}
              transition={{ duration: 0.12 }}
            >
              {/* Card name header */}
              <div className="text-sm text-fs-gold font-display font-semibold px-1 pb-1 mb-1 border-b border-fs-gold/20 truncate">
                {card.name}
              </div>
              <div className="flex flex-col gap-0.5">
                {(actions ?? []).map((action, i) => (
                  <button
                    key={i}
                    className={`text-sm px-2 py-1 rounded border text-left transition-colors ${
                      ACTION_COLORS[action.variant ?? 'default']
                    }`}
                    onClick={() => {
                      setPopoverOpen(false);
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
                {/* Always offer "View card" */}
                <button
                  className="text-sm px-2 py-1 rounded border text-left transition-colors text-fs-parchment/50 border-fs-gold/10 hover:text-fs-parchment hover:bg-fs-darker"
                  onClick={() => {
                    setPopoverOpen(false);
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
