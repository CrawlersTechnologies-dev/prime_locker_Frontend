import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { devicesApi, DEVICES_LIVE, PHONE_CAPABILITIES, TV_CONTROLS } from '../../services/devicesApi';
import { initials } from '../../utils/format';
import {
  Avatar, Breadcrumb, Button, Card, Field, FormRow, FormSection, Icon, SelectField, StateMessage, useToast,
} from '../../components/ui';
import './devices.css';

const TYPES = [
  { value: 'android', label: 'Android phone', icon: 'phone', allowKey: 'android' },
  { value: 'iphone', label: 'iPhone', icon: 'phone', allowKey: 'iphone' },
  { value: 'tv', label: 'Smart TV', icon: 'tv', allowKey: 'tv' },
];
const TV_LABELS = {
  screenLock: 'Screen lock & payment screen', message: 'Message on screen', blockApps: 'Block streaming apps',
  audioReminder: 'Audio reminder', resetProtection: 'Factory-reset protection',
};

/** IMEI check digit (Luhn). Catches most typos before the device reaches the store. */
export function isValidImei(v) {
  if (!/^\d{15}$/.test(v)) return false;
  const sum = v.split('').reverse().map(Number).reduce((s, d, i) => {
    if (i % 2 === 0) return s + d;
    const x = d * 2;
    return s + (x > 9 ? x - 9 : x);
  }, 0);
  return sum % 10 === 0;
}

const digits = (v) => v.replace(/\D/g, '');
const toAmount = (v) => Number(String(v).replace(/[₹,\s]/g, ''));

function validate(v, type) {
  const e = {};
  if (!v.customerId) e.customerId = 'Pick the customer buying this device';
  if (!v.brand.trim()) e.brand = 'Enter the brand';
  if (!v.model.trim()) e.model = 'Enter the model';
  if (type === 'tv') {
    if (v.imei1.trim().length < 6) e.imei1 = 'Enter the serial number from the back of the TV';
  } else {
    const i1 = digits(v.imei1);
    if (i1.length !== 15) e.imei1 = 'IMEI must be 15 digits. Dial *#06# on the phone to see it.';
    else if (!isValidImei(i1)) e.imei1 = 'This IMEI doesn’t look right. Check each digit.';
    const i2 = digits(v.imei2);
    if (i2) {
      if (i2.length !== 15 || !isValidImei(i2)) e.imei2 = 'IMEI 2 must be a valid 15-digit IMEI, or leave it empty';
      else if (i2 === i1) e.imei2 = 'IMEI 2 can’t be the same as IMEI 1';
    }
  }
  const price = toAmount(v.price);
  if (!(price > 0)) e.price = 'Enter the device price in rupees';
  if (!v.invoice.trim()) e.invoice = 'Enter the invoice number';
  return e;
}

/** A-11 · Register device. Live: devices are enrolled in the Retailer app, which scans the device and uses a key. */
export default function RegisterDevice() {
  if (!DEVICES_LIVE) return <RegisterDeviceForm />;
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Mobile devices', to: '/devices' }, { label: 'Register device' }]} />
      <Card>
        <StateMessage icon="phone" title="Devices are enrolled in the Retailer app"
          action={<Button to="/devices">Back to devices</Button>}>
          The retailer scans the phone or TV, enters the customer and uses one key. The device shows up here as soon as it’s enrolled, and you can set up its EMI from EMI plans → Set up EMI.
        </StateMessage>
      </Card>
    </div>
  );
}

function RegisterDeviceForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const customers = useApi(() => devicesApi.customerOptions(), []);
  const [v, setV] = useState({
    customerId: params.get('customer') ?? '', brand: '', model: '', imei1: '', imei2: '', price: '', invoice: '',
  });
  const [type, setType] = useState(params.get('type') === 'tv' ? 'tv' : 'android');
  const [changing, setChanging] = useState(!params.get('customer'));
  const [errors, setErrors] = useState({});
  const [check, setCheck] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const customer = useMemo(() => customers.data?.find((c) => c.id === v.customerId), [customers.data, v.customerId]);
  const allowed = customer?.allowed ?? { android: true, iphone: true, tv: true };

  // A ?customer= link to someone who already has a device (or doesn't exist) → let the user pick instead.
  useEffect(() => {
    if (customers.data && v.customerId && !customer) {
      setV((s) => ({ ...s, customerId: '' }));
      setChanging(true);
    }
  }, [customers.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fall back to an allowed type when the customer's store doesn't sell this kind of device.
  useEffect(() => {
    if (customer && !allowed[TYPES.find((t) => t.value === type).allowKey]) {
      const first = TYPES.find((t) => allowed[t.allowKey]);
      if (first) setType(first.value);
    }
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capability check runs once brand + model are filled in (debounced).
  useEffect(() => {
    if (!v.brand.trim() || !v.model.trim()) { setCheck(null); return undefined; }
    const t = setTimeout(() => devicesApi.checkModel({ type, brand: v.brand, model: v.model }).then(setCheck).catch(() => setCheck(null)), 400);
    return () => clearTimeout(t);
  }, [type, v.brand, v.model]);

  const set = (k) => (e) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, type);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await devicesApi.register({
        customerId: v.customerId, type, brand: v.brand.trim(), model: v.model.trim(),
        imei1: type === 'tv' ? v.imei1.trim().toUpperCase() : digits(v.imei1), imei2: digits(v.imei2) || null,
        price: toAmount(v.price), invoice: v.invoice.trim(), platform: check?.platform,
      });
      toast('Device registered · now set up the EMI');
      navigate(`/emi/new?customer=${res.customerId}&device=${res.id}`, { replace: true });
    } catch (err) {
      if (err.status === 409) setErrors({ imei1: err.message });
      else setFormError(err.message);
      setSaving(false);
    }
  };

  const capRows = type === 'tv'
    ? TV_CONTROLS.map((k) => [k, TV_LABELS[k]])
    : PHONE_CAPABILITIES;
  const supported = new Set(check?.supported ?? []);

  return (
    <form className="page" style={{ gap: 20 }} onSubmit={submit} noValidate>
      <Breadcrumb items={[{ label: type === 'tv' ? 'TV devices' : 'Mobile devices', to: type === 'tv' ? '/tvs' : '/devices' }, { label: 'Register device' }]} />
      <div className="page-head" style={{ alignItems: 'center' }}>
        <h1 className="h1">Register device</h1>
        <div className="page-actions">
          <Button variant="secondary" to={customer ? `/customers/${customer.id}` : '/devices'}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Continue to EMI plan'}</Button>
        </div>
      </div>

      {formError && <div className="form-alert" role="alert">{formError}</div>}

      <div className="form-layout side-360">
        <div className="form-col">
          <FormSection title="Customer">
            {customer && !changing ? (
              <div className="picked">
                <Avatar text={initials(customer.name)} tone="plain" />
                <div className="cell-stack" style={{ flexGrow: 1 }}>
                  <span className="fw-600">{customer.name}</span>
                  <span className="sub">{customer.phone} · {customer.retailer}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>Change</Button>
              </div>
            ) : (
              <SelectField
                label="Customer"
                value={v.customerId}
                onChange={(e) => { setV((s) => ({ ...s, customerId: e.target.value })); setChanging(false); setErrors((x) => ({ ...x, customerId: undefined })); }}
                options={(customers.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.retailer}` }))}
                placeholder={customers.loading ? 'Loading customers…' : customers.data?.length ? 'Select a customer' : 'No customers waiting for a device'}
                hint="Only customers without a device are listed. Add a new customer first if they’re not here."
                error={errors.customerId}
              />
            )}
          </FormSection>

          <FormSection title="Device">
            <div className="type-picker" role="group" aria-label="Device type">
              {TYPES.map((t) => (
                <button key={t.value} type="button" className="type-option" aria-pressed={type === t.value}
                  disabled={!allowed[t.allowKey]} title={!allowed[t.allowKey] ? 'This store isn’t allowed to sell this device type' : undefined}
                  onClick={() => { setType(t.value); setErrors({}); }}>
                  <Icon name={t.icon} />{t.label}
                </button>
              ))}
            </div>
            <FormRow>
              <Field label="Brand" placeholder={type === 'tv' ? 'TCL' : type === 'iphone' ? 'Apple' : 'Xiaomi'} value={v.brand} onChange={set('brand')} error={errors.brand} />
              <Field label="Model" placeholder={type === 'tv' ? '55″ P7K' : type === 'iphone' ? 'iPhone 15' : 'Redmi Note 13 5G'} value={v.model} onChange={set('model')} error={errors.model} />
            </FormRow>
            {type === 'tv' ? (
              <Field label="Serial number" className="mono-input" autoComplete="off" value={v.imei1} onChange={set('imei1')} error={errors.imei1} hint="Printed on the sticker on the back of the TV" />
            ) : (
              <FormRow>
                <Field label="IMEI 1" className="mono-input" inputMode="numeric" autoComplete="off" maxLength={17} value={v.imei1} onChange={set('imei1')} error={errors.imei1} />
                <Field label={<>IMEI 2 <span className="optional">(dual SIM)</span></>} className="mono-input" inputMode="numeric" autoComplete="off" maxLength={17} value={v.imei2} onChange={set('imei2')} error={errors.imei2} />
              </FormRow>
            )}
            <FormRow>
              <Field label="Device price" inputMode="numeric" placeholder="₹" value={v.price} onChange={set('price')} error={errors.price} />
              <Field label="Invoice number" value={v.invoice} onChange={set('invoice')} error={errors.invoice} />
            </FormRow>
          </FormSection>
        </div>

        <div className="form-col">
          <section className="card form-section" style={{ gap: 8 }} aria-live="polite">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 }}>
              <h2 className="h2">Capability check</h2>
              {check && (
                <span style={{ fontSize: 12, fontWeight: 600, color: supported.size === capRows.length ? 'var(--ok)' : 'var(--warn)' }}>
                  {supported.size} of {capRows.length} supported
                </span>
              )}
            </div>
            {!check && <span className="sub">Enter the brand and model to see which controls work on this {type === 'tv' ? 'TV' : 'phone'}.</span>}
            {check && (
              <ul className="cap-list">
                {capRows.map(([k, label]) => (
                  <li key={k} className={supported.has(k) ? undefined : 'is-off'}>
                    <Icon name={supported.has(k) ? 'check' : 'close'} className={supported.has(k) ? 'is-yes' : 'is-no'} size={16} />
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {type === 'iphone' && (
            <div className="warn-box"><Icon name="alert" /><span>iPhones must be supervised through Apple Business Manager before these controls work.</span></div>
          )}
          {type === 'tv' && check && supported.size < capRows.length && (
            <div className="warn-box"><Icon name="alert" /><span>Unsupported controls are hidden on this TV’s page. Tell the customer before the sale.</span></div>
          )}
        </div>
      </div>
    </form>
  );
}