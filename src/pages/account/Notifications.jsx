import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { adminApi, ADMIN_LIVE } from '../../services/adminApi';
import { Button, Card, ErrorBlock, FilterBar, FilterChips, Icon, LoadingBlock, PageHeader, Pagination, StateMessage, useToast } from '../../components/ui';
import { NeedsServer } from '../admin-tools/Staff';

const ICON = { KEY_REQUEST: 'request', PAYMENT_RECEIVED: 'card', OVERDUE_ALERT: 'alert', DEVICE_LOCK: 'lock', DEVICE_UNLOCK: 'unlock', SYSTEM: 'bell' };
const GO = { KEY_REQUEST: '/key-requests', PAYMENT_RECEIVED: '/payments', OVERDUE_ALERT: '/emi/overdue' };
export const NOTIFICATIONS_CHANGED = 'plp:notifications';

/** A-41 · Notifications (bell). */
export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useQueryState({ view: 'all', page: 1 });
  const { data, loading, error, reload } = useApi(
    () => (ADMIN_LIVE ? adminApi.notifications({ unread: f.view === 'unread', page: f.page }) : Promise.resolve(null)),
    [f.view, f.page],
  );
  const [busy, setBusy] = useState(false);
  if (!ADMIN_LIVE) return <NeedsServer title="Notifications" />;

  const changed = () => { window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)); reload(); };
  const open = async (n) => {
    if (!n.read) await adminApi.markRead(n.id).catch(() => null);
    changed();
    if (GO[n.type]) navigate(GO[n.type]);
  };
  const readAll = async () => {
    setBusy(true);
    try { await adminApi.markAllRead(); toast('All marked as read'); changed(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader title="Notifications" subtitle="Key requests, payments and alerts for your account"
        actions={<Button variant="secondary" icon="check" disabled={busy || !data?.items.some((n) => !n.read)} onClick={readAll}>Mark all as read</Button>} />
      <FilterBar>
        <FilterChips label="Show" value={f.view} onChange={(view) => setF({ view })} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
      </FilterBar>
      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <LoadingBlock rows={3} />
          : data.items.length === 0 ? (
            <StateMessage icon="bell" title={f.view === 'unread' ? 'You’re all caught up' : 'No notifications yet'}>
              New key requests and payments recorded in your network show up here.
            </StateMessage>
          ) : (
            <>
              <ul className="notif-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.items.map((n) => (
                  <li key={n.id}>
                    <button type="button" className="alert-row" onClick={() => open(n)}
                      style={{ width: '100%', textAlign: 'left', background: n.read ? undefined : 'var(--navy-tint)', border: 0, cursor: 'pointer' }}>
                      <span className="alert-icon tone-info"><Icon name={ICON[n.type] ?? 'bell'} size={16} /></span>
                      <div className="cell-stack" style={{ gap: 3, flexGrow: 1 }}>
                        <span className={n.read ? '' : 'fw-600'}>{n.title}</span>
                        <span className="sub">{n.message}</span>
                        <span className="cell-sub">{[n.from !== 'System' && n.from, n.at].filter(Boolean).join(' · ')}</span>
                      </div>
                      {!n.read && <span className="dot" aria-label="Unread" style={{ position: 'static' }} />}
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>
    </div>
  );
}
