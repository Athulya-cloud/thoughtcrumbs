<h1 align="center">Thoughtcrumbs</h1>
<p align="center"><b>Catch your thoughts before they vanish.</b></p>

<p align="center"><img src="assets/architecture.png" alt="How Thoughtcrumbs works" width="720"></p>

Between one task and the next, your brain is full of half-formed ideas, worries and "oh, I should…" moments. Thoughtcrumbs gives them somewhere to land in about two seconds, then lets you read them back by day.

No account. No cloud. Nothing leaves your device.

## Why you'll like it

- **Zero friction:** the text box is ready the moment you open the app. Type, or tap the mic and speak
- **Saves itself:** click away, or press `Cmd+Enter` / `Ctrl+Enter` to save and start fresh
- **Easy to look back:** entries grouped by day, with search and a 7 days / 30 days / all time filter
- **Truly private:** your entries live in your browser and nowhere else
- **Works like a real app:** install it on your desktop or phone, and it keeps working offline

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
