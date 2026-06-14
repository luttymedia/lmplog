import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import InstallEnforcer from './InstallEnforcer.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InstallEnforcer>
      <App />
    </InstallEnforcer>
  </StrictMode>,
);
