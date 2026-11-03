import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { flushWorkspace } from '../services/workspace/workspaceSession';
import { useAppStore } from '../stores/appStore';
import { AppShell } from './AppShell';

function useFlushOnExit() {
  useEffect(() => {
    const flush = () => void flushWorkspace();
    window.addEventListener('pagehide', flush);
    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      void getCurrentWindow()
        .onCloseRequested(() => flushWorkspace())
        .then((stop) => {
          unlisten = stop;
        });
    }
    return () => {
      window.removeEventListener('pagehide', flush);
      unlisten?.();
    };
  }, []);
}

export function App() {
  const booted = useAppStore((state) => state.booted);
  const workspacePath = useAppStore((state) => state.workspacePath);
  useFlushOnExit();

  if (!booted) return null;
  return workspacePath ? <AppShell /> : <WelcomeScreen />;
}
