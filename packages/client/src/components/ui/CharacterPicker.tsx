import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { SERVER_URL } from '../../config';
import { getSocket } from '../../socket/client';

interface CharacterPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentId: string | null;
}

export function CharacterPicker({ isOpen, onClose, currentId }: CharacterPickerProps) {
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`${SERVER_URL}/api/cards?type=Character&limit=200`)
      .then(r => r.json())
      .then(data => {
        setCharacters(data.cards || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  const handleSelect = (charId: string | null) => {
    getSocket().emit('action:select_character', { characterId: charId });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Character" wide>
      {loading ? (
        <div className="text-center text-fs-parchment/40 py-8">Loading characters…</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {/* Random option */}
          <button
            onClick={() => handleSelect(null)}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              !currentId
                ? 'border-fs-gold bg-fs-gold/10'
                : 'border-fs-gold/10 bg-fs-darker/50 hover:border-fs-gold/30'
            }`}
          >
            <div className="text-3xl">🎲</div>
            <span className="text-xs text-fs-parchment/70 font-medium">Random</span>
          </button>
          {characters.map(char => (
            <button
              key={char.id}
              onClick={() => handleSelect(char.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                currentId === char.id
                  ? 'border-fs-gold bg-fs-gold/10'
                  : 'border-fs-gold/10 bg-fs-darker/50 hover:border-fs-gold/30'
              }`}
            >
              <img
                src={`${SERVER_URL}${char.imageUrl}`}
                alt={char.name}
                className="w-12 h-16 object-contain rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-[10px] text-fs-parchment/70 text-center leading-tight line-clamp-2">{char.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
