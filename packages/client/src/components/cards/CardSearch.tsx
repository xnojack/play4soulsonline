import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SERVER_URL } from '../../config';

interface CardData {
  id: string;
  name: string;
  imageUrl: string;
  cardType: string;
  subType: string;
  set: string;
  hp: number | null;
  atk: number | null;
  evasion: number | null;
  soulValue: number;
  rewardText: string;
  abilityText: string;
  isEternal: boolean;
  threePlayerOnly: boolean;
  printStatus: string;
  backImageUrl: string | null;
  flipSideName: string | null;
  quantity: number;
}

export function CardSearch() {
  const { isCardSearchOpen, setCardSearchOpen, setModalCard } = useGameStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState<CardData[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const serverUrl = SERVER_URL;
  const LIMIT = 20;

  const search = async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (type) params.set('type', type);
      params.set('limit', String(LIMIT));
      params.set('offset', String(newOffset));

      const res = await fetch(`${serverUrl}/api/cards?${params}`);
      const data = await res.json() as { cards: CardData[]; total: number };
      setResults(data.cards);
      setTotal(data.total);
      setOffset(newOffset);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCardSearchOpen) {
      search(0);
    }
  }, [isCardSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(0);
  };

  return (
    <Modal
      isOpen={isCardSearchOpen}
      onClose={() => setCardSearchOpen(false)}
      title="Card Search"
      wide
    >
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards..."
          className="flex-1 bg-fs-darker border border-fs-gold/30 rounded px-3 py-2 text-fs-parchment text-sm placeholder-fs-parchment/30 focus:outline-none focus:border-fs-gold"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-fs-darker border border-fs-gold/30 rounded px-2 py-2 text-fs-parchment text-sm focus:outline-none focus:border-fs-gold"
        >
          <option value="">All Types</option>
          <option value="Character">Character</option>
          <option value="Treasure">Treasure</option>
          <option value="Monster">Monster</option>
          <option value="Loot">Loot</option>
          <option value="Room">Room</option>
          <option value="BonusSoul">Bonus Soul</option>
        </select>
        <Button type="submit" disabled={loading}>Search</Button>
      </form>

      {/* Results count */}
      <div className="text-sm text-fs-parchment/40 mb-3">
        {loading ? 'Searching…' : `${total} cards found`}
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
        {results.map((card) => (
          <button
            key={card.id}
            onClick={() => setModalCard(card)}
            className="text-left bg-fs-darker/50 border border-fs-gold/10 rounded p-2 hover:border-fs-gold/50 transition-colors"
          >
            <img
              src={`${serverUrl}${card.imageUrl}`}
              alt={card.name}
              className="w-full h-auto rounded-sm mb-1"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-card.png';
              }}
            />
            <div className="text-sm text-fs-parchment/80 font-display truncate">{card.name}</div>
            <div className="text-sm text-fs-parchment/40">{card.cardType}</div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={offset === 0}
            onClick={() => search(offset - LIMIT)}
          >
            Previous
          </Button>
          <span className="text-sm text-fs-parchment/40">
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={offset + LIMIT >= total}
            onClick={() => search(offset + LIMIT)}
          >
            Next
          </Button>
        </div>
      )}
    </Modal>
  );
}
