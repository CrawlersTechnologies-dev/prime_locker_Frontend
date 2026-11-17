import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { offersApi, OFFER_TYPES, OFFER_AUDIENCE, offerTypeLabel, audienceLabel } from '../../services/Offersapi';
import { inr, num } from '../../utils/format';
import {
  Badge, Button, Card, Checkbox, Dialog, ErrorBlock, Field, FilterBar, FormRow, KeyValue, LoadingBlock, MediaImg, PageHeader,
  SelectFilter, SelectField, StateMessage, UploadBox, useToast,
} from '../../components/ui';
import '../emi/emi.css';
import './insights.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : null; };
const isoDay = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''; };

function offerState(o) {
  if (!o.active) return ['mute', 'Paused'];
  if (o.live) return ['ok', 'Running'];
  if (o.validFrom && new Date(o.validFrom) > new Date()) return ['info', 'Scheduled'];
  return ['mute', 'Ended'];
}

function offerValue(o) {
  if (o.type === 'KEY_BONUS' && o.bonusKeys) return `${num(o.bonusKeys)} free keys${o.minKeys ? ` on ${num(o.minKeys)}+` : ''}`;
  if (o.type === 'DISCOUNT' && o.discountPct) return `${o.discountPct}% off`;
  if (o.discountAmount) return `${inr(o.discountAmount)} ${o.type === 'CASHBACK' ? 'cashback' : 'off'}`;
  return offerTypeLabel(o.type);
}

/** A-47 · Offers & promotions shown in the partner panel and the mobile apps. */
export default function Offers() {
  const toast = useToast();
  const [f, setF] = useQueryState({ audience: '' });
  const { data, loading, error, reload } = useApi(() => offersApi.list(f), [f.audience]);
  const [editing, setEditing] = useState(null); // { offer? }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const toggle = async (o) => {
    setBusy(o.id);
    try { await offersApi.toggle(o.id); toast(o.active ? `${o.title} paused` : `${o.title} is on`); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy(deleting.id);
    try { await offersApi.remove(deleting.id); toast('Offer deleted'); setDeleting(null); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Offers"
        subtitle={`${num(data.counts.running)} running · ${num(data.counts.all)} in total. Partners and customers see running offers meant for them.`}
        actions={<Button icon="plus" onClick={() => setEditing({})}>New offer</Button>}
      />
      <FilterBar>
        <SelectFilter label="For" allLabel="Everyone and all levels" value={f.audience} onChange={(audience) => setF({ audience })} options={OFFER_AUDIENCE} />
      </FilterBar>

      {data.items.length === 0 ? (
        <Card>
          <StateMessage icon="send" title="No offers yet" action={<Button icon="plus" onClick={() => setEditing({})}>New offer</Button>}>
            Create a key bonus, festive scheme or announcement for your partners or customers.
          </StateMessage>
        </Card>
      ) : (
        <div className="plan-grid">
          {data.items.map((o) => {
            const [tone, label] = offerState(o);
            return (
              <Card as="article" key={o.id} className="plan-card">
                {o.banner && <MediaImg className="offer-banner" src={o.banner} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div className="cell-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{o.title}</span>
                    <span className="sub">{o.description}</span>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <div className="offer-value">{offerValue(o)}</div>
                <KeyValue items={[
                  ['For', audienceLabel(o.audience)],
                  ['Type', offerTypeLabel(o.type)],
                  o.promoCode && ['Promo code', <span className="mono" key="c">{o.promoCode}</span>],
                  ['Runs', `${short(o.validFrom) ?? 'Now'} → ${short(o.validTo) ?? 'no end date'}`],
                ]} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" size="sm" block onClick={() => setEditing({ offer: o })}>Edit</Button>
                  <Button variant="secondary" size="sm" block disabled={busy === o.id} onClick={() => toggle(o)}>{o.active ? 'Pause' : 'Turn on'}</Button>
                  <Button variant="secondary" size="sm" onClick={() => setDeleting(o)} aria-label={`Delete ${o.title}`} icon="close" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <OfferDialog offer={editing.offer} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} role="alertdialog" icon="alert" title={`Delete ${deleting?.title ?? 'offer'}?`}
        subtitle="It disappears from the panel and the apps straight away. Pause it instead if you may run it again."
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy === deleting?.id} onClick={remove}>Delete offer</Button>
        </>} />
    </div>
  );
}

function OfferDialog({ offer, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState(() => ({
    title: offer?.title ?? '',
    description: offer?.description ?? '',
    audience: offer?.audience ?? 'ALL',
    type: offer?.type ?? 'GENERAL',
    promoCode: offer?.promoCode ?? '',
    discountPct: offer?.discountPct != null ? String(offer.discountPct) : '',
    discountAmount: offer?.discountAmount != null ? String(offer.discountAmount) : '',
    bonusKeys: offer?.bonusKeys != null ? String(offer.bonusKeys) : '',
    minKeys: offer?.minKeys != null ? String(offer.minKeys) : '',
    validFrom: isoDay(offer?.validFrom) || isoDay(new Date()),
    validTo: isoDay(offer?.validTo),
    active: offer ? offer.active : true,
    banner: null,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setV((s) => ({ ...s, [k]: value }));
    setErrors((x) => ({ ...x, [k]: undefined, form: undefined }));
  };

  const save = async () => {
    const e = {};
    if (!v.title.trim()) e.title = 'Give the offer a title';
    if (!v.description.trim()) e.description = 'Say what the offer is';
    const n = (x) => x === '' || (Number(x) >= 0 && !Number.isNaN(Number(x)));
    if (!n(v.discountPct) || Number(v.discountPct) > 100) e.discountPct = 'Between 0 and 100';
    if (!n(v.discountAmount)) e.discountAmount = 'Enter an amount';
    if (!(v.bonusKeys === '' || Number.isInteger(Number(v.bonusKeys)))) e.bonusKeys = 'Whole number of keys';
    if (!(v.minKeys === '' || Number.isInteger(Number(v.minKeys)))) e.minKeys = 'Whole number of keys';
    if (v.validTo && v.validFrom && v.validTo < v.validFrom) e.validTo = 'Ends before it starts';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await offersApi.save(v, offer?.id);
      toast(offer ? 'Offer updated' : v.active ? 'Offer is on' : 'Offer saved, paused');
      onDone();
    } catch (err) { setErrors({ form: err.message }); setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} width={600} title={offer ? `Edit ${offer.title}` : 'New offer'}
      subtitle="Running offers show in the partner panel and the apps of the people you pick."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save offer'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <Field label="Title" value={v.title} onChange={set('title')} error={errors.title} placeholder="Diwali bonus keys" data-autofocus />
      <div className="field">
        <label className="field-label" htmlFor="offer-desc">Description</label>
        <textarea id="offer-desc" className="textarea" value={v.description} onChange={set('description')} placeholder="Buy 100 keys before 15 Nov and get 10 free." />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </div>
      <FormRow>
        <SelectField label="Show to" value={v.audience} onChange={set('audience')} options={OFFER_AUDIENCE} />
        <SelectField label="Type" value={v.type} onChange={set('type')} options={OFFER_TYPES} />
      </FormRow>
      {v.type === 'KEY_BONUS' && (
        <FormRow>
          <Field label="Free keys" inputMode="numeric" value={v.bonusKeys} onChange={set('bonusKeys')} error={errors.bonusKeys} />
          <Field label={<>Minimum keys bought <span className="optional">(optional)</span></>} inputMode="numeric" value={v.minKeys} onChange={set('minKeys')} error={errors.minKeys} />
        </FormRow>
      )}
      {v.type === 'DISCOUNT' && (
        <FormRow>
          <Field label={<>Discount % <span className="optional">(or an amount)</span></>} inputMode="decimal" value={v.discountPct} onChange={set('discountPct')} error={errors.discountPct} />
          <Field label={<>Discount ₹ <span className="optional">(optional)</span></>} inputMode="decimal" value={v.discountAmount} onChange={set('discountAmount')} error={errors.discountAmount} />
        </FormRow>
      )}
      {v.type === 'CASHBACK' && (
        <Field label="Cashback ₹" inputMode="decimal" value={v.discountAmount} onChange={set('discountAmount')} error={errors.discountAmount} />
      )}
      <FormRow>
        <Field label={<>Promo code <span className="optional">(optional)</span></>} value={v.promoCode} onChange={(e) => set('promoCode')({ target: { value: e.target.value.toUpperCase() } })} className="mono-input" placeholder="DIWALI10" />
        <Field label="Starts" type="date" value={v.validFrom} onChange={set('validFrom')} />
        <Field label={<>Ends <span className="optional">(optional)</span></>} type="date" min={v.validFrom} value={v.validTo} onChange={set('validTo')} error={errors.validTo} />
      </FormRow>
      <UploadBox label={offer?.banner && !v.banner ? 'Replace banner image (optional)' : 'Banner image (optional)'} accept="image/*" file={v.banner} onFile={set('banner')} wide />
      <Checkbox label="Turn the offer on now" checked={v.active} onChange={set('active')} />
    </Dialog>
  );
}
