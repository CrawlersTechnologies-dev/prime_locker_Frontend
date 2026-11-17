import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { emiApi } from '../../services/emiApi';
import { P } from '../../config/permissions';
import { inr, inrShort, num, downloadCsv } from '../../utils/format';
import { Badge, Button, Card, Dialog, ErrorBlock, Field, FilterBar, LoadingBlock, PageHeader, Pagination, SearchInput, Table, useToast } from '../../components/ui';
import './emi.css';

const BUCKETS = [['1-7', '1–7 days late'], ['8-15', '8–15 days late'], ['16-30', '16–30 days late'], ['30+', 'Over 30 days']];
const DEVICE = { online: ['ok', 'Online'], offline: ['mute', 'Offline'], locked: ['bad', 'Locked'], unlocked: ['info', 'Unlocked'] };

/** A-22 · Overdue EMIs — remind or lock, one at a time or in bulk. */
export default function OverdueEmis() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useQueryState({ bucket: 'all', q: '', page: 1 });
  const { data, loading, error, reload } = useApi(() => emiApi.overdue(f), [f.bucket, f.q, f.page]);
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // { kind: 'remind-all' | 'lock', ids }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const canRemind = can(P.WHATSAPP_SEND);
  const canLock = can(P.DEVICES_CONTROL);
  const pageIds = useMemo(() => data?.items.map((r) => r.id) ?? [], [data]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n; });

  const live = !!data.live;
  const remind = async (ids) => {
    setBusy(true);
    try {
      const r = await emiApi.remind(ids);
      toast(live
        ? `Reminder sent to ${num(r.sent)} ${r.sent === 1 ? 'customer' : 'customers'} on WhatsApp and their device${r.skipped ? ` · ${num(r.skipped)} couldn’t be reached` : ''}`
        : `WhatsApp reminder sent to ${num(r.sent)} ${r.sent === 1 ? 'customer' : 'customers'}`);
      setSelected(new Set()); setConfirm(null); reload();
    }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(false); }
  };
  const lock = async (ids) => {
    if (!live && !reason.trim()) { toast('Add a reason for the audit log', 'bad'); return; }
    setBusy(true);
    try {
      const r = await emiApi.lockMany(ids, reason.trim());
      toast(live ? `${num(r.locked)} ${r.locked === 1 ? 'device' : 'devices'} locked. Each locks the next time it checks in.` : `${num(r.locked)} locked${r.queued ? ` · ${num(r.queued)} will lock when back online` : ''}`);
      setSelected(new Set()); setConfirm(null); setReason(''); reload();
    } catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(false); }
  };

  const exportCsv = async () => {
    const all = [];
    for (let page = 1, pages = 1; page <= pages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await emiApi.overdue({ ...f, page });
      all.push(...res.items); pages = res.pages;
    }
    downloadCsv('overdue-emis.csv', [
      { key: 'name', header: 'Customer' }, { key: 'phone', header: 'Mobile' }, { key: 'device', header: 'Device' }, { key: 'retailer', header: 'Retailer' },
      { key: 'due', header: 'Oldest due' }, { key: 'amount', header: 'Amount due (₹)' }, { key: 'daysLate', header: 'Days late' }, { key: 'reminders', header: 'Reminders sent' },
    ], all);
    toast(`Exported ${all.length} customers`);
  };

  const columns = [
    ...(canRemind || canLock ? [{ key: 'sel', header: <input type="checkbox" className="row-check" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} />, width: '28px', render: (r) => (
      <input type="checkbox" className="row-check" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
    ) }] : []),
    { key: 'name', header: 'Customer', width: '1.6fr', render: (r) => <div className="cell-stack"><span className="fw-600">{r.name}</span><span className="cell-sub">{r.phone}</span></div> },
    { key: 'device', header: 'Device', width: '1fr' },
    { key: 'retailer', header: 'Retailer', width: '1.1fr', render: (r) => <span className="ink-2">{r.retailer}</span> },
    { key: 'due', header: 'Due date', width: '0.7fr', render: (r) => <span className="ink-2">{r.due}</span> },
    { key: 'amount', header: 'Amount', width: '0.8fr', align: 'right', render: (r) => (
      <div className="cell-stack" style={{ alignItems: 'flex-end' }}>
        <span className="fw-600">{inr(r.amount)}</span>
        {r.lateFee > 0 && <span className="cell-sub">incl. {inr(r.lateFee)} late fee</span>}
      </div>
    ) },
    { key: 'late', header: 'Late by', width: '0.7fr', render: (r) => <span className="text-bad" style={{ fontWeight: 500 }}>{r.daysLate} days</span> },
    ...(live ? [{ key: 'inst', header: 'Missed', width: '0.6fr', render: (r) => <span className="ink-2">{r.installments}</span> }]
      : [{ key: 'rem', header: 'Reminders', width: '0.7fr', render: (r) => <span className="ink-2">{r.reminders} sent</span> }]),
    { key: 'dev', header: 'Device', width: '0.8fr', render: (r) => { const [t, l] = DEVICE[r.deviceStatus] ?? ['mute', '—']; return <Badge tone={t}>{l}</Badge>; } },
    { key: 'act', header: '', width: '150px', render: (r) => (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        {canRemind && <Button variant="secondary" size="sm" onClick={() => remind([r.id])}>Remind</Button>}
        {live && canLock && r.deviceStatus !== 'locked' && (
          <Button variant="secondary" size="sm" style={{ color: 'var(--bad)' }} onClick={() => setConfirm({ kind: 'lock', ids: [r.id] })}>Lock</Button>
        )}
        {!live && canLock && r.deviceStatus !== 'locked' && r.deviceId && (
          <Button variant="secondary" size="sm" style={{ color: 'var(--bad)' }} onClick={() => navigate(r.deviceType === 'tv' ? `/tvs/${r.deviceId}` : `/devices/${r.deviceId}/lock`)}>Lock</Button>
        )}
      </div>
    ) },
  ];

  const ids = [...selected];
  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Overdue EMIs"
        subtitle={`${num(data.totals.customers)} customers · ${inrShort(data.totals.amount)} outstanding`}
        actions={<>
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv}>Export</Button>}
          {canRemind && data.totals.customers > 0 && <Button icon="chat" onClick={() => setConfirm({ kind: 'remind-all', ids: data.allIds })}>Remind all {num(data.allIds.length)}</Button>}
        </>}
      />

      <div className="age-grid" role="group" aria-label="How late">
        {BUCKETS.map(([key, label]) => {
          const b = data.buckets.find((x) => x.key === key);
          return (
            <button key={key} type="button" className="age" aria-pressed={f.bucket === key} onClick={() => setF({ bucket: f.bucket === key ? 'all' : key })}>
              <span className="sub">{label}</span>
              <b style={{ color: key === '30+' && b.count ? 'var(--bad)' : undefined }}>{num(b.count)}</b>
              <small>{inrShort(b.amount)}</small>
            </button>
          );
        })}
      </div>

      <FilterBar>
        <SearchInput placeholder="Name, phone or device" label="Search overdue customers" value={f.q} onChange={(q) => setF({ q })} />
        {f.bucket !== 'all' && <Button variant="text" size="sm" onClick={() => setF({ bucket: 'all' })}>Show all</Button>}
      </FilterBar>

      <Card flush aria-busy={loading}>
        {selected.size > 0 && (
          <div className="bulk-bar" role="region" aria-label="Bulk actions">
            <strong>{selected.size} selected</strong>
            {canRemind && <Button size="sm" className="btn-ghost-light" icon="chat" disabled={busy} onClick={() => remind(ids)}>{'Send reminder'}</Button>}
            {canLock && <Button size="sm" variant="danger" onClick={() => setConfirm({ kind: 'lock', ids })}>Lock devices</Button>}
          </div>
        )}
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <Table columns={columns} rows={data.items} onRowClick={(r) => navigate(`/customers/${r.id}`)} minWidth={1100}
            empty={f.q || f.bucket !== 'all' ? 'No overdue customers match.' : 'No overdue EMIs. Everyone is paid up.'} />
        </div>
        <Pagination {...data} onPage={(page) => setF({ page })} />
      </Card>

      <Dialog open={confirm?.kind === 'remind-all'} onClose={() => setConfirm(null)} title={`Send a reminder to ${num(confirm?.ids.length ?? 0)} customers?`}
        subtitle={live ? 'Each customer gets the overdue WhatsApp message with their amount, and their device shows it too.' : 'Each customer gets the overdue WhatsApp message with their amount and a payment link.'}
        actions={<>
          <Button variant="secondary" data-close onClick={() => setConfirm(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => remind(confirm.ids)}>{busy ? 'Sending…' : 'Send reminders'}</Button>
        </>} />
      <Dialog open={confirm?.kind === 'lock'} onClose={() => setConfirm(null)} icon="lock" role="alertdialog" title={`Lock ${num(confirm?.ids.length ?? 0)} devices?`}
        subtitle="Each device shows the payment screen until its payment is recorded. Offline devices lock as soon as they reconnect."
        actions={<>
          <Button variant="secondary" data-close onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={() => lock(confirm.ids)}>{busy ? 'Locking…' : 'Lock devices'}</Button>
        </>}>
        <Field label={<>Reason <span className="optional">(saved in the audit log)</span></>} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="EMI overdue, reminders ignored" data-autofocus />
      </Dialog>
    </div>
  );
}