import React from 'react';
import { createRoot } from 'react-dom/client';
import GameShell from './GameShell';
import '../../app/globals.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameShell />
  </React.StrictMode>,
);
