import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { emiApi } from '../../services/emiApi';
import { P } from '../../config/permissions';
import { inr, num } from '../../utils/format';
import {
  Badge, Button, Card, Checkbox, Dialog, ErrorBlock, Field, FilterBar, FilterChips, FormRow, KeyValue, LoadingBlock, PageHeader, SelectField, useToast,
} from '../../components/ui';
import { isLive } from '../../services/http';
import './emi.css';

const TENURES = [3, 6, 9, 10, 12, 18, 24];
const LIVE = isLive('emi');
// The backend has one device type per plan: Mobile, Smart TV, or both.
const TYPES = LIVE ? [['mobile', 'Mobile phones'], ['tv', 'Smart TVs']] : [['android', 'Android phones'], ['iphone', 'iPhones'], ['tv', 'Smart TVs']];
const OFF = LIVE ? 'Inactive' : 'Draft';

/** A-19 · EMI plans (templates) */
export default function EmiPlans() {
  const { can } = useAuth();
  const [f, setF] = useQueryState({ status: 'all' });
  const { data, loading, error, reload } = useApi(() => emiApi.plans(f.status), [f.status]);
  const [editing, setEditing] = useState(null); // { plan?, mode: 'new' | 'edit' | 'copy' }
  const [toggling, setToggling] = useState(null);
  const toast = useToast();
  const toggle = async (p) => {
    setToggling(p.id);
    try { await emiApi.togglePlan(p.id); toast(p.status === 'active' ? `${p.name} is now inactive` : `${p.name} is live for retailers`); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setToggling(null); }
  };

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  const manage = can(P.EMI_TEMPLATES);

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="EMI plans"
        subtitle="Plan templates retailers pick from when selling a device"
        actions={<>
          <Button variant="secondary" to="/emi/overdue">Overdue EMIs</Button>
          {can(P.EMI_CREATE) && <Button variant="secondary" to="/emi/new">Set up EMI</Button>}
          {manage && <Button icon="plus" onClick={() => setEditing({ mode: 'new' })}>New plan</Button>}
        </>}
      />
      <FilterBar>
        <FilterChips label="Plan status" value={f.status} onChange={(status) => setF({ status })} options={[
          { value: 'all', label: 'All', count: data.counts.all },
          { value: 'active', label: 'Active', count: data.counts.active },
          { value: 'draft', label: OFF, count: data.counts.draft },
        ]} />
      </FilterBar>

      <div className="plan-grid">
        {data.items.map((p) => (
          <Card as="article" key={p.id} className="plan-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div className="cell-stack" style={{ gap: 4 }}><span style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</span><span className="sub">{p.description}</span></div>
              <Badge tone={p.status === 'active' ? 'ok' : 'mute'}>{p.status === 'active' ? 'Active' : OFF}</Badge>
            </div>
            <div className="plan-price"><b>{p.months}</b><span className="sub">months</span></div>
            <KeyValue items={[
              ['Minimum down payment', `${p.minDownPct}%`],
              ['Processing fee', inr(p.fee)],
              data.live && ['Interest', `${p.interestPct}%`],
              data.live && ['For', p.deviceTypes.length > 1 ? 'Mobiles and Smart TVs' : p.deviceTypes[0] === 'tv' ? 'Smart TVs' : 'Mobiles'],
              ['Grace before auto-lock', `${p.graceDays} ${p.graceDays === 1 ? 'day' : 'days'}`],
              [data.live ? 'Active EMIs on plan' : 'Customers on plan', p.customers == null ? '—' : num(p.customers)],
            ]} />
            {manage && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" block onClick={() => setEditing({ plan: p, mode: 'edit' })}>Edit</Button>
                <Button variant="secondary" size="sm" block onClick={() => setEditing({ plan: p, mode: 'copy' })}>Duplicate</Button>
                {data.live && <Button variant="secondary" size="sm" block disabled={toggling === p.id} onClick={() => toggle(p)}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</Button>}
              </div>
            )}
          </Card>
        ))}
      </div>
      {data.items.length === 0 && <Card><p className="sub" style={{ padding: 8 }}>No plans yet. Create the first plan retailers can pick when they sell a device.</p></Card>}

      {editing && <PlanDialog {...editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

/** New / edit / duplicate a plan template (no design screen — uses the same fields as the cards). */
function PlanDialog({ plan, mode, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState(() => ({
    name: mode === 'copy' ? `${plan.name} (copy)` : plan?.name ?? '',
    description: plan?.description ?? '',
    months: String(plan?.months ?? 12), minDownPct: String(plan?.minDownPct ?? 20), fee: String(plan?.fee ?? 499),
    graceDays: String(plan?.graceDays ?? 3), deviceTypes: plan?.deviceTypes ?? [LIVE ? 'mobile' : 'android'], interestPct: String(plan?.interestPct ?? 0),
    status: mode === 'edit' ? plan.status : 'draft',
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const toggleType = (t) => (e) => setV((s) => ({ ...s, deviceTypes: e.target.checked ? [...s.deviceTypes, t] : s.deviceTypes.filter((x) => x !== t) }));

  const save = async (status) => {
    const e = {};
    if (!v.name.trim()) e.name = 'Give the plan a name';
    const pct = Number(v.minDownPct);
    if (!(pct >= 0 && pct <= 90)) e.minDownPct = 'Between 0 and 90%';
    if (!(Number(v.fee) >= 0)) e.fee = 'Enter 0 or more';
    if (LIVE && !(Number(v.interestPct) >= 0 && Number(v.interestPct) <= 100)) e.interestPct = 'Between 0 and 100%';
    if (!v.deviceTypes.length) e.deviceTypes = 'Pick at least one device type';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await emiApi.savePlan({
        name: v.name.trim(), description: v.description.trim(), months: Number(v.months), minDownPct: pct, fee: Number(v.fee),
        graceDays: Number(v.graceDays), deviceTypes: v.deviceTypes, status, interestPct: Number(v.interestPct),
      }, mode === 'edit' ? plan.id : undefined, mode === 'edit' ? plan.status : undefined);
      toast(status === 'active' ? 'Plan is live for retailers' : `Plan saved as ${OFF.toLowerCase()}`);
      onDone();
    } catch (err) { setErrors({ name: err.message }); setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} width={560}
      title={mode === 'edit' ? `Edit ${plan.name}` : mode === 'copy' ? 'Duplicate plan' : 'New plan'}
      subtitle={mode === 'edit' && plan.customers ? `Changes apply to new EMIs only. The ${num(plan.customers)} customers already on this plan keep their terms.` : 'Retailers see active plans when they sell a device.'}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button variant="secondary" disabled={busy} onClick={() => save('draft')}>Save as {OFF.toLowerCase()}</Button>
        <Button disabled={busy} onClick={() => save('active')}>{v.status === 'active' ? 'Save' : 'Save & activate'}</Button>
      </>}>
      <FormRow>
        <Field label="Plan name" value={v.name} onChange={set('name')} error={errors.name} data-autofocus />
        <SelectField label="Tenure" value={v.months} onChange={set('months')} options={[...new Set([...TENURES, Number(v.months)])].sort((x, y) => x - y).map((m) => ({ value: String(m), label: `${m} months` }))} />
      </FormRow>
      <Field label={<>Description <span className="optional">(shown to retailers)</span></>} value={v.description} onChange={set('description')} />
      <FormRow>
        <Field label="Minimum down payment %" inputMode="numeric" value={v.minDownPct} onChange={set('minDownPct')} error={errors.minDownPct} />
        <Field label="Processing fee ₹" inputMode="numeric" value={v.fee} onChange={set('fee')} error={errors.fee} />
        <SelectField label="Grace before auto-lock" value={v.graceDays} onChange={set('graceDays')} options={[...new Set([0, 1, 2, 3, 5, 7, Number(v.graceDays)])].sort((a, b) => a - b).map((d) => ({ value: String(d), label: `${d} ${d === 1 ? 'day' : 'days'}` }))} />
      </FormRow>
      {LIVE && <Field label="Interest % over the tenure" inputMode="decimal" value={v.interestPct} onChange={set('interestPct')} error={errors.interestPct} hint="0 for a zero-interest EMI. Added on top of the financed amount." />}
      <div className="field">
        <span className="field-label">For</span>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {TYPES.map(([t, label]) => <Checkbox key={t} label={label} checked={v.deviceTypes.includes(t)} onChange={toggleType(t)} />)}
        </div>
        {errors.deviceTypes && <span className="field-error">{errors.deviceTypes}</span>}
      </div>
    </Dialog>
  );
}