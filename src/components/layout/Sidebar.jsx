import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV, partnerNav, PARTNER_FOOTER_NAV } from '../../config/navigation';
import { LEVELS, LEVEL_META } from '../../config/roles';
import { can } from '../../config/permissions';
import Icon from '../ui/Icon';

function NavItem({ item, counts, onNavigate }) {
  const { pathname } = useLocation();
  // Keep the parent item highlighted on its sub-pages (e.g. /emi/overdue → EMI plans).
  const extraMatch = item.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  // …but not on sub-pages that have their own item (e.g. /devices/approved-models).
  const excluded = item.exclude?.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  const count = item.countKey ? counts?.[item.countKey] : null;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) => `nav-link${(isActive || extraMatch) && !excluded ? ' active' : ''}`}
    >
      <Icon name={item.icon} />
      <span className="nav-label">{item.label}</span>
      {count ? <span className="nav-count" aria-label={`${count} waiting`}>{count}</span> : null}
    </NavLink>
  );
}

/** One sidebar for every level. Items the user has no permission for are not rendered. */
export default function Sidebar({ counts, onNavigate }) {
  const { user } = useAuth();
  const isCompany = user.level === LEVELS.COMPANY;
  const groups = (isCompany ? ADMIN_NAV : partnerNav(user.level))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(user, i.perm)) }))
    .filter((g) => g.items.length > 0);
  const meta = LEVEL_META[user.level];

  return (
    <nav className="sidebar" aria-label="Main">
      <NavLink to="/dashboard" className="sidebar-brand" onClick={onNavigate}>
        <img src="/prime-locker-pro-mark.png" alt="" />
        <span>Prime Locker Pro</span>
      </NavLink>

      {!isCompany && (
        <div className="sidebar-org">
          <strong>{user.org?.name}</strong>
          <span className="level-chip" style={{ background: meta.chipBg, color: meta.chipFg }}>{meta.label}</span>
        </div>
      )}

      {groups.map((g, i) => (
        <div key={g.group ?? i} style={{ display: 'contents' }}>
          {g.group && <div className="sidebar-group">{g.group}</div>}
          {g.items.map((item) => <NavItem key={item.key} item={item} counts={counts} onNavigate={onNavigate} />)}
        </div>
      ))}

      {!isCompany && can(user, PARTNER_FOOTER_NAV.perm) && (
        <>
          <div className="sidebar-spacer" />
          <NavItem item={PARTNER_FOOTER_NAV} onNavigate={onNavigate} />
        </>
      )}
    </nav>
  );
}
