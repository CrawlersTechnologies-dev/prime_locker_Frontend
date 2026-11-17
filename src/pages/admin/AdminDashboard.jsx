import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { dashboardApi } from '../../services/dashboardApi';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import {
  Badge, Button, Card, CardHeader, Icon, Kpi, PageHeader, Segmented, Table, LoadingBlock, ErrorBlock,
} from '../../components/ui';
import './dashboard.css';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: 'This month' },
];

/** A-02 · Dashboard (Prime Locker staff) */
export default function AdminDashboard() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState('month');
  const { data, loading, error, reload } = useApi(() => dashboardApi.admin(range), [range]);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const { kpis, collections, deviceStatus: ds, overdue } = data;

  const overdueColumns = [
    { key: 'customer', header: 'Customer', width: '1.7fr', render: (r) => (
      <div className="cell-stack">
        <span className="fw-600">{r.customer}</span>
        {can(P.CUSTOMER_PHONE_VIEW) && <span className="cell-sub">{r.phone}</span>}
      </div>
    ) },
    { key: 'device', header: 'Device', width: '1.5fr', render: (r) => (
      <div className="cell-stack"><span>{r.device}</span><span className="cell-sub mono">{r.deviceRef}</span></div>
    ) },
    { key: 'retailer', header: 'Retailer', width: '1.5fr', render: (r) => <span className="ink-2">{r.retailer}</span> },
    { key: 'due', header: 'Due date', width: '0.8fr', render: (r) => <span className="ink-2">{r.due}</span> },
    { key: 'amount', header: 'Amount', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600">{r.amount}</span> },
    { key: 'late', header: 'Overdue', width: '0.9fr', render: (r) => <span className="text-bad" style={{ fontWeight: 500 }}>{r.daysLate} days</span> },
    { key: 'status', header: 'Device', width: '0.9fr', render: (r) => <Badge status={r.status} /> },
    ...(can(P.WHATSAPP_SEND) ? [{ key: 'act', header: '', width: '88px', render: (r) => (
      <Button
        variant="secondary"
        size="sm"
        block
        onClick={(e) => { e.stopPropagation(); /* TODO(api): POST /reminders { customerId } */ }}
        aria-label={`Send reminder to ${r.customer}`}
      >
        Remind
      </Button>
    ) }] : []),
  ];

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={`${data.dateLabel} · All retailers`}
        actions={<>
          <Segmented label="Date range" options={RANGES} value={range} onChange={setRange} />
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download">Export</Button>}
          {can(P.DEVICES_REGISTER) && <Button icon="plus" to="/devices/register">Register device</Button>}
        </>}
      />

      <div className="grid-4">
        <Kpi label="Active devices" icon="phone" value={num(kpis.activeDevices.value)} foot={kpis.activeDevices.delta} footTone="ok" />
        <Kpi label="Customers on EMI" icon="user" value={num(kpis.customersOnEmi.value)} foot={`across ${kpis.customersOnEmi.retailers} retailers`} />
        <Kpi
          label={kpis.collected.label ?? `Collected in ${kpis.collected.month}`}
          icon="card"
          value={kpis.collected.amount}
          progress={kpis.collected.percentOfDue ?? undefined}
          foot={kpis.collected.percentOfDue != null ? `${kpis.collected.percentOfDue}% of due` : `Today ${kpis.collected.today ?? '—'}`}
        />
        <Kpi label="Overdue EMIs" icon="clock" iconTone="bad" value={num(kpis.overdue.count)} foot={`${kpis.overdue.outstanding} outstanding`} footTone="bad" />
      </div>

      <div className="split-2-1">
        <Card pad>
          <div className="dash-chart-head">
            <div className="card-title">
              <h2 className="h2">EMI collections</h2>
              <span className="sub">Last 6 months · amount collected vs amount due</span>
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--navy)' }} />Collected</span>
              <span><i style={{ background: 'var(--navy-soft)' }} />Due</span>
            </div>
          </div>
          <CollectionsChart data={collections} />
        </Card>

        <Card pad>
          <div className="card-title" style={{ marginBottom: 18 }}>
            <h2 className="h2">Device status</h2>
            <span className="sub">{num(ds.total)} enrolled devices{data.live ? '' : ' · live'}</span>
          </div>
          {ds.items ? (
            <>
              <div className="status-bar" aria-hidden="true">
                {ds.items.map((it) => <div key={it.key} style={{ flexGrow: it.value, background: it.color }} />)}
              </div>
              <ul className="status-list">
                {ds.items.map((it) => (
                  <li key={it.key}><Badge status={it.badge}>{it.label}</Badge><b>{num(it.value)}</b></li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="status-bar" aria-hidden="true">
                <div style={{ flexGrow: ds.online, background: 'var(--ok)' }} />
                <div style={{ flexGrow: ds.offline, background: 'var(--offline)' }} />
                <div style={{ flexGrow: ds.locked, background: 'var(--bad)' }} />
                <div style={{ flexGrow: ds.alert, background: 'var(--alert)' }} />
              </div>
              <ul className="status-list">
                <li><Badge status="online" /><b>{num(ds.online)}</b></li>
                <li><Badge status="offline" /><b>{num(ds.offline)}</b></li>
                <li><Badge status="locked" /><b>{num(ds.locked)}</b></li>
                <li><Badge tone="warn">Alert · SIM change or tamper</Badge><b>{num(ds.alert)}</b></li>
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card flush>
        <CardHeader
          title="Overdue EMIs"
          subtitle={`Oldest first · ${kpis.overdue.count} customers`}
          action={<Link to="/emi/overdue" className="link-arrow">View all<Icon name="chevronRight" size={16} /></Link>}
        />
        <Table
          columns={overdueColumns}
          rows={overdue}
          empty="No overdue EMIs. Every customer is paid up."
          onRowClick={(r) => navigate(data.live ? '/emi/overdue' : `/customers/${r.id}`)}
        />
      </Card>
    </div>
  );
}

/** Grouped bars, collected vs due, in lakh. Axis matches the design: ₹0 / ₹10L / ₹20L. */
function CollectionsChart({ data }) {
  const H = 200;
  // Top of the plot: a round number above the biggest bar (₹24L in the design's mock data).
  const peak = Math.max(0, ...data.flatMap((d) => [d.collected, d.due]));
  const steps = [0.2, 0.5, 1, 2, 5, 10, 20, 24, 50, 100, 200, 500, 1000];
  const max = steps.find((s) => s >= peak) ?? Math.ceil(peak);
  const ticks = [0, max / 2, max];
  const label = (t) => (t ? `₹${Number.isInteger(t) ? t : t.toFixed(1)}L` : '₹0');
  const y = (v) => Math.round((v / max) * H);
  const last = data.length - 1;
  return (
    <div className="bars">
      <div className="bars-axis" style={{ height: H }}>
        {ticks.map((t) => <span key={t} style={{ bottom: y(t) - 7 }}>{label(t)}</span>)}
      </div>
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="bars-plot" style={{ height: H }} role="img"
          aria-label={data.map((d) => `${d.month}: ₹${d.collected}L collected of ₹${d.due}L due`).join('; ')}>
          {ticks.slice(1).map((t) => <div key={t} className="bars-grid" style={{ bottom: y(t) }} />)}
          {data.map((d) => (
            <div key={d.month} className="bars-group">
              <div style={{ height: y(d.collected), background: 'var(--navy)' }} />
              <div style={{ height: y(d.due), background: 'var(--navy-soft)' }} />
            </div>
          ))}
        </div>
        <div className="bars-labels">
          {data.map((d, i) => <span key={d.month} className={i === last ? 'is-current' : undefined}>{d.month}</span>)}
        </div>
      </div>
    </div>
  );
}
