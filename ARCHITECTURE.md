# Juicy Calendar — Architecture

```
React components ──> Zustand store ──> persistenceSync ──> WorkspaceBackend ──> Tauri IPC ──> Rust (fs)
       │                  │                                     └─> browserBackend (dev and e2e only)
       └── Calendar Engine (pure TypeScript, no React)
```

## Modules

| Path | Responsibility |
| --- | --- |
| `src/features/calendar/engine/` | All time and geometry maths. No React, DOM or store imports. |
| `src/features/calendar/hooks/` | Pointer sessions. Transient state lives here, not in the store. |
| `src/features/calendar/components/` | Grid, toolbar, event blocks. |
| `src/features/templates/` | Palette, editor, ball drag. |
| `src/features/inspector/` | Selected-event editor. |
| `src/stores/appStore.ts` | Shared state and the only way to change events (with undo history). |
| `src/services/persistence/` | Schemas, repository, write queue, backends. |
| `src/services/workspace/` | Open / create / restore / close session flow. |
| `src-tauri/src/` | Native capabilities only: folder dialog, path validation, atomic file I/O. |

## Time model

- `startAt` / `endAt` are ISO 8601 UTC instants. Pixels are never stored.
- Each column shows a wall-clock window: `[day @ startHour, day @ startHour + span)`.
  With `08:00 → 03:00`, 01:00 on Tuesday is drawn at the bottom of Monday's column.
- Positions use wall-clock minutes, so grid lines stay truthful across DST changes.
  Durations use elapsed time, so moving an event preserves its real length.
- An event is cut into one segment per column it intersects. Only true ends get resize handles.
- Pointer positions resolve to the nearest minute, with optional 8 px attraction to half-hour lines.

## Interaction model

- Move and resize use native Pointer Events and hold a draft in local hook state. The store only
  changes on commit, so one gesture is one undo step, and Escape simply discards the draft.
- Geometry is re-measured on every update, so scrolling mid-gesture stays correct.
- Ball drag uses dnd-kit for activation, overlay and cancel. Time resolves through the same engine.

## Persistence

```
MyTimeBlock/
├── workspace.json        { schemaVersion, name, createdAt }
├── settings.json         timeline and view preferences
├── templates/<id>.json
└── events/<id>.json
```

- Store changes are diffed against the last persisted state and queued per file, coalesced and written
  serially. A failed write stays queued and is retried.
- Everything read from disk passes through Zod. A bad entity file is skipped, reported and left
  untouched. A file whose name does not match its `id` counts as bad.
- A malformed `workspace.json` or a newer `schemaVersion` refuses to open, so nothing gets overwritten.
- A malformed `settings.json` is copied to `settings.corrupt.json` before defaults are used.

## IPC boundary

The frontend never handles absolute paths. Rust keeps the workspace root, which is set only by the native
folder dialog or the remembered last workspace. Relative paths are checked against an allow-list:
`workspace.json`, `settings.json`, `settings.corrupt.json`, `templates/<safe>.json`, `events/<safe>.json`.
Symlinks that escape the root are rejected. Writes go to a synced temp file, then an atomic rename.

| Command | Purpose |
| --- | --- |
| `workspace_select(mode)` | Native dialog; `create` or `open` |
| `workspace_restore()` | Reopen the remembered workspace |
| `workspace_close()` | Forget the current workspace |
| `workspace_list(dir)` | List entity files |
| `workspace_read(path)` | Read a file, or null if missing |
| `workspace_write(path, contents)` | Atomic write |
| `workspace_remove(path)` | Delete a file |

## Major risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Pointer/time drift | One engine, unit tested in a DST timezone, e2e checks exact times |
| Layout shift under the pointer | Inspector overlays rather than reflows |
| Lost writes on quit | Short debounce, flush on window close |
| Overwriting user data | Allow-list, validation, skip-not-rewrite, version check |

- Hold the primary pointer on empty space for 450 ms to open a radial template picker.
  Keep holding the pointer, move onto a ball to pick it up, then drag onto a dated column and release to place.
- Invalid template drops split into small flat balls and fade; templates remain reusable.
- Workspace format v2 adds `magnetEnabled`; v1 settings migrate with the magnet enabled.
