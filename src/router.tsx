import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import SoundCanvasPage from './pages/soundCanvas/SoundCanvasPage';
import NeverHallucinateAIPage from './pages/neverHallucinateAI/NeverHallucinateAIPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/soundCanvas',
    element: <SoundCanvasPage />,
  },
  {
    path: '/neverHallucinateAI',
    element: <NeverHallucinateAIPage />,
  },
]);