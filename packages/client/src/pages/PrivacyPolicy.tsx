import React from 'react';
import { Link } from 'react-router-dom';
import { AttributionFooter } from '../components/ui/AttributionFooter';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-fs-dark text-fs-parchment flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <Link to="/" className="text-fs-gold/60 hover:text-fs-gold text-sm underline transition-colors">
          &larr; Back
        </Link>

        <h1 className="font-display text-3xl text-fs-gold mt-6 mb-2">Privacy Policy</h1>
        <p className="text-xs text-fs-parchment/40 mb-8">Last updated: 2026</p>

        <div className="space-y-8 text-sm text-fs-parchment/70 leading-relaxed">

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">The short version</h2>
            <p>
              This app collects no personal data, sets no cookies, runs no analytics, and persists
              nothing about you to disk. Your player name and game state live in server RAM for the
              duration of your session and are discarded when the room closes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">What we collect</h2>
            <p>Nothing, in the traditional sense. Specifically:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-fs-parchment/90">No accounts.</strong> There is no sign-up, login, or password.</li>
              <li><strong className="text-fs-parchment/90">No cookies.</strong> This app sets no cookies of any kind.</li>
              <li><strong className="text-fs-parchment/90">No analytics.</strong> No third-party tracking scripts, no telemetry, no page-view counters.</li>
              <li><strong className="text-fs-parchment/90">No IP logging.</strong> The server does not log or store IP addresses.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Your player name</h2>
            <p>
              When you create or join a game you enter a display name. This name is held in server
              RAM and broadcast to other players in your room so they can see who they are playing
              with. It is never written to disk. When the room closes or times out (at most 30
              minutes after all players disconnect), it is gone.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Reconnect tokens</h2>
            <p>
              When you join a game, a random reconnect token (a UUID) is generated and stored in
              your browser's <code className="text-fs-gold/70">sessionStorage</code>. This allows
              the server to recognize you if you accidentally close and reopen the tab. The token
              is held in server RAM only and is never written to a database or log file. It
              disappears from your browser when you close the tab, and from the server when the
              room closes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Game state</h2>
            <p>
              All game state — players, hands, decks, health, coins, the stack — lives entirely in
              server RAM for the lifetime of the room. None of it is written to the database. The
              database stores only card reference data (names, images, stats, ability text) which
              was downloaded from{' '}
              <a
                href="https://foursouls.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fs-gold/60 hover:text-fs-gold underline transition-colors"
              >
                foursouls.com
              </a>{' '}
              at setup time by the scraper. Your browser never contacts foursouls.com directly.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Server logs</h2>
            <p>
              The server writes minimal ephemeral logs to stdout (the process console). These
              include startup messages, database connection status, and room cleanup notices
              (containing only the 6-character room code). Socket IDs are logged in development
              mode only. None of these logs are written to persistent storage by the application
              itself — what happens to stdout is determined by whoever is operating the server.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Self-hosted instances</h2>
            <p>
              Four Souls Online is self-hosted software. This policy describes the behaviour of
              the application code. The person or organization operating the server you are
              connecting to controls the infrastructure and may have additional logging at the
              network or hosting level (e.g. a reverse proxy or hosting provider may log IP
              addresses). If you have concerns, check with whoever runs the instance you are using.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Changes to this policy</h2>
            <p>
              If the data practices of the application code change materially, this page will be
              updated. The source code is always the authoritative reference —{' '}
              <a
                href="https://github.com/xnojack/play4soulsonline"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fs-gold/60 hover:text-fs-gold underline transition-colors"
              >
                read it on GitHub
              </a>.
            </p>
          </section>

        </div>
      </div>

      <div className="pb-8">
        <AttributionFooter compact />
      </div>
    </div>
  );
}
