import { create } from 'zustand';

/**
 * A single card-flight animation: a clone of a card travels from
 * a source DOM zone (queried by data-zone attribute) to a destination zone.
 *
 * The visual is rendered by <CardFlightLayer/> which subscribes to this store.
 * Flights auto-complete and remove themselves after their duration.
 */
export interface CardFlight {
  id: string;
  /** data-zone selector for source — first matching element's bounding rect is used */
  fromZone: string;
  /** data-zone selector for destination */
  toZone: string;
  /** Card ID to render an image for. If null/undefined, a generic deck-back shape is used. */
  cardId: string | null;
  /** Backside texture if no cardId (e.g. 'loot-back') */
  backType?: 'loot' | 'treasure' | 'monster' | 'room' | 'eternal';
  /** Spring duration in ms — defaults to 550 */
  durationMs?: number;
}

interface FlightStore {
  flights: CardFlight[];
  enqueue: (flight: Omit<CardFlight, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCardFlightStore = create<FlightStore>((set) => ({
  flights: [],
  enqueue: (flight) =>
    set((state) => ({
      flights: [
        ...state.flights,
        { ...flight, id: `flight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      ],
    })),
  remove: (id) => set((state) => ({ flights: state.flights.filter((f) => f.id !== id) })),
  clear: () => set({ flights: [] }),
}));
