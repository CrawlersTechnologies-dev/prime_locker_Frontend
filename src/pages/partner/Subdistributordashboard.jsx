import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { P } from '../../config/permissions';
import { num, initials } from '../../utils/format';
import { Button, Card, ErrorBlock, Kpi, LoadingBlock, PageHeader } from '../../components/ui';
import { usePartnerDashboard } from './usePartnerDashboard';
import RequestsPanel from './RequestsPanel';
import PartnerDialogs from './PartnerDialogs';
import './partner.css';

function weeksLabel(days) {
  if (days == null) return 'Open key wallet';
  if (days < 7) return `About ${days} days at current rate`;
  return `About ${Math.round(days / 7)} weeks at current rate`;
}

/** N-11 · Sub distributor dashboard (also their "My retailers" page). */
export default function SubDistributorDashboard() {
  const { can } = useAuth();
  const { data, loading, error, reload, dialog, setDialog, close, done } = usePartnerDashboard();

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  return (
    <div className="page">
      <PageHeader
        title={data.name}
        subtitle={`Under ${data.parent?.name} · ${data.children.length} retailers`}
        actions={<>
          {can(P.KEYS_REQUEST) && (data.pendingRequest
            ? <span className="badge badge-warn">Asked {data.parent?.name} for {num(data.pendingRequest.qty)}</span>
            : <Button variant="secondary" onClick={() => setDialog({ kind: 'request' })}>Request keys from {data.parent?.name}</Button>)}
          {can(P.RETAILERS_MANAGE) && <Button icon="plus" to="/retailers/new">Add retailer</Button>}
        </>}
      />

      <div className="grid-4">
        <Link to="/wallet" className="kpi-link">
          <Kpi dark label="Your key balance" value={num(data.balance)} foot={weeksLabel(data.daysLeft)} />
        </Link>
        <Kpi label="Active devices" value={num(data.devices)} foot={data.usedPerMonth == null ? 'in your network' : `+${num(data.usedPerMonth)} this month`} />
        <Kpi label="Overdue customers" value={<span style={{ color: data.overdue ? 'var(--bad)' : undefined }}>{num(data.overdue)}</span>} foot={data.lockedNow == null ? 'installments past due' : `${num(data.lockedNow)} phones locked`} />
        <Kpi label={`EMI collection, ${data.collectionMoney.month}`} value={data.collection != null ? `${data.collection}%` : '—'} foot="across your retailers" />
      </div>

      <div className="split-side side-360">
        <Card flush>
          <div className="card-head" style={{ padding: '18px 20px' }}><h2 className="h2">My retailers</h2></div>
          {data.children.length === 0 && <p className="sub" style={{ padding: '0 20px 20px' }}>No retailers yet. Add your first store to start enrolling devices.</p>}
          {data.children.map((r, i) => (
            <div key={r.id} className="ret-row">
              <span className="avatar-i is-square" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 14, background: i === 0 ? 'var(--navy-deep)' : 'var(--mute-bg)', color: i === 0 ? 'var(--amber)' : 'var(--ink-2)' }}>{initials(r.name)}</span>
              <Link to={`/retailers/${r.id}`} className="grow cell-stack" style={{ color: 'var(--ink)', gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span><span className="sub">{r.owner} · {r.city}</span>
              </Link>
              <div className="ret-stat"><span>Keys left</span><span style={{ color: r.low ? 'var(--bad)' : undefined }}>{num(r.balance)}</span></div>
              <div className="ret-stat"><span>Devices</span><span>{num(r.devices)}</span></div>
              <div className="ret-stat"><span>Collection</span><span>{r.collection != null ? `${r.collection}%` : '—'}</span></div>
              {can(P.KEYS_SEND) && (
                <Button size="sm" variant={r.low ? 'primary' : 'secondary'} disabled={r.status !== 'active'} onClick={() => setDialog({ kind: 'send', toId: r.id })}>Send keys</Button>
              )}
            </div>
          ))}
        </Card>
        <RequestsPanel title="Requests from retailers" requests={data.requests} balance={data.balance} onDecline={(r) => setDialog({ kind: 'decline', request: r })} onDone={reload} />
      </div>

      <PartnerDialogs data={data} dialog={dialog} close={close} done={done} />
    </div>
  );
}