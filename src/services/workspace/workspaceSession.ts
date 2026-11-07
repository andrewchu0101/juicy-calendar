import type { OpenErrorState } from '../notices/notices';
import { backend, type WorkspaceLocation } from '../persistence/backend';
import { BackendError } from '../persistence/backendError';
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

/** Turns anything thrown while opening into a code. `detail` keeps the diagnostic off the screen. */
function toOpenError(error: unknown): OpenErrorState {
  if (error instanceof WorkspaceOpenError) {
    return error.version === undefined ? { code: error.code } : { code: error.code, version: error.version };
  }
  if (error instanceof BackendError) {
    if (error.code === 'WORKSPACE_LOCKED' || error.code === 'NOT_A_WORKSPACE' || error.code === 'PORTABLE_DATA_UNAVAILABLE') {
      return { code: error.code };
    }
    return { code: 'OPEN_FAILED', detail: error.detail ?? error.code };
  }
  return { code: 'OPEN_FAILED', detail: error instanceof Error ? error.message : String(error) };
}

export async function restoreLastWorkspace(): Promise<void> {
  try {
    const location = await backend.restore();
    if (location) await enter(location);
  } catch (error) {
    await backend.close().catch(() => undefined);
    useAppStore.getState().setOpenError(toOpenError(error));
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
    store.setOpenError(toOpenError(error));
  }
}

export async function closeWorkspace(): Promise<void> {
  if (sync && !(await sync.stop())) return;
  sync = null;
  await backend.close();
  useAppStore.getState().reset();
}

/** False prevents a normal window close while writes still need recovery. */
export function flushWorkspace(): Promise<boolean> {
  return sync?.flush() ?? Promise.resolve(true);
}
