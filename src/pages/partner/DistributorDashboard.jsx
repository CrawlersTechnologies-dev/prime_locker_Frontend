import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import { Button, Card, ErrorBlock, KeyValue, Kpi, LoadingBlock, PageHeader } from '../../components/ui';
import { KeyStatusBadge } from '../network/networkParts';
import { usePartnerDashboard } from './usePartnerDashboard';
import RequestsPanel from './RequestsPanel';
import PartnerDialogs from './PartnerDialogs';
import './partner.css';

/** N-10 · My sub distributors (distributor's dashboard and network page). */
export default function DistributorDashboard() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload, dialog, setDialog, close, done } = usePartnerDashboard();

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  return (
    <div className="page">
      <PageHeader
        title="My sub distributors"
        subtitle="You can see everything below you. You can't see other distributors' networks."
        actions={<>
          {can(P.KEYS_REQUEST) && !data.pendingRequest && <Button variant="secondary" onClick={() => setDialog({ kind: 'request' })}>Request keys from {data.parent?.name}</Button>}
          {can(P.PARTNER_ADD) && <Button icon="plus" to="/partners/new">Add sub distributor</Button>}
        </>}
      />

      <div className="grid-4">
        <button type="button" className="kpi-link" onClick={() => navigate('/wallet')}>
          <Kpi dark label="Your key balance" value={num(data.balance)} foot={data.pendingRequest ? `Request pending · ${num(data.pendingRequest.qty)}` : 'Open key wallet'} />
        </button>
        <Kpi label="Sub distributors" value={num(data.counts.subDistributors)} foot={`${num(data.counts.retailers)} retailers under them`} />
        <Kpi label="Active devices" value={num(data.devices)} foot={data.usedPerMonth == null ? 'in your network' : `+${num(data.usedPerMonth)} this month`} />
        <Kpi label={`EMI collection, ${data.collectionMoney.month}`} value={data.collection != null ? `${data.collection}%` : '—'} foot={`${num(data.overdue)} customers overdue`} />
      </div>

      {data.requests.length > 0 && (
        <RequestsPanel requests={data.requests} balance={data.balance} onDecline={(r) => setDialog({ kind: 'decline', request: r })} onDone={reload} />
      )}

      <div className="partner-cards">
        {data.children.length === 0 && <Card pad><p className="sub">No sub distributors yet. Add your first one to start sending keys.</p></Card>}
        {data.children.map((s) => (
          <Card as="article" key={s.id} className="partner-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div className="cell-stack" style={{ gap: 3 }}><span style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</span><span className="sub">{s.owner} · {s.city}</span></div>
              <KeyStatusBadge status={s.keyStatus} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: s.low ? 'var(--bad)' : undefined }}>{num(s.balance)}</span><span className="sub">keys left</span>
            </div>
            <KeyValue items={[['Retailers', num(s.counts.retailers)], ['Active devices', num(s.devices)], [`Keys used, ${data.collectionMoney.month}`, num(s.usedPerMonth)]]} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" block to={`/partners/${s.id}`}>View</Button>
              {can(P.KEYS_SEND) && <Button size="sm" block disabled={s.status === 'suspended'} onClick={() => setDialog({ kind: 'send', toId: s.id })}>Send keys</Button>}
            </div>
          </Card>
        ))}
      </div>

      <PartnerDialogs data={data} dialog={dialog} close={close} done={done} />
    </div>
  );
}