import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { retailersApi } from '../../services/retailersApi';
import { isLive } from '../../services/http';

const LIVE = isLive('partners');
import { P } from '../../config/permissions';
import { LEVELS } from '../../config/roles';
import { isIndianMobile } from '../../utils/format';
import {
  Breadcrumb, Button, Checkbox, ErrorBlock, Field, FormRow, FormSection, Icon, LoadingBlock,
  SelectField, UploadBox, Card, useToast,
} from '../../components/ui';

const EMPTY = {
  store: '', gstin: '', storePhone: '', email: '',
  owner: '', ownerMobile: '', idProof: null,
  address: '', city: '', district: '', pin: '',
  allowedDevices: { android: true, iphone: true, tv: false },
  gracePeriodDays: '3', maxDevicesOnEmi: '500',
  subDistributorId: '',
  state: 'Karnataka', pan: '', password: '', confirm: '',
};

const GRACE_OPTIONS = [1, 2, 3, 5, 7, 10].map((d) => ({ value: String(d), label: `${d} ${d === 1 ? 'day' : 'days'}` }));

function validate(v, { isEdit, needsParent }) {
  const e = {};
  if (LIVE) {
    // Email is the login.
    if (!v.store.trim()) e.store = 'Enter the store name';
    if (v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(v.gstin.trim())) e.gstin = 'GSTIN is 15 characters, like 29ABCDE1234F1Z5';
    if (v.pan && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(v.pan.trim())) e.pan = 'PAN is 10 characters, like ABCDE1234F';
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email. The owner signs in with it.';
    if (!v.owner.trim()) e.owner = 'Enter the owner’s name';
    if (!isIndianMobile(v.ownerMobile)) e.ownerMobile = 'Enter a 10-digit mobile number';
    if (!v.address.trim()) e.address = 'Enter the shop address';
    if (!v.city.trim()) e.city = 'Enter the city';
    if (!v.state.trim()) e.state = 'Enter the state';
    if (!/^\d{6}$/.test(v.pin.trim())) e.pin = 'PIN code is 6 digits';
    if (needsParent && !v.subDistributorId) e.subDistributorId = 'Pick who this store sits under';
    if (v.storePhone && v.storePhone.replace(/\D/g, '').length < 10) e.storePhone = 'Phone number needs at least 10 digits';
    if (!v.allowedDevices.android && !v.allowedDevices.iphone && !v.allowedDevices.tv) e.allowedDevices = 'Allow at least one device type';
    if (!(Number(v.maxDevicesOnEmi) >= 1)) e.maxDevicesOnEmi = 'Enter 1 or more';
    if (!isEdit) {
      if (v.password.length < 8) e.password = 'Use at least 8 characters';
      else if (v.password !== v.confirm) e.confirm = 'Passwords don’t match';
    }
    return e;
  }
  if (!v.store.trim()) e.store = 'Enter the store name';
  if (v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(v.gstin.trim())) e.gstin = 'GSTIN is 15 characters, like 29ABCDE1234F1Z5';
  if (!v.storePhone.trim()) e.storePhone = 'Enter the store phone';
  else if (v.storePhone.replace(/\D/g, '').length < 10) e.storePhone = 'Phone number needs at least 10 digits';
  if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email, like store@example.com';
  if (!v.owner.trim()) e.owner = 'Enter the owner’s name';
  if (!isIndianMobile(v.ownerMobile)) e.ownerMobile = 'Enter a 10-digit mobile number';
  if (!isEdit && !v.idProof) e.idProof = 'Upload the owner’s ID proof';
  if (!v.address.trim()) e.address = 'Enter the shop address';
  if (!v.city.trim()) e.city = 'Enter the city';
  if (!v.district.trim()) e.district = 'Enter the district';
  if (!/^\d{6}$/.test(v.pin.trim())) e.pin = 'PIN code is 6 digits';
  if (!Object.values(v.allowedDevices).some(Boolean)) e.allowedDevices = 'Pick at least one device type';
  if (!(Number(v.maxDevicesOnEmi) > 0)) e.maxDevicesOnEmi = 'Enter a number above 0';
  if (needsParent && !v.subDistributorId) e.subDistributorId = 'Pick the sub distributor this store sits under';
  return e;
}

/** A-05 · Add retailer — also used for editing (/retailers/:id/edit). */
export default function RetailerForm() {
  const { retailerId } = useParams();
  const isEdit = Boolean(retailerId);
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isCompany = user.level === LEVELS.COMPANY;
  const needsParent = !isEdit && isCompany;

  const existing = useApi(() => (isEdit ? retailersApi.get(retailerId) : Promise.resolve(null)), [retailerId]);
  const parents = useApi(() => (needsParent ? retailersApi.parentOptions() : Promise.resolve([])), [needsParent]);

  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setV({
      ...EMPTY, ...r,
      gstin: r.gstin ?? '', storePhone: r.storePhone ?? '', email: r.email ?? '',
      gracePeriodDays: String(r.gracePeriodDays ?? 3), maxDevicesOnEmi: String(r.maxDevicesOnEmi ?? 500), idProof: null,
      owner: r.owner ?? '', ownerMobile: r.ownerMobile ?? '', address: r.address ?? '', city: r.city ?? '',
      district: r.district ?? '', pin: r.pin ?? '', state: r.state ?? '', pan: r.pan ?? '',
      allowedDevices: r.allowedDevices ?? EMPTY.allowedDevices, password: '', confirm: '',
    });
  }, [existing.data]);

  const set = (k) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const setDevice = (k) => (e) => {
    setV((s) => ({ ...s, allowedDevices: { ...s.allowedDevices, [k]: e.target.checked } }));
    setErrors((x) => ({ ...x, allowedDevices: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, { isEdit, needsParent });
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector('[aria-invalid="true"], .upload.has-error')?.focus();
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...v,
        gracePeriodDays: Number(v.gracePeriodDays),
        maxDevicesOnEmi: Number(v.maxDevicesOnEmi),
        gstin: v.gstin.trim().toUpperCase() || null,
        ...(LIVE ? { email: v.email.trim().toLowerCase(), pan: v.pan.trim().toUpperCase(), state: v.state.trim() } : {}),
      };
      const saved = await retailersApi.save(payload, retailerId);
      toast(isEdit ? 'Retailer updated'
        : LIVE ? `Retailer added · the owner signs in with ${v.email.trim().toLowerCase()}`
        : saved.status === 'pending' ? 'Retailer saved · waiting for approval' : 'Retailer added');
      navigate(`/retailers/${saved.id}`, { replace: true });
    } catch (err) {
      setFormError(err.message);
      setSaving(false);
    }
  };

  if (isEdit && existing.loading) return <LoadingBlock rows={3} />;
  if (isEdit && existing.error) return <div className="page"><Card><ErrorBlock error={existing.error} onRetry={existing.reload} /></Card></div>;

  const cancelTo = isEdit ? `/retailers/${retailerId}` : '/retailers';
  const approvesOwnAdds = can(P.RETAILERS_APPROVE);

  return (
    <form className="page" style={{ gap: 20 }} onSubmit={submit} noValidate>
      <Breadcrumb items={[
        { label: 'Retailers', to: '/retailers' },
        ...(isEdit ? [{ label: existing.data?.store, to: cancelTo }, { label: 'Edit' }] : [{ label: 'New retailer' }]),
      ]} />
      <div className="page-head" style={{ alignItems: 'center' }}>
        <h1 className="h1">{isEdit ? 'Edit retailer' : 'Add retailer'}</h1>
        <div className="page-actions">
          <Button variant="secondary" to={cancelTo}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save retailer'}</Button>
        </div>
      </div>

      {formError && <div className="form-alert" role="alert">{formError}</div>}

      <div className="form-layout">
        <div className="form-col">
          <FormSection title="Store details" subtitle="Shown on customer receipts and the lock screen.">
            <FormRow>
              <Field label="Store name" value={v.store} onChange={set('store')} error={errors.store} />
              <Field label={<>GSTIN <span className="optional">(optional)</span></>} placeholder="29ABCDE1234F1Z5" value={v.gstin} onChange={set('gstin')} error={errors.gstin} className="mono-input" />
            </FormRow>
            {LIVE ? (
              <FormRow>
                <Field label={<>Store phone <span className="optional">(optional)</span></>} type="tel" inputMode="tel" value={v.storePhone} onChange={set('storePhone')} error={errors.storePhone} />
                <Field label={<>PAN <span className="optional">(optional)</span></>} className="mono-input" placeholder="ABCDE1234F" value={v.pan} onChange={set('pan')} error={errors.pan} />
              </FormRow>
            ) : (
              <FormRow>
                <Field label="Store phone" type="tel" inputMode="tel" value={v.storePhone} onChange={set('storePhone')} error={errors.storePhone} />
                <Field label={<>Email <span className="optional">(optional)</span></>} type="email" placeholder="store@example.com" value={v.email} onChange={set('email')} error={errors.email} />
              </FormRow>
            )}
          </FormSection>

          <FormSection title="Owner">
            <FormRow>
              <Field label="Owner name" value={v.owner} onChange={set('owner')} error={errors.owner} />
              <Field label="Owner mobile" type="tel" inputMode="tel" placeholder="+91" value={v.ownerMobile} onChange={set('ownerMobile')} error={errors.ownerMobile} hint="Used to sign in to the Retailer app" />
            </FormRow>
            <div className="field">
              <span className="field-label">ID proof{isEdit && <span className="optional"> (upload only to replace)</span>}</span>
              <UploadBox wide label="Upload Aadhaar, PAN or trade licence · PDF or photo" file={v.idProof} onFile={set('idProof')} error={errors.idProof} />
            </div>
          </FormSection>

          <FormSection title="Address">
            <Field label="Shop address" value={v.address} onChange={set('address')} error={errors.address} />
            <FormRow>
              <Field label="City" value={v.city} onChange={set('city')} error={errors.city} />
              {LIVE && <Field label={<>District <span className="optional">(optional)</span></>} value={v.district} onChange={set('district')} />}
              {LIVE ? <Field label="State" value={v.state} onChange={set('state')} error={errors.state} />
                : <Field label="District" value={v.district} onChange={set('district')} error={errors.district} />}
              <Field label="PIN code" inputMode="numeric" maxLength={6} value={v.pin} onChange={set('pin')} error={errors.pin} />
            </FormRow>
          </FormSection>
        </div>

        <div className="form-col">
          {needsParent && (
            <FormSection title="Network" subtitle={LIVE ? 'A store can sit under a sub distributor or a distributor.' : 'Keys for this store come from this sub distributor.'}>
              <SelectField
                label={LIVE ? 'Reports to' : 'Reports to (sub distributor)'}
                value={v.subDistributorId}
                onChange={set('subDistributorId')}
                options={(parents.data ?? []).map((p) => ({ value: p.id, label: p.label }))}
                error={errors.subDistributorId}
              />
            </FormSection>
          )}
          {!isCompany && !isEdit && (
            <FormSection title="Network">
              <span className="sub" style={{ fontSize: 14 }}>This store will sit under <strong style={{ color: 'var(--ink)' }}>{user.org?.name}</strong>.</span>
            </FormSection>
          )}

          {LIVE && (
            <FormSection title="Login" subtitle={isEdit ? 'The owner signs in to the Retailer app with this email.' : 'Share these with the owner. They sign in to the Retailer app with them.'}>
              <Field label="Email (sign-in)" type="email" autoComplete="off" placeholder="store@example.com" value={v.email} onChange={set('email')} error={errors.email} />
              {!isEdit && (
                <FormRow>
                  <Field label="Password" type="text" autoComplete="new-password" value={v.password} onChange={set('password')} error={errors.password}
                    labelAction={<button type="button" className="btn btn-text" style={{ padding: 0, height: 'auto' }} onClick={() => {
                      const p = `PL-${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}`;
                      setV((s) => ({ ...s, password: p, confirm: p })); setErrors((x) => ({ ...x, password: undefined, confirm: undefined }));
                    }}>Generate</button>} />
                  <Field label="Confirm password" type="text" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={errors.confirm} />
                </FormRow>
              )}
            </FormSection>
          )}

          {<><FormSection title="Allowed devices">
            <Checkbox label="Android phones" checked={v.allowedDevices.android} onChange={setDevice('android')} />
            <Checkbox label="iPhones" note="· supervised only" checked={v.allowedDevices.iphone} onChange={setDevice('iphone')} />
            <Checkbox label="Smart TVs" checked={v.allowedDevices.tv} onChange={setDevice('tv')} error={errors.allowedDevices} />
          </FormSection>

          <FormSection title="Default EMI rules">
            <SelectField label="Grace period before auto-lock" value={v.gracePeriodDays} onChange={set('gracePeriodDays')} options={GRACE_OPTIONS} />
            <Field label="Maximum devices on EMI" type="number" min={1} inputMode="numeric" value={v.maxDevicesOnEmi} onChange={set('maxDevicesOnEmi')} error={errors.maxDevicesOnEmi} />
          </FormSection></>}

          {!isEdit && !LIVE && (
            <div className="note">
              <Icon name="chat" size={16} />
              <span>
                {approvesOwnAdds
                  ? 'The owner gets an SMS with the Retailer app link as soon as you save this store.'
                  : 'The owner gets an SMS with the Retailer app link once a super admin approves this store.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
