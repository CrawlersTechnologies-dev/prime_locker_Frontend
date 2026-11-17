import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { paymentsApi } from '../../services/paymentsApi';
import { inr } from '../../utils/format';
import { Button, Drawer, Field, SelectField, Toggle, useToast } from '../../components/ui';

const MODES = [
  ['Cash', 'Cash at store'],
  ['UPI', 'UPI at store'],
  ['Card', 'Card at store'],
  ['Bank', 'Bank transfer'],
];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const toAmount = (v) => Number(String(v).replace(/[₹,\s]/g, ''));

/**
 * A-24 · Record payment (side sheet). Pass customerId to skip the customer picker.
 * After saving it opens the receipt (A-25), unless stayOnPage is set.
 */
export default function RecordPaymentDrawer({ customerId: fixedId, onClose, onSaved, stayOnPage }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [customerId, setCustomerId] = useState(fixedId ?? '');
  const payers = useApi(() => (fixedId ? Promise.resolve(null) : paymentsApi.payers()), [fixedId]);
  const due = useApi(() => (customerId ? paymentsApi.due(customerId) : Promise.resolve(null)), [customerId]);
  const [v, setV] = useState({ amount: '', mode: 'Cash', reference: '', date: today(), unlock: true, sendReceipt: true });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (due.data) setV((s) => ({ ...s, amount: String(due.data.defaultAmount) }));
  }, [due.data]);

  const d = due.data;
  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined, form: undefined })); };
  const locked = d?.device?.locked;

  const save = async () => {
    const e = {};
    if (!customerId) e.customerId = 'Pick the customer';
    const amount = toAmount(v.amount);
    if (!(amount > 0)) e.amount = 'Enter the amount received';
    if (v.mode !== 'Cash') {
      const ref = v.reference.trim();
      if (!ref) e.reference = 'Enter the reference or UTR';
      else if (v.mode === 'UPI' && !/^\d{12}$/.test(ref)) e.reference = 'UPI UTR is 12 digits';
    }
    if (!v.date) e.date = 'Pick the payment date';
    else if (new Date(v.date) > new Date()) e.date = 'The date can’t be in the future';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const res = await paymentsApi.record({
        customerId, amount, mode: MODES.find(([k]) => k === v.mode)[1], reference: v.reference.trim(), date: v.date,
        unlock: locked ? v.unlock : false, sendReceipt: v.sendReceipt,
      });
      toast(locked && (d?.autoUnlock || v.unlock) ? 'Payment saved · unlock sent' : 'Payment saved');
      onSaved?.(res);
      if (!stayOnPage) navigate(`/payments/${res.id}`);
    } catch (err) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      title="Record payment"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !d} onClick={save}>{saving ? 'Saving…' : locked && v.unlock && !d?.autoUnlock ? 'Save & unlock' : 'Save payment'}</Button>
      </>}
    >
      {!fixedId && (
        <SelectField label="Customer" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setErrors({}); }}
          options={(payers.data ?? []).map((p) => ({ value: p.id, label: `${p.label}${p.overdue ? ' · overdue' : ''}` }))}
          placeholder={payers.loading ? 'Loading…' : 'Select a customer'} error={errors.customerId} />
      )}

      {d && (
        <div className="note" style={{ flexDirection: 'column', gap: 4, background: d.overdueCount ? 'var(--bad-bg)' : 'var(--ground)', color: 'var(--ink)' }}>
          <strong style={{ fontSize: 15 }}>{d.customer.name}{d.device ? ` · ${d.device.name}` : ''}</strong>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            {d.next ? `Installment ${d.next.n} of ${d.months} · due ${d.next.due}` : 'Fully paid'}
            {d.overdueCount > 1 ? ` · ${d.overdueCount} installments overdue` : d.overdueCount ? ' · overdue' : ''}
            {locked ? ' · device locked' : ''}
          </span>
        </div>
      )}

      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

      <Field label="Amount received" inputMode="numeric" value={v.amount} onChange={set('amount')} error={errors.amount} data-autofocus
        hint={d ? (d.feeIncluded ? `${inr(d.defaultAmount - d.feeIncluded)} EMI + ${inr(d.feeIncluded)} late fee` : `${inr(d.defaultAmount)} EMI`) + ' · must cover whole installments' : undefined} />

      <div className="field">
        <span className="field-label">Payment mode</span>
        <div className="choice-row" role="group" aria-label="Payment mode">
          {MODES.map(([k]) => <button key={k} type="button" className="choice" aria-pressed={v.mode === k} onClick={() => setV((s) => ({ ...s, mode: k, reference: k === 'Cash' ? '' : s.reference }))}>{k}</button>)}
        </div>
      </div>

      <Field label={<>Reference or UTR <span className="optional">(not needed for cash)</span></>} placeholder={v.mode === 'UPI' ? '12-digit UTR' : 'Transaction reference'}
        value={v.reference} onChange={set('reference')} disabled={v.mode === 'Cash'} error={errors.reference} className="mono-input" />
      <Field label="Payment date" type="date" max={today()} value={v.date} onChange={set('date')} error={errors.date} />

      <div style={{ height: 1, background: 'var(--line-soft)' }} />
      {locked && d?.autoUnlock && (
        <div className="note" style={{ background: 'var(--ground)', color: 'var(--ink)' }}>
          The device unlocks by itself once no installment is overdue{d.overdueCount > 1 ? ` (all ${d.overdueCount} overdue installments)` : ''}.
        </div>
      )}
      {locked && !d?.autoUnlock && (
        <div className="rule-row">
          <div><strong>Unlock device after saving</strong><span className="sub">Sends the unlock command right away</span></div>
          <Toggle label="Unlock after saving" checked={v.unlock} onChange={(x) => setV((s) => ({ ...s, unlock: x }))} />
        </div>
      )}
      <div className="rule-row">
        <div><strong>Send receipt on WhatsApp</strong><span className="sub">{d ? `To ${d.customer.phone}` : 'To the customer'}</span></div>
        <Toggle label="Send receipt" checked={v.sendReceipt} onChange={(x) => setV((s) => ({ ...s, sendReceipt: x }))} />
      </div>
    </Drawer>
  );
}