import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { emiApi } from '../../services/emiApi';
import { customersApi } from '../../services/customersApi';
import { PAYMENT_MODES } from '../../services/customersLive';
import { P } from '../../config/permissions';
import { inr } from '../../utils/format';
import { Badge, Breadcrumb, Button, Card, Dialog, ErrorBlock, Field, LoadingBlock, PageHeader, SelectField, StateMessage, Table, useToast } from '../../components/ui';
import RecordPaymentDrawer from '../payments/RecordPaymentDrawer';
import './emi.css';

const STATUS = { paid: ['ok', 'Paid'], paid_late: ['warn', 'Paid late'], overdue: ['bad', 'Overdue'], upcoming: ['mute', 'Upcoming'], due: ['warn', 'Due'] };

/** A-21 · EMI schedule for one customer */
export default function EmiSchedule() {
  const { emiId } = useParams();
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi(() => emiApi.schedule(emiId), [emiId]);
  const [paying, setPaying] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const toast = useToast();

  if (loading && !data) return <LoadingBlock rows={3} />;
  if (error) {
    return <div className="page"><Card>{error.status === 404
      ? <StateMessage icon="calendar" title={error.message} action={<Button to={`/customers/${emiId}`}>Open customer</Button>}>Set up the EMI after the device is registered.</StateMessage>
      : <ErrorBlock error={error} onRetry={reload} />}</Card></div>;
  }

  const live = !!data.live;
  const toggleLock = async () => {
    setLockBusy(true);
    try { await customersApi.setLocked(data.customer.id, !data.device.locked); toast(data.device.locked ? 'Device unlocked' : 'Device locked'); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setLockBusy(false); }
  };

  const columns = [
    { key: 'n', header: '#', width: '44px', render: (r) => <span className="muted">{r.n}</span> },
    { key: 'due', header: 'Due date', width: '1fr' },
    { key: 'amount', header: 'Amount', width: '0.8fr', align: 'right', render: (r) => <span style={{ fontWeight: 500 }}>{inr(r.amount)}</span> },
    { key: 'lateFee', header: 'Late fee', width: '0.7fr', align: 'right', render: (r) => <span className="ink-2">{r.lateFee ? inr(r.lateFee) : '—'}</span> },
    { key: 'paidOn', header: 'Paid on', width: '1fr', render: (r) => <span className="ink-2">{r.paidOnDate ? r.paidOnDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span> },
    { key: 'mode', header: 'Mode', width: '1fr', render: (r) => <span className="ink-2">{r.mode ?? '—'}</span> },
    live
      ? { key: 'ref', header: 'Reference', width: '1fr', render: (r) => <div className="cell-stack"><span className="mono small">{r.ref || '—'}</span>{r.by && <span className="cell-sub">by {r.by}</span>}</div> }
      : { key: 'receipt', header: 'Receipt', width: '0.9fr', render: (r) => (r.receipt ? <Link to={`/payments/${r.receipt}`} className="mono" style={{ fontSize: 13 }}>{r.receipt}</Link> : '') },
    { key: 'status', header: 'Status', width: '0.9fr', render: (r) => { const [t, l] = STATUS[r.status]; return <Badge tone={t}>{l}</Badge>; } },
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: data.customer.name, to: `/customers/${data.customer.id}` }, { label: 'EMI schedule' }]} />
      <PageHeader
        title="EMI schedule"
        subtitle={[data.device?.name, `${data.plan} plan`, data.started && `started ${data.started}`, data.draft && 'draft — not active yet'].filter(Boolean).join(' · ')}
        actions={<>
          <Button variant="secondary" icon="download" onClick={() => window.print()}>Download PDF</Button>
          {live && can(P.DEVICES_CONTROL) && !data.closed && (
            <Button variant="secondary" icon={data.device.locked ? 'unlock' : 'lock'} disabled={lockBusy} onClick={toggleLock}>{lockBusy ? 'Sending…' : data.device.locked ? 'Unlock device' : 'Lock device'}</Button>
          )}
          {can(P.PAYMENTS_RECORD) && !data.closed && !data.draft && <Button onClick={() => setPaying(true)}>Record payment</Button>}
        </>}
      />

      <Card flush className="sum-strip">
        <div><span>Device price</span><span>{inr(data.price)}</span></div>
        <div><span>Down payment</span><span>{inr(data.down)}</span></div>
        <div><span>Financed</span><span>{inr(data.financed)}</span></div>
        <div><span>Paid so far</span><span style={{ color: 'var(--ok)' }}>{inr(data.paid)}</span></div>
        <div><span>Outstanding</span><span style={{ color: data.outstanding ? 'var(--bad)' : undefined }}>{inr(data.outstanding)}</span></div>
      </Card>

      {live && (data.lockPhone || data.product?.type !== 'PHONE') && (
        <Card style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="cell-stack" style={{ gap: 4, flexGrow: 1 }}>
            <span className="fw-600">
              {data.product?.type !== 'PHONE' ? `${{ TV: 'TV', APPLIANCE: 'Appliance', OTHER: 'Product' }[data.product.type] ?? 'Product'} on EMI${data.product.name ? ` · ${data.product.name}` : ''}` : 'Phone that gets locked'}
            </span>
            <span className="sub">
              {data.lockPhone ? <>Secured by the customer’s phone · IMEI <span className="mono">{data.lockPhone.imei}</span></> : 'No lock phone linked yet. Missed EMIs can’t lock anything.'}
            </span>
          </div>
          {data.lockPhone && <Button variant="secondary" size="sm" to={`/devices/${data.lockPhone.id}`}>Open phone</Button>}
          {can(P.DEVICES_CONTROL) && !data.closed && <Button variant="secondary" size="sm" onClick={() => setSwapping(true)}>{data.lockPhone ? 'Change lock phone' : 'Link a phone'}</Button>}
        </Card>
      )}

      <Card flush>
        <Table columns={columns} rows={data.rows} rowKey="n" minWidth={860} />
      </Card>

      {swapping && <SwapPhoneDialog data={data} onClose={() => setSwapping(false)} onDone={() => { setSwapping(false); reload(); }} />}

      {paying && !live && <RecordPaymentDrawer customerId={data.customer.id} onClose={() => setPaying(false)} onSaved={() => { setPaying(false); reload(); }} stayOnPage />}
      {paying && live && <LivePaymentDialog data={data} onClose={() => setPaying(false)} onSaved={() => { setPaying(false); reload(); }} />}
    </div>
  );
}
/** Live: record one installment (POST /emi-installments/:id/record-payment/). */
function LivePaymentDialog({ data, onClose, onSaved }) {
  const toast = useToast();
  const unpaid = data.rows.filter((r) => r.status !== 'paid' && r.status !== 'paid_late');
  const [instId, setInstId] = useState(String(unpaid[0]?.id ?? ''));
  const inst = unpaid.find((r) => String(r.id) === instId);
  const [v, setV] = useState({ amount: String(unpaid[0]?.amount ?? ''), mode: 'CASH', reference: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors({}); };

  const save = async () => {
    const e = {};
    const amount = Number(String(v.amount).replace(/[₹,\s]/g, ''));
    if (!inst) e.form = 'Every installment is already paid';
    if (!(amount > 0)) e.amount = 'Enter the amount received';
    if (v.mode !== 'CASH' && !v.reference.trim()) e.reference = 'Enter the reference or UTR';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await emiApi.recordPayment(inst.id, { amount, mode: v.mode, reference: v.reference.trim(), notes: v.notes.trim() });
      toast(res?.contract_status === 'COMPLETED' ? 'Payment saved · EMI fully paid' : data.device.locked && res?.contract_status === 'ACTIVE' ? 'Payment saved · device unlocked' : 'Payment saved');
      onSaved();
    } catch (err) { setErrors({ form: err.message }); setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} width={520} title="Record payment"
      subtitle={`${data.customer.name} · ${data.device.name}`}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !inst} onClick={save}>{busy ? 'Saving…' : 'Save payment'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <SelectField label="Installment" value={instId}
        onChange={(e) => { setInstId(e.target.value); const r = unpaid.find((x) => String(x.id) === e.target.value); setV((s) => ({ ...s, amount: String(r?.amount ?? '') })); }}
        options={unpaid.map((r) => ({ value: String(r.id), label: `#${r.n} · due ${r.due} · ${inr(r.amount)}${r.status === 'overdue' ? ' · overdue' : ''}` }))} />
      <Field label="Amount received" inputMode="decimal" value={v.amount} onChange={set('amount')} error={errors.amount} data-autofocus />
      <div className="field">
        <span className="field-label">Payment mode</span>
        <div className="choice-row" role="group" aria-label="Payment mode">
          {PAYMENT_MODES.filter((m) => m.value !== 'ONLINE_GATEWAY').map((m) => (
            <button key={m.value} type="button" className="choice" aria-pressed={v.mode === m.value} onClick={() => setV((s) => ({ ...s, mode: m.value }))}>{m.label}</button>
          ))}
        </div>
      </div>
      <Field label={<>Reference or UTR <span className="optional">(not needed for cash)</span></>} value={v.reference} onChange={set('reference')} disabled={v.mode === 'CASH'} error={errors.reference} className="mono-input" />
      <Field label={<>Note <span className="optional">(optional)</span></>} value={v.notes} onChange={set('notes')} />
    </Dialog>
  );
}

/** Change the phone that secures this EMI (TV EMIs). The phone must already be enrolled; iPhones are refused. */
function SwapPhoneDialog({ data, onClose, onDone }) {
  const toast = useToast();
  const [imei, setImei] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const v = imei.replace(/\D/g, '');
    if (v.length !== 15) { setError('IMEI is 15 digits (dial *#06# on the phone)'); return; }
    setBusy(true);
    try { await emiApi.swapLockPhone(data.contractId, v); toast('Lock phone changed'); onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} width={480} title={data.lockPhone ? 'Change lock phone' : 'Link a lock phone'}
      subtitle="Use another Android phone of the same customer that is already enrolled. The change is saved in the audit log."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
      </>}>
      {data.lockPhone && <p className="sub" style={{ margin: 0 }}>Now: IMEI <span className="mono">{data.lockPhone.imei}</span></p>}
      <Field label="IMEI of the new phone" inputMode="numeric" maxLength={17} className="mono-input" value={imei}
        onChange={(e) => { setImei(e.target.value); setError(null); }} error={error} data-autofocus />
    </Dialog>
  );
}
