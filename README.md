# Interstitial Journal (Thoughtcrumbs)

A lightweight, local-first PWA for interstitial journaling — capturing
quick thoughts at task-transition moments with near-zero friction.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later (includes `npm`). This is what
  lets your computer run the app's local server.
- A modern browser (Chrome, Edge, or Safari recommended; voice input isn't
  available in Firefox — see Notes below).

## Step 1: Install Node.js (one-time setup)

If you're not sure whether you already have it, open a terminal (see
below for how) and type:

    node -v

- If you see something like `v18.x.x` or higher, you're set — skip to
  Step 2.
- If you see "command not found" or similar, go to
  [nodejs.org](https://nodejs.org/), download the **LTS** version for
  your operating system, and run the installer (click Next/Continue
  through the defaults). Then close and reopen your terminal and try
  `node -v` again to confirm it worked.

### Opening a terminal

- **Mac:** press `Cmd+Space`, type `Terminal`, press Enter.
- **Windows:** press the Windows key, type `PowerShell` (or
  `Command Prompt`), press Enter.

## Step 2: Get the code

The easiest way if you don't use `git` day-to-day:

1. Go to the repository page:
   https://github.com/Athulya-cloud/thoughtcrumbs
2. Click the green **Code** button → **Download ZIP**.
3. Find the downloaded ZIP file (usually in your Downloads folder) and
   unzip it (double-click it on Mac; right-click → "Extract All" on
   Windows). This gives you a `thoughtcrumbs` folder.

If you're comfortable with `git`, you can instead run:

    git clone https://github.com/Athulya-cloud/thoughtcrumbs.git
    cd thoughtcrumbs

## Step 3: Start the local server

In your terminal, move into the folder you just downloaded/cloned. For
example, if you unzipped it into Downloads:

    cd Downloads/thoughtcrumbs

(Tip: instead of typing the path, you can type `cd ` — with a trailing
space — then drag the `thoughtcrumbs` folder from Finder/File Explorer
into the terminal window, and press Enter.)

Then install dependencies once, and start the server:

    npm install
    npm run serve

The first command downloads a few small helper files the app needs (only
required the first time, or after you download a fresh copy). The second
command starts the app and prints a local URL such as:

    http://localhost:3000

Open that URL in your browser — that's the app running. There's no
separate build step and nothing else to configure.

Keep that terminal window open while you're using the app in the
browser; closing it stops the server (see "Stop the server" below).

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

## How to use the app

The app has two tabs at the top: **Capture** and **Review**.

### Capture — jotting down a thought

1. Open the app. You'll land on the Capture tab, with a text box already
   focused and ready to type into.
2. Type whatever's on your mind — no need to hit a "save" button.
3. Your entry is saved automatically as soon as you click away from the
   box (or switch to the Review tab). You can also save it immediately and
   start a fresh entry by pressing **Cmd+Enter** (Mac) or **Ctrl+Enter**
   (Windows/Linux) while typing.
4. If you'd rather speak than type, tap the microphone button (🎤) next to
   the text box and say your thought out loud — it'll be typed in for you.
   (The mic button won't appear in Firefox, since that browser doesn't
   support this yet.)

An empty text box is never saved as an entry, so there's no need to worry
about accidentally creating blank notes.

### Review — reading back your entries

1. Tap the **Review** tab to see everything you've captured, grouped by
   day with the most recent at the top.
2. Use the search box to find entries containing specific words.
3. Use the dropdown next to it to narrow the list to the last 7 days, the
   last 30 days, or all time.
4. If nothing matches your search or the app is empty, you'll see a short
   message instead of a blank screen — that's expected, not an error.

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
