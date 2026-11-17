import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { customersApi } from '../../services/customersApi';
import { retailersApi } from '../../services/retailersApi';
import { isIndianMobile } from '../../utils/format';
import { isLive } from '../../services/http';
import {
  Breadcrumb, Button, Checkbox, Dialog, Field, FormRow, FormSection, KeyValue, SelectField, UploadBox, useToast,
} from '../../components/ui';

const LIVE = isLive('customers');

const ID_TYPES = [
  { value: 'Aadhaar', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'Voter ID', label: 'Voter ID' },
  { value: 'Driving licence', label: 'Driving licence' },
];

const ID_RULES = {
  Aadhaar: [/^\d{12}$/, 'Aadhaar is 12 digits'],
  PAN: [/^[A-Z]{5}\d{4}[A-Z]$/, 'PAN is 10 characters, like ABCDE1234F'],
  'Voter ID': [/^[A-Z]{3}\d{7}$/, 'Voter ID is 3 letters and 7 digits'],
  'Driving licence': [/^[A-Z]{2}\d{2}[A-Z\d]{11,13}$/, 'Check the licence number'],
};

const EMPTY = {
  name: '', retailerId: '', mobile: '', altMobile: '', address: '', city: '', state: '', pincode: '', email: '', signature: null,
  idType: 'Aadhaar', idNumber: '', idFront: null, idBack: null, photo: null, agreement: false,
};

/** Shows only the last 4 characters once the field loses focus (A-08: ID numbers are stored masked). */
const mask = (v) => {
  const s = v.replace(/\s/g, '');
  if (s.length <= 4) return s;
  return `${'X'.repeat(s.length - 4)}${s.slice(-4)}`.replace(/(.{4})(?=.)/g, '$1 ');
};

function validate(v, draft) {
  const e = {};
  if (!v.name.trim()) e.name = 'Enter the customer’s full name';
  if (!v.retailerId) e.retailerId = 'Pick the store selling the device';
  if (!isIndianMobile(v.mobile)) e.mobile = 'Enter a 10-digit WhatsApp number';
  if (v.altMobile && !isIndianMobile(v.altMobile)) e.altMobile = 'Enter a 10-digit mobile number, or leave it empty';
  if (draft) return e; // a draft only needs who the customer is
  if (!v.address.trim()) e.address = 'Enter the customer’s address';
  if (LIVE) {
    // ID is optional; when given, it must look right.
    if (v.idNumber) {
      const [re, msg] = ID_RULES[v.idType];
      if (!re.test(v.idNumber.replace(/\s/g, '').toUpperCase())) e.idNumber = msg;
    }
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email, or leave it empty';
    if (v.pincode && !/^\d{6}$/.test(v.pincode.trim())) e.pincode = 'PIN code is 6 digits';
    if (!v.agreement) e.agreement = 'The customer must sign the EMI agreement before a device is added';
    return e;
  }
  const [re, msg] = ID_RULES[v.idType];
  if (!re.test(v.idNumber.replace(/\s/g, '').toUpperCase())) e.idNumber = msg;
  if (!v.idFront) e.idFront = 'Upload the front of the ID';
  if (!v.idBack && v.idType !== 'PAN') e.idBack = 'Upload the back of the ID';
  if (!v.photo) e.photo = 'Take or upload a photo';
  if (!v.agreement) e.agreement = 'The customer must sign the EMI agreement before a device is added';
  return e;
}

const STEPS_LIVE = [
  ['Customer details', 'You are here'],
  ['Enrol device', 'Retailer app: scan the device and use 1 key'],
  ['EMI plan', 'Attached right after enrolment'],
];

const STEPS = [
  ['Customer details', 'You are here'],
  ['Register device', 'IMEI or serial, model check'],
  ['EMI plan', 'Down payment, tenure, rules'],
  ['Enrol device', 'Agent installed at the store'],
];

/** A-08 · Add customer — step 1 of 4 (customer → device → EMI → enrol). */
export default function AddCustomer() {
  const navigate = useNavigate();
  const toast = useToast();
  const retailers = useApi(() => retailersApi.options(), []);
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [idFocused, setIdFocused] = useState(false);
  const [saving, setSaving] = useState(null); // 'draft' | 'next' | null
  const [formError, setFormError] = useState(null);
  const [created, setCreated] = useState(null); // live: { id, email, password, mobile }

  const set = (k) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const save = async (draft) => {
    const errs = validate(v, draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTimeout(() => document.querySelector('[aria-invalid="true"], .upload.has-error, .check-field .field-error')?.closest('.field, .upload-wrap, .check-field')?.querySelector('input, select, button')?.focus());
      return;
    }
    setSaving(draft ? 'draft' : 'next');
    setFormError(null);
    try {
      const res = await customersApi.create({ ...v, idNumber: v.idNumber.replace(/\s/g, '').toUpperCase() }, { draft });
      const { id } = res;
      if (LIVE) {
        setCreated({ ...res, mobile: v.mobile.replace(/\D/g, '').slice(-10) });
        setSaving(null);
        return;
      }
      if (draft) {
        toast('Saved as draft');
        navigate(`/customers/${id}`, { replace: true });
      } else {
        toast('Customer saved · now register the device');
        navigate(`/devices/register?customer=${id}`, { replace: true });
      }
    } catch (err) {
      setFormError(err.message);
      setSaving(null);
    }
  };

  return (
    <form className="page" style={{ gap: 20 }} noValidate onSubmit={(e) => { e.preventDefault(); save(false); }}>
      <Breadcrumb items={[{ label: 'Customers', to: '/customers' }, { label: 'New customer' }]} />
      <div className="page-head" style={{ alignItems: 'center' }}>
        <h1 className="h1">Add customer</h1>
        <div className="page-actions">
          <Button variant="secondary" to="/customers">Cancel</Button>
          <Button variant="secondary" disabled={!!saving} onClick={() => save(true)}>{saving === 'draft' ? 'Saving…' : 'Save as draft'}</Button>
          <Button type="submit" disabled={!!saving}>{saving === 'next' ? 'Saving…' : LIVE ? 'Save customer' : 'Save & add device'}</Button>
        </div>
      </div>

      {formError && <div className="form-alert" role="alert">{formError}</div>}

      <div className="form-layout">
        <div className="form-col">
          <FormSection title="Personal details" subtitle="Payment reminders go to the WhatsApp number.">
            <FormRow>
              <Field label="Full name" autoComplete="off" value={v.name} onChange={set('name')} error={errors.name} />
              <SelectField
                label="Assign to retailer"
                value={v.retailerId}
                onChange={set('retailerId')}
                options={(retailers.data ?? []).map((r) => ({ value: r.id, label: r.label }))}
                placeholder={retailers.loading ? 'Loading stores…' : 'Select a store'}
                error={errors.retailerId}
              />
            </FormRow>
            <FormRow>
              <Field label="Mobile (WhatsApp)" type="tel" inputMode="tel" placeholder="+91" value={v.mobile} onChange={set('mobile')} error={errors.mobile} />
              <Field label={<>Alternate mobile <span className="optional">(optional)</span></>} type="tel" inputMode="tel" placeholder="+91" value={v.altMobile} onChange={set('altMobile')} error={errors.altMobile} />
            </FormRow>
            <Field label="Address" value={v.address} onChange={set('address')} error={errors.address} />
            {LIVE && (
              <>
                <FormRow>
                  <Field label={<>City <span className="optional">(optional)</span></>} value={v.city} onChange={set('city')} />
                  <Field label={<>State <span className="optional">(optional)</span></>} value={v.state} onChange={set('state')} />
                  <Field label={<>PIN code <span className="optional">(optional)</span></>} inputMode="numeric" value={v.pincode} onChange={set('pincode')} error={errors.pincode} />
                </FormRow>
                <Field label={<>Email <span className="optional">(optional)</span></>} type="email" value={v.email} onChange={set('email')} error={errors.email}
                  hint="The customer signs in to the app with their mobile number. Email is only for receipts." />
              </>
            )}
          </FormSection>

          {LIVE ? (
            <FormSection title="Photo, signature and ID" subtitle="Photo and signature are what the backend needs; the retailer can also take them at enrolment. ID is optional.">
              <div className="form-row">
                <UploadBox label="Customer photo" accept="image/*" file={v.photo} onFile={set('photo')} />
                <UploadBox label="Customer signature" accept="image/*" file={v.signature} onFile={set('signature')} />
              </div>
              <FormRow>
                <SelectField label={<>ID type <span className="optional">(optional)</span></>} value={v.idType} onChange={set('idType')} options={ID_TYPES} />
                <Field
                  label={<>ID number <span className="optional">(optional)</span></>}
                  className="mono-input"
                  autoComplete="off"
                  value={idFocused ? v.idNumber : mask(v.idNumber)}
                  onFocus={() => setIdFocused(true)}
                  onBlur={() => setIdFocused(false)}
                  onChange={set('idNumber')}
                  error={errors.idNumber}
                />
              </FormRow>
              <div className="form-row">
                <UploadBox label="ID front (optional)" accept="image/*" file={v.idFront} onFile={set('idFront')} />
                <UploadBox label="ID back (optional)" accept="image/*" file={v.idBack} onFile={set('idBack')} />
              </div>
              <Checkbox
                label="Customer has signed the EMI agreement allowing the device to be locked, tracked and managed until fully paid."
                checked={v.agreement}
                onChange={set('agreement')}
                error={errors.agreement}
              />
            </FormSection>
          ) : (
          <FormSection title="KYC" subtitle="ID numbers are stored masked; only the last 4 digits are shown.">
            <FormRow>
              <SelectField label="ID type" value={v.idType} onChange={set('idType')} options={ID_TYPES} />
              <Field
                label="ID number"
                className="mono-input"
                autoComplete="off"
                value={idFocused ? v.idNumber : mask(v.idNumber)}
                onFocus={() => setIdFocused(true)}
                onBlur={() => setIdFocused(false)}
                onChange={set('idNumber')}
                error={errors.idNumber}
              />
            </FormRow>
            <div className="form-row">
              <UploadBox label="ID front" accept="image/*" file={v.idFront} onFile={set('idFront')} error={errors.idFront} />
              <UploadBox label={v.idType === 'PAN' ? 'ID back (optional)' : 'ID back'} accept="image/*" file={v.idBack} onFile={set('idBack')} error={errors.idBack} />
              <UploadBox label="Customer photo" accept="image/*" file={v.photo} onFile={set('photo')} error={errors.photo} />
            </div>
            <Checkbox
              label="Customer has signed the EMI agreement allowing the device to be locked, tracked and managed until fully paid."
              checked={v.agreement}
              onChange={set('agreement')}
              error={errors.agreement}
            />
          </FormSection>
          )}
        </div>

        <section className="card form-section">
          <h2 className="h2">Next steps</h2>
          <ol className="steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(LIVE ? STEPS_LIVE : STEPS).map(([title, sub], i) => (
              <li key={title} className={`step${i === 0 ? ' is-current' : ''}`} aria-current={i === 0 ? 'step' : undefined}>
                <b>{i + 1}</b>
                <div><strong>{title}</strong><span className="sub">{sub}</span></div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Dialog open={!!created} onClose={() => navigate(`/customers/${created.id}`, { replace: true })} icon="check" tone="info"
        title="Customer saved"
        subtitle="Share these sign-in details with the customer for the Prime Locker app."
        actions={<Button onClick={() => navigate(`/customers/${created.id}`, { replace: true })}>Open customer</Button>}>
        {created && (
          <KeyValue items={[
            ['Mobile number', created.mobile],
            ['Password', <span className="mono" key="pw">{created.password}</span>],
          ]} />
        )}
      </Dialog>
    </form>
  );
}
