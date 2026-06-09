import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastHost } from './components/ui/Toast';
import { ConfirmHost } from './components/ui/ConfirmDialog';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <ToastHost />
    <ConfirmHost />
  </React.StrictMode>,
);
