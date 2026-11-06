# Juicy Calendar — Product

A local-first desktop app for visual time blocking. You allocate time by dragging
reusable coloured balls onto a calendar. It is not a todo list and not a task manager.

## Core loop

Pick a ball → drag it onto the calendar → a 2-hour block appears → resize it → double-click to name it.

## Concepts

| Concept | Meaning |
| --- | --- |
| Template | A reusable material (a coloured ball). Never consumed by dragging. |
| Event | An independent time allocation. Copies its colour and keeps a reference to the source template. |
| Calendar | A free canvas. Optional gentle half-hour attraction, overlaps are allowed, empty space is meaningful. |
| Workspace | A plain folder of JSON files that the user owns. |

## Product rules

- New events are always exactly 120 minutes, whatever the template's default duration says.
  The default duration is stored and editable, and is reserved for a later product decision.
- Pointer positions resolve to the nearest whole minute. A default-on, persistent magnet attracts
  drops, moves and resize edges within 8 screen pixels of a 30-minute line; it can be disabled.
- Overlaps are never prevented or rearranged in time; they only share width visually.
- Editing an event never affects its template or any other event.
- Editing or deleting a template never changes existing events.
- Undo/redo covers event changes only. Template and view settings are not part of the history.

## Out of scope

Accounts, cloud sync, collaboration, checkboxes, AI scheduling, external calendars,
analytics, subscriptions.

- Hold the primary pointer on empty space for 250 ms to open a radial template picker.
  Keep holding the pointer, move onto a ball to pick it up, then drag onto a dated column and release to place.
- Invalid template drops split into small flat balls and fade; templates remain reusable.
- Workspace format v2 adds `magnetEnabled`; v1 settings migrate with the magnet enabled.

- Past-date calendar columns show event blocks at reduced saturation, updating as the local date changes.
