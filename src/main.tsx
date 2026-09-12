import { useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './AppV2';
import Landing from './Landing';

function Root() {
  const [entered, setEntered] = useState(false);
  return entered ? <App /> : <Landing onEnter={() => setEntered(true)} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
