import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { RequireAuth, GuestOnly } from './routes/guards';
import ScreenRoute from './routes/ScreenRoute';
import { SCREENS } from './config/screens';
import AppShell from './components/layout/AppShell';
import Login from './pages/auth/Login';
import NotFound from './pages/system/NotFound';

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <Login /> },
      // A-43 Reset password — coming next
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          ...SCREENS.map((route) => ({
            path: route.path,
            element: route.redirect ? <Navigate to={route.redirect} replace /> : <ScreenRoute route={route} />,
          })),
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}
