import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CardFlight, useCardFlightStore } from '../../store/cardFlightStore';
import { useCard } from '../board/CardResolver';
import { SERVER_URL } from '../../config';

const DECK_BACKS: Record<string, string> = {
  treasure: '/treasure-back.png',
  loot: '/loot-back.png',
  monster: '/monster-back.png',
  room: '/room-back.png',
  eternal: '/eternal-back.png',
};

/**
 * Renders one in-flight card overlay per active flight. Mounted once at the
 * GameBoard root level. Each flight queries source + destination DOM rects
 * via data-zone selectors at mount time, then animates a card-shaped clone
 * from source to destination using framer-motion.
 *
 * If either zone is missing (e.g. user collapsed the panel), the flight is
 * still played from screen center to screen center as a fallback so the
 * animation never silently no-ops.
 */
export function CardFlightLayer() {
  const flights = useCardFlightStore((s) => s.flights);

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9000]">
      <AnimatePresence>
        {flights.map((f) => (
          <FlightCard key={f.id} flight={f} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getZoneRect(selector: string): Rect | null {
  const el = document.querySelector(`[data-zone="${selector}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

function FlightCard({ flight }: { flight: CardFlight }) {
  const remove = useCardFlightStore((s) => s.remove);
  const card = useCard(flight.cardId ?? undefined);
  const [endpoints] = useState(() => {
    const fallback: Rect = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      w: 80,
      h: 110,
    };
    const from = getZoneRect(flight.fromZone) ?? fallback;
    const to = getZoneRect(flight.toZone) ?? fallback;
    return { from, to };
  });

  const duration = (flight.durationMs ?? 550) / 1000;

  useEffect(() => {
    const t = setTimeout(() => remove(flight.id), (flight.durationMs ?? 550) + 50);
    return () => clearTimeout(t);
  }, [flight.id, flight.durationMs, remove]);

  // Card image source — use real card image when available, otherwise a deck back
  const showFront = !!card?.imageUrl;
  const imgSrc = showFront
    ? `${SERVER_URL}${card!.imageUrl}`
    : DECK_BACKS[flight.backType ?? 'loot'];

  // Card visual size during flight
  const W = 90;
  const H = 124;

  return (
    <motion.div
      initial={{
        x: endpoints.from.x - W / 2,
        y: endpoints.from.y - H / 2,
        scale: 0.9,
        rotate: -6,
        opacity: 0,
      }}
      animate={{
        x: endpoints.to.x - W / 2,
        y: endpoints.to.y - H / 2,
        scale: [0.9, 1.15, 0.95],
        rotate: [-6, 8, 0],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration,
        ease: [0.34, 1.2, 0.64, 1],
        opacity: { times: [0, 0.15, 0.85, 1], duration },
        scale: { times: [0, 0.5, 1], duration },
      }}
      style={{
        position: 'absolute',
        width: W,
        height: H,
        top: 0,
        left: 0,
        willChange: 'transform, opacity',
      }}
    >
      <img
        src={imgSrc}
        alt=""
        className="w-full h-full object-cover rounded shadow-2xl ring-2 ring-fs-gold/80"
        draggable={false}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/card-back.png';
        }}
      />
    </motion.div>
  );
}
