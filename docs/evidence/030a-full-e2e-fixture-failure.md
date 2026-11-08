# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: multiSelect.spec.ts >> [TC-18][AC-04.2,FR-13] dragging one selected block moves all of them by the same time difference, across days, in one undo step
- Location: e2e\multiSelect.spec.ts:161:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('event-block')
Expected: 1
Received: 3
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByTestId('event-block') with timeout 5000ms
  - waiting for getByTestId('event-block')
    14 × locator resolved to 3 elements
       - unexpected value "3"

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e4]:
    - complementary [ref=f1e5]:
      - list [ref=f1e6]:
        - listitem [ref=f1e7]:
          - button "Drag Coding onto the calendar" [active] [ref=f1e8]
          - button "Coding" [ref=f1e9] [cursor=pointer]
        - listitem [ref=f1e10]:
          - button "Drag Study onto the calendar" [ref=f1e11]
          - button "Study" [ref=f1e12] [cursor=pointer]
        - listitem [ref=f1e13]:
          - button "Drag Exercise onto the calendar" [ref=f1e14]
          - button "Exercise" [ref=f1e15] [cursor=pointer]
        - listitem [ref=f1e16]:
          - button "Drag Reading onto the calendar" [ref=f1e17]
          - button "Reading" [ref=f1e18] [cursor=pointer]
        - listitem [ref=f1e19]:
          - button "Drag Rest onto the calendar" [ref=f1e20]
          - button "Rest" [ref=f1e21] [cursor=pointer]
        - listitem [ref=f1e22]:
          - button "Drag Personal onto the calendar" [ref=f1e23]
          - button "Personal" [ref=f1e24] [cursor=pointer]
        - listitem [ref=f1e25]:
          - button "Add template" [ref=f1e26] [cursor=pointer]: +
      - generic [ref=f1e27]:
        - generic "Browser Workspace" [ref=f1e28]
        - button "Switch" [ref=f1e29] [cursor=pointer]
    - main [ref=f1e30]:
      - generic [ref=f1e31]:
        - generic [ref=f1e32]:
          - button "Previous period" [ref=f1e33] [cursor=pointer]: ‹
          - button "Next period" [ref=f1e34] [cursor=pointer]: ›
          - button "Today" [ref=f1e35] [cursor=pointer]
        - heading "Nov 2 – 8, 2026" [level=2] [ref=f1e36]
        - generic [ref=f1e37]:
          - generic [ref=f1e38]:
            - generic [ref=f1e39]: Timeline start
            - combobox "Timeline start" [ref=f1e40]:
              - option "00:00"
              - option "01:00"
              - option "02:00"
              - option "03:00"
              - option "04:00"
              - option "05:00"
              - option "06:00"
              - option "07:00"
              - option "08:00" [selected]
              - option "09:00"
              - option "10:00"
              - option "11:00"
              - option "12:00"
              - option "13:00"
              - option "14:00"
              - option "15:00"
              - option "16:00"
              - option "17:00"
              - option "18:00"
              - option "19:00"
              - option "20:00"
              - option "21:00"
              - option "22:00"
              - option "23:00"
            - generic [aria-hidden] [ref=f1e41]: →
            - combobox "Timeline end" [ref=f1e42]:
              - option "00:00 +1"
              - option "01:00 +1"
              - option "02:00 +1"
              - option "03:00 +1" [selected]
              - option "04:00 +1"
              - option "05:00 +1"
              - option "06:00 +1"
              - option "07:00 +1"
              - option "08:00 +1"
              - option "09:00"
              - option "10:00"
              - option "11:00"
              - option "12:00"
              - option "13:00"
              - option "14:00"
              - option "15:00"
              - option "16:00"
              - option "17:00"
              - option "18:00"
              - option "19:00"
              - option "20:00"
              - option "21:00"
              - option "22:00"
              - option "23:00"
          - generic [ref=f1e43]:
            - checkbox "30 minute magnet" [checked] [ref=f1e44]
            - text: 30 min magnet
          - generic [ref=f1e45]:
            - text: Zoom
            - slider "Zoom" [ref=f1e46]: "1"
          - group "View" [ref=f1e47]:
            - button "week" [pressed] [ref=f1e48] [cursor=pointer]
            - button "day" [ref=f1e49] [cursor=pointer]
          - generic [ref=f1e51]:
            - generic [ref=f1e52]: Language
            - combobox "Language" [ref=f1e53]:
              - option "繁體中文"
              - option "English" [selected]
      - generic [ref=f1e57]:
        - generic [ref=f1e58]:
          - button "Mon 2" [ref=f1e60] [cursor=pointer]:
            - generic [ref=f1e61]: Mon
            - generic [ref=f1e62]: "2"
          - button "Tue 3" [ref=f1e63] [cursor=pointer]:
            - generic [ref=f1e64]: Tue
            - generic [ref=f1e65]: "3"
          - button "Wed 4" [ref=f1e66] [cursor=pointer]:
            - generic [ref=f1e67]: Wed
            - generic [ref=f1e68]: "4"
          - button "Thu 5" [ref=f1e69] [cursor=pointer]:
            - generic [ref=f1e70]: Thu
            - generic [ref=f1e71]: "5"
          - button "Fri 6" [ref=f1e72] [cursor=pointer]:
            - generic [ref=f1e73]: Fri
            - generic [ref=f1e74]: "6"
          - button "Sat 7" [ref=f1e75] [cursor=pointer]:
            - generic [ref=f1e76]: Sat
            - generic [ref=f1e77]: "7"
          - button "Sun 8" [ref=f1e78] [cursor=pointer]:
            - generic [ref=f1e79]: Sun
            - generic [ref=f1e80]: "8"
        - generic [ref=f1e81]:
          - generic [ref=f1e83]:
            - generic [ref=f1e84]: 08:00
            - generic [ref=f1e85]: 09:00
            - generic [ref=f1e86]: 10:00
            - generic [ref=f1e87]: 11:00
            - generic [ref=f1e88]: 12:00
            - generic [ref=f1e89]: 13:00
            - generic [ref=f1e90]: 14:00
            - generic [ref=f1e91]: 15:00
            - generic [ref=f1e92]: 16:00
            - generic [ref=f1e93]: 17:00
            - generic [ref=f1e94]: 18:00
            - generic [ref=f1e95]: 19:00
            - generic [ref=f1e96]: 20:00
            - generic [ref=f1e97]: 21:00
            - generic [ref=f1e98]: 22:00
            - generic [ref=f1e99]: 23:00
            - generic [ref=f1e100]:
              - text: 00:00
              - superscript [ref=f1e101]: "+1"
            - generic [ref=f1e102]: 01:00
            - generic [ref=f1e103]: 02:00
          - generic [ref=f1e104]:
            - generic [ref=f1e124]:
              - generic "Coding · 10:00–12:00" [ref=f1e125]:
                - generic:
                  - generic: Coding
                  - generic: 10:00–12:00
              - generic "Coding · 16:00–18:00" [ref=f1e128]:
                - generic:
                  - generic: Coding
                  - generic: 16:00–18:00
            - generic "Coding · 10:00–12:00" [ref=f1e132]:
              - generic:
                - generic: Coding
                - generic: 10:00–12:00
  - status [ref=f1e140]: Draggable item coding was dropped.
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from '@playwright/test';
  2   | import { RADIAL_LONG_PRESS_MS } from '../src/features/calendar/engine/limits';
  3   |
  4   | /** Fixed clock: Monday, Nov 2, 2026. */
  5   | const NOW = new Date('2026-11-02T12:00:00-05:00');
  6   |
  7   | async function box(locator: Locator) {
  8   |   const rect = await locator.boundingBox();
  9   |   if (!rect) throw new Error('element has no box');
  10  |   return rect;
  11  | }
  12  |
  13  | /** Client coordinates for a column and a time, with the default 08:00 start at 1 px/min. */
  14  | async function point(page: Page, column: number, hour: number, minute = 0) {
  15  |   const grid = await box(page.getByTestId('calendar-columns'));
  16  |   const count = await page.getByTestId('day-column').count();
  17  |   return { x: grid.x + (grid.width / count) * (column + 0.5), y: grid.y + (hour - 8) * 60 + minute };
  18  | }
  19  |
  20  | async function dragBall(page: Page, index: number, target: { x: number; y: number }) {
  21  |   const ball = await box(page.getByTestId('template-ball').nth(index));
  22  |   await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
  23  |   await page.mouse.down();
  24  |   await page.mouse.move(target.x, target.y - 30, { steps: 6 });
  25  |   await page.mouse.move(target.x, target.y);
  26  |   await expect(page.locator('.ball-dragging-source')).toHaveCount(1);
  27  |   await expect.poll(async () => {
  28  |     const ghost = await page.getByTestId('drop-ghost').first().boundingBox();
  29  |     return ghost ? Math.abs(ghost.y - target.y) : Infinity;
  30  |   }).toBeLessThanOrEqual(8);
  31  |   await page.mouse.up();
  32  | }
  33  |
  34  | async function createAt(page: Page, column: number, hour: number) {
  35  |   const before = await page.getByTestId('event-block').count();
  36  |   await dragBall(page, 0, await point(page, column, hour));
> 37  |   await expect(page.getByTestId('event-block')).toHaveCount(before + 1);
      |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  38  |   await expect(page.locator('.event-drop')).toHaveCount(0);
  39  | }
  40  |
  41  | /** The fake clock freezes timers, not React's scheduler. A few round trips let a pending render land. */
  42  | async function settle(page: Page) {
  43  |   await page.evaluate(async () => {
  44  |     for (let i = 0; i < 5; i += 1) {
  45  |       await new Promise<void>((resolve) => {
  46  |         const channel = new MessageChannel();
  47  |         channel.port1.onmessage = () => resolve();
  48  |         channel.port2.postMessage(0);
  49  |       });
  50  |     }
  51  |   });
  52  | }
  53  |
  54  | const selected = (page: Page) => page.locator('[data-testid="event-block"][data-selected="true"]');
  55  | const eventFiles = (page: Page) =>
  56  |   page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('juicy-calendar:file:events/')).sort());
  57  |
  58  | /** Three events: A Monday 10:00, B Tuesday 10:00, C Monday 16:00. Then freezes the clock so the long press is test-driven. */
  59  | test.beforeEach(async ({ page }) => {
  60  |   await page.clock.setFixedTime(NOW);
  61  |   await page.goto('/');
  62  |   await page.getByRole('button', { name: 'Create workspace' }).click();
  63  |   await expect(page.getByTestId('template-ball')).toHaveCount(6);
  64  |   await createAt(page, 0, 10);
  65  |   await createAt(page, 1, 10);
  66  |   await createAt(page, 0, 16);
  67  |   await page.waitForTimeout(300); // the save debounce settles before time is frozen
  68  |   await page.clock.install({ time: NOW });
  69  |   await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
  70  | });
  71  |
  72  | async function marquee(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  73  |   await page.mouse.move(from.x, from.y);
  74  |   await page.mouse.down();
  75  |   await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  76  |   await page.mouse.move(to.x, to.y, { steps: 3 });
  77  |   if (release) await page.mouse.up();
  78  | }
  79  |
  80  | test('[TC-18][AC-04.1,FR-12] a quick drag on empty space selects the blocks it touches, not the others, and opens no radial menu', async ({ page }) => {
  81  |   const filesBefore = await eventFiles(page);
  82  |   // From empty space (Wednesday 14:00) up-left over A (Mon 10:00) and B (Tue 10:00), clear of C (Mon 16:00).
  83  |   await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  84  |   await settle(page);
  85  |   await expect(selected(page)).toHaveCount(2);
  86  |   await expect(page.locator('.radial-choice')).toHaveCount(0);
  87  |   await expect(page.getByTestId('inspector')).toHaveCount(0);
  88  |   await page.clock.runFor(RADIAL_LONG_PRESS_MS * 2);
  89  |   expect(await eventFiles(page)).toEqual(filesBefore);
  90  | });
  91  |
  92  | test('[TC-18][AC-04.1,FR-12] a marquee over empty space clears the selection', async ({ page }) => {
  93  |   await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  94  |   await expect(selected(page)).toHaveCount(2);
  95  |   await marquee(page, await point(page, 3, 9), await point(page, 4, 12));
  96  |   await settle(page);
  97  |   await expect(selected(page)).toHaveCount(0);
  98  | });
  99  |
  100 | test('[TC-18][AC-04.1,FR-12] Escape during a marquee puts the earlier selection back', async ({ page }) => {
  101 |   await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  102 |   await expect(selected(page)).toHaveCount(2);
  103 |   // A new marquee over C only; Escape before release must leave A and B selected.
  104 |   await marquee(page, await point(page, 3, 18), await point(page, 0, 16, 30), false);
  105 |   await page.keyboard.press('Escape');
  106 |   await page.mouse.up();
  107 |   await settle(page);
  108 |   await expect(selected(page)).toHaveCount(2);
  109 | });
  110 |
  111 | test('[TC-18][AC-04.1,FR-12] holding still for the long-press time opens the radial menu, and moving afterwards does not start a marquee', async ({ page }) => {
  112 |   const start = await point(page, 2, 14);
  113 |   await page.mouse.move(start.x, start.y);
  114 |   await page.mouse.down();
  115 |   await page.clock.runFor(RADIAL_LONG_PRESS_MS);
  116 |   await expect(page.locator('.radial-choice')).toHaveCount(6);
  117 |   await page.mouse.move(start.x - 200, start.y - 200, { steps: 4 });
  118 |   await page.mouse.up();
  119 |   await settle(page);
  120 |   await expect(selected(page)).toHaveCount(0);
  121 | });
  122 |
  123 | test('[TC-18][AC-04.1,FR-12] a click on one selected block shrinks the selection to that block', async ({ page }) => {
  124 |   await marquee(page, await point(page, 2, 14), await point(page, 0, 10, 30));
  125 |   await expect(selected(page)).toHaveCount(2);
  126 |   const target = await point(page, 1, 11);
  127 |   await page.mouse.click(target.x, target.y);
  128 |   await settle(page);
  129 |   await expect(selected(page)).toHaveCount(1);
  130 | });
  131 |
  132 | type Stored = { id: string; title: string; startAt: string; endAt: string };
  133 |
  134 | /** Advances the frozen clock past the save debounce, then reads the event files the app wrote. */
  135 | async function stored(page: Page): Promise<Stored[]> {
  136 |   await page.clock.runFor(1000);
  137 |   await settle(page);
```