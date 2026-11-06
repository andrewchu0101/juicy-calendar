import { expect, test, type Page } from '@playwright/test';
import { RADIAL_ENTER_MS, RADIAL_LONG_PRESS_MS, RADIAL_MOVE_TOLERANCE_PX } from '../src/features/calendar/engine/limits';

/** Fixed clock: Monday, Nov 2, 2026. */
const NOW = new Date('2026-11-02T12:00:00-05:00');

async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  // Fake timers only after the workspace is open, so the long-press wait is driven by the test, not by guessing.
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 1000)); // frozen: time moves only through runFor
}

/** The fake clock freezes timers, not React's scheduler (MessageChannel). A few round trips let a pending render land,
 *  so a "nothing appeared" assertion cannot pass just because it ran before the render. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      });
    }
  });
}

test.beforeEach(async ({ page }) => open(page));

test('[TC-17][AC-01.4,FR-04] the radial menu appears at the long-press time and not before', async ({ page }) => {
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await page.clock.runFor(RADIAL_LONG_PRESS_MS - 1);
  await settle(page);
  await expect(page.locator('.radial-choice')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.mouse.up();
});

test('[TC-17][AC-01.4,FR-04] moving more than the tolerance before the long-press time cancels the menu; moving exactly the tolerance does not', async ({ page }) => {
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await page.clock.runFor(RADIAL_LONG_PRESS_MS - 100);
  await page.mouse.move(650 + RADIAL_MOVE_TOLERANCE_PX + 1, 450);
  await page.clock.runFor(RADIAL_LONG_PRESS_MS * 2);
  await settle(page);
  await expect(page.locator('.radial-choice')).toHaveCount(0);
  await page.mouse.up();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('juicy-calendar:file:events/')))).toHaveLength(0);

  await page.mouse.move(650, 450);
  await page.mouse.down();
  await page.clock.runFor(RADIAL_LONG_PRESS_MS - 100);
  await page.mouse.move(650 + RADIAL_MOVE_TOLERANCE_PX, 450);
  await page.clock.runFor(100);
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  await page.mouse.up();
});

test('[TC-17][AC-01.4,FR-04] the radial balls slide out in the entrance time from the single constant', async ({ page }) => {
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await page.clock.runFor(RADIAL_LONG_PRESS_MS);
  await expect(page.locator('.radial-choice')).toHaveCount(6);
  const durations = await page.locator('.radial-choice').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationDuration));
  expect(durations).toEqual(Array(6).fill(`${RADIAL_ENTER_MS / 1000}s`));
  await page.mouse.up();
});
