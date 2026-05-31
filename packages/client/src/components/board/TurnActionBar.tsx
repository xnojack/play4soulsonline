import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useHasPriority, useMyPlayer } from '../../hooks/useMyPlayer';
import { DiceRoller } from '../dice/DiceRoller';

interface TurnActionBarProps {
  onScrollToPlayer?: () => void;
  /** When true, render inline (no fixed positioning, no slide-in animation) for embedding in a layout section. */
  inline?: boolean;
  /** When true, render only the inner content row with no container wrapper (bg, border, animation).
   *  Use when embedding inside an existing styled container like BottomBar. */
  bare?: boolean;
}

/**
 * Turn action bar — turn phases + priority actions.
 * Default mode: sticky bottom overlay (fixed positioning).
 * Inline mode (`inline=true`): renders as a regular flex child for embedding in the bottom section.
 */
export function TurnActionBar({ onScrollToPlayer, inline = false, bare = false }: TurnActionBarProps) {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const hasPriority = useHasPriority();
  const myPlayer = useMyPlayer();

  if (!game) return null;
  if (game.phase !== 'active') return null;
  if (myPlayer?.isSpectator) return null;

  const activePlayer = game.players.find((p) => p.id === game.turn.activePlayerId);
  const priorityPlayer = game.priorityQueue[0]
    ? game.players.find((p) => p.id === game.priorityQueue[0])
    : null;
  const priorityIsActive = priorityPlayer?.id === activePlayer?.id;

  /** My Cards button — shown on all states, mobile only */
  const myCardsButton = onScrollToPlayer && (
    <button
      onClick={onScrollToPlayer}
      className="lg:hidden flex items-center gap-1 px-2 py-1 rounded border border-fs-gold/30 text-fs-parchment/60 hover:text-fs-parchment hover:border-fs-gold/50 text-xs transition-colors flex-shrink-0"
      title="Scroll to your cards"
    >
      <span>👤</span>
      <span className="hidden sm:inline">My Cards</span>
    </button>
  );

  const stackLength = game.stack.length;
  const turn = game.turn;
  const lootDrawn = turn.lootDrawn;
  const lootPlaysRemaining = turn.lootPlaysRemaining;
  const lootPlayed = lootPlaysRemaining < 1;
  const hasAttacked = turn.attacksDeclared > 0;
  const hasPurchased = turn.purchasesMade > 0;
  const inAttack = !!turn.currentAttack;
  const stackEmpty = stackLength === 0;

  const attackPhase = turn.currentAttack?.phase;
  const hasAttackDeclarationOnStack =
    game.stack.some((i) => i.type === 'attack_declaration' && !i.isCanceled);
  const showAttackDice =
    isMyTurn && inAttack && !hasAttackDeclarationOnStack &&
    (attackPhase === 'declared' || attackPhase === 'rolling');

  const handleEndTurn = () => getSocket().emit('action:end_turn');
  const handlePassPriority = () => getSocket().emit('action:pass_priority');
  const handleResolveTop = () => getSocket().emit('action:resolve_top');
  const handleDrawLoot = () => getSocket().emit('action:draw_loot', { playerId: myPlayer!.id, count: 1 });
  const handleGrantLootPlay = () => getSocket().emit('action:grant_loot_play');

  // ── Priority (not your turn) ─────────────────────────────────────────────
  if (!isMyTurn && hasPriority) {
    const timeoutRemaining = game?.priorityTimeoutRemaining ?? 0;
    const isUrgent = timeoutRemaining > 0 && timeoutRemaining <= 5;

    const innerContent = (
      <div className={`${bare ? '' : inline ? '' : 'max-w-5xl mx-auto'} px-3 md:px-4 py-2 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <motion.div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${isUrgent ? 'bg-red-400' : 'bg-fs-gold'}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: isUrgent ? 0.5 : 1.5, repeat: Infinity }}
          />
          <span className={`text-sm font-display font-semibold ${isUrgent ? 'text-red-400' : 'text-fs-gold'}`}>
            You have priority
          </span>
          {stackLength > 0 && (
            <span className="text-xs text-fs-parchment/40">({stackLength} on stack)</span>
          )}
          {timeoutRemaining > 0 && (
            <span className={`text-xs font-display font-semibold ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              {timeoutRemaining}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {myCardsButton}
          <DiceRoller compact context="manual" />
          <button
            onClick={handlePassPriority}
            className={`px-4 py-1.5 rounded-lg border-2 font-display font-semibold text-sm transition-colors ${
              isUrgent
                ? 'border-red-500/80 text-red-400 hover:bg-red-900/20'
                : 'border-fs-gold/60 text-fs-gold hover:bg-fs-gold/10'
            }`}
          >
            Pass
          </button>
        </div>
      </div>
    );

    if (bare) return innerContent;

    const containerCls = inline
      ? 'bg-fs-darker/70 border border-fs-gold/30 rounded-lg backdrop-blur-sm'
      : 'fixed bottom-0 left-0 right-0 z-40 bg-fs-dark/95 border-t-2 border-fs-gold/50 backdrop-blur-sm';
    return (
      <AnimatePresence>
        <motion.div
          className={containerCls}
          initial={inline ? false : { y: 60 }}
          animate={inline ? {} : { y: 0 }}
          exit={inline ? {} : { y: 60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {innerContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Active turn ──────────────────────────────────────────────────────────
  if (isMyTurn) {
    const innerContent = (
      <div className={`${bare ? '' : inline ? '' : 'max-w-6xl mx-auto'} px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-display text-fs-gold font-bold px-2 py-0.5 bg-fs-gold/15 rounded">
            Your Turn
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center gap-0.5 md:gap-1 flex-wrap">
          <PhaseButton
            label="Draw Loot"
            icon="🃏"
            active={!lootDrawn && stackEmpty && !inAttack}
            done={lootDrawn}
            onClick={handleDrawLoot}
            disabled={!stackEmpty}
          />
          <PhaseArrow />
          <PhaseButton
            label="Play Loot"
            icon="✋"
            active={lootPlaysRemaining > 0 && stackEmpty && !inAttack}
            done={lootPlayed}
            hint={lootPlaysRemaining > 0 ? `${lootPlaysRemaining} play${lootPlaysRemaining !== 1 ? 's' : ''} remaining` : 'Loot played'}
          />
          <PhaseArrow />
          <PhaseButton
            label="Buy"
            icon="💰"
            active={!inAttack && stackEmpty}
            done={hasPurchased}
            disabled={inAttack || !stackEmpty}
            hint={hasPurchased ? `${turn.purchasesMade} bought` : undefined}
          />
          <PhaseArrow />
          <PhaseButton
            label="Attack"
            icon="⚔"
            active={!inAttack && !hasAttacked && stackEmpty}
            done={hasAttacked}
            disabled={inAttack || !stackEmpty}
            hint={inAttack ? 'In combat' : undefined}
          />
          <PhaseArrow />
          <button
            onClick={handleEndTurn}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-display font-semibold text-sm transition-colors ${
              stackEmpty
                ? 'bg-fs-gold text-fs-dark hover:bg-fs-gold-light shadow-lg shadow-fs-gold/20'
                : 'bg-amber-900/60 text-amber-300 border border-amber-600/50 hover:bg-amber-800/60 hover:border-amber-500/70'
            }`}
            title={stackEmpty ? 'End your turn' : `Force end turn — ${stackLength} stack item${stackLength !== 1 ? 's' : ''} will be discarded`}
          >
            {stackEmpty ? 'End Turn' : 'End Turn ⚠'}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {myCardsButton}
          <DiceRoller compact context={showAttackDice ? 'attack' : 'manual'} />
          <button
            onClick={handleGrantLootPlay}
            className="text-xs px-1.5 py-0.5 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment hover:border-fs-gold/50 transition-colors"
            title="Grant yourself an extra loot play this turn"
          >
            +1 Play
          </button>
          {hasPriority && stackLength > 0 && (
            <>
              <button
                onClick={handlePassPriority}
                className="px-3 py-1.5 rounded-lg border border-fs-gold/40 text-fs-parchment/70 text-sm hover:bg-fs-gold/10 transition-colors"
              >
                Pass
              </button>
              <button
                onClick={handleResolveTop}
                className="px-3 py-1.5 rounded-lg border border-fs-gold/40 text-fs-gold text-sm hover:bg-fs-gold/10 transition-colors"
                title="Resolve top of stack immediately"
              >
                Resolve
              </button>
            </>
          )}
          {hasPriority && stackLength === 0 && (
            <button
              onClick={handlePassPriority}
              className="px-3 py-1.5 rounded-lg border border-fs-gold/30 text-fs-parchment/50 text-sm hover:bg-fs-gold/10 transition-colors"
            >
              Pass Priority
            </button>
          )}
        </div>
      </div>
    );

    if (bare) return innerContent;

    const containerCls = inline
      ? 'bg-fs-darker/70 border border-fs-gold/30 rounded-lg backdrop-blur-sm'
      : 'fixed bottom-0 left-0 right-0 z-40 bg-fs-dark/95 border-t-2 border-fs-gold/40 backdrop-blur-sm';
    return (
      <AnimatePresence>
        <motion.div
          className={containerCls}
          initial={inline ? false : { y: 80 }}
          animate={inline ? {} : { y: 0 }}
          exit={inline ? {} : { y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {innerContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Idle — not your turn, no priority ───────────────────────────────────
  const idleInnerContent = (
    <div className={`${bare ? '' : inline ? '' : 'max-w-6xl mx-auto'} px-4 py-2 flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-3 text-sm flex-1 min-w-0">
        <span className="text-fs-parchment/50">
          <span className="text-fs-parchment/80 font-display">
            {activePlayer?.id === myPlayer?.id ? 'Your turn' : `${activePlayer?.name ?? '?'}'s turn`}
          </span>
        </span>
        {priorityPlayer && !priorityIsActive && (
          <span className="text-fs-parchment/40 text-xs flex items-center gap-1">
            <span className="text-fs-gold">⚡</span>
            <span>{priorityPlayer.id === myPlayer?.id ? 'You have' : `${priorityPlayer.name} has`} priority</span>
          </span>
        )}
        {priorityIsActive && priorityPlayer && (
          <span className="text-fs-parchment/30 text-xs">
            {priorityPlayer.id === myPlayer?.id ? 'You have' : `${priorityPlayer.name} has`} priority
          </span>
        )}
      </div>
      {myCardsButton}
    </div>
  );

  if (bare) return idleInnerContent;

  const idleCls = inline
    ? 'bg-fs-darker/60 border border-fs-gold/20 rounded-lg backdrop-blur-sm'
    : 'fixed bottom-0 left-0 right-0 z-40 bg-fs-dark/90 border-t border-fs-gold/20 backdrop-blur-sm';
  return (
    <div className={idleCls}>
      {idleInnerContent}
    </div>
  );
}

/** Turn phase breadcrumb button */
function PhaseButton({
  label,
  icon,
  active,
  done,
  onClick,
  disabled,
  hint,
}: {
  label: string;
  icon: string;
  active: boolean;
  done: boolean;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const isClickable = onClick && !disabled && active;

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`flex items-center gap-0.5 md:gap-1 px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-lg text-xs md:text-sm font-display transition-colors ${
        done
          ? 'bg-fs-green/20 text-green-400/70 border border-green-700/30'
          : active && isClickable
          ? 'bg-fs-brown/60 text-fs-parchment border border-fs-gold/40 hover:bg-fs-brown hover:border-fs-gold/70 cursor-pointer'
          : 'bg-fs-darker/40 text-fs-parchment/25 border border-fs-gold/10 cursor-default'
      }`}
      title={hint ?? label}
    >
      <span className="text-xs">{done ? '✓' : icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Arrow between phase buttons */
function PhaseArrow() {
  return (
    <span className="text-fs-parchment/15 text-xs mx-0.5">→</span>
  );
}

