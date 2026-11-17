import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { adminApi, ADMIN_LIVE } from '../../services/adminApi';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import { Badge, Button, Card, CardHeader, ErrorBlock, Field, LoadingBlock, PageHeader, SelectField, Table, useToast } from '../../components/ui';
import { NeedsServer } from './Staff';

const SEGMENTS = [
  { value: 'OVERDUE', label: 'Customers with an overdue EMI' },
  { value: 'LOCKED_DEVICES', label: 'Customers whose device is locked' },
  { value: 'CUSTOM', label: 'Numbers I type in' },
];
const NICE = {
  emi_due_reminder: 'EMI due reminder', emi_overdue_warning: 'Overdue warning', device_locked_notice: 'Device locked notice',
  payment_receipt_success: 'Payment receipt', welcome_onboarding: 'Welcome message',
};
// Filled per customer by the backend, so not asked here.
const AUTO = new Set(['customer_name']);
const STATUS = { SENT: 'ok', SIMULATED: 'info', FAILED: 'bad' };

/** WhatsApp campaigns: pick a template and who gets it; see recent deliveries. */
export default function WhatsApp() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => (ADMIN_LIVE ? adminApi.whatsapp() : Promise.resolve(null)), []);
  const [v, setV] = useState({ template: '', segment: 'OVERDUE', phones: '', params: {} });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const t = useMemo(() => data?.templates.find((x) => x.key === v.template) ?? data?.templates[0], [data, v.template]);
  if (!ADMIN_LIVE) return <NeedsServer title="WhatsApp campaigns" />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  if (loading && !data) return <LoadingBlock rows={3} />;

  const fields = (t?.params ?? []).filter((p) => !AUTO.has(p));
  const preview = (t?.body ?? '').replace(/{{\s*(\w+)\s*}}/g, (_, k) => v.params[k] || (k === 'customer_name' ? 'Asha' : `[${k.replace(/_/g, ' ')}]`));
  const send = async () => {
    const e = {};
    const phones = v.phones.split(/[\s,;]+/).map((p) => p.replace(/\D/g, '')).filter(Boolean);
    if (v.segment === 'CUSTOM' && !phones.length) e.phones = 'Type at least one mobile number';
    if (v.segment === 'CUSTOM' && phones.some((p) => p.length < 10)) e.phones = 'Each number needs 10 digits';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await adminApi.sendCampaign({ template: t.key, segment: v.segment, phones, params: v.params });
      toast(`Sent to ${num(r.total_recipients ?? 0)} ${r.total_recipients === 1 ? 'person' : 'people'}`);
      reload();
    } catch (x) { toast(x.message, 'bad'); }
    finally { setBusy(false); }
  };

  const columns = [
    { key: 'at', header: 'When', width: '1.1fr', render: (d) => <span className="ink-2">{d.at}</span> },
    { key: 'to', header: 'To', width: '1.3fr', render: (d) => <div className="cell-stack"><span className="fw-600">{d.name || '—'}</span><span className="cell-sub mono">{d.phone}</span></div> },
    { key: 'template', header: 'Message', width: '1.3fr', render: (d) => <span className="ink-2">{NICE[d.template] ?? d.template}</span> },
    { key: 'status', header: 'Status', width: '0.8fr', render: (d) => <Badge tone={STATUS[d.status] ?? 'mute'}>{d.status === 'SIMULATED' ? 'Simulated' : d.status === 'SENT' ? 'Sent' : d.status === 'FAILED' ? 'Failed' : d.status}</Badge> },
    { key: 'provider', header: 'Via', width: '0.8fr', render: (d) => <span className="ink-2">{d.provider}</span> },
  ];
  const simulated = data.deliveries.length > 0 && data.deliveries.every((d) => d.status === 'SIMULATED');

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader title="WhatsApp campaigns" subtitle="Send a template message to a group of customers. Payment receipts also go out automatically when a payment is recorded." />
      {simulated && (
        <div className="note" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
          WhatsApp is in simulation mode, so messages are logged here but not delivered. Connect a provider in Settings → Integrations.
        </div>
      )}
      <div className="split-side">
        <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="h2">New campaign</h2>
          <SelectField label="Message" value={t?.key ?? ''} onChange={(e) => setV((s) => ({ ...s, template: e.target.value, params: {} }))}
            options={data.templates.map((x) => ({ value: x.key, label: NICE[x.key] ?? x.key }))} hint={t?.description} />
          <SelectField label="Send to" value={v.segment} onChange={(e) => setV((s) => ({ ...s, segment: e.target.value }))} options={SEGMENTS} />
          {v.segment === 'CUSTOM' && (
            <div className="field">
              <label className="field-label" htmlFor="wa-phones">Mobile numbers</label>
              <textarea id="wa-phones" className="textarea" placeholder="9876543210, 9123456780" value={v.phones}
                onChange={(e) => { setV((s) => ({ ...s, phones: e.target.value })); setErr({}); }} />
              {err.phones ? <span className="field-error">{err.phones}</span> : <span className="field-hint">Separate with commas or new lines</span>}
            </div>
          )}
          {fields.map((k) => (
            <Field key={k} label={k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} value={v.params[k] ?? ''}
              onChange={(e) => setV((s) => ({ ...s, params: { ...s.params, [k]: e.target.value } }))}
              placeholder={k === 'payment_link' ? 'https://…' : k === 'amount' ? '4500' : ''} />
          ))}
          <div className="note" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, background: 'var(--ground)', color: 'var(--ink)' }}>
            <span className="sub">Preview</span>
            <span style={{ fontSize: 14 }}>{preview}</span>
          </div>
          {can(P.WHATSAPP_SEND) && <Button icon="send" disabled={busy || !t} onClick={send}>{busy ? 'Sending…' : 'Send campaign'}</Button>}
        </Card>
        <Card flush>
          <CardHeader title="Recent messages" subtitle="Last 50, newest first" />
          <Table columns={columns} rows={data.deliveries} minWidth={640} empty="No WhatsApp messages yet." />
        </Card>
      </div>
    </div>
  );
}
