import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { customersApi } from '../../services/customersApi';
import { P } from '../../config/permissions';
import { inr } from '../../utils/format';
import {
  Avatar, Badge, Breadcrumb, Button, Card, CardHeader, ErrorBlock, Icon, KeyValue, LoadingBlock,
  MediaLink, StateMessage, Table, Tabs, TabPanel, useToast,
} from '../../components/ui';
import { CustomerStatus } from './customerColumns';
import './customer.css';

const INST_STATUS = {
  paid: ['ok', 'Paid'], paid_late: ['warn', 'Paid late'], overdue: ['bad', 'Overdue'], upcoming: ['mute', 'Upcoming'], due: ['warn', 'Due'],
};
const KYC = { verified: ['ok', 'KYC verified'], partial: ['warn', 'KYC partial'], missing: ['warn', 'KYC missing'], pending: ['warn', 'KYC pending'] };
const DEVICE_ICON = { android: 'phone', iphone: 'phone', tv: 'tv' };

/** A-09 · Customer detail */
export default function CustomerDetail() {
  const { customerId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { data: c, loading, error, reload } = useApi(() => customersApi.get(customerId), [customerId]);
  const [q, setQ] = useQueryState({ tab: 'overview' });
  const [sending, setSending] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);

  if (loading && !c) return <LoadingBlock />;
  if (error) {
    return (
      <div className="page"><Card>
        {error.status === 404
          ? <StateMessage icon="users" title="This customer isn’t in your list" action={<Button to="/customers">Back to customers</Button>}>The customer may have been removed, or belongs to a store you can’t see.</StateMessage>
          : <ErrorBlock error={error} onRetry={reload} />}
      </Card></div>
    );
  }

  const remind = async () => {
    setSending(true);
    try {
      const r = await customersApi.sendReminder(c.id);
      toast(c.live ? [r.whatsapp && `WhatsApp to ${c.phone}`, r.screen && 'shown on the device'].filter(Boolean).join(' · ').replace(/^./, (x) => x.toUpperCase()) || 'Reminder sent' : `Reminder sent on WhatsApp to ${c.phone}`);
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setSending(false);
    }
  };

  const live = !!c.live;
  const locked = c.device?.status === 'locked';
  const toggleLock = async () => {
    setLockBusy(true);
    try {
      await customersApi.setLocked(c.id, !locked);
      toast(locked ? 'Device unlocked' : 'Device locked');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setLockBusy(false);
    }
  };

  const hasEmi = Boolean(c.emi);
  const open = hasEmi && c.status !== 'completed';
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'devices', label: `Devices (${c.device ? 1 : 0})` },
    { value: 'payments', label: 'Payments' },
    { value: 'documents', label: 'Documents' },
    ...(live ? [] : [{ value: 'messages', label: 'Messages' }]),
  ];
  const tab = tabs.some((t) => t.value === q.tab) ? q.tab : 'overview';
  const showPhone = can(P.CUSTOMER_PHONE_VIEW);

  // Overview shows the schedule up to and including the next upcoming installment (as in the design).
  const firstUpcoming = c.schedule.findIndex((s) => s.status === 'upcoming');
  const visible = firstUpcoming === -1 ? c.schedule : c.schedule.slice(0, firstUpcoming + 1);

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: 'Customers', to: '/customers' }, { label: c.name }]} />

      <div className="detail-head">
        <Avatar text={c.initials} size="lg" tone={c.status === 'overdue' ? 'warn' : 'plain'} />
        <div className="detail-head-main">
          <div className="detail-head-title">
            <h1 className="h1">{c.name}</h1>
            <CustomerStatus status={c.status} />
            <Badge tone={(KYC[c.kyc] ?? KYC.pending)[0]}>{(KYC[c.kyc] ?? KYC.pending)[1]}</Badge>
          </div>
          <span className="sub" style={{ fontSize: 14 }}>
            {[showPhone && c.phone, c.retailer && [c.retailer.name, c.retailer.city].filter(Boolean).join(', '), `Customer since ${c.since}`].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="page-actions">
          {open && can(P.WHATSAPP_SEND) && <Button variant="secondary" icon="send" disabled={sending} onClick={remind}>{sending ? 'Sending…' : 'Send reminder'}</Button>}
          {live && (c.device || hasEmi) && can(P.DEVICES_CONTROL) && (
            <Button variant="secondary" icon={locked ? 'unlock' : 'lock'} disabled={lockBusy} onClick={toggleLock}>{lockBusy ? 'Sending…' : locked ? 'Unlock device' : 'Lock device'}</Button>
          )}
          {open && can(P.PAYMENTS_RECORD) && <Button to={live ? `/emi/${c.id}` : `/payments/new?customer=${c.id}`}>Record payment</Button>}
          {!c.device && !live && can(P.DEVICES_REGISTER) && <Button icon="plus" to={`/devices/register?customer=${c.id}`}>Register device</Button>}
        </div>
      </div>

      <Tabs label="Customer sections" idPrefix="ct" tabs={tabs} value={tab} onChange={(t) => setQ({ tab: t })} />

      <TabPanel idPrefix="ct" value={tab}>
        {tab === 'overview' && (
          <div className="split-side">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <DeviceCard customer={c} />
              {hasEmi ? (
                <Card flush>
                  <CardHeader
                    title="EMI schedule"
                    subtitle={`${inr(c.emi.price)} device · ${inr(c.emi.down)} down payment · ${inr(c.emi.amount)} × ${c.emi.months} months`}
                    action={<Link to={`/emi/${c.id}`} className="link-arrow">Full schedule</Link>}
                  />
                  <ScheduleTable rows={visible} />
                </Card>
              ) : (
                <Card>
                  <StateMessage icon="calendar" title="No EMI yet"
                    action={live && c.device && can(P.EMI_CREATE) && <Button to={`/emi/new?customer=${c.id}`}>Set up EMI</Button>}>
                    {live ? 'The retailer attaches an EMI plan in the Retailer app right after enrolling the device.' : 'The EMI is set up after the device is registered.'}
                  </StateMessage>
                </Card>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {hasEmi && (
                <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 className="h2">Balance</h2>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{inr(c.balance.outstanding)}</span>
                    <span className="sub">outstanding</span>
                  </div>
                  <div className="progress" role="progressbar" aria-label="Installments paid"
                    aria-valuenow={c.balance.paidCount} aria-valuemin={0} aria-valuemax={c.balance.months}>
                    <div style={{ width: `${(c.balance.paidCount / c.balance.months) * 100}%` }} />
                  </div>
                  <span className="sub">{c.balance.paidCount} of {c.balance.months} installments paid · {inr(c.balance.collected)} collected</span>
                </Card>
              )}
              <Card style={{ padding: '20px 24px' }}>
                <h2 className="h2" style={{ paddingBottom: 6 }}>Profile</h2>
                <KeyValue items={[
                  showPhone && c.altPhone && ['Alternate', c.altPhone],
                  ['Address', c.address],
                  live && ['App sign-in', c.email || '—'],
                  (!live || c.idLast4) && ['ID', c.idLast4 ? `${c.idType ?? 'ID'} ••• ${c.idLast4}` : '—'],
                  live && ['EMI agreement', c.agreement ? 'Signed' : 'Not recorded'],
                  live && hasEmi && ['EMI plan', c.emi.plan],
                  ['Retailer', c.retailer ? <Link to={`/retailers/${c.retailer.id}`}>{c.retailer.name}</Link> : '—'],
                ]} />
              </Card>
            </div>
          </div>
        )}

        {tab === 'devices' && <DeviceCard customer={c} />}

        {tab === 'payments' && (
          <Card flush>
            <CardHeader title="Payments" subtitle={hasEmi ? `${c.balance.paidCount} installments paid` : 'No EMI yet'} />
            <PaymentsTable rows={c.schedule.filter((s) => s.paidOn)} />
          </Card>
        )}

        {tab === 'documents' && (
          <Card flush>
            <CardHeader title="Documents" subtitle={live ? 'Photo, signature and ID (if added)' : 'KYC and the signed EMI agreement'} />
            {c.documents.length === 0 && <p className="sub" style={{ padding: '0 24px 24px' }}>No documents uploaded yet. The photo and signature are taken in the Retailer app at enrolment.</p>}
            <ul className="doc-list">
              {c.documents.map((d) => (
                <li key={d.id}>
                  <span className="doc-icon"><Icon name="file" /></span>
                  <div className="cell-stack"><span className="fw-600">{d.label}</span><span className="cell-sub">{d.file}</span></div>
                  {/* TODO(api): GET /customers/:id/documents/:docId returns a signed URL */}
                  {d.url
                    ? <MediaLink url={d.url} />
                    : <Button variant="secondary" size="sm">View</Button>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {tab === 'messages' && (
          <Card flush>
            <CardHeader title="Messages" subtitle="Reminders and notices sent to this customer" />
            {c.messages.length === 0
              ? <p className="sub" style={{ padding: '0 24px 24px' }}>No messages sent yet. Payment reminders go out on WhatsApp 3 days before and on the due date.</p>
              : (
                <ul className="msg-list">
                  {c.messages.map((m) => (
                    <li key={m.id}>
                      <div className="msg-meta"><span>{m.channel} · {m.at}</span><span>{m.status}</span></div>
                      <p>{m.text}</p>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        )}
      </TabPanel>
    </div>
  );
}

function DeviceCard({ customer: c }) {
  const { can } = useAuth();
  if (!c.device && c.live) {
    return (
      <Card>
        <StateMessage icon="phone" title="No device enrolled yet">
          The retailer enrols the phone or TV in the Retailer app by scanning it and using one key.
        </StateMessage>
      </Card>
    );
  }
  if (!c.device) {
    return (
      <Card>
        <StateMessage icon="phone" title="No device registered yet"
          action={can(P.DEVICES_REGISTER) && <Button icon="plus" to={`/devices/register?customer=${c.id}`}>Register device</Button>}>
          Register the phone or TV this customer is buying, then set up the EMI.
        </StateMessage>
      </Card>
    );
  }
  const d = c.device;
  const to = d.type === 'tv' ? `/tvs/${d.id}` : `/devices/${d.id}`;
  if (c.live) {
    // TODO(api): link to the device page once the devices module is live.
    return (
      <div className="card device-card">
        <span className="device-card-icon"><Icon name={DEVICE_ICON[d.type] ?? 'phone'} /></span>
        <div className="cell-stack" style={{ flexGrow: 1, gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</span>
          <span className="sub">{d.type === 'tv' ? 'Serial' : 'IMEI'} <span className="mono">{d.imei ?? '—'}</span>{d.os ? ` · ${d.os}` : ''} · last seen {d.lastSeen}</span>
        </div>
        <Badge status={d.status} />
      </div>
    );
  }
  return (
    <Link to={to} className="card device-card">
      <span className="device-card-icon"><Icon name={DEVICE_ICON[d.type] ?? 'phone'} /></span>
      <div className="cell-stack" style={{ flexGrow: 1, gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</span>
        <span className="sub">{d.type === 'android' ? 'IMEI' : 'Serial'} <span className="mono">{d.imei}</span> · {d.os} · last seen {d.lastSeen}</span>
      </div>
      <Badge status={d.status} />
      <Icon name="chevronRight" size={16} />
    </Link>
  );
}

function ScheduleTable({ rows }) {
  const columns = [
    { key: 'n', header: '#', width: '44px', render: (s) => <span className="muted">{s.n}</span> },
    { key: 'due', header: 'Due date', width: '1fr' },
    { key: 'amount', header: 'Amount', width: '1fr', render: (s) => <span style={{ fontWeight: 500 }}>{inr(s.amount)}</span> },
    { key: 'paidOn', header: 'Paid on', width: '1fr', render: (s) => <span className="ink-2">{s.paidOn ?? '—'}</span> },
    { key: 'status', header: 'Status', width: '1fr', render: (s) => { const [t, l] = INST_STATUS[s.status]; return <Badge tone={t}>{l}</Badge>; } },
  ];
  return <div className="compact-table"><Table columns={columns} rows={rows} rowKey="n" minWidth={520} /></div>;
}

function PaymentsTable({ rows }) {
  const columns = [
    { key: 'n', header: 'Installment', width: '1fr', render: (s) => `${s.n}` },
    { key: 'paidOn', header: 'Paid on', width: '1fr' },
    { key: 'amount', header: 'Amount', width: '1fr', align: 'right', render: (s) => <span className="fw-600">{inr(s.amount)}</span> },
    { key: 'status', header: 'Status', width: '1fr', render: (s) => { const [t, l] = INST_STATUS[s.status]; return <Badge tone={t}>{l}</Badge>; } },
  ];
  return <Table columns={columns} rows={[...rows].reverse()} rowKey="n" minWidth={520} empty="No payments yet." />;
}
