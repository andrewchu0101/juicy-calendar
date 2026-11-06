# Juicy Calendar

A local-first desktop app for visual time blocking. Pick a coloured ball, drag it onto the calendar,
get a 2-hour block, resize it, double-click to name it.

Your data is a plain folder of JSON files. No account, server or network needed.

## Setup

Requires Node.js 20+, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
(on macOS, the Xcode Command Line Tools).

```sh
npm install
npm run desktop        # run the desktop app in development
npm run desktop:build  # build src-tauri/target/release/bundle/macos/Juicy Calendar.app
```

`npm run dev` runs the UI alone at http://localhost:1421, storing data in `localStorage` instead of a folder.

## Windows

> **Draft.** The Windows installer and the portable .zip are not built yet (tickets 016 and 017), so the
> installer steps below have not been tried on a clean machine. The portable-mode behaviour is implemented.
> Requires 64-bit Windows 10 (1803 or later) and the Microsoft Edge WebView2 Runtime.

**Installer (planned)**

1. Run `Juicy Calendar_<version>_x64-setup.exe`. If WebView2 is missing, the installer downloads it from
   Microsoft, so it needs an internet connection that one time. The app itself never goes online.
2. The installer is **not code-signed**, so Windows SmartScreen may say "Windows protected your PC". Choose
   **More info**, then **Run anyway**, but only for a file you got from this project's own releases.
3. Create or open a workspace from the welcome screen. A workspace is a plain folder of JSON files that you pick.
4. To uninstall, use Settings, Apps, Installed apps. Your workspace folders are yours and are expected to stay
   where they are (to be confirmed on a clean machine).

**Keep your workspace out of cloud-sync folders** (OneDrive, Dropbox, Google Drive and similar). The app
writes files in place and keeps a `.juicy.lock` file while a workspace is open, and a sync client that
touches those files at the same moment may cause conflicts or stale copies.

**Portable .zip (planned)**

- Extract the .zip anywhere and run the app. The folder contains `portable.flag` next to the executable, and
  that file is what turns portable mode on. Do not delete it.
- Every start opens the `data` folder next to the executable, and the app settings (such as language) are kept
  there too. Copy or move the whole folder to take your blocks and settings with you.
- If you open another workspace by hand, that folder is **not** part of what moves with the .zip folder, and
  the next start returns to `data`.
- If the app cannot create or write `data` (for example a read-only location), it shows an error and does
  **not** save anywhere else. Move the folder somewhere writable and start it again.
- Deleting the folder removes the program and the data inside it. WebView2 may leave its own cache elsewhere
  on that computer; whether that cache can be kept inside `data` has not been verified.

## Using it

| Do this | To |
| --- | --- |
| Drag a ball onto the calendar | Create a 2-hour block starting at the drop point |
| Drag a block | Move it, across dates too |
| Drag a block's top or bottom edge | Change its start or end |
| Double-click a block | Name it (Enter saves, Escape cancels) |
| Click a block | Open the inspector |
| Click a ball's name, or **+** | Edit or add a template |
| Click a day header | Open that day |
| Delete / Backspace | Delete the selected block |
| Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z | Undo, redo |
| Escape | Cancel a drag or edit, or clear the selection |

## Tests

```sh
npm run typecheck
npm run lint
npm test              # engine, store and persistence, in a DST timezone
npm run test:rust     # path allow-list and atomic writes
npx playwright install webkit   # first time only
npm run test:e2e      # real pointer interactions in WebKit, using the browser backend
npm run test:desktop  # builds and launches the real app; a window opens briefly (macOS, Linux)
```

## Known limitations

- **Desktop gestures have partial automated coverage.** `test:e2e` drives real pointer input in Playwright's
  WebKit, not Tauri's own webview. `test:desktop` runs in the real webview, but with synthetic pointer events
  and only for ball dropping. The native folder dialog and macOS menu key handling are not automated.
- The release build has been launched on Windows 10 and Windows 11 during development, and the installer builds, but the
  installer has **not** been tried on a clean machine and Windows 10 1803 (the stated minimum) is unverified. Linux is
  untested. The build is not code-signed.
- A file edited externally while the app is open is not reloaded, and the app's next save of that file wins.
- A second window on a workspace that is already open is refused with an explanation (a `.juicy.lock` file marks
  the owner). This was verified by automated tests only, not yet with two real app processes.
- Stored times are UTC instants shown in local time, so changing timezone shifts blocks on the grid.
- Balls cannot be dragged by keyboard. Time-field formatting (12h or 24h) follows the system locale.
- There is no dark mode.

See `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md` and `AGENTS.md` for more.
