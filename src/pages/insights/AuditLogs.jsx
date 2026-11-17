import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { reportsApi, AUDIT_LIVE } from '../../services/Reportsapi';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import {
  Badge, Button, Card, ErrorBlock, Field, FilterBar, PageHeader, Pagination, SearchInput, SelectFilter, StateMessage, Table, useToast,
} from '../../components/ui';
import './insights.css';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super admin' },
  { value: 'SUPER_DISTRIBUTOR', label: 'Super distributor' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'SUB_DISTRIBUTOR', label: 'Sub distributor' },
  { value: 'RETAILER', label: 'Retailer' },
  { value: 'CUSTOMER', label: 'Customer' },
];
const ACTIONS = [
  { value: 'LOG', label: 'Sign-ins & sign-outs' },
  { value: 'PASSWORD', label: 'Password changes' },
  { value: 'KEY', label: 'Keys & key requests' },
  { value: 'PAYMENT', label: 'Payments' },
  { value: 'CREATED', label: 'Created' },
  { value: 'UPDATED', label: 'Updated' },
  { value: 'DELETED', label: 'Deleted' },
  { value: 'LOCK', label: 'Locks & unlocks' },
  { value: 'ENROLLED', label: 'Enrolments' },
  { value: 'EMI', label: 'EMI plans' },
  { value: 'OFFER', label: 'Offers' },
  { value: 'DEVICE', label: 'Device controls' },
];
const tone = (a = '') => {
  if (/UNLOCK|CREATED|ENROLLED|PAYMENT|ATTACHED|REGISTERED|APPROVED|GENERATED|ALLOCATED/.test(a)) return 'ok';
  if (/DELETED|LOCK|REJECTED|RECLAIMED/.test(a)) return 'bad';
  if (/LOGIN|LOGOUT|PASSWORD/.test(a)) return 'info';
  return 'mute';
};

/** A-37 · Audit logs — who did what, when, from where. */
export default function AuditLogs() {
  const { can } = useAuth();
  const toast = useToast();
  const [f, setF] = useQueryState({ q: '', role: '', action: '', from: '', to: '', page: 1 });
  const { data, loading, error, reload } = useApi(
    () => (AUDIT_LIVE ? reportsApi.audit(f) : Promise.resolve(null)),
    [f.q, f.role, f.action, f.from, f.to, f.page],
  );
  const [exporting, setExporting] = useState(false);

  if (!AUDIT_LIVE) {
    return (
      <div className="page">
        <PageHeader title="Audit logs" />
        <Card><StateMessage icon="file" title="Audit logs read live data">Add <span className="mono">audit</span> to VITE_LIVE_MODULES to open them.</StateMessage></Card>
      </div>
    );
  }

  const exportCsv = async () => {
    setExporting(true);
    try { await reportsApi.auditCsv(f); toast('Spreadsheet downloaded (latest 5,000 entries)'); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setExporting(false); }
  };

  const columns = [
    { key: 'at', header: 'When', width: '1.1fr', render: (l) => <span className="ink-2">{l.at}</span> },
    { key: 'who', header: 'Who', width: '1.5fr', render: (l) => <div className="cell-stack"><span className="fw-600">{l.who}</span>{l.whoSub && <span className="cell-sub">{l.whoSub}</span>}</div> },
    { key: 'action', header: 'Action', width: '1.4fr', render: (l) => <Badge tone={tone(l.action)}>{l.actionLabel}</Badge> },
    { key: 'details', header: 'Details', width: '2.6fr', render: (l) => <span className="ink-2 small audit-details" title={l.details}>{l.details || '—'}</span> },
    { key: 'ip', header: 'IP address', width: '0.9fr', render: (l) => <span className="mono small muted">{l.ip || '—'}</span> },
  ];
  const filtered = f.q || f.role || f.action || f.from || f.to;

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Audit logs"
        subtitle={data ? `${num(data.total)} ${filtered ? 'matching entries' : 'entries'} · sign-ins, changes, keys, locks and payments` : ' '}
        actions={can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" disabled={exporting || !data} onClick={exportCsv}>{exporting ? 'Preparing…' : 'Export'}</Button>}
      />
      <FilterBar>
        <SearchInput placeholder="Person, business, action or IP" label="Search audit logs" value={f.q} onChange={(q) => setF({ q })} />
        <SelectFilter label="Action" value={f.action} onChange={(action) => setF({ action })} options={ACTIONS} />
        <SelectFilter label="Role" value={f.role} onChange={(role) => setF({ role })} options={ROLES} />
        <div className="date-range">
          <Field label="From" type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ from: e.target.value })} />
          <Field label="To" type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ to: e.target.value })} />
        </div>
        {filtered && <Button variant="text" size="sm" onClick={() => setF({ q: '', role: '', action: '', from: '', to: '' })}>Clear</Button>}
      </FilterBar>
      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading audit logs…</div>
          : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table columns={columns} rows={data.items} minWidth={1000} empty={filtered ? 'No entries match these filters.' : 'Nothing logged yet.'} />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} noun="entries" />
            </>
          )}
      </Card>
    </div>
  );
}
