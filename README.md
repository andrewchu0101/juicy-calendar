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

`npm run dev` runs the UI alone at http://localhost:1420, storing data in `localStorage` instead of a folder.

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
- Only macOS has been run. Windows and Linux are untested, and the build is not code-signed.
- A file edited externally while the app is open is not reloaded, and the app's next save of that file wins.
- Two windows or instances on one workspace are not coordinated.
- Stored times are UTC instants shown in local time, so changing timezone shifts blocks on the grid.
- Balls cannot be dragged by keyboard. Time-field formatting (12h or 24h) follows the system locale.
- There is no dark mode.

See `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md` and `AGENTS.md` for more.
