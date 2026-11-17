import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { keysApi } from '../../services/networkApi';
import { P } from '../../config/permissions';
import { LEVELS, levelBelow } from '../../config/roles';
import { num } from '../../utils/format';
import { Badge, Button, Card, ErrorBlock, LoadingBlock, PageHeader, StateMessage, Tabs, useToast } from '../../components/ui';
import { DeclineRequestDialog, LevelChip, RequestKeysDialog } from './networkParts';

const PLURAL = { super_distributor: 'Super distributors', distributor: 'Distributors', sub_distributor: 'Sub distributors', retailer: 'Retailers' };

/** N-08 · Key requests — requests sent to you by the level directly below. */
export default function KeyRequests() {
  const { user, can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useQueryState({ tab: 'waiting' });
  const { data, loading, error, reload } = useApi(() => keysApi.requests(q.tab), [q.tab]);
  const wallet = useApi(() => (user.level === LEVELS.COMPANY ? Promise.resolve(null) : keysApi.wallet()), []);
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (data) setQty(Object.fromEntries(data.rows.map((r) => [r.id, String(r.qty)])));
  }, [data]);

  if (loading && !data) return <LoadingBlock rows={3} />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const isCompany = user.level === LEVELS.COMPANY;
  const below = levelBelow(isCompany ? LEVELS.COMPANY : user.level);
  const canApprove = can(P.KEYS_APPROVE);
  const stockLabel = isCompany ? 'Company stock' : 'Your balance';

  const approve = async (r) => {
    const n = Number(String(qty[r.id]).replace(/,/g, ''));
    if (!Number.isInteger(n) || n <= 0) { toast('Enter how many keys to send', 'bad'); return; }
    const have = data.balanceByType?.find((t) => t.value === r.deviceType)?.count ?? data.balance;
    if (n > have) { toast(`You have only ${num(have)} ${r.platform ?? ''} keys`.replace('  ', ' '), 'bad'); return; }
    setBusy(r.id);
    try { await keysApi.approve(r.id, n); toast(`${num(n)} keys sent to ${r.from.name}`); reload(); wallet.reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };

  const tabs = [
    { value: 'waiting', label: `Waiting (${data.counts.waiting})` },
    { value: 'approved', label: data.live ? `Approved (${data.counts.approved})` : 'Approved' },
    { value: 'declined', label: data.live ? `Declined (${data.counts.declined})` : 'Declined' },
  ];
  const w = wallet.data;

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Key requests"
        subtitle={isCompany
          ? 'Super distributors ask you for keys. Lower levels ask the partner above them, not you.'
          : `${PLURAL[below]} ask you for keys. You ask ${w?.parent?.name ?? 'the level above'}.`}
        actions={!isCompany && can(P.KEYS_REQUEST) && w && (
          w.pendingRequest
            ? <Badge tone="warn">You asked {w.parent.name} for {num(w.pendingRequest.qty)}</Badge>
            : <Button variant="secondary" onClick={() => setAsking(true)}>Request keys from {w.parent?.name}</Button>
        )}
      />

      <Tabs label="Request status" idPrefix="kr" tabs={tabs} value={q.tab} onChange={(tab) => setQ({ tab })} />

      {q.tab === 'waiting' && data.counts.waiting > 0 && (
        <div className="note" style={{ background: 'var(--navy-tint)', color: 'var(--ink)', fontSize: 14 }}>
          <span>{stockLabel}: <b>{data.balanceByType ? data.balanceByType.map((t) => `${num(t.count)} ${t.label}`).join(' · ') : `${num(data.balance)} keys`}</b>. Approving all {data.counts.waiting} requests needs {num(data.needed)}.
            {data.needed > data.balance && !data.live && <> You can approve part of a request by changing the number.</>}</span>
        </div>
      )}

      {data.rows.length === 0 && (
        <Card>
          <StateMessage icon="request" title={q.tab === 'waiting' ? 'No requests waiting' : `No ${q.tab} requests`}>
            {q.tab === 'waiting' ? `When ${PLURAL[below].toLowerCase()} run low, their requests show up here.` : 'Handled requests are listed here.'}
          </StateMessage>
        </Card>
      )}

      {data.rows.map((r) => (
        <Card key={r.id} className="req-card">
          <div className="cell-stack" style={{ gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LevelChip level={r.from.level} /><span style={{ fontSize: 15, fontWeight: 600 }}>{r.from.name}</span></div>
            <span className="sub">{[r.platform ? `${r.platform} keys` : null, r.by, r.at, r.ref ?? r.id].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="req-stat"><span>Asked for</span><span>{num(r.qty)}</span></div>
          <div className="req-stat"><span>Balance now</span><span style={{ color: r.from.low ? 'var(--bad)' : undefined }}>{r.from.balance == null ? '—' : num(r.from.balance)}</span></div>
          <div className="req-stat"><span>Used / month</span><span>{r.from.usedPerMonth == null ? '—' : `~${num(r.from.usedPerMonth)}`}</span></div>
          <div className="req-note">{r.note ? `“${r.note}”` : <span className="muted">No note</span>}</div>
          {r.status === 'waiting' && canApprove ? (
            <div className="req-actions">
              <label className="visually-hidden" htmlFor={`qty-${r.id}`}>Keys to approve for {r.from.name}</label>
              <input id={`qty-${r.id}`} className="qty-input" inputMode="numeric" value={qty[r.id] ?? ''}
                readOnly={r.fullOnly} title={r.fullOnly ? 'The full requested amount is sent' : undefined}
                onChange={(e) => setQty((s) => ({ ...s, [r.id]: e.target.value }))}
                aria-invalid={Number(String(qty[r.id]).replace(/,/g, '')) > data.balance} />
              <Button variant="secondary" onClick={() => setDeclining(r)}>Decline</Button>
              <Button disabled={busy === r.id} onClick={() => approve(r)}>{busy === r.id ? 'Sending…' : 'Approve'}</Button>
            </div>
          ) : (
            <div className="req-actions">
              {r.status === 'approved' && <Badge tone="ok">Sent {num(r.approvedQty)} · {r.decidedAt}</Badge>}
              {r.status === 'declined' && <Badge tone="bad">Declined · {r.decidedAt}</Badge>}
              {r.status === 'waiting' && <Badge tone="warn">Waiting</Badge>}
            </div>
          )}
          {r.status === 'declined' && r.reason && <span className="sub" style={{ gridColumn: '1 / -1' }}>Reason: {r.reason}</span>}
        </Card>
      ))}

      <DeclineRequestDialog request={declining} onClose={() => setDeclining(null)} onDone={() => { setDeclining(null); reload(); }} />
      {w && <RequestKeysDialog open={asking} parentName={w.parent?.name} balance={w.balance} usedPerMonth={w.usedPerMonth}
        onClose={() => setAsking(false)} onDone={() => { setAsking(false); wallet.reload(); }} />}
    </div>
  );
}