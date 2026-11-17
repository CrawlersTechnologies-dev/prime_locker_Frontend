import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { emiApi, monthlyEmi } from '../../services/emiApi';
import { inr } from '../../utils/format';
import { Breadcrumb, Button, Card, Field, FormRow, FormSection, SelectField, StateMessage, Toggle, useToast } from '../../components/ui';
import { isLive } from '../../services/http';
import './emi.css';

const LIVE = isLive('devices');

const TENURES = [3, 6, 9, 12];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toAmount = (v) => Number(String(v).replace(/[₹,\s]/g, ''));
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const label = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** A-20 · Set up EMI (step 3: customer → device → EMI → enrol) */
export default function SetupEmi() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const customers = useApi(() => emiApi.awaitingSetup(), []);
  const plans = useApi(() => emiApi.plans('active'), []);

  const nextMonth = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; }, []);
  const [customerId, setCustomerId] = useState(params.get('customer') ?? '');
  const [planId, setPlanId] = useState('');
  const [v, setV] = useState({ price: '', down: '', fee: '', months: 9, custom: false, firstDue: iso(nextMonth), reminders: true, autoLock: true, graceDays: 3 });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(null);
  const [formError, setFormError] = useState(null);

  const customer = customers.data?.find((c) => c.id === customerId);
  const planOptions = (plans.data?.items ?? []).filter((p) => !customer || p.deviceTypes.includes(customer.device.type));
  const plan = planOptions.find((p) => p.id === planId);

  // A ?customer= link to someone who already has an EMI → let the user pick instead.
  useEffect(() => {
    if (customers.data && customerId && !customers.data.some((c) => c.id === customerId)) setCustomerId('');
  }, [customers.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick a sensible plan and prefill the price once the customer is known.
  useEffect(() => {
    if (!customer || !plans.data) return;
    const best = planOptions.find((p) => p.months === 9) ?? planOptions[0];
    if (best) applyPlan(best, customer.device.price);
    setV((s) => ({ ...s, price: customer.device.price ? String(customer.device.price) : s.price, graceDays: best?.graceDays ?? customer.graceDays }));
  }, [customer?.id, plans.data]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPlan(p, priceOverride) {
    setPlanId(p.id);
    const price = toAmount(priceOverride ?? v.price);
    setV((s) => ({
      ...s, months: p.months, custom: !TENURES.includes(p.months), fee: String(p.fee), graceDays: p.graceDays,
      down: price ? String(Math.ceil((price * p.minDownPct) / 100)) : s.down,
    }));
  }

  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const price = toAmount(v.price);
  const down = toAmount(v.down);
  const months = Number(v.months);
  const { financed, amount } = monthlyEmi(price || 0, down || 0, months || 0);
  const first = new Date(v.firstDue);
  const preview = Number.isNaN(first.getTime()) || !months ? [] : Array.from({ length: months }, (_, i) => new Date(first.getFullYear(), first.getMonth() + i, first.getDate()));

  const validate = (draft) => {
    const e = {};
    if (!customerId) e.customerId = 'Pick the customer';
    if (draft) return e;
    if (!(price > 0)) e.price = 'Enter the device price';
    if (!(down >= 0)) e.down = 'Enter the down payment, or 0';
    else if (price && down >= price) e.down = 'Down payment must be less than the price';
    else if (plan && price && down < Math.ceil((price * plan.minDownPct) / 100)) e.down = `${plan.name} needs at least ${plan.minDownPct}% (${inr(Math.ceil((price * plan.minDownPct) / 100))})`;
    if (!(toAmount(v.fee) >= 0)) e.fee = 'Enter 0 or more';
    if (!(months >= 1 && months <= 36)) e.months = 'Tenure is 1 to 36 months';
    if (Number.isNaN(first.getTime())) e.firstDue = 'Pick the first due date';
    else if (first <= new Date()) e.firstDue = 'The first due date must be in the future';
    return e;
  };

  const save = async (draft) => {
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length) { setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setSaving(draft ? 'draft' : 'active');
    setFormError(null);
    try {
      await emiApi.setup({
        customerId, planId: planId || null, price, down, fee: toAmount(v.fee) || 0, months, firstDue: v.firstDue,
        reminders: v.reminders, autoLock: v.autoLock, graceDays: Number(v.graceDays), draft,
      });
      toast(LIVE ? 'EMI active · the installment schedule is ready' : draft ? 'EMI saved as draft' : 'EMI active · down payment recorded. Next: enrol the device at the store.');
      navigate(draft ? `/customers/${customerId}` : `/emi/${customerId}`, { replace: true });
    } catch (err) { setFormError(err.message); setSaving(null); }
  };

  if (customers.data && customers.data.length === 0 && !customerId) {
    return (
      <div className="page">
        <Breadcrumb items={[{ label: 'EMI plans', to: '/emi-plans' }, { label: 'New EMI' }]} />
        <Card><StateMessage icon="calendar" title="No customers waiting for an EMI" action={!LIVE && <Button to="/customers/new">Add customer</Button>}>
          {LIVE ? 'Every enrolled device already has an EMI. New devices appear here after a retailer enrols them in the Retailer app.' : 'An EMI is set up after a customer’s device is registered. Add a customer and register their device first.'}
        </StateMessage></Card>
      </div>
    );
  }

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: 'EMI plans', to: '/emi-plans' }, { label: 'New EMI' }]} />
      <div className="page-head" style={{ alignItems: 'center' }}>
        <h1 className="h1">Set up EMI</h1>
        <div className="page-actions">
          {!LIVE && <Button variant="secondary" disabled={!!saving} onClick={() => save(true)}>{saving === 'draft' ? 'Saving…' : 'Save draft'}</Button>}
          <Button disabled={!!saving} onClick={() => save(false)}>{saving === 'active' ? 'Activating…' : 'Activate EMI'}</Button>
        </div>
      </div>

      {formError && <div className="form-alert" role="alert">{formError}</div>}

      <div className="form-layout side-360">
        <div className="form-col">
          <FormSection title="Customer & device">
            <FormRow>
              <SelectField label="Customer" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setErrors({}); }}
                options={(customers.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))}
                placeholder={customers.loading ? 'Loading…' : 'Select a customer'} error={errors.customerId} />
              <Field label="Device" value={customer?.device.label ?? ''} readOnly placeholder="Picked with the customer" />
            </FormRow>
          </FormSection>

          <FormSection title="Plan">
            <SelectField label="Template" value={planId} onChange={(e) => applyPlan(planOptions.find((p) => p.id === e.target.value))}
              options={planOptions.map((p) => ({ value: p.id, label: `${p.name} · ${p.months} months · min ${p.minDownPct}% down` }))}
              placeholder={customer ? 'Pick a plan' : 'Pick the customer first'} hint="Fills in the tenure, fee and grace period. You can still change them." />
            <FormRow>
              <Field label="Device price" inputMode="numeric" placeholder="₹" value={v.price} onChange={set('price')} error={errors.price} />
              <Field label="Down payment" inputMode="numeric" placeholder="₹" value={v.down} onChange={set('down')} error={errors.down} />
              <Field label="Processing fee" inputMode="numeric" placeholder="₹" value={v.fee} onChange={set('fee')} error={errors.fee} />
            </FormRow>
            <div className="field">
              <span className="field-label">Tenure</span>
              <div className="choice-row" role="group" aria-label="Tenure">
                {TENURES.map((m) => (
                  <button key={m} type="button" className="choice" aria-pressed={!v.custom && months === m} onClick={() => setV((s) => ({ ...s, months: m, custom: false }))}>{m} months</button>
                ))}
                <button type="button" className="choice" aria-pressed={v.custom} onClick={() => setV((s) => ({ ...s, custom: true }))}>Custom</button>
              </div>
              {v.custom && <Field label="Months" inputMode="numeric" value={String(v.months)} onChange={set('months')} error={errors.months} />}
            </div>
            <FormRow>
              <Field label="First due date" type="date" min={iso(new Date())} value={v.firstDue} onChange={set('firstDue')} error={errors.firstDue} />
              <Field label="Due every month on" value={Number.isNaN(first.getTime()) ? '' : ordinal(first.getDate())} readOnly />
            </FormRow>
          </FormSection>

          {LIVE ? (
            <FormSection title="Reminders & lock rules">
              <span className="sub">The device locks automatically 3 days after a missed due date and unlocks when the payment is recorded. Reminders show on the device screen.</span>
            </FormSection>
          ) : (
          <FormSection title="Reminders & lock rules">
            <div className="rule-row">
              <div><strong>WhatsApp reminders</strong><span className="sub">3 days before, and on the due date</span></div>
              <Toggle label="WhatsApp reminders" checked={v.reminders} onChange={(x) => setV((s) => ({ ...s, reminders: x }))} />
            </div>
            <div className="rule-row">
              <div><strong>Auto-lock after grace period</strong><span className="sub">Grace period: {v.graceDays} days · unlocks when payment is recorded</span></div>
              <Toggle label="Auto-lock" checked={v.autoLock} onChange={(x) => setV((s) => ({ ...s, autoLock: x }))} />
            </div>
          </FormSection>
          )}
        </div>

        <div className="form-col">
          <section className="emi-hero" aria-live="polite">
            <span>Monthly EMI</span>
            <b>{amount ? inr(amount) : '—'}</b>
            <span>× {months || '—'} months · {inr(financed)} financed{toAmount(v.fee) ? ` · ${inr(toAmount(v.fee))} fee at signing` : ''}</span>
          </section>
          <Card style={{ padding: '20px 24px' }}>
            <h2 className="h2" style={{ paddingBottom: 8 }}>Schedule</h2>
            {preview.length === 0 && <span className="sub">Fill in the plan to see the dates.</span>}
            {preview.slice(0, months > 6 ? 4 : months).map((d, i) => (
              <div key={i} className="sch-row"><span>{i + 1} · {label(d)}</span><span>{amount ? inr(amount) : '—'}</span></div>
            ))}
            {months > 6 && <>
              <div className="sch-row"><span>…</span><span /></div>
              <div className="sch-row"><span>{months} · {label(preview[months - 1])}</span><span>{amount ? inr(amount) : '—'}</span></div>
            </>}
          </Card>
        </div>
      </div>
    </div>
  );
}