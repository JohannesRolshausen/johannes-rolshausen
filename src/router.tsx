import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import SoundCanvasPage from './pages/soundCanvas/SoundCanvasPage';
import NeverHallucinateAIPage from './pages/neverHallucinateAI/NeverHallucinateAIPage';
import AiRightsPage from './pages/aiRights/AiRightsPage';
//import ShowreelPage from './pages/showreel/ShowreelPage';

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
  {
    path: '/aiRights',
    element: <AiRightsPage />,
  }/*,
  {
    path: '/showreel',
    element: <ShowreelPage />,
  }*/,
]);