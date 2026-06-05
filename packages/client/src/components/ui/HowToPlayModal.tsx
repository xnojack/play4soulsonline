import React from 'react';
import { Modal } from './Modal';

export function HowToPlayModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How to Play" wide>
      <div className="space-y-4 text-sm text-fs-parchment/70 max-h-[70vh] overflow-y-auto pr-2">
        <section>
          <h3 className="font-display text-fs-gold font-bold mb-1">Goal</h3>
          <p>Collect 4 souls before the D8 timer reaches 0. Defeat monsters, play loot cards, and outlast your opponents.</p>
        </section>

        <section>
          <h3 className="font-display text-fs-gold font-bold mb-1">Your Turn</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong>Draw Loot</strong> — draw cards from the loot deck</li>
            <li><strong>Play Loot</strong> — drag hand cards to the stack, or hover + press E</li>
            <li><strong>Buy</strong> — purchase shop cards with coins (drag to items, or hover + E)</li>
            <li><strong>Attack</strong> — declare attacks on monsters (hover + E), roll dice to defeat them</li>
            <li><strong>End Turn</strong> — pass to the next player</li>
          </ul>
        </section>

        <section>
          <h3 className="font-display text-fs-gold font-bold mb-1">Priority</h3>
          <p>When cards are on the stack, other players with priority can play reactions before the effect resolves.</p>
        </section>

        <section>
          <h3 className="font-display text-fs-gold font-bold mb-1">Shortcuts</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li><kbd className="px-1 py-0.5 bg-fs-darker rounded text-xs">E</kbd> = interact with hovered card</li>
            <li><kbd className="px-1 py-0.5 bg-fs-darker rounded text-xs">C</kbd> = add counter</li>
            <li><kbd className="px-1 py-0.5 bg-fs-darker rounded text-xs">1-9</kbd> = draw N cards</li>
            <li><strong>Right-click</strong> = quick-action menu</li>
          </ul>
        </section>

        <div className="pt-2 border-t border-fs-gold/10 text-center">
          <a
            href="https://foursouls.com/rules/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fs-link hover:text-fs-link-hover underline transition-colors"
          >
            Full rules at foursouls.com/rules
          </a>
        </div>
      </div>
    </Modal>
  );
}
