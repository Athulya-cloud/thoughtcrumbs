# Thoughtcrumbs

A journal for short notes during the day. Each note gets the time you wrote it.

<p align="center"><img src="assets/demo.gif" alt="Thoughtcrumbs in use" width="640"></p>

Use it here: https://athulya-cloud.github.io/thoughtcrumbs/

Your notes stay in your browser. There's no account.

## How to use it

- **Write a note:** type in the box under today's notes and press Enter. The time is added for you. Shift+Enter starts a new line.
- **Stuck on what to write?** Tap "Just did…", "Next I'll…" or "Stuck on…".
- **Things:** a thing is a topic you keep coming back to, like "Move flats". Click **New thing** to add one. Open a thing to see its notes, grouped by day.
- **Inbox:** notes you write on the Today page go here. Later, move each one to a thing, turn it into a new thing, or leave it.
- **Park or Done:** takes a thing off today's list. Undo it right away, or bring it back later from "Parked & done".
- **⌘K** (Ctrl+K on Windows): jump to any thing, or make a new one.
- **Calendar:** click a day to read what you wrote that day.
- **Nudge:** turn it on and, while the app is open, it asks "Anything on your mind?" about once an hour. It stays quiet from 10 pm to 7 am.
- **Export everything:** saves all your notes to a file. Do it every week or so. Clearing your browser data deletes your notes.

## Install it as an app

- **Chrome, Edge or Brave on a computer:** click the install icon at the right end of the address bar.
- **iPhone (Safari):** tap Share, then Add to Home Screen.
- **Android (Chrome):** tap the menu, then Add to Home screen.

Once installed, it works without internet.

## Focus Pill (Mac, macOS 14 or newer)

A small timer that sits on top of your screen. Type what you're working on and press Enter to start 25 minutes. You can drag it anywhere.

What you start, finish and note in the pill shows up in Thoughtcrumbs.

To connect them, click the pill's dot, then **Open Thoughtcrumbs**. You only do this once. After that, new notes show up on their own while Thoughtcrumbs is open.

If the browser asks to let the site reach apps on this device, click Allow.

To build it, you need Xcode Command Line Tools (`xcode-select --install`). Then run:

```bash
cd focus-pill
./make_app.sh
open "build/Focus Pill.app"
```

Details: [focus-pill/README.md](focus-pill/README.md)

## Run it on your computer

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/Athulya-cloud/thoughtcrumbs.git
cd thoughtcrumbs
npm install
npm run serve
```

Open the address it prints, like http://localhost:3000.

Run the tests with `npm test`.
