import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { reportsApi, REPORTS, REPORTS_LIVE } from '../../services/Reportsapi';
import { P } from '../../config/permissions';
import { inr, inrShort, num } from '../../utils/format';
import {
  Badge, Button, Card, ErrorBlock, Field, FilterBar, FilterChips, Kpi, PageHeader, SearchInput, StateMessage, Table, Tabs, TabPanel, useToast,
} from '../../components/ui';
import './insights.css';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const KYC_TONE = { COMPLETE: ['ok', 'Complete'], PARTIAL: ['warn', 'Partial'], MISSING: ['bad', 'Missing'] };
const LOCK_TONE = { LOCKED: 'bad', ACTIVE: 'ok', COMPLETED: 'mute', DRAFT: 'mute', DEFAULTED: 'bad' };

/** A-32 Reports (and A-33 Retailer performance, which opens on that tab). */
export default function Reports() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useQueryState({ tab: pathname.endsWith('/retailer-performance') ? 'retailers' : 'collections', from: monthStart(), to: iso(new Date()), status: '', q: '' });
  const tab = REPORTS.some((r) => r.key === q.tab) ? q.tab : 'collections';
  const filters = { from: q.from, to: q.to, status: q.status };
  const { data, loading, error, reload } = useApi(
    () => (REPORTS_LIVE ? reportsApi.get(tab, filters) : Promise.resolve(null)),
    [tab, q.from, q.to, q.status],
  );
  const [exporting, setExporting] = useState(false);

  if (!REPORTS_LIVE) {
    return (
      <div className="page">
        <PageHeader title="Reports" />
        <Card><StateMessage icon="chart" title="Reports read live data">Add <span className="mono">reports</span> to VITE_LIVE_MODULES to open them.</StateMessage></Card>
      </div>
    );
  }

  const exportCsv = async () => {
    setExporting(true);
    try { await reportsApi.exportCsv(tab, filters); toast('Spreadsheet downloaded'); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setExporting(false); }
  };
  const search = (rows, ...keys) => rows.filter((r) => !q.q || keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q.q.toLowerCase())));

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Reports"
        subtitle="Live figures for your whole network. Export opens the same data in Excel."
        actions={can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" disabled={exporting} onClick={exportCsv}>{exporting ? 'Preparing…' : 'Export to Excel'}</Button>}
      />
      <Tabs label="Report" idPrefix="rep" tabs={REPORTS.map((r) => ({ value: r.key, label: r.title }))} value={tab} onChange={(t) => setQ({ tab: t, q: '', status: '' })} />

      <FilterBar>
        <SearchInput placeholder="Search this report" label="Search this report" value={q.q} onChange={(v) => setQ({ q: v })} />
        {tab === 'collections' && (
          <div className="date-range">
            <Field label="From" type="date" value={q.from} max={q.to} onChange={(e) => setQ({ from: e.target.value })} />
            <Field label="To" type="date" value={q.to} min={q.from} onChange={(e) => setQ({ to: e.target.value })} />
          </div>
        )}
        {tab === 'kyc' && (
          <FilterChips label="KYC status" value={q.status} onChange={(status) => setQ({ status })} options={[
            { value: '', label: 'All' }, { value: 'COMPLETE', label: 'Complete' }, { value: 'PARTIAL', label: 'Partial' }, { value: 'MISSING', label: 'Missing' },
          ]} />
        )}
      </FilterBar>

      <TabPanel idPrefix="rep" value={tab}>
        {error ? <Card><ErrorBlock error={error} onRetry={reload} /></Card>
          : !data ? <Card><div className="table-empty">Loading report…</div></Card>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.6 : 1 }}>
              {tab === 'collections' && <Collections d={data} rows={search(data.rows, 'store')} onOpen={(r) => navigate(`/retailers/${r.id}`)} />}
              {tab === 'overdue' && <Overdue d={data} rows={search(data.rows, 'customer', 'phone', 'store', 'imei', 'device')} />}
              {tab === 'retailers' && <Retailers d={data} rows={search(data.rows, 'store', 'owner', 'place', 'phone')} onOpen={(r) => navigate(`/retailers/${r.id}`)} />}
              {tab === 'modes' && <Modes d={data} />}
              {tab === 'locks' && <Locks d={data} rows={search(data.rows, 'customer', 'phone', 'store', 'imei', 'device')} />}
              {tab === 'kyc' && <Kyc d={data} rows={search(data.rows, 'customer', 'phone', 'store')} />}
            </div>
          )}
      </TabPanel>
    </div>
  );
}

const pct = (n) => `${Math.round(n * 10) / 10}%`;

function Collections({ d, rows, onOpen }) {
  const columns = [
    { key: 'store', header: 'Retailer', width: '2fr', render: (r) => <span className="fw-600">{r.store}</span> },
    { key: 'due', header: 'Due', width: '1fr', align: 'right', render: (r) => inr(r.due) },
    { key: 'collected', header: 'Collected', width: '1fr', align: 'right', render: (r) => <span className="fw-600">{inr(r.collected)}</span> },
    { key: 'pending', header: 'Pending', width: '1fr', align: 'right', render: (r) => <span style={{ color: r.pending > 0 ? 'var(--bad)' : undefined }}>{inr(r.pending)}</span> },
    { key: 'rate', header: 'Collected %', width: '0.8fr', align: 'right', render: (r) => pct(r.rate) },
  ];
  return <>
    <div className="grid-4">
      <Kpi label="Due in this period" value={inrShort(d.kpis.due)} foot="installments falling due" />
      <Kpi label="Collected" value={<span style={{ color: 'var(--ok)' }}>{inrShort(d.kpis.collected)}</span>} foot={`${pct(d.kpis.rate)} of what’s due`} />
      <Kpi label="Still pending" value={<span style={{ color: d.kpis.pending ? 'var(--bad)' : undefined }}>{inrShort(d.kpis.pending)}</span>} foot="due but not paid" />
      <Kpi label="By mode" value={d.modes.length ? d.modes[0].mode : '—'} foot={d.modes.map((m) => `${m.mode} ${inrShort(m.amount)}`).join(' · ') || 'no payments yet'} />
    </div>
    <Card flush><Table columns={columns} rows={rows} onRowClick={onOpen} minWidth={720} empty="No installments fall due in these dates." /></Card>
  </>;
}

function Overdue({ d, rows }) {
  const columns = [
    { key: 'customer', header: 'Customer', width: '1.6fr', render: (r) => <div className="cell-stack"><span className="fw-600">{r.customer}</span><span className="cell-sub">{r.phone}</span></div> },
    { key: 'device', header: 'Device', width: '1.4fr', render: (r) => <div className="cell-stack"><span>{r.device}</span><span className="cell-sub mono">{r.imei}</span></div> },
    { key: 'store', header: 'Retailer', width: '1.2fr', render: (r) => <span className="ink-2">{r.store}</span> },
    { key: 'due', header: 'Due date', width: '0.9fr', render: (r) => <span className="ink-2">{r.due}</span> },
    { key: 'amount', header: 'Amount', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600">{inr(r.amount)}</span> },
    { key: 'days', header: 'Late by', width: '0.7fr', render: (r) => <span className="text-bad">{r.days} days</span> },
    { key: 'status', header: 'EMI', width: '0.7fr', render: (r) => <Badge tone={r.status === 'Locked' ? 'bad' : 'mute'}>{r.status}</Badge> },
  ];
  return <>
    <div className="grid-4">
      {d.kpis.buckets.map((b) => <Kpi key={b.label} label={`${b.label} late`} value={num(b.count)} foot={inrShort(b.amount)} />)}
    </div>
    <Card flush><Table columns={columns} rows={rows} minWidth={1000} empty="Nothing overdue. Everyone is paid up." /></Card>
  </>;
}

function Retailers({ d, rows, onOpen }) {
  const columns = [
    { key: 'store', header: 'Retailer', width: '1.8fr', render: (r) => <div className="cell-stack"><span className="fw-600">{r.store}</span><span className="cell-sub">{[r.owner, r.place].filter(Boolean).join(' · ')}</span></div> },
    { key: 'devices', header: 'Devices sold', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600">{num(r.devices)}</span> },
    { key: 'financed', header: 'Financed', width: '1fr', align: 'right', render: (r) => inr(r.financed) },
    { key: 'collected', header: 'Collected', width: '1fr', align: 'right', render: (r) => inr(r.collected) },
    { key: 'rate', header: 'Collected %', width: '0.8fr', align: 'right', render: (r) => (r.financed ? pct(r.rate) : '—') },
    { key: 'overdue', header: 'Overdue', width: '0.7fr', align: 'right', render: (r) => <span style={{ color: r.overdue ? 'var(--bad)' : undefined }}>{num(r.overdue)}</span> },
  ];
  const sold = rows.reduce((n, r) => n + r.devices, 0);
  return <>
    <div className="grid-4">
      <Kpi label="Stores" value={num(d.kpis.stores)} foot="in your network" />
      <Kpi label="Devices sold" value={num(sold)} foot="all time" />
      <Kpi label="Collected" value={inrShort(rows.reduce((n, r) => n + r.collected, 0))} foot="all time" />
      <Kpi label="Stores with overdue" value={num(rows.filter((r) => r.overdue > 0).length)} foot="at least one late installment" />
    </div>
    <Card flush><Table columns={columns} rows={rows} onRowClick={onOpen} minWidth={860} empty="No retailers yet." /></Card>
  </>;
}

function Modes({ d }) {
  const columns = [
    { key: 'mode', header: 'Mode', width: '1.4fr', render: (r) => <span className="fw-600">{r.mode}</span> },
    { key: 'count', header: 'Payments', width: '1fr', align: 'right', render: (r) => num(r.count) },
    { key: 'amount', header: 'Amount', width: '1fr', align: 'right', render: (r) => <span className="fw-600">{inr(r.amount)}</span> },
    { key: 'share', header: 'Share', width: '1.6fr', render: (r) => (
      <div className="share-bar"><div style={{ width: `${Math.min(100, r.share)}%` }} /><span>{pct(r.share)}</span></div>
    ) },
  ];
  return <>
    <div className="grid-4">
      <Kpi label="Collected, all modes" value={inrShort(d.kpis.total)} foot="all time" />
      {d.rows.slice(0, 3).map((r) => <Kpi key={r.id} label={r.mode} value={inrShort(r.amount)} foot={`${num(r.count)} payments · ${pct(r.share)}`} />)}
    </div>
    <Card flush><Table columns={columns} rows={d.rows} minWidth={640} empty="No payments recorded yet." /></Card>
  </>;
}

function Locks({ d, rows }) {
  const columns = [
    { key: 'device', header: 'Device', width: '1.5fr', render: (r) => <div className="cell-stack"><span className="fw-600">{r.device}</span><span className="cell-sub mono">{r.imei}</span></div> },
    { key: 'customer', header: 'Customer', width: '1.4fr', render: (r) => <div className="cell-stack"><span>{r.customer}</span><span className="cell-sub">{r.phone}</span></div> },
    { key: 'store', header: 'Retailer', width: '1.2fr', render: (r) => <span className="ink-2">{r.store}</span> },
    { key: 'status', header: 'Status', width: '0.8fr', render: (r) => <Badge tone={LOCK_TONE[r.status] ?? 'mute'}>{r.statusLabel}</Badge> },
    { key: 'auto', header: 'Auto-lock', width: '0.9fr', render: (r) => <span className="ink-2">{r.autoLock ? `After ${r.grace} ${r.grace === 1 ? 'day' : 'days'}` : 'Off'}</span> },
    { key: 'updated', header: 'Last change', width: '1fr', render: (r) => <span className="ink-2">{r.updated}</span> },
  ];
  return <>
    <div className="grid-4">
      <Kpi label="Devices on EMI" value={num(d.kpis.total)} foot="all contracts" />
      <Kpi label="Locked now" value={<span style={{ color: d.kpis.locked ? 'var(--bad)' : undefined }}>{num(d.kpis.locked)}</span>} foot="showing the payment screen" />
      <Kpi label="Active" value={num(d.kpis.active)} foot="unlocked, EMI running" />
      <Kpi label="Paid off" value={num(Math.max(0, d.kpis.total - d.kpis.locked - d.kpis.active))} foot="completed or other" />
    </div>
    <Card flush><Table columns={columns} rows={rows} minWidth={980} empty="No devices on EMI yet." /></Card>
  </>;
}

function Kyc({ d, rows }) {
  const yes = (v) => (v ? <span style={{ color: 'var(--ok)' }}>Yes</span> : <span className="text-bad">No</span>);
  const columns = [
    { key: 'customer', header: 'Customer', width: '1.6fr', render: (r) => <div className="cell-stack"><span className="fw-600">{r.customer}</span><span className="cell-sub">{r.phone}</span></div> },
    { key: 'store', header: 'Retailer', width: '1.3fr', render: (r) => <span className="ink-2">{r.store}</span> },
    { key: 'photo', header: 'Photo', width: '0.6fr', render: (r) => yes(r.photo) },
    { key: 'signature', header: 'Signature', width: '0.7fr', render: (r) => yes(r.signature) },
    { key: 'alt', header: 'Alternate mobile', width: '1fr', render: (r) => <span className={r.alt === 'Missing' ? 'text-bad' : 'ink-2'}>{r.alt}</span> },
    { key: 'status', header: 'KYC', width: '0.8fr', render: (r) => { const [t, l] = KYC_TONE[r.status] ?? ['mute', r.status]; return <Badge tone={t}>{l}</Badge>; } },
    { key: 'joined', header: 'Added', width: '0.9fr', render: (r) => <span className="ink-2">{r.joined}</span> },
  ];
  return <>
    <div className="grid-4">
      <Kpi label="Customers" value={num(d.kpis.total)} foot="added by retailers" />
      <Kpi label="KYC complete" value={<span style={{ color: 'var(--ok)' }}>{num(d.kpis.complete)}</span>} foot="photo, signature, alternate mobile" />
      <Kpi label="Missing or partial" value={<span style={{ color: d.kpis.missing ? 'var(--bad)' : undefined }}>{num(d.kpis.missing)}</span>} foot="follow up with the store" />
      <Kpi label="Complete rate" value={d.kpis.total ? pct((d.kpis.complete / d.kpis.total) * 100) : '—'} foot="of all customers" />
    </div>
    <Card flush><Table columns={columns} rows={rows} minWidth={980} empty="No customers match." /></Card>
  </>;
}
