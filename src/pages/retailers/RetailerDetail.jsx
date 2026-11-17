import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { retailersApi } from '../../services/retailersApi';
import { networkApi } from '../../services/networkApi';
import { LEVELS } from '../../config/roles';
import { P } from '../../config/permissions';
import { num, inr, inrShort } from '../../utils/format';
import {
  Avatar, Badge, Breadcrumb, Button, Card, CardHeader, Dialog, ErrorBlock, KeyValue, Kpi, LoadingBlock,
  StateMessage, Table, Tabs, TabPanel, useToast,
  MediaLink,
} from '../../components/ui';
import { customerColumns } from '../customers/customerColumns';
import { isLive } from '../../services/http';

const CUSTOMERS_LIVE = isLive('customers');

const EMI_TONE = { active: ['info', 'Active'], overdue: ['bad', 'Overdue'], completed: ['mute', 'Completed'] };
const MONTH = 'September'; // TODO(api): period from the backend

/** A-06 · Retailer detail */
export default function RetailerDetail() {
  const { retailerId } = useParams();
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: r, loading, error, reload } = useApi(() => retailersApi.get(retailerId), [retailerId]);
  const [q, setQ] = useQueryState({ tab: 'overview' });
  const [dialog, setDialog] = useState(null); // 'suspend' | 'decline' | 'delete' | null
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !r) return <LoadingBlock />;
  if (error) {
    return (
      <div className="page"><Card>
        {error.status === 404
          ? <StateMessage icon="store" title="This store isn’t in your list" action={<Button to="/retailers">Back to retailers</Button>}>It may have been removed, or it belongs to another network.</StateMessage>
          : <ErrorBlock error={error} onRetry={reload} />}
      </Card></div>
    );
  }

  const changeStatus = async (status, message) => {
    setBusy(true);
    try {
      await retailersApi.setStatus(r.id, status, reason || undefined);
      toast(message);
      setDialog(null);
      setReason('');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const live = !!r.live;
  const remove = async () => {
    setBusy(true);
    try { await networkApi.removePartner(r.id); toast(`${r.store} deleted`); navigate('/retailers', { replace: true }); }
    catch (err) { toast(err.message, 'bad'); setBusy(false); }
  };
  const canManage = can(P.RETAILERS_MANAGE);
  const canDelete = live && user.level === LEVELS.COMPANY && can(P.PARTNER_SUSPEND);
  const canSuspend = canManage && can(P.PARTNER_SUSPEND);
  const s = r.stats;
  const rate = s.due ? Math.round((s.collected / s.due) * 100) : null;

  const tabs = [
    { value: 'overview', label: 'Overview' },
    ...(can(P.CUSTOMERS_VIEW) && (!live || CUSTOMERS_LIVE) ? [{ value: 'customers', label: 'Customers' }] : []),
    ...(live ? [] : [{ value: 'devices', label: 'Devices' }]),
    ...(can(P.COLLECTIONS_VIEW) && !live ? [{ value: 'payments', label: 'Payments' }] : []),
    { value: 'staff', label: 'Store staff' },
  ];
  const tab = tabs.some((t) => t.value === q.tab) ? q.tab : 'overview';

  const devices = r.allowedDevices ? [
    r.allowedDevices.android && 'Android',
    r.allowedDevices.iphone && 'iPhone',
    r.allowedDevices.tv && 'Smart TV',
  ].filter(Boolean).join(', ') : '';

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: 'Retailers', to: '/retailers' }, { label: r.store }]} />

      <div className="detail-head">
        <Avatar text={r.initials} shape="square" size="lg" tone="brand" />
        <div className="detail-head-main">
          <div className="detail-head-title"><h1 className="h1">{r.store}</h1><Badge status={r.status} /></div>
          <span className="sub" style={{ fontSize: 14 }}>
            {[r.owner, live ? [r.city, r.state].filter(Boolean).join(', ') : r.city === r.district ? r.city : `${r.city}, ${r.district}`, r.since && `Partner since ${r.since}`].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="page-actions">
          {r.status === 'pending' && can(P.RETAILERS_APPROVE) && <>
            <Button variant="secondary" onClick={() => setDialog('decline')}>Decline</Button>
            <Button icon="check" disabled={busy} onClick={() => changeStatus('active', 'Store approved · owner notified by SMS')}>Approve store</Button>
          </>}
          {r.status === 'active' && canSuspend && <Button variant="secondary" onClick={() => setDialog('suspend')}>Suspend</Button>}
          {r.status === 'suspended' && canSuspend && (
            <Button variant="secondary" disabled={busy} onClick={() => changeStatus('active', 'Store reactivated')}>Reactivate</Button>
          )}
          {canDelete && <Button variant="secondary" onClick={() => setDialog('delete')}>Delete</Button>}
          {canManage && <Button variant="secondary" icon="edit" to={`/retailers/${r.id}/edit`}>Edit</Button>}
        </div>
      </div>

      {r.status === 'pending' && (
        <div className="note" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
          This store is waiting for a super admin to approve it. The owner can’t sign in to the Retailer app until then.
        </div>
      )}

      <Tabs label="Retailer sections" idPrefix="rt" tabs={tabs} value={tab} onChange={(t) => setQ({ tab: t })} />

      <TabPanel idPrefix="rt" value={tab}>
        {tab === 'overview' && live && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="grid-4">
              <Kpi label="Devices enrolled" value={num(s.devices)} foot="all time" />
              <Kpi label="Keys available" value={num(r.balance)} foot={r.status === 'suspended' ? 'hidden while suspended' : 'ready to enrol'} />
              <Kpi label="Overdue" value={<span style={{ color: s.overdue ? 'var(--bad)' : undefined }}>{num(s.overdue)}</span>} foot="installments past due" />
              <Kpi label="Collected" value={inrShort(s.collected)} foot={s.collectionRate == null ? 'Nothing due yet' : `${s.collectionRate}% of what’s due`} />
            </div>
            <div className="split-side">
              <Card>
                {CUSTOMERS_LIVE ? (
                  <StateMessage icon="users" title="Customers at this store"
                    action={<Button variant="secondary" onClick={() => setQ({ tab: 'customers' })}>Open customers</Button>}>
                    Every customer this store sold to, with their device, EMI and next due date.
                  </StateMessage>
                ) : (
                  <StateMessage icon="phone" title="Devices and customers">
                    This store’s customers, devices and payments show here once the customers and EMI screens are connected to the server.
                  </StateMessage>
                )}
              </Card>
              <Card style={{ padding: '20px 24px' }}>
                <h2 className="h2" style={{ paddingBottom: 8 }}>Store information</h2>
                <KeyValue items={[
                  ['Owner', r.owner || '—'],
                  ['Mobile', r.ownerMobile || '—'],
                  ['Sign-in email', r.email || '—'],
                  ['GSTIN', r.gstin ? <span className="mono" style={{ fontSize: 13 }}>{r.gstin}</span> : '—'],
                  ['PAN', r.pan ? <span className="mono" style={{ fontSize: 13 }}>{r.pan}</span> : '—'],
                  ['Address', [r.address, r.city, r.state, r.pin].filter(Boolean).join(', ') || '—'],
                  ['ID proof', r.kycUrl ? <MediaLink url={r.kycUrl} className="btn btn-text">View document</MediaLink> : '—'],
                  ['Reports to', r.network?.subDistributorName],
                ]} />
              </Card>
            </div>
          </div>
        )}
        {tab === 'overview' && !live && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="grid-4">
              <Kpi label="Devices" value={num(s.devices)} foot={`${num(s.lockedNow)} locked right now`} />
              <Kpi label="Active EMIs" value={num(s.activeEmis)} foot={`${num(s.fullyPaid)} fully paid`} />
              <Kpi label="Overdue" value={<span style={{ color: s.overdue ? 'var(--bad)' : undefined }}>{num(s.overdue)}</span>} foot={`${inr(s.overdueAmount)} outstanding`} />
              <Kpi label={`Collected in ${MONTH}`} value={inrShort(s.collected)} foot={rate == null ? 'Nothing due yet' : `${rate}% of ${inrShort(s.due)} due`} />
            </div>

            <div className="split-side">
              <Card flush>
                <CardHeader title="Recently enrolled devices" action={r.recentDevices.length > 0 && <button type="button" className="btn btn-text" onClick={() => setQ({ tab: 'devices' })}>View all</button>} />
                <DeviceTable rows={r.recentDevices} />
              </Card>
              <Card style={{ padding: '20px 24px' }}>
                <h2 className="h2" style={{ paddingBottom: 8 }}>Store information</h2>
                <KeyValue items={[
                  ['Owner', r.owner],
                  ['Mobile', r.ownerMobile],
                  r.storePhone && ['Store phone', r.storePhone],
                  ['GSTIN', r.gstin ? <span className="mono" style={{ fontSize: 13 }}>{r.gstin}</span> : '—'],
                  ['Address', `${r.address}, ${r.city} ${r.pin}`],
                  ['Reports to', r.network?.subDistributorName],
                  ['Grace period', `${r.gracePeriodDays} ${r.gracePeriodDays === 1 ? 'day' : 'days'}`],
                  ['Allowed devices', devices || '—'],
                ]} />
              </Card>
            </div>
          </div>
        )}
        {tab === 'customers' && <CustomersTab retailerId={r.id} />}
        {tab === 'devices' && <DevicesTab retailerId={r.id} />}
        {tab === 'payments' && (
          <Card>
            <StateMessage icon="card" title="Payments for this store" action={<Button variant="secondary" to={`/payments?retailer=${r.id}`}>Open payments</Button>}>
              This tab will list every payment collected at {r.store}. It’s built together with the Payments screens (A-23).
            </StateMessage>
          </Card>
        )}
        {tab === 'staff' && <StaffTab retailerId={r.id} />}
      </TabPanel>

      <Dialog
        open={dialog === 'suspend' || dialog === 'decline'}
        title={dialog === 'suspend' ? `Suspend ${r.store}?` : `Decline ${r.store}?`}
        onClose={() => setDialog(null)}
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => (dialog === 'suspend'
              ? changeStatus('suspended', 'Store suspended')
              : changeStatus('suspended', 'Store declined'))}
          >
            {dialog === 'suspend' ? 'Suspend store' : 'Decline store'}
          </Button>
        </>}
      >
        <p>
          {dialog === 'suspend'
            ? 'Store staff can’t sign in to the Retailer app or enrol new devices. Devices already enrolled stay protected, and EMIs keep running.'
            : 'The owner won’t get access to the Retailer app. You can approve the store later from this page.'}
        </p>
        {!live && <div className="field">
          <label className="field-label" htmlFor="reason">Reason <span className="optional">(saved in the audit log)</span></label>
          <textarea id="reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>}
      </Dialog>
      <Dialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={`Delete ${r.store}?`}
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
        </>}>
        <p>This removes the store’s account for good. To stop the owner signing in but keep the store’s history, suspend it instead.</p>
      </Dialog>
    </div>
  );
}

function DeviceTable({ rows }) {
  const navigate = useNavigate();
  const columns = [
    { key: 'customer', header: 'Customer', width: '1.4fr', render: (d) => <span className="fw-600">{d.customer}</span> },
    { key: 'device', header: 'Device', width: '1.4fr', render: (d) => (
      <div className="cell-stack"><span>{d.device}</span><span className="cell-sub mono">{d.ref}</span></div>
    ) },
    { key: 'enrolled', header: 'Enrolled', width: '1fr', render: (d) => <span className="ink-2">{d.enrolled}</span> },
    { key: 'emi', header: 'EMI', width: '0.9fr', render: (d) => { const [t, l] = EMI_TONE[d.emiStatus]; return <Badge tone={t}>{l}</Badge>; } },
    { key: 'status', header: 'Device', width: '0.9fr', render: (d) => <Badge status={d.deviceStatus} /> },
  ];
  return <Table columns={columns} rows={rows} onRowClick={(d) => navigate(`/devices/${d.id}`)} minWidth={640} empty="No devices enrolled at this store yet." />;
}

function CustomersTab({ retailerId }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(() => retailersApi.customers(retailerId), [retailerId]);
  if (error) return <Card><ErrorBlock error={error} onRetry={reload} /></Card>;
  return (
    <Card flush>
      <CardHeader title="Customers" subtitle={data ? `${num(data.length)} customers at this store` : 'Loading…'} />
      {data && <Table
        columns={customerColumns({ showPhone: can(P.CUSTOMER_PHONE_VIEW), showRetailer: false })}
        rows={data}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        minWidth={860}
        empty="No customers at this store yet."
      />}
    </Card>
  );
}

function DevicesTab({ retailerId }) {
  const { data, error, reload } = useApi(() => retailersApi.customers(retailerId), [retailerId]);
  if (error) return <Card><ErrorBlock error={error} onRetry={reload} /></Card>;
  const rows = (data ?? []).filter((c) => c.device).map((c) => ({
    id: c.deviceId, customer: c.name, device: c.device, ref: c.deviceRef, enrolled: c.since,
    emiStatus: c.status === 'overdue' ? 'overdue' : c.status === 'completed' ? 'completed' : 'active',
    deviceStatus: c.deviceStatus,
  }));
  return (
    <Card flush>
      <CardHeader title="Devices" subtitle={data ? `${num(rows.length)} devices enrolled` : 'Loading…'} />
      {data && <DeviceTable rows={rows} />}
    </Card>
  );
}

function StaffTab({ retailerId }) {
  const { data, error, reload } = useApi(() => retailersApi.staff(retailerId), [retailerId]);
  if (error) return <Card><ErrorBlock error={error} onRetry={reload} /></Card>;
  const columns = [
    { key: 'name', header: 'Name', width: '1.5fr', render: (s) => (
      <div className="cell-person"><Avatar text={s.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} /><span className="fw-600">{s.name}</span></div>
    ) },
    { key: 'role', header: 'Role', width: '1fr', render: (s) => <span className="ink-2">{s.role}</span> },
    { key: 'mobile', header: 'Mobile (app sign-in)', width: '1.2fr' },
    { key: 'lastActive', header: 'Last active', width: '1fr', render: (s) => <span className="ink-2">{s.lastActive}</span> },
  ];
  return (
    <Card flush>
      <CardHeader title="Store staff" subtitle="People who sign in to the Retailer app for this store" />
      {data && <Table columns={columns} rows={data} minWidth={600} />}
    </Card>
  );
}
