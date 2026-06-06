import { createBrowserRouter, Navigate } from 'react-router-dom';
import { auth } from './lib/api';
import { Login } from './pages/Login';
import { ChatPage } from './pages/ChatPage';
import { LinkDevice } from './pages/LinkDevice';
import { SettingsPage } from './pages/SettingsPage';

function Protected({ children }: { children: JSX.Element }) {
  return auth.isAuthed() ? children : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <Protected>
        <ChatPage />
      </Protected>
    ),
  },
  {
    path: '/chat/:jid',
    element: (
      <Protected>
        <ChatPage />
      </Protected>
    ),
  },
  {
    path: '/link',
    element: (
      <Protected>
        <LinkDevice />
      </Protected>
    ),
  },
  {
    path: '/settings',
    element: (
      <Protected>
        <SettingsPage />
      </Protected>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
