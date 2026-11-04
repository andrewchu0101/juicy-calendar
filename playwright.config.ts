import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:1421',
    // WebKit is the engine Tauri uses on macOS.
    browserName: 'webkit',
    viewport: { width: 1400, height: 900 },
    timezoneId: 'America/New_York',
    // English with a 24-hour clock: browser mode has no Windows setting, so the time format comes from Intl
    // (FR-10, API-06). Specs that need a 12-hour clock set their own locale (en-US, zh-TW).
    locale: 'en-GB',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1421',
    reuseExistingServer: true,
  },
});
