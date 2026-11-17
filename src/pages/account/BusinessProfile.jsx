import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { authApi } from '../../services/authApi';
import {
  Button, Card, ErrorBlock, Field, FormRow, FormSection, KeyValue, LoadingBlock, MediaImg, PageHeader, UploadBox, useToast,
} from '../../components/ui';

const ROLE = { SUPER_DISTRIBUTOR: 'Super distributor', DISTRIBUTOR: 'Distributor', SUB_DISTRIBUTOR: 'Sub distributor', RETAILER: 'Retailer' };
const blank = (p) => ({
  name: p?.name && p.name !== p.business_name ? p.name : [p?.first_name, p?.last_name].filter(Boolean).join(' '),
  businessName: p?.business_name ?? '',
  storePhone: p?.store_phone ?? '',
  address: p?.address ?? '',
  city: p?.city ?? '',
  state: p?.state ?? '',
  pincode: p?.pincode ?? '',
  logo: null,
});

/** Partner business profile — GET/PATCH /auth/me/ (name, business name, store phone, address, logo). */
export default function BusinessProfile() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const { data: p, loading, error, reload } = useApi(() => authApi.profile(), []);
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (p) setV(blank(p)); }, [p]);

  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  if (loading || !v) return <LoadingBlock rows={3} />;

  const set = (k) => (e) => { const val = e?.target ? e.target.value : e; setV((s) => ({ ...s, [k]: val })); setErrors((x) => ({ ...x, [k]: undefined, form: undefined })); };
  const save = async () => {
    const e = {};
    if (!v.name.trim()) e.name = 'Enter your name';
    if (!v.businessName.trim()) e.businessName = 'Enter the business name';
    const phone = v.storePhone.replace(/\D/g, '');
    if (v.storePhone && phone.length < 10) e.storePhone = 'Enter a 10-digit number';
    if (v.pincode && !/^\d{6}$/.test(v.pincode.trim())) e.pincode = 'PIN code is 6 digits';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await authApi.updateProfile(v);
      toast('Business profile saved');
      await refreshUser();
      reload();
    } catch (err) { setErrors({ form: err.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader title="Business profile" subtitle="Shown to your network and on receipts from your stores." />
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <div className="form-layout">
        <div className="form-col">
          <FormSection title="Business">
            <Field label="Business name" value={v.businessName} onChange={set('businessName')} error={errors.businessName} />
            <FormRow>
              <Field label="Your name" value={v.name} onChange={set('name')} error={errors.name} />
              <Field label={<>Store phone <span className="optional">(optional)</span></>} type="tel" inputMode="numeric" value={v.storePhone} onChange={set('storePhone')} error={errors.storePhone} />
            </FormRow>
          </FormSection>
          <FormSection title="Address">
            <Field label="Address" value={v.address} onChange={set('address')} />
            <FormRow>
              <Field label="City" value={v.city} onChange={set('city')} />
              <Field label="State" value={v.state} onChange={set('state')} />
              <Field label="PIN code" inputMode="numeric" maxLength={6} value={v.pincode} onChange={set('pincode')} error={errors.pincode} />
            </FormRow>
          </FormSection>
          <FormSection title="Logo" subtitle="A square image works best.">
            {p.logo && !v.logo && <MediaImg src={p.logo} alt="Current logo" style={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--line)' }} />}
            <UploadBox label={p.logo ? 'Replace logo' : 'Upload logo'} accept="image/*" file={v.logo} onFile={set('logo')} />
          </FormSection>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => { setV(blank(p)); setErrors({}); }}>Discard changes</Button>
          </div>
        </div>
        <div className="form-col">
          <Card style={{ padding: '20px 24px' }}>
            <h2 className="h2" style={{ paddingBottom: 6 }}>Account</h2>
            <KeyValue items={[
              ['Role', ROLE[p.role] ?? p.role],
              ['Mobile', p.mobile_number || '—'],
              ['Email', p.email || '—'],
              p.parent && ['Reports to', p.parent.business_name || p.parent.name || '—'],
              (p.gst_number || p.pan_number) && ['GST / PAN', [p.gst_number, p.pan_number].filter(Boolean).join(' · ')],
            ]} />
            <p className="sub" style={{ margin: '12px 0 0' }}>To change your mobile, email, GST or PAN, ask the company admin.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
