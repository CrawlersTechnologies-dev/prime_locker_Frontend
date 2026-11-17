import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { adminApi, ADMIN_LIVE } from '../../services/adminApi';
import { num } from '../../utils/format';
import {
  Badge, Button, Card, Checkbox, Dialog, ErrorBlock, Field, FormRow, KeyValue, LoadingBlock, MediaImg, PageHeader,
  SelectField, StateMessage, UploadBox, useToast,
} from '../../components/ui';
import { NeedsServer } from './Staff';
import '../emi/emi.css';
import '../insights/insights.css';

// Banner.TARGET_ROLES on the backend.
const AUDIENCE = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'RETAILER', label: 'Retailers' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'SUPER_DISTRIBUTOR', label: 'Super distributors' },
  { value: 'DISTRIBUTOR', label: 'Distributors' },
  { value: 'SUB_DISTRIBUTOR', label: 'Sub distributors' },
];
const audienceLabel = (v) => AUDIENCE.find((a) => a.value === v)?.label ?? v;

/** A-46 · App banners shown at the top of the Retailer and Customer apps (GET/POST /banners/). */
export default function Banners() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => (ADMIN_LIVE ? adminApi.banners() : Promise.resolve(null)), []);
  const [editing, setEditing] = useState(null); // { banner? }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);

  if (!ADMIN_LIVE) return <NeedsServer title="App banners" />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  if (loading && !data) return <LoadingBlock />;

  const toggle = async (b) => {
    setBusy(b.id);
    try { await adminApi.setBannerActive(b.id, !b.active); toast(b.active ? `${b.title} hidden` : `${b.title} is showing`); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy(deleting.id);
    try { await adminApi.deleteBanner(deleting.id); toast('Banner deleted'); setDeleting(null); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };
  const showing = data.filter((b) => b.active).length;

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="App banners"
        subtitle={`${num(showing)} showing · ${num(data.length)} in total. Banners appear at the top of the apps, lowest order number first.`}
        actions={<Button icon="plus" onClick={() => setEditing({})}>New banner</Button>}
      />

      {data.length === 0 ? (
        <Card>
          <StateMessage icon="image" title="No banners yet" action={<Button icon="plus" onClick={() => setEditing({})}>New banner</Button>}>
            Add an image for a festive offer, a new EMI plan or a notice to retailers and customers.
          </StateMessage>
        </Card>
      ) : (
        <div className="plan-grid">
          {data.map((b) => (
            <Card as="article" key={b.id} className="plan-card">
              {b.image && <MediaImg className="offer-banner" src={b.image} alt={b.title} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{b.title}</span>
                <Badge tone={b.active ? 'ok' : 'mute'}>{b.active ? 'Showing' : 'Hidden'}</Badge>
              </div>
              <KeyValue items={[
                ['Shown to', audienceLabel(b.audience)],
                ['Order', String(b.order)],
                b.link && ['Opens', <a key="l" href={b.link} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{b.link}</a>],
                ['Changed', b.updatedAt],
              ]} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" block onClick={() => setEditing({ banner: b })}>Edit</Button>
                <Button variant="secondary" size="sm" block disabled={busy === b.id} onClick={() => toggle(b)}>{b.active ? 'Hide' : 'Show'}</Button>
                <Button variant="secondary" size="sm" onClick={() => setDeleting(b)} aria-label={`Delete ${b.title}`} icon="close" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <BannerDialog banner={editing.banner} nextOrder={data.length} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} role="alertdialog" icon="alert" title={`Delete ${deleting?.title ?? 'banner'}?`}
        subtitle="It disappears from the apps straight away. Hide it instead if you may use it again."
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy === deleting?.id} onClick={remove}>Delete banner</Button>
        </>} />
    </div>
  );
}

function BannerDialog({ banner, nextOrder, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState(() => ({
    title: banner?.title ?? '',
    link: banner?.link ?? '',
    audience: banner?.audience ?? 'ALL',
    order: String(banner?.order ?? nextOrder),
    active: banner ? banner.active : true,
    image: null,
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
    if (!v.title.trim()) e.title = 'Give the banner a title';
    if (v.link.trim() && !/^https?:\/\/\S+$/.test(v.link.trim())) e.link = 'Start the link with https://';
    if (!Number.isInteger(Number(v.order)) || Number(v.order) < 0) e.order = 'Whole number, 0 or more';
    if (!banner && !v.image) e.image = 'Add an image';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await adminApi.saveBanner(v, banner?.id);
      toast(banner ? 'Banner updated' : v.active ? 'Banner is showing' : 'Banner saved, hidden');
      onDone();
    } catch (err) { setErrors({ form: err.message }); setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} width={560} title={banner ? `Edit ${banner.title}` : 'New banner'}
      subtitle="Use a wide image, about 3:1 (for example 1200 × 400)."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save banner'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <Field label="Title" value={v.title} onChange={set('title')} error={errors.title} placeholder="Diwali EMI offer" data-autofocus />
      <FormRow>
        <SelectField label="Show to" value={v.audience} onChange={set('audience')} options={AUDIENCE} />
        <Field label="Order" inputMode="numeric" value={v.order} onChange={set('order')} error={errors.order} hint="0 shows first" />
      </FormRow>
      <Field label={<>Link <span className="optional">(optional)</span></>} type="url" value={v.link} onChange={set('link')} error={errors.link} placeholder="https://primelocker.pro/offers" />
      <UploadBox label={banner ? 'Replace image (optional)' : 'Banner image'} accept="image/*" file={v.image} onFile={set('image')} error={errors.image} wide />
      <Checkbox label="Show it in the apps now" checked={v.active} onChange={set('active')} />
    </Dialog>
  );
}
