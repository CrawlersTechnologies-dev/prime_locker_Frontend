import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { networkApi } from '../../services/networkApi';
import { isLive } from '../../services/http';

const LIVE = isLive('partners');
import { P } from '../../config/permissions';
import { LEVELS, LEVEL_META, levelBelow } from '../../config/roles';
import { isIndianMobile, num } from '../../utils/format';
import { Breadcrumb, Button, Checkbox, Field, FormRow, FormSection, SelectField, UploadBox, useToast } from '../../components/ui';
import { LevelChip } from './networkParts';

const LEVEL_OPTIONS = [LEVELS.SUPER_DISTRIBUTOR, LEVELS.DISTRIBUTOR, LEVELS.SUB_DISTRIBUTOR];
const PLURAL = { distributor: 'distributors', sub_distributor: 'sub distributors', retailer: 'retailers' };
const RULE = {
  super_distributor: 'A super distributor gets keys directly from Prime Locker.',
  distributor: 'A distributor must sit directly under a super distributor.',
  sub_distributor: 'A sub distributor must sit directly under a distributor.',
};

function validate(v, parent) {
  const e = {};
  if (LIVE) {
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email. They sign in with it.';
    if (!v.state.trim()) e.state = 'Enter the state';
    if (!/^\d{6}$/.test(v.pincode.trim())) e.pincode = 'PIN code is 6 digits';
    if (!v.address.trim()) e.address = 'Enter the business address';
    if (v.password.length < 8) e.password = 'Use at least 8 characters';
    else if (v.password !== v.confirm) e.confirm = 'Passwords don’t match';
    if (v.pan && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(v.pan.trim())) e.pan = 'PAN is 10 characters, like ABCDE1234F';
  }
  if (!v.parentId) e.parentId = 'Pick who this partner reports to';
  if (!v.name.trim()) e.name = 'Enter the business name';
  if (v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(v.gstin.trim())) e.gstin = 'GSTIN is 15 characters, like 29ABCDE1234F1Z5';
  if (!v.owner.trim()) e.owner = 'Enter the owner’s name';
  if (!isIndianMobile(v.mobile)) e.mobile = 'Enter a 10-digit mobile number. It becomes their login.';
  if (!v.city.trim()) e.city = 'Enter the city';
  if (!v.idProof) e.idProof = 'Upload the owner’s PAN or Aadhaar';
  if (LIVE) return e;
  const k = Number(String(v.openingKeys).replace(/,/g, '') || 0);
  if (!Number.isInteger(k) || k < 0) e.openingKeys = 'Enter a whole number, or 0';
  else if (parent && k > parent.balance) e.openingKeys = `${parent.name} has only ${num(parent.balance)} keys`;
  return e;
}

/** N-03 · Add partner. Staff pick any level; partners add only the level directly below them. */
export default function AddPartner() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const isCompany = user.level === LEVELS.COMPANY;
  const fixedLevel = isCompany ? null : levelBelow(user.level);

  const [level, setLevel] = useState(fixedLevel ?? (LEVEL_OPTIONS.includes(params.get('level')) ? params.get('level') : LEVELS.DISTRIBUTOR));
  const parents = useApi(() => networkApi.parentOptions(level), [level]);
  const [v, setV] = useState({
    parentId: '', name: '', gstin: '', owner: '', mobile: '', city: '', area: '',
    gstDoc: null, idProof: null, openingKeys: '0',
    email: '', state: 'Karnataka', pincode: '', address: '', pan: '', password: '', confirm: '', canReclaim: false,
    flags: { addPartners: true, seeDevices: true, seePhones: false },
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // One possible parent (always the case for partners, and for super distributors) → pick it.
  useEffect(() => {
    if (parents.data?.length === 1) setV((s) => ({ ...s, parentId: parents.data[0].id }));
    else if (parents.data && !parents.data.some((p) => p.id === v.parentId)) setV((s) => ({ ...s, parentId: '' }));
  }, [parents.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const parent = useMemo(() => parents.data?.find((p) => p.id === v.parentId), [parents.data, v.parentId]);

  // Sub distributors add retailers, which have their own form.
  if (fixedLevel === LEVELS.RETAILER) return <Navigate to="/retailers/new" replace />;

  const set = (k) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const setFlag = (k) => (e) => setV((s) => ({ ...s, flags: { ...s.flags, [k]: e.target.checked } }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, parent);
    setErrors(errs);
    if (Object.keys(errs).length) { setTimeout(() => document.querySelector('[aria-invalid="true"], .upload.has-error')?.focus()); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await networkApi.createPartner({
        level, parentId: v.parentId, name: v.name.trim(), gstin: v.gstin.trim().toUpperCase(), owner: v.owner.trim(),
        mobile: v.mobile.trim(), city: v.city.trim(), area: v.area.trim(), flags: v.flags,
        openingKeys: Number(String(v.openingKeys).replace(/,/g, '') || 0),
        ...(LIVE ? {
          email: v.email.trim().toLowerCase(), state: v.state.trim(), pincode: v.pincode.trim(), address: v.address.trim(),
          pan: v.pan.trim().toUpperCase(), password: v.password, idProof: v.idProof, canReclaim: v.canReclaim,
        } : {}),
      });
      toast(LIVE ? `Partner created · they sign in with ${v.email.trim().toLowerCase()} and the password you set`
        : res.status === 'pending' ? 'Partner saved · waiting for a super admin to approve' : `Login sent by SMS to ${v.mobile.trim()}`);
      navigate(`/partners/${res.id}`, { replace: true });
    } catch (err) {
      if (err.status === 409) setErrors({ mobile: err.message });
      else setFormError(err.message);
      setSaving(false);
    }
  };

  const below = levelBelow(level);
  const newName = v.name.trim() || `New ${LEVEL_META[level].label.toLowerCase()}`;

  return (
    <form className="page" style={{ gap: 20 }} onSubmit={submit} noValidate>
      <Breadcrumb items={[isCompany ? { label: 'Partners', to: '/partners' } : { label: LEVEL_META[user.level].downline, to: '/network' }, { label: 'New partner' }]} />
      <div className="page-head" style={{ alignItems: 'center' }}>
        <h1 className="h1">{isCompany ? 'Add partner' : `Add ${LEVEL_META[level].label.toLowerCase()}`}</h1>
        <div className="page-actions">
          <Button variant="secondary" to={isCompany ? '/partners' : '/network'}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : LIVE ? 'Create partner' : 'Create & send login'}</Button>
        </div>
      </div>

      {formError && <div className="form-alert" role="alert">{formError}</div>}

      <div className="form-layout side-360">
        <div className="form-col">
          <FormSection title="Level">
            {isCompany && (
              <div className="level-picker" role="group" aria-label="Partner level">
                {LEVEL_OPTIONS.map((l) => (
                  <button key={l} type="button" className="level-option" aria-pressed={level === l} onClick={() => { setLevel(l); setErrors({}); }}>
                    {LEVEL_META[l].label}
                  </button>
                ))}
              </div>
            )}
            {level === LEVELS.SUPER_DISTRIBUTOR ? (
              <span className="sub" style={{ fontSize: 14 }}>{RULE[level]}</span>
            ) : isCompany ? (
              <SelectField
                label={`Reports to (${LEVEL_META[level === LEVELS.DISTRIBUTOR ? LEVELS.SUPER_DISTRIBUTOR : LEVELS.DISTRIBUTOR].label.toLowerCase()})`}
                value={v.parentId}
                onChange={set('parentId')}
                options={(parents.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${p.city}` }))}
                placeholder={parents.loading ? 'Loading…' : 'Select'}
                hint={RULE[level]}
                error={errors.parentId}
              />
            ) : (
              <span className="sub" style={{ fontSize: 14 }}>They will sit directly under <strong style={{ color: 'var(--ink)' }}>{user.org?.name}</strong> and get keys from you.</span>
            )}
          </FormSection>

          <FormSection title="Business & owner">
            <FormRow>
              <Field label="Business name" value={v.name} onChange={set('name')} error={errors.name} />
              <Field label={<>GSTIN <span className="optional">(optional)</span></>} className="mono-input" placeholder="29ABCDE1234F1Z5" value={v.gstin} onChange={set('gstin')} error={errors.gstin} />
            </FormRow>
            <FormRow>
              <Field label="Owner name" value={v.owner} onChange={set('owner')} error={errors.owner} />
              <Field label={LIVE ? 'Owner mobile' : 'Owner mobile (login)'} type="tel" inputMode="tel" placeholder="+91" value={v.mobile} onChange={set('mobile')} error={errors.mobile}
                hint={LIVE ? 'They can also sign in with this number' : 'They sign in with this number and an OTP'} />
            </FormRow>
            {LIVE ? (
              <>
                <FormRow>
                  <Field label="City" value={v.city} onChange={set('city')} error={errors.city} />
                  <Field label="State" value={v.state} onChange={set('state')} error={errors.state} />
                  <Field label="PIN code" inputMode="numeric" maxLength={6} value={v.pincode} onChange={set('pincode')} error={errors.pincode} />
                </FormRow>
                <Field label="Business address" value={v.address} onChange={set('address')} error={errors.address} />
                <FormRow>
                  <Field label={<>PAN <span className="optional">(optional)</span></>} className="mono-input" placeholder="ABCDE1234F" value={v.pan} onChange={set('pan')} error={errors.pan} />
                  <div className="field"><span className="field-label">Owner PAN / Aadhaar</span><UploadBox label="Upload PDF or photo" file={v.idProof} onFile={set('idProof')} error={errors.idProof} /></div>
                </FormRow>
              </>
            ) : (
              <>
                <FormRow>
                  <Field label="City" value={v.city} onChange={set('city')} error={errors.city} />
                  <Field label={<>Area covered <span className="optional">(optional)</span></>} placeholder="Haveri, Ranebennur, Hangal" value={v.area} onChange={set('area')} />
                </FormRow>
                <div className="form-row">
                  <UploadBox label="GST certificate (optional)" file={v.gstDoc} onFile={set('gstDoc')} />
                  <UploadBox label="Owner PAN / Aadhaar" file={v.idProof} onFile={set('idProof')} error={errors.idProof} />
                </div>
              </>
            )}
          </FormSection>

          {LIVE && (
            <FormSection title="Login" subtitle="Share these with the partner. They can change the password later.">
              <Field label="Email (sign-in)" type="email" autoComplete="off" placeholder="owner@example.com" value={v.email} onChange={set('email')} error={errors.email} />
              <FormRow>
                <Field label="Password" type="text" autoComplete="new-password" value={v.password} onChange={set('password')} error={errors.password}
                  labelAction={<button type="button" className="btn btn-text" style={{ padding: 0, height: 'auto' }} onClick={() => {
                    const p = `PL-${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}`;
                    setV((s) => ({ ...s, password: p, confirm: p })); setErrors((x) => ({ ...x, password: undefined, confirm: undefined }));
                  }}>Generate</button>} />
                <Field label="Confirm password" type="text" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={errors.confirm} />
              </FormRow>
            </FormSection>
          )}
        </div>

        <div className="form-col">
          <FormSection title="Where they sit">
            <div className="chain">
              {(parent?.chain ?? (level === LEVELS.SUPER_DISTRIBUTOR ? [{ id: 'pl', name: 'Prime Locker', level: 'company' }] : [])).map((c) => (
                <div key={c.id} style={{ display: 'contents' }}>
                  <div className="chain-item"><LevelChip level={c.level} /><span>{c.name}</span></div>
                  <div className="chain-line" />
                </div>
              ))}
              {!parent && level !== LEVELS.SUPER_DISTRIBUTOR && <span className="sub">Pick who they report to.</span>}
              <div className="chain-item is-new"><LevelChip level={level} /><span>{newName}</span></div>
            </div>
          </FormSection>

          {<FormSection title="Opening keys">
            <Field
              label={parent ? `Send keys from ${parent.name} now` : 'Send keys now'}
              inputMode="numeric"
              value={v.openingKeys}
              onChange={set('openingKeys')}
              error={errors.openingKeys}
              hint={LIVE ? 'Mobile keys from your own stock. Leave at 0 to send later.' : parent ? `${parent.name} has ${num(parent.balance)} keys. Leave at 0 to send later.` : 'Leave at 0 to send later.'}
              disabled={!parent}
            />
          </FormSection>}

          {LIVE ? (
            <FormSection title="This partner can">
              {below && below !== LEVELS.RETAILER && <Checkbox label={`Add ${PLURAL[below]}`} checked={v.flags.addPartners} onChange={setFlag('addPartners')} />}
              {below === LEVELS.RETAILER && <Checkbox label="Add retailers" checked={v.flags.addPartners} onChange={setFlag('addPartners')} />}
              <Checkbox label="See devices in their network" checked={v.flags.seeDevices} onChange={setFlag('seeDevices')} />
              <Checkbox label="See customer phone numbers" checked={v.flags.seePhones} onChange={setFlag('seePhones')} />
              <Checkbox label="Take keys back from partners below them" checked={v.canReclaim} onChange={set('canReclaim')} />
            </FormSection>
          ) : <FormSection title="This partner can">
            {below && below !== LEVELS.RETAILER && <Checkbox label={`Add ${PLURAL[below]}`} checked={v.flags.addPartners} onChange={setFlag('addPartners')} />}
            {below === LEVELS.RETAILER && <Checkbox label="Add retailers" checked={v.flags.addPartners} onChange={setFlag('addPartners')} />}
            <Checkbox label="See devices in their network" checked={v.flags.seeDevices} onChange={setFlag('seeDevices')} />
            {can(P.STAFF_MANAGE) && (
              <Checkbox label="See customer phone numbers" note="· off by default for partners" checked={v.flags.seePhones} onChange={setFlag('seePhones')} />
            )}
          </FormSection>}
        </div>
      </div>
    </form>
  );
}