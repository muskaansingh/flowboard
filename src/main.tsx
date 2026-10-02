import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { STORAGE_KEY, rehydrateFromStorage } from './store/appStore';
import './index.css';

// Keep multiple tabs in sync: another tab's write re-hydrates this store
// (and stale drawer edits are then caught by the version check → CONFLICT).
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) void rehydrateFromStorage();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
