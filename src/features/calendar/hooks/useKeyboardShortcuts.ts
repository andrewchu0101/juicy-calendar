import { useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Text fields keep their native editing keys, including their own undo.
      if (isTyping(event.target)) return;
      const store = useAppStore.getState();

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && (store.selectedEventId || store.selectedEventIds.length > 0)) {
        event.preventDefault();
        store.deleteSelected();
        return;
      }
      if (event.key === 'Escape') store.select(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
