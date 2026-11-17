import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { screenFor } from '../config/screens';
import { PAGES } from './pageRegistry';
import Placeholder from '../pages/system/Placeholder';
import Forbidden from '../pages/system/Forbidden';

/**
 * Resolves one entry of config/screens.js for the signed-in user:
 * permission check → pick the screen for their level → render it (or a placeholder).
 */
export default function ScreenRoute({ route }) {
  const { user, can } = useAuth();
  const { pathname } = useLocation();
  const screen = screenFor(route, user.level);

  if (!screen || (route.perm && !can(route.perm))) return <Forbidden />;

  const key = `${screen.code}:${user.level}`;
  const Page = PAGES[key] ?? PAGES[screen.code];
  if (!Page) return <Placeholder code={screen.code} title={screen.title} />;
  // key: a fresh page (and fresh form state) when moving between records, e.g. /customers/c1 → c2
  return <Page key={pathname} screen={screen} />;
}
