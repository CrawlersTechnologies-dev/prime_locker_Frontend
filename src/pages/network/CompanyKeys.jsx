import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { keysApi } from '../../services/networkApi';
import { isLive } from '../../services/http';

const PARTNERS_LIVE = isLive('partners');
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import { Button, Card, CardHeader, ErrorBlock, Kpi, LoadingBlock, PageHeader, Table } from '../../components/ui';
import { GenerateKeysDialog, KeyStatusBadge, SendKeysDialog } from './networkParts';

/** N-05 · Enrolment keys (Prime Locker). /keys/send opens the Send keys dialog (N-06) on top. */
export default function CompanyKeys({ initialSend = false }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => keysApi.company(), []);
  const [send, setSend] = useState(initialSend ? { toId: params.get('to') ?? undefined } : null);
  const [generate, setGenerate] = useState(false);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const total = data.stock + data.withNetwork + data.used;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const closeSend = () => { setSend(null); if (initialSend) navigate('/keys', { replace: true }); };

  const columns = [
    { key: 'name', header: 'Super distributor', width: '2fr', render: (r) => (
      <div className="cell-stack"><span className="fw-600">{r.name}</span><span className="cell-sub">{r.lastLabel}</span></div>
    ) },
    // The backend gives each partner's available keys only (no received / sent / used totals yet).
    ...(data.live ? [] : [
      { key: 'received', header: 'Received', width: '0.8fr', align: 'right', render: (r) => num(r.received) },
      { key: 'sent', header: 'Sent down', width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{num(r.sent)}</span> },
    ]),
    { key: 'balance', header: data.live ? 'Available keys' : 'Balance', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600" style={{ color: r.low ? 'var(--bad)' : undefined }}>{num(r.balance)}</span> },
    ...(data.live ? [] : [{ key: 'used', header: 'Used', width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{num(r.used)}</span> }]),
    { key: 'status', header: 'Status', width: '1fr', render: (r) => <KeyStatusBadge status={r.keyStatus} /> },
    ...(can(P.KEYS_SEND) ? [{ key: 'act', header: '', width: '104px', render: (r) => (
      <Button variant="secondary" size="sm" disabled={r.status === 'suspended'} onClick={(e) => { e.stopPropagation(); setSend({ toId: r.id }); }}>Send keys</Button>
    ) }] : []),
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Enrolment keys"
        subtitle="1 key enrols 1 device. Keys move Prime Locker → super distributor → distributor → sub distributor → retailer."
        actions={<>
          <Button variant="secondary" to="/keys/history">Key history</Button>
          {can(P.KEYS_GENERATE) && <Button variant="secondary" icon="plus" onClick={() => setGenerate(true)}>Generate keys</Button>}
          {can(P.KEYS_SEND) && <Button onClick={() => setSend({})}>Send keys</Button>}
        </>}
      />

      <div className="grid-4">
        <Kpi label="Generated" value={num(data.generated)} foot={data.batches != null ? `${data.batches} batches since Feb` : 'stock + network + used'} />
        <Kpi label="In company stock" value={<span style={{ color: 'var(--navy)' }}>{num(data.stock)}</span>}
          foot={data.stockByType ? data.stockByType.map((t) => `${t.label} ${num(t.count)}`).join(' · ') : 'ready to send'} />
        <Kpi label="With partners & retailers" value={num(data.withNetwork)} foot="not yet used" />
        <Kpi label="Used on devices" value={num(data.used)} foot={data.usedThisMonth != null ? `+${num(data.usedThisMonth)} this month` : 'devices enrolled'} />
      </div>

      <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="dist-bar" role="img" aria-label={`Company stock ${pct(data.stock)}%, with network ${pct(data.withNetwork)}%, used ${pct(data.used)}%`}>
          <div style={{ width: `${pct(data.stock)}%`, background: 'var(--navy)' }} />
          <div style={{ width: `${pct(data.withNetwork)}%`, background: '#9FB1D6' }} />
          <div style={{ width: `${pct(data.used)}%`, background: 'var(--alert)' }} />
        </div>
        <div className="dist-legend">
          <span><i style={{ background: 'var(--navy)' }} />Company stock {Math.round(pct(data.stock))}%</span>
          <span><i style={{ background: '#9FB1D6' }} />With network {Math.round(pct(data.withNetwork))}%</span>
          <span><i style={{ background: 'var(--alert)' }} />Used on devices {Math.round(pct(data.used))}%</span>
        </div>
      </Card>

      <Card flush>
        <CardHeader title="Super distributors" action={<span className="sub">Keys you have sent directly</span>} />
        <Table columns={columns} rows={data.rows} onRowClick={data.live && !PARTNERS_LIVE ? undefined : (r) => navigate(`/partners/${r.id}`)} minWidth={data.live ? 600 : 820}
          empty="No super distributors yet. Add one, then send keys." />
      </Card>

      {send && <SendKeysDialog open toId={send.toId} toLevel={send.toId ? 'super_distributor' : undefined} onClose={closeSend} onDone={() => { closeSend(); reload(); }} />}
      <GenerateKeysDialog open={generate} onClose={() => setGenerate(false)} onDone={() => { setGenerate(false); reload(); }} />
    </div>
  );
}