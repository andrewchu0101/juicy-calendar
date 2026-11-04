import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initLanguage } from '../i18n/i18n';
import { restoreLastWorkspace } from '../services/workspace/workspaceSession';
import { App } from './App';
import './index.css';

void initLanguage();
void restoreLastWorkspace();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
