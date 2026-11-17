import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Splash() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }} aria-busy="true">
    <img src="/prime-locker-pro-mark.png" alt="Loading Prime Locker Pro" width="40" height="38" />
  </div>;
}

/** Only for signed-in users. Remembers where they were going. */
export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Login / reset pages — signed-in users go straight to the dashboard. */
export function GuestOnly() {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
