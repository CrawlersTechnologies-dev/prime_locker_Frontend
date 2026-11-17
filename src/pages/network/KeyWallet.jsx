import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { keysApi } from '../../services/networkApi';
import { P } from '../../config/permissions';
import { LEVEL_META, levelBelow } from '../../config/roles';
import { num } from '../../utils/format';
import { Badge, Button, Card, CardHeader, ErrorBlock, Icon, LoadingBlock, PageHeader, Table } from '../../components/ui';
import { RequestKeysDialog, SendKeysDialog } from './networkParts';

const BELOW = { sub_distributor: 'sub distributors', retailer: 'retailers', distributor: 'distributors' };

/** N-12 · Key wallet (partners). /keys/send opens the Send keys dialog on top. */
export default function KeyWallet({ initialSend = false }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: w, loading, error, reload } = useApi(() => keysApi.wallet(), []);
  const [send, setSend] = useState(initialSend ? { toId: params.get('to') ?? undefined } : null);
  const [asking, setAsking] = useState(false);

  if (loading && !w) return <LoadingBlock rows={3} />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const below = BELOW[levelBelow(user.level)];
  const belowSingular = LEVEL_META[levelBelow(user.level)]?.label.toLowerCase();
  const closeSend = () => { setSend(null); if (initialSend) navigate('/wallet', { replace: true }); };

  const columns = [
    { key: 'date', header: 'Date', width: '0.8fr', render: (m) => <span className="ink-2">{m.date}</span> },
    { key: 'what', header: 'Details', width: '2.4fr' },
    { key: 'delta', header: 'Keys', width: '0.7fr', align: 'right', render: (m) => (
      <span className="fw-600" style={{ color: m.delta > 0 ? 'var(--ok)' : undefined }}>{m.delta > 0 ? `+${num(m.delta)}` : `−${num(-m.delta)}`}</span>
    ) },
    { key: 'balance', header: 'Balance', width: '0.7fr', align: 'right', render: (m) => <span className="ink-2">{num(m.balance)}</span> },
    { key: 'ref', header: 'Reference', width: '1.2fr', render: (m) => <span className="mono small muted">{m.ref}</span> },
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Key wallet"
        subtitle={`You get keys from ${w.parent?.name} and send them to your ${below}.`}
        actions={<>
          {can(P.KEYS_REQUEST) && (w.pendingRequest
            ? <Badge tone="warn">Asked {w.parent.name} for {num(w.pendingRequest.qty)} · {w.pendingRequest.at}</Badge>
            : <Button variant="secondary" onClick={() => setAsking(true)}>Request from {w.parent?.name}</Button>)}
          {can(P.KEYS_SEND) && <Button onClick={() => setSend({})}>Send to {belowSingular}</Button>}
        </>}
      />

      <Card className="wallet">
        <div className="wallet-balance">
          <span className="sub">Balance</span>
          <b>{num(w.balance)}</b>
          <span className={w.low ? 'text-bad small' : 'sub'}>{w.daysLeft != null ? `About ${w.daysLeft} days at your current rate` : 'keys ready to send'}</span>
        </div>
        {w.live ? (
          <div className="wallet-flow">
            {w.balanceByType.map((t) => <div key={t.value}><b>{num(t.count)}</b><span>{t.label} keys</span></div>)}
          </div>
        ) : (
          <div className="wallet-flow">
            <div><b>{num(w.received)}</b><span>Received from {w.parent?.name.split(' ')[0]}</span></div>
            <Icon name="chevronRight" />
            <div><b>{num(w.sent)}</b><span>Sent to {below}</span></div>
            <Icon name="chevronRight" />
            <div><b>{num(w.used)}</b><span>Used on devices below you</span></div>
          </div>
        )}
      </Card>

      <Card flush>
        <CardHeader title="Movements" action={<Link to="/keys/history" className="link-arrow">Key history for your network<Icon name="chevronRight" size={16} /></Link>} />
        <Table columns={columns} rows={w.movements} minWidth={720}
          empty={w.live ? 'Key movements will show here once the server adds key history. Your balance above is live.' : 'No keys received or sent yet.'} />
      </Card>

      {send && <SendKeysDialog open toId={send.toId} onClose={closeSend} onDone={() => { closeSend(); reload(); }} />}
      <RequestKeysDialog open={asking} parentName={w.parent?.name} balance={w.balance} usedPerMonth={w.usedPerMonth}
        onClose={() => setAsking(false)} onDone={() => { setAsking(false); reload(); }} />
    </div>
  );
}