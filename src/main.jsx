import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { detectLocale, loadLocale } from './i18n/index.js';

// Load the interface language before the first render; Spanish is built in and always available.
loadLocale(detectLocale()).catch(() => loadLocale('es')).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
