# Thoughtcrumbs

A tiny journal for the moments between tasks. Jot down a quick thought in seconds, read it back later. Everything stays on your device.

![architecture](assets/architecture.png)

## What it does

- **Capture fast:** a text box is ready the moment you open the app. Type, or tap the mic and speak
- **Saves itself:** click away, or press `Cmd+Enter` / `Ctrl+Enter` to save and start a new entry
- **Review:** entries grouped by day, newest first, with search and a 7 days / 30 days / all time filter
- **Private:** no account, no server. Data lives in your browser (IndexedDB)
- **Installable and offline:** add it to your desktop or phone home screen and it works without internet

## Run it

You need [Node.js](https://nodejs.org/) 18 or later and a modern browser (Chrome, Edge or Safari). The mic button doesn't appear in Firefox.

```bash
git clone https://github.com/Athulya-cloud/thoughtcrumbs.git
cd thoughtcrumbs
npm install
npm run serve
```

Open the URL it prints (for example http://localhost:3000).

Stop the server with `Ctrl+C`. Your entries are not affected because they live in the browser.

## Install it as an app

- **Chrome / Edge (desktop):** click the install icon in the address bar
- **Chrome (Android):** menu → Add to Home screen
- **Safari (iPhone / iPad):** Share → Add to Home Screen

Offline use starts from your second visit, once the service worker has installed.

## Tests

```bash
npm test
```

## Tech stack

Plain JavaScript (no framework), IndexedDB, a service worker and a web manifest. Tests use Vitest.
