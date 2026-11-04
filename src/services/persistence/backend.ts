import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Language } from '../../i18n/detectLanguage';
import { BackendError, toBackendError } from './backendError';
import { appSettingsFileSchema, systemInfoSchema } from './schemas';

export type WorkspaceLocation = {
  path: string;
  /** Whether the folder already contains a workspace.json. */
  initialized: boolean;
};

/** App-wide settings of this computer (API-05). `language` is null until the user has chosen one. */
export type AppSettings = { language: Language | null };

/** What the operating system reports (API-06). A value is null when it cannot be read. */
export type SystemInfo = { locale: string | null; hour12: boolean | null };

/** Everything the app may ask of the file system. Paths are always workspace-relative. */
export type WorkspaceBackend = {
  select(mode: 'create' | 'open'): Promise<WorkspaceLocation | null>;
  restore(): Promise<WorkspaceLocation | null>;
  close(): Promise<void>;
  list(dir: 'templates' | 'events'): Promise<string[]>;
  read(path: string): Promise<string | null>;
  write(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
  readAppSettings(): Promise<AppSettings>;
  writeAppSettings(settings: { language: Language }): Promise<void>;
  systemInfo(): Promise<SystemInfo>;
};

/** Every Tauri failure arrives as `{code, detail}`; callers get a BackendError instead. */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toBackendError(error);
  }
}

const tauriBackend: WorkspaceBackend = {
  select: (mode) => call('workspace_select', { mode }),
  restore: () => call('workspace_restore'),
  close: () => call('workspace_close'),
  list: (dir) => call('workspace_list', { dir }),
  read: (path) => call('workspace_read', { path }),
  write: (path, contents) => call('workspace_write', { path, contents }),
  remove: (path) => call('workspace_remove', { path }),
  readAppSettings: async () => {
    const parsed = appSettingsFileSchema.safeParse(await call('app_settings_read'));
    return { language: parsed.success ? parsed.data.language : null };
  },
  writeAppSettings: (settings) => call('app_settings_write', { settings }),
  // API-06 never fails: any problem means "unknown", and the caller falls back to the browser.
  systemInfo: async () => {
    const reply = await call('system_info').catch(() => undefined);
    const parsed = systemInfoSchema.safeParse(reply);
    return parsed.success ? parsed.data : { locale: null, hour12: null };
  },
};

function readJson(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Browser-only stand-in, used by `npm run dev` and the end-to-end tests. */
export function createBrowserBackend(): WorkspaceBackend {
  const prefix = 'juicy-calendar:file:';
  const activeKey = 'juicy-calendar:active';
  const settingsKey = 'juicy-calendar:app-settings';
  const location = (): WorkspaceLocation => ({
    path: 'Browser Workspace',
    initialized: localStorage.getItem(`${prefix}workspace.json`) !== null,
  });
  return {
    select: async () => {
      localStorage.setItem(activeKey, '1');
      return location();
    },
    restore: async () => (localStorage.getItem(activeKey) ? location() : null),
    close: async () => localStorage.removeItem(activeKey),
    list: async (dir) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(`${prefix}${dir}/`))
        .map((key) => key.slice(`${prefix}${dir}/`.length)),
    read: async (path) => localStorage.getItem(prefix + path),
    write: async (path, contents) => localStorage.setItem(prefix + path, contents),
    remove: async (path) => localStorage.removeItem(prefix + path),
    readAppSettings: async () => {
      const parsed = appSettingsFileSchema.safeParse(readJson(localStorage.getItem(settingsKey)));
      return { language: parsed.success ? parsed.data.language : null };
    },
    writeAppSettings: async (settings) => {
      const parsed = appSettingsFileSchema.safeParse(settings);
      if (!parsed.success) throw new BackendError('IO_ERROR', 'Unsupported language');
      localStorage.setItem(settingsKey, JSON.stringify(parsed.data));
    },
    systemInfo: async () => ({ locale: navigator.languages?.[0] || null, hour12: null }),
  };
}

export const backend: WorkspaceBackend = isTauri() ? tauriBackend : createBrowserBackend();
