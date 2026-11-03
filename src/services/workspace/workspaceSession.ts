import { backend, type WorkspaceLocation } from '../persistence/backend';
import { startPersistenceSync, type PersistenceSync } from '../persistence/persistenceSync';
import { initializeWorkspace, loadWorkspace, WorkspaceOpenError } from '../persistence/repository';
import { useAppStore } from '../../stores/appStore';

let sync: PersistenceSync | null = null;

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? 'Workspace';
}

async function enter(location: WorkspaceLocation): Promise<void> {
  const data = location.initialized
    ? await loadWorkspace(backend)
    : await initializeWorkspace(backend, folderName(location.path));
  // Hydrate before subscribing, so loading a workspace never writes it back.
  useAppStore.getState().hydrate(data, location.path);
  sync = startPersistenceSync(backend);
}

function describe(error: unknown): string {
  return error instanceof WorkspaceOpenError ? error.message : `Could not open the workspace: ${String(error)}`;
}

export async function restoreLastWorkspace(): Promise<void> {
  try {
    const location = await backend.restore();
    if (location) await enter(location);
  } catch (error) {
    await backend.close().catch(() => undefined);
    useAppStore.getState().setOpenError(describe(error));
  } finally {
    useAppStore.getState().setBooted();
  }
}

export async function selectWorkspace(mode: 'create' | 'open'): Promise<void> {
  const store = useAppStore.getState();
  store.setOpenError(null);
  try {
    const location = await backend.select(mode);
    if (location) await enter(location);
  } catch (error) {
    await backend.close().catch(() => undefined);
    store.setOpenError(describe(error));
  }
}

export async function closeWorkspace(): Promise<void> {
  await sync?.stop();
  sync = null;
  await backend.close();
  useAppStore.getState().reset();
}

export function flushWorkspace(): Promise<void> {
  return sync?.flush() ?? Promise.resolve();
}
