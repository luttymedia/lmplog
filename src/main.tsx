import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import SplashScreen from './SplashScreen.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SplashScreen>
      <App />
    </SplashScreen>
  </StrictMode>,
);
