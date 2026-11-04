/**
 * Test-only (票 018、NFR-03). Reads a Content-Security-Policy given as `{ directive: "source source" }`
 * (the shape of `app.security.csp` in tauri.conf.json) and lists every source that is not on the local
 * allow-list. An allow-list, not a block-list: anything not named here (a domain, `*`, a bare scheme such
 * as `https:` or `wss:`, a typo) counts as external.
 */
export type ExternalSource = { directive: string; source: string };

const LOCAL_SOURCES = new Set([
  "'self'", // the app's own bundled files
  "'none'",
  "'unsafe-inline'", // inline styles (style-src); no network
  'data:', // images embedded in the page
  'ipc:', // Tauri's IPC scheme
  'http://ipc.localhost', // the same IPC on Windows
]);

export function externalSources(csp: Record<string, string>): ExternalSource[] {
  return Object.entries(csp).flatMap(([directive, value]) =>
    value
      .split(/\s+/)
      .filter((source) => source !== '' && !LOCAL_SOURCES.has(source))
      .map((source) => ({ directive, source })),
  );
}
