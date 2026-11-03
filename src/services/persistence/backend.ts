import { invoke, isTauri } from '@tauri-apps/api/core';

export type WorkspaceLocation = {
  path: string;
  /** Whether the folder already contains a workspace.json. */
  initialized: boolean;
};

/** Everything the app may ask of the file system. Paths are always workspace-relative. */
export type WorkspaceBackend = {
  select(mode: 'create' | 'open'): Promise<WorkspaceLocation | null>;
  restore(): Promise<WorkspaceLocation | null>;
  close(): Promise<void>;
  list(dir: 'templates' | 'events'): Promise<string[]>;
  read(path: string): Promise<string | null>;
  write(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
};

const tauriBackend: WorkspaceBackend = {
  select: (mode) => invoke('workspace_select', { mode }),
  restore: () => invoke('workspace_restore'),
  close: () => invoke('workspace_close'),
  list: (dir) => invoke('workspace_list', { dir }),
  read: (path) => invoke('workspace_read', { path }),
  write: (path, contents) => invoke('workspace_write', { path, contents }),
  remove: (path) => invoke('workspace_remove', { path }),
};

/** Browser-only stand-in, used by `npm run dev` and the end-to-end tests. */
function createBrowserBackend(): WorkspaceBackend {
  const prefix = 'juicy-calendar:file:';
  const activeKey = 'juicy-calendar:active';
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
  };
}

export const backend: WorkspaceBackend = isTauri() ? tauriBackend : createBrowserBackend();
