import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './app/styles.css';
import { initializeTheme } from './app/theme';
import { restoreWorkspace } from './app/workspaceStorage';

initializeTheme();

const root = createRoot(document.getElementById('root')!);
void restoreWorkspace().then((initialState) => root.render(
  <StrictMode>
    <App initialState={initialState} />
  </StrictMode>,
)).catch(() => root.render(<p role="alert">Impossible de lire la sauvegarde locale. Rechargez la page pour réessayer.</p>));
