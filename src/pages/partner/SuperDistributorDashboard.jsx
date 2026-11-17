import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import { Button, Card, CardHeader, ErrorBlock, Kpi, LoadingBlock, PageHeader, Table } from '../../components/ui';
import { KeyStatusBadge } from '../network/networkParts';
import { greeting, usePartnerDashboard } from './usePartnerDashboard';
import RequestsPanel from './RequestsPanel';
import PartnerDialogs from './PartnerDialogs';
import './partner.css';

/** N-09 · Super distributor dashboard (also their "My distributors" page). */
export default function SuperDistributorDashboard() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload, dialog, setDialog, close, done } = usePartnerDashboard();

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const columns = [
    { key: 'name', header: 'Distributor', width: '2fr', render: (r) => (
      <div className="cell-stack"><span className="fw-600">{r.name}</span><span className="cell-sub">{r.owner} · {r.city}</span></div>
    ) },
    { key: 'subs', header: 'Sub dist.', width: '0.7fr', align: 'right', render: (r) => num(r.counts.subDistributors) },
    { key: 'retailers', header: 'Retailers', width: '0.7fr', align: 'right', render: (r) => num(r.counts.retailers) },
    { key: 'balance', header: 'Keys left', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600" style={{ color: r.low ? 'var(--bad)' : undefined }}>{num(r.balance)}</span> },
    { key: 'used', header: `Used, ${data.collectionMoney.month}`, width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{num(r.usedPerMonth)}</span> },
    { key: 'collection', header: 'Collection', width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{r.collection != null ? `${r.collection}%` : '—'}</span> },
    { key: 'status', header: 'Keys', width: '1.1fr', render: (r) => <KeyStatusBadge status={r.keyStatus} /> },
  ];

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={`Your network: ${data.counts.distributors} distributors · ${data.counts.subDistributors} sub distributors · ${data.counts.retailers} retailers`}
        actions={<>
          {can(P.KEYS_REQUEST) && !data.pendingRequest && <Button variant="secondary" onClick={() => setDialog({ kind: 'request' })}>Request keys from {data.parent?.name}</Button>}
          {can(P.KEYS_SEND) && <Button onClick={() => setDialog({ kind: 'send' })}>Send keys</Button>}
        </>}
      />

      <div className="grid-4">
        <button type="button" className="kpi-link" onClick={() => navigate('/wallet')}>
          <Kpi dark label="Your key balance" value={num(data.balance)}
            foot={data.pendingRequest ? `Request pending · ${num(data.pendingRequest.qty)}` : 'Open key wallet'} />
        </button>
        <Kpi label={data.usedPerMonth == null ? 'Devices enrolled' : 'Keys used this month'} value={num(data.usedPerMonth ?? data.used)} foot={data.usedPerMonth == null ? 'in your network, all time' : `${num(data.used)} since start`} />
        <Kpi label="Active devices" value={num(data.devices)} foot="in your network" />
        <Kpi label={`EMI collection, ${data.collectionMoney.month}`} value={data.collection != null ? `${data.collection}%` : '—'} foot={`${data.collectionMoney.collected} of ${data.collectionMoney.due}`} />
      </div>

      <div className="split-side">
        <Card flush>
          <CardHeader title="My distributors" action={can(P.PARTNER_ADD) && <Button variant="secondary" size="sm" to="/partners/new">Add distributor</Button>} />
          <Table columns={columns} rows={data.children} onRowClick={(r) => navigate(`/partners/${r.id}`)} minWidth={720} empty="No distributors yet. Add your first one." />
        </Card>
        <RequestsPanel requests={data.requests} balance={data.balance} onDecline={(r) => setDialog({ kind: 'decline', request: r })} onDone={reload} />
      </div>

      <PartnerDialogs data={data} dialog={dialog} close={close} done={done} />
    </div>
  );
}