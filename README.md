<h1 align="center">Thoughtcrumbs</h1>
<p align="center"><b>Catch your thoughts before they vanish.</b></p>

<p align="center"><img src="assets/demo.gif" alt="Thoughtcrumbs in use" width="720"></p>

Your head is full of half-formed ideas, worries and "oh, I should…" moments, and they tend to arrive in chains. Thoughtcrumbs gives each chain a home: one short title per thing on your mind, and a fast place to jot everything that belongs under it.

Built for brains that get overwhelmed by words. Each day gets one quiet page: the things on your mind at the top, and below them a running list of timestamped notes, like `14:05 - call the dentist`.

No account. No cloud. Nothing leaves your device.

## Built for busy, overloaded minds

- **Dump first, decide later:** the field at the bottom of today's page takes any thought, no topic needed, and it's focused the moment you open the app. Each note gets the time it was written. File it later from the inbox with "Move to…" or "Make a thing"
- **Never a wall of stuff:** today's page shows your 7 most recent things. The rest hide behind "Show more"
- **Lists that shrink:** mark a thing **Park** (not now) or **Done**. It leaves today's list (done things stay struck through until the day ends), and "Bring back" is one tap away. Every change has an Undo
- **A gentle weekly check:** once a week it asks "Still on your mind?" about the three things you haven't touched longest. Keep, Park or Done, or just "Not now". No streaks, no guilt
- **See everything at a glance:** the day's page shows how many notes, things and finished sessions it holds. Short titles with "last note 3 weeks ago". No colours, no previews, no clutter
- **Then versus now:** open a thing and its notes are grouped by day, so you can see how your thinking has changed
- **Move between days:** a month calendar in the sidebar marks the days you wrote something. Pick one to read that day's page, or step with the ‹ › buttons next to the day's name. A small graph shows which things a day touched
- **Jot in a chain:** type, press Enter, and the line clears for the next thought. `Esc` takes you back to today
- **Jump anywhere:** press `Cmd+K` (or `Ctrl+K`), type a few letters, and you're in that thing. Typing a new name makes a new thing
- **A soft nudge:** turn on "Nudge" and get a quiet "Anything on your mind?" about once an hour, never between 10 pm and 7 am. "Jot" goes straight to the note field. When a Focus Pill session ends, it asks "What's next?"
- **Calm by default:** quiet greys, Apple's system font, one narrow column and lots of empty space. It follows your system's light mode, and has no animations
- **Prompts when you're blank:** tap "Just did…", "Next I'll…" or "Stuck on…" to start the line
- **Where you left off:** after 45 minutes away, today's page opens with the last thing you wrote
- **Keep a copy:** "Export everything" in the sidebar saves all your things and notes as one JSON file
- **Truly private:** your entries live in your browser and nowhere else
- **Works like a real app:** install it on your desktop, and it keeps working offline

## How it works

<p align="center"><img src="assets/architecture.png" alt="How Thoughtcrumbs works" width="720"></p>

## Run it

You need [Node.js](https://nodejs.org/) 18 or later and a modern browser (Chrome, Edge or Safari).

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

**Forget to open it?** Keep it pinned as an installed app and switch Nudge on. The nudge only works while the app is open or running in the background, because a browser can't wake a closed app.

## Focus Pill (macOS)

A small black pomodoro pill that floats at the top of your Mac screen. It lives in [`focus-pill/`](focus-pill/).

- Type the one thing you're working on, press Enter, and a 25-minute focus starts.
- Click the pill's dot to see today's sessions and notes. **Open Thoughtcrumbs** takes you to the journal: the installed app if you have one, otherwise https://athulya-cloud.github.io/thoughtcrumbs/.
- **Drag the pill anywhere.** Grab the dots on its right edge (or any empty part). It remembers where you left it. Right-click → Reset position puts it back.
- Session starts, notes and finished sessions from the pill come with you. The first time, click **Open Thoughtcrumbs**: the notes travel in the link's `#` part, which the browser never sends to the server. After that, an open Thoughtcrumbs pulls new ones by itself every 20 seconds from the pill's local address (`127.0.0.1:47812`, which only this Mac can reach). Your browser may ask once to let the site reach apps on this device: allow it. Thoughtcrumbs skips notes it already has, or that you deleted.

Build it (needs Xcode command-line tools):

```bash
cd focus-pill && ./make_app.sh && open "build/Focus Pill.app"
```

## Tests

```bash
npm test
```

## Tech stack

Plain JavaScript (no framework), IndexedDB, a service worker and a web manifest. Tests use Vitest.
