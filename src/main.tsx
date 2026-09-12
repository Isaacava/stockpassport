import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './AppV2';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
