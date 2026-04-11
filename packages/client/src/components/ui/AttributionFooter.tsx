import React from 'react';
import { Link } from 'react-router-dom';

export function AttributionFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-center text-[10px] text-fs-parchment/20 leading-relaxed">
        Card data &amp; artwork &copy; Edmund McMillen / Maestro Media &mdash;{' '}
        <a
          href="https://foursouls.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-fs-parchment/50 transition-colors"
        >
          foursouls.com
        </a>
        {' '}&mdash;{' '}
        <a
          href="https://foursouls.com/rules/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-fs-parchment/50 transition-colors"
        >
          Rules
        </a>
        {' '}&mdash; Unofficial fan companion. All rights reserved by their respective owners.
        {' '}&mdash; Vibe coded &mdash;{' '}
        <a
          href="https://github.com/xnojack/play4soulsonline"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-fs-parchment/50 transition-colors"
        >
          PRs welcome
        </a>
        {' '}&mdash;{' '}
        <Link to="/privacy" className="underline hover:text-fs-parchment/50 transition-colors">
          Privacy
        </Link>
        {' '}&middot;{' '}
        <Link to="/terms" className="underline hover:text-fs-parchment/50 transition-colors">
          Terms
        </Link>
      </p>
    );
  }

  return (
    <div className="text-center space-y-1 mt-4">
      <p className="text-xs text-fs-parchment/30">
        <span className="font-display">The Binding of Isaac: Four Souls</span> is created by{' '}
        <strong className="text-fs-parchment/50">Edmund McMillen</strong> and published by{' '}
        <strong className="text-fs-parchment/50">Maestro Media</strong>.
      </p>
      <p className="text-xs text-fs-parchment/20 leading-relaxed max-w-sm mx-auto">
        All card content, artwork, and game design remain the property of their respective
        owners. No permission is expressly given for reproduction. This is an unofficial
        fan project to play the game online with friends.
      </p>
      <p className="text-xs text-fs-parchment/20 leading-relaxed max-w-sm mx-auto">
        Vibe coded — not because AI is great, but because there&apos;s no time to maintain
        another passion project. It works well enough.{' '}
        <a
          href="https://github.com/xnojack/play4soulsonline"
          target="_blank"
          rel="noopener noreferrer"
          className="text-fs-gold/50 hover:text-fs-gold underline transition-colors"
        >
          PRs welcome.
        </a>
      </p>
      <p className="text-xs text-fs-parchment/30">
        <a
          href="https://foursouls.com/rules/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-fs-gold/50 hover:text-fs-gold underline transition-colors"
        >
          Rules
        </a>
        {' '}&mdash; Card repository:{' '}
        <a
          href="https://foursouls.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-fs-gold/50 hover:text-fs-gold underline transition-colors"
        >
          foursouls.com
        </a>
        {' '}&mdash; Buy the game at{' '}
        <a
          href="https://maestromedia.com/collections/binding-of-isaac-four-souls"
          target="_blank"
          rel="noopener noreferrer"
          className="text-fs-gold/50 hover:text-fs-gold underline transition-colors"
        >
          maestromedia.com
        </a>
      </p>
      <p className="text-xs text-fs-parchment/30">
        <Link
          to="/privacy"
          className="text-fs-gold/50 hover:text-fs-gold underline transition-colors"
        >
          Privacy Policy
        </Link>
        {' '}&middot;{' '}
        <Link
          to="/terms"
          className="text-fs-gold/50 hover:text-fs-gold underline transition-colors"
        >
          Terms of Service
        </Link>
      </p>
    </div>
  );
}
