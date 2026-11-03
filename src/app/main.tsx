import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { restoreLastWorkspace } from '../services/workspace/workspaceSession';
import { App } from './App';
import './index.css';

void restoreLastWorkspace();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
