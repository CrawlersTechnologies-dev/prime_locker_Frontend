import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { keysApi, KEYS_CHANGED } from '../../services/networkApi';

/** Sidebar + top bar + page. Every signed-in route renders inside this. */
export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  const [counts, setCounts] = useState({ keyRequests: 0 });

  useEffect(() => { setNavOpen(false); window.scrollTo(0, 0); }, [pathname]);

  // Waiting key requests for the sidebar badge — refreshed on every page change.
  useEffect(() => {
    let alive = true;
    const load = () => Promise.resolve(keysApi.pendingCount())
      .then((n) => alive && setCounts({ keyRequests: n }))
      .catch(() => {});
    load();
    window.addEventListener(KEYS_CHANGED, load);
    return () => { alive = false; window.removeEventListener(KEYS_CHANGED, load); };
  }, [pathname]);

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="shell-side">
        <Sidebar counts={counts} onNavigate={() => setNavOpen(false)} />
      </aside>
      {navOpen && <button type="button" className="scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />}
      <div className="shell-main">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}