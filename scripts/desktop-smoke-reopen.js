// Second launch: the event from the first launch must be back on the calendar.
(async () => {
  const report = {
    blocksOnLaunch: document.querySelectorAll('[data-testid="event-block"]').length,
    time: document.querySelector('[data-testid="event-time"]')?.textContent ?? null,
  };
  await window.__TAURI_INTERNALS__.invoke('workspace_write', {
    path: 'settings.corrupt.json',
    contents: JSON.stringify(report, null, 2),
  });
})();
