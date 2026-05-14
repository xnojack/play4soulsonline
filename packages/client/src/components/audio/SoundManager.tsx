import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SERVER_URL } from '../../config';

const SOUNDS: Record<string, string> = {
  cardFlip: '/sounds/card-flip.wav',
  diceRoll: '/sounds/dice-roll.wav',
  coinClink: '/sounds/coin-clink.wav',
  cardSlide: '/sounds/card-slide.wav',
  attack: '/sounds/attack.wav',
  soul: '/sounds/soul.wav',
};

const STORAGE_KEY_MUTED = 'fs_sound_muted';
const STORAGE_KEY_VOLUME = 'fs_sound_volume';

function loadAudio(src: string): HTMLAudioElement {
  const audio = new Audio(SERVER_URL + src);
  audio.preload = 'auto';
  return audio;
}

/**
 * Plays a named sound effect. Call from any component — no import needed.
 * The SoundManager component exposes this function globally while mounted.
 */
export function playSound(soundName: string): void {
  (window as any).__fsPlaySound?.(soundName);
}

export function SoundManager() {
  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MUTED);
    return saved ? saved === 'true' : true;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
    return saved ? Math.max(0, Math.min(100, Number(saved))) : 30;
  });
  const [showSettings, setShowSettings] = useState(false);
  const soundsRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, src]) => {
      soundsRef.current[key] = loadAudio(src);
    });
  }, []);

  const play = useCallback((soundName: string) => {
    if (muted) return;
    const sound = soundsRef.current[soundName];
    if (sound) {
      sound.volume = volume / 100;
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  }, [muted, volume]);

  useEffect(() => {
    (window as any).__fsPlaySound = play;
    return () => {
      delete (window as any).__fsPlaySound;
    };
  }, [play]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
  }, [muted]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
  }, [volume]);

  return (
    <>
      <div className="fixed top-2 right-2 z-50 flex items-center gap-1">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="text-fs-parchment/30 hover:text-fs-parchment transition-colors text-sm"
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {muted ? '🔇' : volume < 30 ? '🔈' : volume < 70 ? '🔉' : '🔊'}
        </button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-8 right-0 bg-fs-dark/95 border border-fs-gold/40 rounded-lg p-3 backdrop-blur-sm shadow-xl z-50 min-w-[160px]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-fs-parchment/60">Volume</span>
                <button
                  onClick={() => {
                    setMuted((m) => !m);
                    localStorage.setItem(STORAGE_KEY_MUTED, String(!muted));
                  }}
                  className="text-xs text-fs-parchment/40 hover:text-fs-parchment transition-colors"
                >
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-fs-gold"
              />
              <div className="text-center text-xs text-fs-parchment/40 mt-1">{volume}%</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
