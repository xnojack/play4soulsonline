import React from 'react';
import { Link } from 'react-router-dom';
import { AttributionFooter } from '../components/ui/AttributionFooter';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-fs-dark text-fs-parchment flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <Link to="/" className="text-fs-gold/60 hover:text-fs-gold text-sm underline transition-colors">
          &larr; Back
        </Link>

        <h1 className="font-display text-3xl text-fs-gold mt-6 mb-2">Terms of Service</h1>
        <p className="text-xs text-fs-parchment/40 mb-8">Last updated: 2026</p>

        <div className="space-y-8 text-sm text-fs-parchment/70 leading-relaxed">

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">What this is</h2>
            <p>
              Four Souls Online is an unofficial, fan-made companion app for playing{' '}
              <em>The Binding of Isaac: Four Souls</em> online with friends. It is not affiliated
              with, endorsed by, or connected to Edmund McMillen or Maestro Media in any way. All
              card content, artwork, and game design are the property of their respective owners.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Using the app</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>This app is a game state tracker. It does not replace the physical game or its rulebook.</li>
              <li>Card effects are resolved manually by players — the app does not automate them.</li>
              <li>
                You are responsible for ensuring you have legitimate access to the game (i.e. own
                a copy of <em>The Binding of Isaac: Four Souls</em>).
              </li>
              <li>Don't use this app to harass or ruin the experience of other players.</li>
              <li>Don't attempt to abuse, crash, or stress the server you are connecting to.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">No warranty</h2>
            <p>
              This software is provided as-is, without warranty of any kind. Games can be lost if
              the server restarts — all state is in-memory only. There are no guarantees of
              uptime, availability, or fitness for any particular purpose. Use it at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Self-hosted instances</h2>
            <p>
              Four Souls Online is free, open-source software licensed under the{' '}
              <a
                href="https://www.gnu.org/licenses/gpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fs-gold/60 hover:text-fs-gold underline transition-colors"
              >
                GNU General Public License v3
              </a>
              . Anyone may run their own instance. The operator of each instance is solely
              responsible for their deployment, infrastructure, and compliance with applicable laws.
              These terms describe the software itself — operators may publish their own additional
              terms for their specific instance.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Intellectual property</h2>
            <p>
              <em>The Binding of Isaac: Four Souls</em>, all card names, artwork, and game content
              are &copy; Edmund McMillen / Maestro Media. This project reproduces card data and
              images for the sole purpose of facilitating online play among people who own the
              game. No commercial use is intended or permitted.
            </p>
            <p className="mt-2">
              The source code of this companion app is available at{' '}
              <a
                href="https://github.com/xnojack/play4soulsonline"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fs-gold/60 hover:text-fs-gold underline transition-colors"
              >
                github.com/xnojack/play4soulsonline
              </a>{' '}
              under the GPL-3.0 license.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-fs-parchment/90 mb-2">Changes</h2>
            <p>
              These terms may be updated at any time. The current version is always in the
              source repository. Continued use of the app after changes constitutes acceptance
              of the updated terms.
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
