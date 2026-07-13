# Interstitial Journal

A lightweight, local-first PWA for interstitial journaling — capturing
quick thoughts at task-transition moments with near-zero friction.

## Run locally

    npm install
    npm run serve

Then open the printed URL. The app can be installed to your device's
home screen / app list from the browser's install prompt (Chrome: address
bar install icon; Safari: Share → Add to Home Screen).

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
