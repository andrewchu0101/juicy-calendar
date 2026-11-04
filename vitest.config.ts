import { defineConfig } from 'vitest/config';

// A DST timezone makes the daylight-saving tests meaningful on any machine.
process.env.TZ = 'America/New_York';

export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
});
