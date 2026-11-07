import { expect, test, type Page } from '@playwright/test';
import { RADIAL_LONG_PRESS_MS } from '../src/features/calendar/engine/limits';

const NOW = new Date('2026-11-02T12:00:00-05:00');
const EVENT = {
  id: 'scope-event', templateId: 'coding', title: 'Scope event', color: '#E98B87',
  startAt: '2026-11-02T15:30:00.000Z', endAt: '2026-11-02T17:30:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.evaluate((event) => localStorage.setItem(`juicy-calendar:file:events/${event.id}.json`, JSON.stringify(event)), EVENT);
  await page.reload();
  await expect(page.getByTestId('event-block')).toHaveCount(1);
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
});

async function expectNoRadialOnLongPress(page: Page, point: { x: number; y: number }) {
  const filesBefore = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('juicy-calendar:file:')));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  try {
    await page.clock.runFor(RADIAL_LONG_PRESS_MS * 2);
    // Fake timers leave React scheduling live; let queued renders finish before testing absence.
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i += 1) {
        await new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => resolve();
          channel.port2.postMessage(0);
        });
      }
    });
    await expect(page.locator('.radial-choice')).toHaveCount(0);
  } finally {
    await page.mouse.up();
  }
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('juicy-calendar:file:')))).toEqual(filesBefore);
}

test('[TC-17][AC-01.4,FR-04] long pressing sidebar background does not open the radial menu', async ({ page }) => {
  const sidebar = await page.locator('aside').boundingBox();
  if (!sidebar) throw new Error('sidebar has no box');
  await expectNoRadialOnLongPress(page, { x: sidebar.x + sidebar.width / 2, y: sidebar.y + sidebar.height - 100 });
});

test('[TC-17][AC-01.4,FR-04] long pressing the toolbar heading does not open the radial menu', async ({ page }) => {
  const heading = await page.getByTestId('range-label').boundingBox();
  if (!heading) throw new Error('toolbar heading has no box');
  await expectNoRadialOnLongPress(page, { x: heading.x + heading.width / 2, y: heading.y + heading.height / 2 });
});

test('[TC-17][AC-01.4,FR-04] long pressing inspector text does not open the radial menu', async ({ page }) => {
  await page.getByTestId('event-block').click();
  const text = await page.getByTestId('inspector-template').boundingBox();
  if (!text) throw new Error('inspector text has no box');
  await expectNoRadialOnLongPress(page, { x: text.x + text.width / 2, y: text.y + text.height / 2 });
});
