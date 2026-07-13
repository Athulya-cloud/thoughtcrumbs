# Interstitial Journal (Thoughtcrumbs)

A lightweight, local-first PWA for interstitial journaling — capturing
quick thoughts at task-transition moments with near-zero friction.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later (includes `npm`). Check with
  `node -v` — if that fails, install Node first.
- A modern browser (Chrome, Edge, or Safari recommended; voice input isn't
  available in Firefox — see Notes below).

## Get the code

Clone this repository, then move into it:

    git clone https://github.com/Athulya-cloud/thoughtcrumbs.git
    cd thoughtcrumbs

## Run it

Install dependencies once, then start the local server:

    npm install
    npm run serve

This prints a local URL (e.g. `http://localhost:3000`) — open it in your
browser. That's the whole app; there's no separate build step.

## Install it as an app on your device

Once the page is open in your browser, you can install it like any other
app instead of just bookmarking it:

- **Chrome / Edge (desktop):** click the install icon in the address bar
  (a monitor-with-arrow icon), or open the browser's `⋮` menu →
  "Install Interstitial Journal".
- **Chrome (Android):** browser menu → "Add to Home screen" / "Install app".
- **Safari (iPhone/iPad):** tap the Share icon → "Add to Home Screen".

Once installed, it opens in its own window/icon, without browser chrome,
and works offline (see Notes below).

## Stop the server

`npm run serve` runs in the foreground — press `Ctrl+C` in that terminal
to stop it. Your data isn't affected either way; it lives in the browser,
not the server process.

## Run tests

    npm test

## Notes

- All data is stored locally in the browser's IndexedDB — nothing is sent
  to any server, and there is no account/login.
- If IndexedDB is unavailable (e.g. very restrictive private browsing), the
  app still works for the session using an in-memory fallback, and shows a
  banner warning that entries won't persist.
- Voice input uses the browser's built-in Speech Recognition API. It is
  unavailable in Firefox; the mic button simply won't appear there.
- The app works offline starting from your second visit (or after a
  reload) — the service worker needs one full page load to install before
  it can take over.
