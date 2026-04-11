import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useCard } from './CardResolver';
import { getSocket } from '../../socket/client';

const serverUrl = import.meta.env.VITE_SERVER_URL || '';

/** Character card display for a single player during the vote */
function PlayerVoteCard({
  playerId,
  playerName,
  characterCardId,
  voteCount,
  voterNames,
  hasVoted,
  isMyVote,
  onVote,
}: {
  playerId: string;
  playerName: string;
  characterCardId: string;
  voteCount: number;
  voterNames: string[];
  hasVoted: boolean;
  isMyVote: boolean;
  onVote: (id: string) => void;
}) {
  const card = useCard(characterCardId);

  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
        isMyVote
          ? 'border-fs-gold bg-fs-gold/10'
          : 'border-fs-gold/20 bg-fs-darker/40'
      }`}
    >
      {/* Character image */}
      <div className="relative rounded overflow-hidden border border-fs-gold/30 w-36 h-52 flex-shrink-0">
        {card ? (
          <img
            src={`${serverUrl}${card.imageUrl}`}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
          />
        ) : (
          <div className="w-full h-full bg-fs-darker flex items-center justify-center text-fs-parchment/30 text-sm">
            Loading…
          </div>
        )}
        {/* Vote count badge */}
        {voteCount > 0 && (
          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-fs-soul flex items-center justify-center text-white text-xs font-bold shadow">
            {voteCount}
          </div>
        )}
      </div>

      {/* Player name + character name */}
      <div className="text-center">
        <div className="font-display text-fs-parchment text-sm font-semibold">{playerName}</div>
        <div className="text-fs-parchment/50 text-xs">{card?.name ?? '…'}</div>
      </div>

      {/* Who voted for this player */}
      {voterNames.length > 0 && (
        <div className="text-center text-sm text-fs-parchment/40 leading-tight">
          {voterNames.join(', ')}
        </div>
      )}

      {/* Vote button */}
      <button
        disabled={hasVoted}
        onClick={() => onVote(playerId)}
        className={`px-3 py-1 rounded border text-sm font-semibold transition-colors ${
          isMyVote
            ? 'bg-fs-gold/30 border-fs-gold text-fs-gold cursor-default'
            : hasVoted
            ? 'bg-transparent border-fs-gold/10 text-fs-parchment/20 cursor-not-allowed'
            : 'bg-fs-gold/10 border-fs-gold/40 text-fs-gold hover:bg-fs-gold/30 hover:border-fs-gold cursor-pointer'
        }`}
      >
        {isMyVote ? 'Voted' : 'Vote'}
      </button>
    </div>
  );
}

/** Full-screen blocking modal shown during the sad_vote phase */
export function SadVoteModal() {
  const game = useGameStore((s) => s.game);
  const [skipping, setSkipping] = useState(false);

  if (!game || game.phase !== 'sad_vote') return null;

  const { players, sadVotes, myPlayerId, hostPlayerId } = game;
  const nonSpectators = players.filter((p) => !p.isSpectator);
  const myVoteTarget = sadVotes[myPlayerId];
  const hasVoted = !!myVoteTarget;
  const isHost = myPlayerId === hostPlayerId;

  const voteCount = Object.keys(sadVotes).length;
  const totalVoters = nonSpectators.length;
  const remaining = totalVoters - voteCount;

  function handleVote(targetPlayerId: string) {
    getSocket().emit('action:sad_vote', { targetPlayerId });
  }

  function handleSkip() {
    setSkipping(true);
    getSocket().emit('action:sad_vote_skip', {});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="panel max-w-3xl w-full mx-4 p-6 space-y-5 text-center">
        {/* Header */}
        <div>
          <h2 className="font-display text-fs-gold text-2xl font-bold">
            Who has the saddest character?
          </h2>
          <p className="text-fs-parchment/60 text-sm mt-1">
            The player with the most votes goes first.
            {hasVoted && (
              <span className="text-fs-gold ml-1">
                You voted for{' '}
                <span className="font-semibold">
                  {players.find((p) => p.id === myVoteTarget)?.name ?? '…'}
                </span>
                .
              </span>
            )}
          </p>
        </div>

        {/* Player cards grid */}
        <div className="flex flex-wrap justify-center gap-4">
          {nonSpectators.map((player) => {
            const voterNames = Object.entries(sadVotes)
              .filter(([, targetId]) => targetId === player.id)
              .map(([voterId]) => players.find((p) => p.id === voterId)?.name ?? voterId);

            return (
              <PlayerVoteCard
                key={player.id}
                playerId={player.id}
                playerName={player.name}
                characterCardId={player.characterCardId}
                voteCount={voterNames.length}
                voterNames={voterNames}
                hasVoted={hasVoted}
                isMyVote={myVoteTarget === player.id}
                onVote={handleVote}
              />
            );
          })}
        </div>

        {/* Progress + host skip */}
        <div className="border-t border-fs-gold/20 pt-4 space-y-3">
          <div className="text-sm text-fs-parchment/50">
            {voteCount} / {totalVoters} players have voted
            {remaining > 0 && (
              <span className="text-fs-parchment/30">
                {' '}— waiting for {remaining} more…
              </span>
            )}
          </div>

          {isHost && (
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="text-sm px-3 py-1.5 rounded border border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {skipping ? 'Resolving…' : 'Skip Vote'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
