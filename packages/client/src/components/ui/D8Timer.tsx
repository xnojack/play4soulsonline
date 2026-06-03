import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface D8TimerProps {
  value: number;
  onTick?: (newValue: number) => void;
}

export function D8Timer({ value, onTick }: D8TimerProps) {
  const isLow = value <= 2;
  const isCritical = value <= 1;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* D8 die */}
      <div
        className={`relative w-14 h-16 flex items-center justify-center rounded-lg border-2 transition-all duration-300 ${
          isCritical
            ? 'border-red-500 bg-red-950/60 shadow-lg shadow-red-900/40'
            : isLow
            ? 'border-orange-500/60 bg-orange-950/40 shadow-md shadow-orange-900/20'
            : 'border-fs-gold/40 bg-fs-brown/60'
        }`}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
      >
        {/* Inner diamond shape for D8 look */}
        <div
          className="absolute inset-1 rounded-sm flex items-center justify-center"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
        />
        <span
          className={`relative z-10 text-2xl font-bold font-mono transition-colors ${
            isCritical
              ? 'text-red-400'
              : isLow
              ? 'text-orange-400'
              : 'text-fs-gold'
          }`}
        >
          {value}
        </span>
      </div>

      {/* Label */}
      <span
        className={`text-[10px] font-medium uppercase tracking-wider ${
          isCritical
            ? 'text-red-400/70'
            : isLow
            ? 'text-orange-400/60'
            : 'text-fs-parchment/40'
        }`}
      >
        D8
      </span>

      {/* Critical pulse animation */}
      {isCritical && value > 0 && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 0px rgba(239, 68, 68, 0)',
              '0 0 20px rgba(239, 68, 68, 0.3)',
              '0 0 0px rgba(239, 68, 68, 0)',
            ],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  );
}
