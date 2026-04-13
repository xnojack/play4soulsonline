import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useHasPriority, useMyPlayer } from '../../hooks/useMyPlayer';
import { DiceRoller } from '../dice/DiceRoller';

/**
 * Sticky bottom action bar — visible when:
 * - It's your turn (full bar with turn phases + end turn)
 * - You have priority but it's not your turn (compact bar with pass/respond)
 * - There are stack items and you're involved
 */
export function TurnActionBar() {
  const game = useGameStore((s) => s.game);
  const isMyTurn = useIsMyTurn();
  const hasPriority = useHasPriority();
  const myPlayer = useMyPlayer();

  if (!game || !myPlayer || myPlayer.isSpectator) return null;
  if (game.phase !== 'active') return null;

  // Show the bar when it's your turn OR you have priority
  const showBar = isMyTurn || hasPriority;
  if (!showBar) return null;

  const stackLength = game.stack.length;
  const turn = game.turn;
  const lootDrawn = turn.lootDrawn;
  const lootPlaysRemaining = turn.lootPlaysRemaining;
  const lootPlayed = lootPlaysRemaining < 1;
  const hasAttacked = turn.attacksDeclared > 0;
  const hasPurchased = turn.purchasesMade > 0;
  const inAttack = !!turn.currentAttack;
  const stackEmpty = stackLength === 0;

  // Attack dice visibility
  const attackPhase = turn.currentAttack?.phase;
  const hasAttackDeclarationOnStack =
    game.stack.some((i) => i.type === 'attack_declaration' && !i.isCanceled);
  const showAttackDice =
    isMyTurn && inAttack && !hasAttackDeclarationOnStack &&
    (attackPhase === 'declared' || attackPhase === 'rolling');

  const handleEndTurn = () => {
    getSocket().emit('action:end_turn');
  };

  const handlePassPriority = () => {
    getSocket().emit('action:pass_priority');
  };

  const handleResolveTop = () => {
    getSocket().emit('action:resolve_top');
  };

  const handleDrawLoot = () => {
    getSocket().emit('action:draw_loot', { playerId: myPlayer.id, count: 1 });
  };

  const handleGrantLootPlay = () => {
    getSocket().emit('action:grant_loot_play');
  };

  // Non-active-turn player: compact priority bar
  if (!isMyTurn && hasPriority) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-40 bg-fs-dark/95 border-t-2 border-fs-gold/50 backdrop-blur-sm"
          initial={{ y: 60 }}
          animate={{ y: 0 }}
          exit={{ y: 60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
            {/* Priority indicator */}
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-fs-gold"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-sm font-display text-fs-gold font-semibold">
                You have priority
              </span>
              {stackLength > 0 && (
                <span className="text-xs text-fs-parchment/40 ml-1">
                  ({stackLength} on stack)
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <DiceRoller compact context="manual" />
              <button
                onClick={handlePassPriority}
                className="px-4 py-1.5 rounded-lg border-2 border-fs-gold/60 text-fs-gold font-display font-semibold text-sm hover:bg-fs-gold/10 transition-colors"
              >
                Pass
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Active turn: full action bar
  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-40 bg-fs-dark/95 border-t-2 border-fs-gold/40 backdrop-blur-sm"
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
          {/* Left: Turn indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-display text-fs-gold font-bold px-2 py-0.5 bg-fs-gold/15 rounded">
              Your Turn
            </span>
          </div>

          {/* Center: Turn phase breadcrumbs */}
          <div className="flex-1 flex items-center justify-center gap-1">
            {/* Draw Loot */}
            <PhaseButton
              label="Draw Loot"
              icon="🃏"
              active={!lootDrawn && stackEmpty && !inAttack}
              done={lootDrawn}
              onClick={handleDrawLoot}
              disabled={!stackEmpty}
            />
            <PhaseArrow />

            {/* Play Loot */}
            <PhaseButton
              label="Play Loot"
              icon="✋"
              active={lootPlaysRemaining > 0 && stackEmpty && !inAttack}
              done={lootPlayed}
              hint={lootPlaysRemaining > 0 ? `${lootPlaysRemaining} play${lootPlaysRemaining !== 1 ? 's' : ''} remaining` : 'Loot played'}
            />
            <PhaseArrow />

            {/* Buy */}
            <PhaseButton
              label="Buy"
              icon="💰"
              active={!inAttack && stackEmpty}
              done={hasPurchased}
              disabled={inAttack || !stackEmpty}
              hint={hasPurchased ? `${turn.purchasesMade} bought` : undefined}
            />
            <PhaseArrow />

            {/* Attack */}
            <PhaseButton
              label="Attack"
              icon="⚔"
              active={!inAttack && !hasAttacked && stackEmpty}
              done={hasAttacked}
              disabled={inAttack || !stackEmpty}
              hint={inAttack ? 'In combat' : undefined}
            />
            <PhaseArrow />

            {/* End Turn */}
            <button
              onClick={handleEndTurn}
              disabled={!stackEmpty}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-display font-semibold text-sm transition-colors ${
                stackEmpty
                  ? 'bg-fs-gold text-fs-dark hover:bg-fs-gold-light shadow-lg shadow-fs-gold/20'
                  : 'bg-fs-darker text-fs-parchment/30 border border-fs-gold/10 cursor-not-allowed'
              }`}
              title={stackEmpty ? 'End your turn' : 'Resolve the stack first'}
            >
              End Turn
            </button>
          </div>

          {/* Right: Dice + loot play grant + Stack actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <DiceRoller compact context={showAttackDice ? 'attack' : 'manual'} />
            <button
              onClick={handleGrantLootPlay}
              className="text-xs px-1.5 py-0.5 rounded border border-fs-gold/20 text-fs-parchment/40 hover:text-fs-parchment hover:border-fs-gold/50 transition-colors"
              title="Grant yourself an extra loot play this turn"
            >
              +1 Play
            </button>

            {/* Priority/Stack controls */}
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
      </motion.div>
    </AnimatePresence>
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
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-display transition-colors ${
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
