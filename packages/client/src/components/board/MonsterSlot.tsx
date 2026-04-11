import React, { useState } from 'react';
import { MonsterSlot as MonsterSlotType, useGameStore } from '../../store/gameStore';
import { ResolvedCard, useCard } from './CardResolver';
import { CardAction } from '../cards/CardComponent';
import { getSocket } from '../../socket/client';
import { useIsMyTurn, useMyPlayer } from '../../hooks/useMyPlayer';

interface MonsterSlotProps {
  slot: MonsterSlotType;
}

export function MonsterSlotComponent({ slot }: MonsterSlotProps) {
  const isMyTurn = useIsMyTurn();
  const myPlayer = useMyPlayer();
  const game = useGameStore((s) => s.game);
  const [showAll, setShowAll] = useState(false);
  const [givingCurse, setGivingCurse] = useState(false);

  const isEmpty = slot.stack.length === 0;
  const topCard = isEmpty ? null : slot.stack[slot.stack.length - 1];
  const coveredCards = slot.stack.slice(0, -1);
  const topCardData = useCard(topCard?.cardId);

  const canAttack = isMyTurn && !isEmpty && game?.turn.currentAttack === null;
  const hasSoul = (topCardData?.soulValue ?? 0) > 0;
  const isEvent = topCardData?.subType === 'Event';
  // Player curse: Curse subtype with no HP stat — reveals and gets assigned to a player
  const isPlayerCurse = topCardData?.subType === 'Curse' && topCardData?.hp === null;
  // Curse monster: Curse subtype WITH HP — fully attackable, goes to kills on death
  const isCurseMonster = topCardData?.subType === 'Curse' && topCardData?.hp !== null;
  const isActiveTurn = game?.turn.activePlayerId === myPlayer?.id;

  const otherPlayers = game?.players.filter(
    (p) => p.id !== myPlayer?.id && !p.isSpectator
  ) ?? [];

  const handleAttack = () => {
    getSocket().emit('action:declare_attack', {
      targetType: 'monster_slot',
      targetSlotIndex: slot.slotIndex,
    });
  };

  const handleGainSoul = () => {
    if (!topCard || !myPlayer) return;
    getSocket().emit('action:gain_soul', {
      instanceId: topCard.instanceId,
      playerId: myPlayer.id,
    });
  };

  const handleApplyDamage = (amount: number) => {
    if (!topCard) return;
    getSocket().emit('action:apply_damage', { targetInstanceId: topCard.instanceId, amount });
  };

  const handleHeal = () => {
    if (!topCard) return;
    getSocket().emit('action:heal', { targetInstanceId: topCard.instanceId, amount: 1 });
  };

  const handleResolveEvent = () => {
    getSocket().emit('action:resolve_event', { slotIndex: slot.slotIndex });
  };

  const handleGiveCurse = (toPlayerId: string) => {
    getSocket().emit('action:give_curse', { slotIndex: slot.slotIndex, toPlayerId });
    setGivingCurse(false);
  };

  const maxHp = topCardData && topCard ? (topCardData.hp ?? 0) + topCard.hpCounters : 0;
  const currentHp = topCard ? maxHp - topCard.damageCounters : 0;

  // Build action list for the popover
  // Events: resolve button shown below card (not in popover)
  // Player curses: give-to button shown below card (not in popover)
  const actions: CardAction[] = [];
  if (!isPlayerCurse && !isEvent) {
    // Normal monsters and curse monsters (with HP) are attackable
    if (canAttack) actions.push({ label: 'Declare Attack', onClick: handleAttack, variant: 'danger' });
  }
  if (isMyTurn && hasSoul) actions.push({ label: 'Gain Soul', onClick: handleGainSoul, variant: 'soul' });
  if (topCard && !isPlayerCurse && !isEvent) {
    actions.push({ label: 'Deal 1 Damage', onClick: () => handleApplyDamage(1), variant: 'danger' });
    actions.push({ label: 'Heal 1 HP', onClick: handleHeal, variant: 'ghost' });
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-[130px]">
      <div className="section-title text-center text-sm mb-0.5">Monster {slot.slotIndex + 1}</div>

      {/* Stack display */}
      <div className="relative">
        {isEmpty ? (
          <div className="w-[117px] h-[160px] rounded border-2 border-dashed border-fs-gold/20 flex flex-col items-center justify-center text-fs-parchment/20 text-sm text-center gap-1">
            <span>Empty</span>
            {isActiveTurn && game?.turn.currentAttack === null && (
              <button
                onClick={() => getSocket().emit('action:attack_monster_deck', { slotIndex: slot.slotIndex })}
                className="text-xs px-1 py-0.5 rounded border border-red-700/40 text-red-500/60 hover:text-red-400 hover:bg-red-900/20 transition-colors mt-1"
                title="Flip top of monster deck into this slot and attack"
              >
                Flip &amp; Attack
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {coveredCards.length > 0 && (
              <div
                className="absolute -bottom-1 -right-1 bg-fs-darker border border-fs-gold/20 rounded text-xs text-fs-parchment/40 px-1 cursor-pointer z-10"
                onClick={() => setShowAll(!showAll)}
                title={`${coveredCards.length} covered card${coveredCards.length !== 1 ? 's' : ''}`}
              >
                +{coveredCards.length}
              </div>
            )}
            {topCard && (
              <ResolvedCard
                instance={topCard}
                size="md"
                actions={actions.length > 0 ? actions : undefined}
                popoverBelow
              />
            )}
          </div>
        )}
      </div>

      {/* Type / soul tag — below card, above HP tracker */}
      {!isEmpty && (isPlayerCurse || isEvent || isCurseMonster || hasSoul) && (
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          isPlayerCurse ? 'bg-red-900/80 text-red-300'
          : isCurseMonster ? 'bg-orange-900/80 text-orange-300'
          : isEvent ? 'bg-purple-900/80 text-purple-300'
          : 'bg-yellow-900/80 text-yellow-300'
        }`}>
          {isPlayerCurse ? 'Curse' : isCurseMonster ? 'Curse Monster' : isEvent ? 'Event' : `★ ${topCardData?.soulValue ?? 1}`}
        </span>
      )}

      {/* Resolve / Discard button — shown below card for Event cards */}
      {isEvent && topCard && (
        <div className="flex flex-col items-center mt-1">
          <button
            onClick={handleResolveEvent}
            className="text-xs px-3 py-1 rounded border border-purple-500/50 text-purple-300 hover:bg-purple-900/30 hover:border-purple-400/70 transition-colors font-display"
          >
            Resolve / Discard
          </button>
        </div>
      )}

      {/* Give Curse controls — shown below card for player curses */}
      {isPlayerCurse && topCard && (
        <div className="flex flex-col items-center gap-1 mt-1">
          {!givingCurse ? (
            <button
              onClick={() => setGivingCurse(true)}
              className="text-xs px-2 py-0.5 rounded border border-red-700/50 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Give Curse…
            </button>
          ) : (
            <div className="flex flex-col gap-0.5 items-center">
              <span className="text-xs text-fs-parchment/40">Give to:</span>
              {/* Self */}
              {myPlayer && (
                <button
                  onClick={() => handleGiveCurse(myPlayer.id)}
                  className="text-xs px-1.5 py-0.5 rounded border border-red-700/40 text-red-400 hover:bg-red-900/20 transition-colors w-full text-left"
                >
                  {myPlayer.name} (you)
                </button>
              )}
              {otherPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleGiveCurse(p.id)}
                  className="text-xs px-1.5 py-0.5 rounded border border-red-700/40 text-red-400 hover:bg-red-900/20 transition-colors w-full text-left"
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => setGivingCurse(false)}
                className="text-xs text-fs-parchment/30 hover:text-fs-parchment/60 mt-0.5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* HP Tracker — only for non-event, non-player-curse monsters with HP */}
      {topCard && maxHp > 0 && !isEvent && !isPlayerCurse && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleApplyDamage(1)}
            className="w-5 h-5 rounded bg-red-900/50 text-red-400 hover:bg-red-800 text-xs font-bold"
            title="Deal 1 damage"
          >-</button>
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(maxHp, 10) }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full border ${
                  i < currentHp ? 'bg-red-500 border-red-400' : 'bg-fs-darker border-gray-700'
                }`}
              />
            ))}
            {maxHp > 10 && <span className="text-sm text-fs-parchment/40">{currentHp}/{maxHp}</span>}
          </div>
          <button
            onClick={handleHeal}
            className="w-5 h-5 rounded bg-green-900/50 text-green-400 hover:bg-green-800 text-xs font-bold"
            title="Heal 1"
          >+</button>
        </div>
      )}

      {/* Covered cards expanded */}
      {showAll && coveredCards.length > 0 && (
        <div className="bg-fs-darker border border-fs-gold/20 rounded p-2 mt-1">
          <div className="text-sm text-fs-parchment/40 mb-1">Covered:</div>
          <div className="flex gap-1 flex-wrap">
            {coveredCards.map((c) => (
              <ResolvedCard key={c.instanceId} instance={c} size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

