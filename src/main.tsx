import RAPIER from '@dimforge/rapier3d-compat';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './parts'; // registers all built-in part types
import './styles.css';
import App from './App';

async function boot() {
  await RAPIER.init();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
