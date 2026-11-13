import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppSettingsProvider } from './context/AppSettingsContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AppSettingsProvider>
    <App />
  </AppSettingsProvider>
);
