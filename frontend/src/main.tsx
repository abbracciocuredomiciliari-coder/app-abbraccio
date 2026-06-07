import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
