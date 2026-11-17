# Focus Pill

A black, always-on-top pomodoro for macOS. One pill, one task, one hotkey.

## Design rules

- **One thing at a time.** The pill only ever asks one question: what's the one thing, or what got done.
- **Never steals your keyboard.** Timers end with a sound and a colour change, not a popup. You answer when you're ready.
- **One hotkey, ⌃⌥Space.** It does whatever the pill is asking for: start a task, log what got done, or drop a quick note under the current task.
- **Calm by default.** Monochrome, controls hidden until hover, single accent per state.
- **Your log is plain markdown.** `~/Documents/focus-log/YYYY-MM-DD.md`, with notes nested under the task they belong to.

## States

| State | Pill shows | You do |
|---|---|---|
| Idle | `○ What's the one thing?` | Type, ↵ to start 25 min |
| Focus | `● 18:13  Draft X post` + progress line | Hover (or right-click) for pause / finish / stop. ⌃⌥Space = quick note |
| Review | `+0:42  What got done?` (amber, counts overtime) | Type, ↵ to log and start break. Esc = break, no note. Hover ✕ = discard |
| Break | `● 3:32  Break` (mint) | Hover for skip / stop. Ends back on Idle with the last task prefilled |

Every 4th break is 15 min. After midnight, Idle asks if you want to call it. Your day rolls over at 05:00, so late sessions stay in today's log.

**⌃⌥⇧Space** hides or shows the pill (and brings it back if it went off screen). Opening the app again from Spotlight also brings it back. **⌘Q** quits while the pill has focus.

Right-click the pill: focus length (25 / 50), today's notes, open Thoughtcrumbs, open today's log, reset position, quit.

## Today's notes and Thoughtcrumbs

Click the pill's dot, or the ☰ button that appears on hover, to drop a small panel under the pill with today's sessions and notes, newest first. Click anywhere else to close it.

**Open Thoughtcrumbs** opens the Thoughtcrumbs app if you installed it from the browser (it then works offline, in its own window). It also hands over today's notes and finished sessions (the day ends at 05:00), and Thoughtcrumbs adds the ones it hasn't seen. The pill keeps them in `.thoughtcrumbs-outbox.json` in your log folder. Otherwise it opens https://athulya-cloud.github.io/thoughtcrumbs/. If you point it at a local server that isn't running, the pill says so instead of opening an error page. Point it somewhere else with:

```bash
defaults write local.athulya.focuspill thoughtcrumbsURL "http://localhost:4000"
```

## Log format

```markdown
# Focus · 2026-11-15

## 20:40  Draft X post for Focus Pill
- ask Navaneeth about pack names
- ✓ 3 hooks drafted, picked #2  (25 min)
```

## Build

```bash
./make_app.sh
open "build/Focus Pill.app"
```

Needs only the Xcode Command Line Tools. Snapshots of every state: `./make_app.sh && "build/Focus Pill.app/Contents/MacOS/FocusPill" --snapshot shots`.
