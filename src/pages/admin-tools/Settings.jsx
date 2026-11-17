import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { adminApi, ADMIN_LIVE } from '../../services/adminApi';
import {
  Badge, Button, Card, CardHeader, Checkbox, Dialog, ErrorBlock, Field, FormRow, FormSection, LoadingBlock, PageHeader, SelectField, StateMessage, Table, Tabs, TabPanel, Toggle, useToast,
} from '../../components/ui';
import { NeedsServer } from './Staff';

const TABS = [
  { value: 'company', label: 'Company' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'lock-screen', label: 'Lock-screen messages' },
];
const PROVIDERS = [
  { value: 'SIMULATION', label: 'Simulation (no messages sent)' },
  { value: 'WATI', label: 'WATI' },
  { value: 'GUPSHUP', label: 'Gupshup' },
  { value: 'INTERAKT', label: 'Interakt' },
];

/** A-38 Company · A-39 Integrations · A-40 Lock-screen messages (GET/PATCH /settings/). */
export default function Settings() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const tab = TABS.find((t) => pathname.endsWith(t.value))?.value ?? 'company';
  const { data, loading, error, reload } = useApi(() => (ADMIN_LIVE ? adminApi.settings() : Promise.resolve(null)), []);
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setV({ ...data, razorpaySecret: '', whatsappKey: '' }); }, [data]);

  if (!ADMIN_LIVE) return <NeedsServer title="Settings" />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  if (loading || !v) return <LoadingBlock rows={3} />;

  const set = (k) => (e) => { const val = e?.target ? e.target.value : e; setV((s) => ({ ...s, [k]: val })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async (fields) => {
    const e = {};
    if (fields.includes('companyName') && !v.companyName.trim()) e.companyName = 'Enter the company name';
    if (fields.includes('supportEmail') && v.supportEmail && !/^\S+@\S+\.\S+$/.test(v.supportEmail)) e.supportEmail = 'Enter a valid email';
    if (fields.includes('graceDays') && !(Number(v.graceDays) >= 0 && Number(v.graceDays) <= 30)) e.graceDays = '0 to 30 days';
    if (fields.includes('lateFee') && !(Number(v.lateFee) >= 0)) e.lateFee = 'Enter 0 or more';
    setErrors(e);
    if (Object.keys(e).length) return;
    const patch = {};
    fields.forEach((k) => {
      // Secrets are only sent when typed; an empty box keeps the saved one.
      if ((k === 'razorpaySecret' || k === 'whatsappKey') && !v[k]) return;
      patch[k] = k === 'graceDays' ? Number(v[k]) : k === 'lateFee' ? Number(v[k]) : v[k];
    });
    setBusy(true);
    try { await adminApi.saveSettings(patch); toast('Settings saved'); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader title="Settings" subtitle={`Last changed ${data.updatedAt}`} />
      <Tabs label="Settings sections" idPrefix="set" tabs={TABS} value={tab} onChange={(t) => navigate(`/settings/${t}`)} />
      <TabPanel idPrefix="set" value={tab}>
        {tab === 'company' && (
          <div className="form-layout">
            <div className="form-col">
              <FormSection title="Company" subtitle="Shown on receipts and the customer lock screen.">
                <Field label="Company name" value={v.companyName} onChange={set('companyName')} error={errors.companyName} />
                <FormRow>
                  <Field label="Support phone" type="tel" value={v.supportPhone} onChange={set('supportPhone')} />
                  <Field label="Support email" type="email" value={v.supportEmail} onChange={set('supportEmail')} error={errors.supportEmail} />
                </FormRow>
                <Field label="Address" value={v.address} onChange={set('address')} />
                <Field label={<>GSTIN <span className="optional">(optional)</span></>} className="mono-input" value={v.gstin} onChange={set('gstin')} />
              </FormSection>
            </div>
            <div className="form-col">
              <FormSection title="EMI rules" subtitle="Defaults for new EMIs. Each plan can still set its own grace period.">
                <Field label="Grace period before auto-lock (days)" inputMode="numeric" value={v.graceDays} onChange={set('graceDays')} error={errors.graceDays} />
                <div className="rule-row">
                  <div><strong>Auto-lock after grace period</strong><span className="sub">Locks the device when an installment stays unpaid</span></div>
                  <Toggle label="Auto-lock" checked={v.autoLock} onChange={(x) => setV((s) => ({ ...s, autoLock: x }))} />
                </div>
                <Field label="Late fee per day (₹)" inputMode="decimal" value={v.lateFee} onChange={set('lateFee')} error={errors.lateFee} hint="0 for no late fee" />
              </FormSection>
              <Button disabled={busy} onClick={() => save(['companyName', 'supportPhone', 'supportEmail', 'address', 'gstin', 'graceDays', 'autoLock', 'lateFee'])}>
                {busy ? 'Saving…' : 'Save company settings'}
              </Button>
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="form-layout">
            <div className="form-col">
              <FormSection title="Razorpay" subtitle="Online EMI payments in the Customer app.">
                <Field label="Key ID" className="mono-input" placeholder="rzp_live_…" value={v.razorpayKeyId} onChange={set('razorpayKeyId')} />
                <Field label="Key secret" type="password" autoComplete="new-password" placeholder={v.razorpaySecretSet ? 'Saved · type to replace' : 'Not set'}
                  value={v.razorpaySecret} onChange={set('razorpaySecret')} />
              </FormSection>
              <FormSection title="WhatsApp" subtitle="Reminders, receipts and campaigns. In Simulation mode nothing is sent; messages are only logged.">
                <SelectField label="Provider" value={v.whatsappProvider} onChange={set('whatsappProvider')} options={PROVIDERS} />
                <Field label="API key" type="password" autoComplete="new-password" placeholder={v.whatsappKeySet ? 'Saved · type to replace' : 'Not set'}
                  value={v.whatsappKey} onChange={set('whatsappKey')} />
                <Field label="Sender ID / number" value={v.whatsappSender} onChange={set('whatsappSender')} />
              </FormSection>
              <Button disabled={busy} onClick={() => save(['razorpayKeyId', 'razorpaySecret', 'whatsappProvider', 'whatsappKey', 'whatsappSender'])}>
                {busy ? 'Saving…' : 'Save integrations'}
              </Button>
            </div>
            <div className="form-col">
              <Card style={{ padding: '20px 24px' }}>
                <h2 className="h2" style={{ paddingBottom: 6 }}>Status</h2>
                <p className="sub" style={{ margin: 0 }}>Razorpay: {v.razorpayKeyId && v.razorpaySecretSet ? 'connected' : 'not connected (payments run in simulation)'}</p>
                <p className="sub" style={{ margin: '6px 0 0' }}>WhatsApp: {v.whatsappProvider === 'SIMULATION' || !v.whatsappKeySet ? 'simulation — messages are logged, not sent' : `live via ${v.whatsappProvider}`}</p>
              </Card>
            </div>
          </div>
        )}

        {tab === 'lock-screen' && <LockMessages />}
      </TabPanel>
    </div>
  );
}

/** A-40 · Saved messages for the lock screen (GET/POST /lock-messages/). The default one shows when no message is typed. */
function LockMessages() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => adminApi.lockMessages(), []);
  const [editing, setEditing] = useState(null); // { message? }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) return <Card><ErrorBlock error={error} onRetry={reload} /></Card>;
  if (loading && !data) return <LoadingBlock rows={3} />;

  const remove = async () => {
    setBusy(true);
    try { await adminApi.deleteLockMessage(deleting.id); toast('Message deleted'); setDeleting(null); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(false); }
  };
  const columns = [
    { key: 'title', header: 'Name', width: '1fr', render: (m) => <div className="cell-stack"><span className="fw-600">{m.title}</span>{m.isDefault && <Badge tone="info">Default</Badge>}</div> },
    { key: 'text', header: 'Message on the screen', width: '2.2fr', render: (m) => <span className="ink-2">{m.text}</span> },
    { key: 'updatedAt', header: 'Changed', width: '0.9fr', render: (m) => <span className="ink-2">{m.updatedAt}</span> },
    { key: 'actions', header: '', width: '150px', render: (m) => (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={() => setEditing({ message: m })}>Edit</Button>
        <Button variant="secondary" size="sm" icon="close" aria-label={`Delete ${m.title}`} onClick={() => setDeleting(m)} />
      </div>
    ) },
  ];

  return (
    <>
      <Card flush>
        <CardHeader title="Lock-screen messages" subtitle="Pick one of these when locking a device. The default shows if nothing else is chosen."
          action={<Button size="sm" icon="plus" onClick={() => setEditing({})}>New message</Button>} />
        <Table columns={columns} rows={data} minWidth={640} empty="No saved messages yet. Add one, for example “Your EMI is overdue. Pay to unlock.”" />
      </Card>
      {editing && <LockMessageDialog message={editing.message} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} role="alertdialog" icon="alert" title={`Delete “${deleting?.title ?? ''}”?`}
        subtitle="Devices already showing it keep it until they're locked again."
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={remove}>Delete message</Button>
        </>} />
    </>
  );
}

function LockMessageDialog({ message, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ title: message?.title ?? '', text: message?.text ?? '', isDefault: message?.isDefault ?? false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = {};
    if (!v.title.trim()) e.title = 'Give it a short name';
    if (!v.text.trim()) e.text = 'Type the message';
    else if (v.text.trim().length > 300) e.text = 'Keep it under 300 characters so it fits the screen';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await adminApi.saveLockMessage(v, message?.id); toast(message ? 'Message updated' : 'Message saved'); onDone(); }
    catch (err) { setErrors({ form: err.message }); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} width={540} title={message ? 'Edit lock-screen message' : 'New lock-screen message'}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save message'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <Field label="Name" value={v.title} onChange={(e) => { setV((s) => ({ ...s, title: e.target.value })); setErrors({}); }} error={errors.title} placeholder="Overdue reminder" data-autofocus />
      <div className="field">
        <label className="field-label" htmlFor="lock-text">Message</label>
        <textarea id="lock-text" className="textarea" value={v.text} placeholder="Your EMI is overdue. Pay at your store or in the Prime Locker app to unlock."
          onChange={(e) => { setV((s) => ({ ...s, text: e.target.value })); setErrors({}); }} />
        {errors.text ? <span className="field-error">{errors.text}</span> : <span className="field-hint">{v.text.trim().length}/300</span>}
      </div>
      <Checkbox label="Use as the default message" checked={v.isDefault} onChange={(e) => setV((s) => ({ ...s, isDefault: e.target.checked }))} />
    </Dialog>
  );
}
