import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initCloud } from './progress/cloud';
import { keepProgress } from './progress/persist';
import { onSaved } from './progress/store';
import { initSound } from './sound/engine';
import './install';
import './styles.css';

registerSW({ immediate: true });
initSound();
onSaved(keepProgress);
initCloud();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
