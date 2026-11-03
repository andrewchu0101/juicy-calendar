// Runs inside the real Tauri webview. Drops a ball with synthetic pointer events, probes the IPC
// boundary, and writes a report through the app's own allow-listed path.
(async () => {
  const report = {};
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fire = (target, type, x, y) =>
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }),
    );
  try {
    const ball = document.querySelector('[data-testid="template-ball"]');
    const grid = document.querySelector('[data-testid="calendar-columns"]');
    const style = getComputedStyle(ball);
    report.ballCount = document.querySelectorAll('[data-testid="template-ball"]').length;
    report.ballImage = style.backgroundImage;
    report.ballColor = style.backgroundColor;
    report.stylesLoaded = style.borderRadius === '50%';

    const ballRect = ball.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const x = ballRect.left + 20;
    const y = ballRect.top + 20;
    const targetX = gridRect.left + gridRect.width / 14;
    const targetY = gridRect.top + 150;
    fire(ball, 'pointerdown', x, y);
    await wait(50);
    for (let step = 1; step <= 8; step += 1) {
      fire(document, 'pointermove', x + ((targetX - x) * step) / 8, y + ((targetY - y) * step) / 8);
      await wait(20);
    }
    report.ghostShown = document.querySelector('[data-testid="drop-ghost"]') !== null;
    fire(document, 'pointerup', targetX, targetY);
    await wait(400);
    report.blocksAfterDrop = document.querySelectorAll('[data-testid="event-block"]').length;
    report.droppedTime = document.querySelector('[data-testid="event-time"]')?.textContent ?? null;

    for (const [name, args] of [
      ['readTraversal', ['workspace_read', { path: '../outside.json' }]],
      ['writeAbsolute', ['workspace_write', { path: '/tmp/juicy-escape.json', contents: 'x' }]],
      ['writeNested', ['workspace_write', { path: 'events/../../juicy-escape.json', contents: 'x' }]],
      ['listOutside', ['workspace_list', { dir: '..' }]],
    ]) {
      try {
        await invoke(...args);
        report[name] = 'ALLOWED';
      } catch {
        report[name] = 'rejected';
      }
    }
  } catch (error) {
    report.error = String(error);
  }
  await invoke('workspace_write', { path: 'settings.corrupt.json', contents: JSON.stringify(report, null, 2) });
})();
