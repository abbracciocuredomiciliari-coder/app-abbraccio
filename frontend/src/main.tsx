import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import './styles.css';
import './tailwind.css';

// ─── Auto-reload quando un chunk lazy non esiste più (nuova versione deployata)
// Se il browser ha ancora il vecchio index.html con chunk scaduti, ricarica una
// volta per scaricare la versione corrente invece di mostrare pagina bianca.
const isChunkLoadError = (msg: string) =>
  /dynamically imported module|chunkloaderror|loading chunk|module script|imported module/i.test(msg);

const reloadOnStaleChunk = () => {
  if (sessionStorage.getItem('chunk-reload')) return; // evita loop infinito
  sessionStorage.setItem('chunk-reload', '1');
  window.location.reload();
};

window.addEventListener('load', () => sessionStorage.removeItem('chunk-reload'));
window.addEventListener('error', (e) => {
  if (isChunkLoadError(String(e.message || '')) || isChunkLoadError(String((e as any).error?.message || ''))) {
    reloadOnStaleChunk();
  }
}, true);
window.addEventListener('unhandledrejection', (e) => {
  if (isChunkLoadError(String(e.reason?.message || e.reason || ''))) {
    reloadOnStaleChunk();
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
