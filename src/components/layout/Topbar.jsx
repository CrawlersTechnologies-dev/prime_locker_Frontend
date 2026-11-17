import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleLabel } from '../../config/roles';
import Icon from '../ui/Icon';
import { adminApi, ADMIN_LIVE } from '../../services/adminApi';

const NOTIFICATIONS_CHANGED = 'plp:notifications';

export default function Topbar({ onMenu, hasUnread: demoUnread = true }) {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  // Live: unread count from the server, every minute and whenever the Notifications page changes it.
  useEffect(() => {
    if (!ADMIN_LIVE) return undefined;
    let off = false;
    const load = () => adminApi.unreadCount().then((n) => { if (!off) setUnread(n); });
    load();
    const t = setInterval(load, 60000);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => { off = true; clearInterval(t); window.removeEventListener(NOTIFICATIONS_CHANGED, load); };
  }, []);
  const hasUnread = ADMIN_LIVE ? unread > 0 : demoUnread;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const onSearch = (e) => {
    e.preventDefault();
    // TODO(api): global search endpoint — customer, phone or IMEI.
    if (query.trim()) navigate(`/devices?q=${encodeURIComponent(query.trim())}`);
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-toggle" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <form className="search" role="search" onSubmit={onSearch}>
        <Icon name="search" />
        <input
          type="search"
          placeholder="Search customer, phone or IMEI"
          aria-label="Search customer, phone or IMEI"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <div className="topbar-spacer" />
      <Link to="/notifications" className="icon-btn" aria-label={hasUnread ? `Notifications, ${ADMIN_LIVE ? `${unread} unread` : 'unread'}` : 'Notifications'}>
        <Icon name="bell" />
        {hasUnread && <span className="dot" />}
      </Link>
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button type="button" className="user-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="avatar">{user.initials}</span>
          <span className="who"><b>{user.name}</b><span>{roleLabel(user)}</span></span>
        </button>
        {open && (
          <div className="menu" role="menu">
            <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}><Icon name="user" />My profile</Link>
            <div className="menu-sep" />
            <button type="button" role="menuitem" onClick={signOut}><Icon name="logout" />Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
