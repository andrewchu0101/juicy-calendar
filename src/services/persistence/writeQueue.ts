import type { WorkspaceBackend } from './backend';

export type WriteQueue = {
  /** Queues a write, or a delete when contents is null. Later changes to a path replace earlier ones. */
  set(path: string, contents: string | null): void;
  /** Resolves once everything queued so far has been attempted. */
  flush(): Promise<void>;
  /** Removes any pending timer. Pending changes that were not flushed are dropped. */
  dispose(): void;
};

export function createWriteQueue(
  backend: Pick<WorkspaceBackend, 'write' | 'remove'>,
  onResult: (error: string | null) => void,
  debounceMs = 120,
): WriteQueue {
  const pending = new Map<string, string | null>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;

  const drain = async () => {
    const failed = new Map<string, string | null>();
    let lastError: string | null = null;
    while (pending.size > 0) {
      const [path, contents] = pending.entries().next().value as [string, string | null];
      pending.delete(path);
      try {
        if (contents === null) await backend.remove(path);
        else await backend.write(path, contents);
        failed.delete(path);
      } catch (error) {
        failed.set(path, contents);
        lastError = String(error);
      }
    }
    // Failures return to the queue unless a newer change for that path arrived meanwhile.
    for (const [path, contents] of failed) if (!pending.has(path)) pending.set(path, contents);
    onResult(lastError);
  };

  const run = (): Promise<void> => {
    running ??= drain().finally(() => {
      running = null;
    });
    return running;
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return {
    set(path, contents) {
      pending.set(path, contents);
      clearTimer();
      timer = setTimeout(() => void run(), debounceMs);
    },
    async flush() {
      clearTimer();
      if (running) await running;
      if (pending.size > 0) await run();
    },
    dispose() {
      clearTimer();
      pending.clear();
    },
  };
}
