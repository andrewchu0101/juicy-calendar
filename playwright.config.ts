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
    locale: 'en-US',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1421',
    reuseExistingServer: true,
  },
});
