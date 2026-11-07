import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { useI18nStore } from '../i18n/i18n';
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
        .onCloseRequested(async (event) => {
          if (!(await flushWorkspace())) event.preventDefault();
        })
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
  const languageReady = useI18nStore((state) => state.ready);
  const workspacePath = useAppStore((state) => state.workspacePath);
  useFlushOnExit();

  // Wait for the language so the first paint is never in the wrong one.
  if (!booted || !languageReady) return null;
  return workspacePath ? <AppShell /> : <WelcomeScreen />;
}
