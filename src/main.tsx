import { useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import './lib/appkit';
import './styles.css';
import './portfolio.css';
import PortfolioApp from './PortfolioApp';
import Landing from './Landing';

function Root() {
  const [entered, setEntered] = useState(false);
  return entered ? <PortfolioApp /> : <Landing onEnter={() => setEntered(true)} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
