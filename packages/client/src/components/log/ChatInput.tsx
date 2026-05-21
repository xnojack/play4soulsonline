import { useRef, useState } from 'react';
import { getSocket } from '../../socket/client';
import { useGameStore } from '../../store/gameStore';

const MAX_LEN = 280;

/** Chat input at the bottom of the game log panel. */
export function ChatInput() {
  const game = useGameStore((s) => s.game);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const inGame = !!game && game.phase !== 'lobby';

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    getSocket().emit('action:chat', { message: trimmed.slice(0, MAX_LEN) });
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-1 border-t border-fs-gold/10 p-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={inGame ? 'Type a message...' : 'Join a game to chat'}
        disabled={!inGame}
        maxLength={MAX_LEN}
        className="flex-1 bg-fs-darker/50 border border-fs-gold/20 rounded px-2 py-1 text-sm text-fs-parchment placeholder-fs-parchment/20 disabled:opacity-40 focus:outline-none focus:border-fs-gold/40"
      />
      <button
        onClick={handleSend}
        disabled={!inGame || !value.trim()}
        className="px-2 py-1 rounded border border-fs-gold/20 text-fs-parchment/50 hover:text-fs-parchment hover:border-fs-gold/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
      >
        Send
      </button>
    </div>
  );
}
