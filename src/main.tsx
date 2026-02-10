import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Perceptr from '@perceptr/web-sdk';
import './index.css';
import App from './App.tsx';

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}

// Initialize Perceptr SDK for session recording & bug detection
Perceptr.init({
  projectId: 'projecthub-bug-zoo',
  debug: true,
  env: 'dev',
  network: {
    captureRequestBody: true,
    captureResponseBody: true,
    sanitizeHeaders: ['authorization', 'cookie'],
  },
});
Perceptr.start();

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
