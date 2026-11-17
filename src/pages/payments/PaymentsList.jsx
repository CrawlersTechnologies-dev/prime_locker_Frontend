import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { paymentsApi } from '../../services/paymentsApi';
import { paymentsLive } from '../../services/paymentsLive';
import { P } from '../../config/permissions';
import { LEVELS } from '../../config/roles';
import { inr, inrShort, num, downloadCsv } from '../../utils/format';
import {
  Badge, Button, Card, ErrorBlock, FilterBar, FilterChips, Kpi, LoadingBlock, PageHeader, Pagination, SearchInput, Table, useToast,
} from '../../components/ui';
import RecordPaymentDrawer from './RecordPaymentDrawer';

const STATUS = { paid: ['ok', 'Paid'], failed: ['bad', 'Failed'], pending: ['warn', 'Pending'] };

/**
 * A-23 · Payments. /payments/new opens the Record payment sheet (A-24) on top.
 * Partners see this as "EMI collections" — their network only, read-only.
 */
export default function PaymentsList({ initialRecord = false }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [f, setF] = useQueryState({ filter: 'all', q: '', page: 1 });
  const { data, loading, error, reload } = useApi(() => paymentsApi.list(f), [f.filter, f.q, f.page]);
  const [recording, setRecording] = useState(initialRecord ? { customerId: params.get('customer') ?? undefined } : null);
  const isPartner = user.level !== LEVELS.COMPANY;

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  const k = data.kpis;
  const pct = (n) => (k.collected ? Math.round((n / k.collected) * 100) : 0);
  const closeRecord = () => { setRecording(null); if (initialRecord) navigate('/payments', { replace: true }); };

  const exportCsv = async () => {
    if (data.live) {
      try { await paymentsLive.exportCsv(f); toast('Payments downloaded'); } catch (err) { toast(err.message, 'bad'); }
      return;
    }
    const all = [];
    for (let page = 1, pages = 1; page <= pages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await paymentsApi.list({ ...f, page });
      all.push(...res.items); pages = res.pages;
    }
    downloadCsv('payments.csv', [
      { key: 'id', header: 'Receipt' }, { key: 'customer', header: 'Customer' }, { key: 'installment', header: 'Installment' },
      { key: 'amount', header: 'Amount (₹)' }, { key: 'mode', header: 'Mode' }, { key: 'at', header: 'Date' }, { key: 'by', header: 'Recorded by' }, { key: 'status', header: 'Status' },
    ], all);
    toast(`Exported ${all.length} payments`);
  };

  const columns = [
    { key: 'id', header: 'Receipt', width: '0.9fr', render: (r) => (isPartner ? <span className="mono" style={{ fontSize: 13 }}>{r.id}</span>
      : <Link to={`/payments/${r.id}`} className="mono" style={{ fontSize: 13, fontWeight: 500 }} onClick={(e) => e.stopPropagation()}>{r.id}</Link>) },
    { key: 'customer', header: 'Customer', width: '1.4fr', render: (r) => <span className="fw-600">{r.customer}</span> },
    { key: 'installment', header: 'Installment', width: '1fr', render: (r) => <span className="ink-2">{r.installment}</span> },
    { key: 'amount', header: 'Amount', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600">{inr(r.amount)}</span> },
    { key: 'mode', header: 'Mode', width: '1fr', render: (r) => <span className="ink-2">{r.mode}</span> },
    { key: 'at', header: 'Date', width: '1fr', render: (r) => <span className="ink-2">{r.at}</span> },
    { key: 'by', header: 'Recorded by', width: '1.2fr', render: (r) => <span className="ink-2">{r.by}</span> },
    { key: 'status', header: 'Status', width: '0.8fr', render: (r) => { const [t, l] = STATUS[r.status]; return <Badge tone={t}>{l}</Badge>; } },
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title={isPartner ? 'EMI collections' : 'Payments'}
        subtitle={`${k.month} · ${isPartner ? 'your network' : 'all retailers'}`}
        actions={<>
          <Button variant="secondary" to={isPartner ? '/reports' : '/emi/overdue'}>{isPartner ? 'Reports' : 'Overdue EMIs'}</Button>
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv}>Export</Button>}
          {can(P.PAYMENTS_RECORD) && <Button icon="plus" onClick={() => setRecording({})}>Record payment</Button>}
        </>}
      />

      <div className="grid-4">
        <Kpi label="Collected" value={inrShort(k.collected)} foot={`${num(k.count)} payments`} />
        <Kpi label="Online (gateway)" value={inrShort(k.online)} foot={`${pct(k.online)}% of collections`} />
        <Kpi label="Cash or UPI at store" value={inrShort(k.store)} foot={`${pct(k.store)}% · recorded by retailers`} />
        <Kpi label="Failed or pending" value={<span style={{ color: k.issuesCount ? 'var(--bad)' : undefined }}>{inr(k.issues)}</span>} foot={`${num(k.issuesCount)} payments to check`} />
      </div>

      <FilterBar>
        <SearchInput placeholder="Receipt or customer" label="Search payments" value={f.q} onChange={(q) => setF({ q })} />
        <FilterChips label="Payment type" value={f.filter} onChange={(filter) => setF({ filter })} options={[
          { value: 'all', label: 'All' },
          { value: 'online', label: 'Online' },
          { value: 'store', label: 'At store' },
          { value: 'issues', label: 'Failed or pending', count: k.issuesCount },
        ]} />
      </FilterBar>

      <Card flush aria-busy={loading}>
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <Table columns={columns} rows={data.items} onRowClick={isPartner ? undefined : (r) => navigate(`/payments/${r.id}`)} minWidth={980}
            empty="No payments match. Clear the search or pick another filter." />
        </div>
        <Pagination {...data} onPage={(page) => setF({ page })} />
      </Card>

      {recording && <RecordPaymentDrawer customerId={recording.customerId} onClose={closeRecord} onSaved={() => setRecording(null)} />}
    </div>
  );
}

export const RecordPaymentRoute = () => <PaymentsList initialRecord />;