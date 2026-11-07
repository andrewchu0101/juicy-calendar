import { useAppStore, type AppState } from '../../stores/appStore';
import type { WorkspaceBackend } from './backend';
import { eventPath, serialize, templatePath } from './repository';
import { createWriteQueue, type WriteQueue } from './writeQueue';

function diffEntities<T>(
  previous: Record<string, T>,
  next: Record<string, T>,
  toPath: (id: string) => string,
  queue: WriteQueue,
) {
  if (previous === next) return;
  for (const [id, entity] of Object.entries(next)) {
    if (previous[id] !== entity) queue.set(toPath(id), serialize(entity));
  }
  for (const id of Object.keys(previous)) {
    if (!(id in next)) queue.set(toPath(id), null);
  }
}

/** A false result keeps unsaved changes and the subscription alive for recovery. */
export type PersistenceSync = { flush(): Promise<boolean>; stop(): Promise<boolean> };

/** Mirrors store changes to disk. Undo and redo need no special handling: they are just changes. */
export function startPersistenceSync(backend: WorkspaceBackend): PersistenceSync {
  const queue = createWriteQueue(backend, (error) => {
    useAppStore.getState().setSaveError(error === null ? null : { code: 'SAVE_FAILED', detail: error });
  });

  const unsubscribe = useAppStore.subscribe((state: AppState, previous: AppState) => {
    diffEntities(previous.events, state.events, eventPath, queue);
    diffEntities(previous.templates, state.templates, templatePath, queue);
    if (previous.settings !== state.settings) queue.set('settings.json', serialize(state.settings));
  });

  return {
    flush: () => queue.flush(),
    async stop() {
      if (!(await queue.flush())) return false;
      unsubscribe();
      queue.dispose();
      return true;
    },
  };
}
