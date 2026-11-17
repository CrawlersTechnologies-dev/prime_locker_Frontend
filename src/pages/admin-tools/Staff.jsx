import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { adminApi, ADMIN_LIVE, STAFF_ROLE_OPTIONS } from '../../services/adminApi';
import { P, staffMatrix } from '../../config/permissions';
import { STAFF_ROLES, STAFF_ROLE_META } from '../../config/roles';
import {
  Badge, Button, Card, Dialog, ErrorBlock, Field, FormRow, LoadingBlock, PageHeader, SelectField, StateMessage, Table, Tabs, TabPanel, useToast,
} from '../../components/ui';

const PERM_LABEL = {
  [P.KEYS_GENERATE]: 'Generate keys', [P.KEYS_SEND]: 'Send keys', [P.KEYS_APPROVE]: 'Approve key requests', [P.KEYS_HISTORY]: 'Key history',
  [P.NETWORK_VIEW]: 'See partners', [P.PARTNER_ADD]: 'Add partners', [P.PARTNER_SUSPEND]: 'Suspend partners',
  [P.RETAILERS_VIEW]: 'See retailers', [P.RETAILERS_MANAGE]: 'Add and edit retailers', [P.CUSTOMERS_VIEW]: 'See customers',
  [P.CUSTOMERS_MANAGE]: 'Add customers', [P.CUSTOMER_PHONE_VIEW]: 'See customer phone numbers', [P.DEVICES_VIEW]: 'See devices',
  [P.DEVICES_CONTROL]: 'Lock, unlock and control devices', [P.DEVICES_OFFLINE_CODE]: 'Offline unlock codes', [P.DEVICES_LOCATION]: 'Device location',
  [P.EMI_TEMPLATES]: 'EMI plans', [P.EMI_CREATE]: 'Set up EMIs', [P.PAYMENTS_RECORD]: 'Record payments', [P.COLLECTIONS_VIEW]: 'See payments',
  [P.WHATSAPP_SEND]: 'Send WhatsApp', [P.BANNERS_MANAGE]: 'Offers and banners', [P.REPORTS_VIEW]: 'Reports', [P.REPORTS_EXPORT]: 'Export',
  [P.AUDIT_VIEW]: 'Audit logs', [P.STAFF_MANAGE]: 'Manage staff', [P.SETTINGS_MANAGE]: 'Settings',
};
const ROLE_COLS = [STAFF_ROLES.SUPER_ADMIN, STAFF_ROLES.OPERATIONS, STAFF_ROLES.COLLECTIONS, STAFF_ROLES.SUPPORT, STAFF_ROLES.VIEWER];

/** A-34 Staff · A-35 Add staff (dialog) · A-36 Roles & permissions (tab). */
export default function Staff() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const tab = pathname.endsWith('/roles') ? 'roles' : 'staff';
  const adding = pathname.endsWith('/new');
  const { data, loading, error, reload } = useApi(() => (ADMIN_LIVE ? adminApi.staff() : Promise.resolve(null)), []);
  const [busy, setBusy] = useState(null);

  if (!ADMIN_LIVE) return <NeedsServer title="Staff & roles" />;

  const change = async (s, patch, msg) => {
    setBusy(s.id);
    try {
      if (patch.active === false) await adminApi.deactivateStaff(s.id); else await adminApi.updateStaff(s.id, patch);
      toast(msg); reload();
    } catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };

  const columns = [
    { key: 'name', header: 'Name', width: '1.5fr', render: (s) => <div className="cell-stack"><span className="fw-600">{s.name}</span><span className="cell-sub">{s.email}</span></div> },
    { key: 'mobile', header: 'Mobile', width: '1fr', render: (s) => <span className="ink-2">{s.mobile || '—'}</span> },
    { key: 'role', header: 'Role', width: '1.4fr', render: (s) => (
      <select className="input" style={{ height: 34, padding: "0 10px", fontSize: 14 }} aria-label={`Role for ${s.name}`} value={s.role} disabled={busy === s.id || !s.active}
        onChange={(e) => change(s, { role: e.target.value }, `${s.name} is now ${STAFF_ROLE_OPTIONS.find((o) => o.value === e.target.value)?.label}`)}>
        {STAFF_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ) },
    { key: 'since', header: 'Added', width: '0.8fr', render: (s) => <span className="ink-2">{s.since}</span> },
    { key: 'status', header: 'Status', width: '0.7fr', render: (s) => <Badge tone={s.active ? 'ok' : 'mute'}>{s.active ? 'Active' : 'Deactivated'}</Badge> },
    { key: 'act', header: '', width: '120px', render: (s) => (s.active
      ? <Button variant="secondary" size="sm" disabled={busy === s.id} onClick={() => change(s, { active: false }, `${s.name} can no longer sign in`)}>Deactivate</Button>
      : <Button variant="secondary" size="sm" disabled={busy === s.id} onClick={() => change(s, { active: true }, `${s.name} can sign in again`)}>Reactivate</Button>) },
  ];

  const matrix = staffMatrix();
  const permColumns = [
    { key: 'p', header: 'Can…', width: '2fr', render: (r) => <span>{r.label}</span> },
    ...ROLE_COLS.map((role) => ({ key: role, header: STAFF_ROLE_META[role].label, width: '1fr', align: 'center', render: (r) => (
      r.row[role] ? <span style={{ color: 'var(--ok)', fontWeight: 600 }} aria-label="Yes">✓</span> : <span className="muted" aria-label="No">—</span>
    ) })),
  ];
  const permRows = Object.entries(PERM_LABEL).filter(([k]) => matrix[k]).map(([k, label]) => ({ id: k, label, row: matrix[k] }));

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader title="Staff & roles" subtitle="Prime Locker employees who sign in to this panel. Partners are managed under Partners."
        actions={tab === 'staff' && <Button icon="plus" onClick={() => navigate('/staff/new')}>Add staff</Button>} />
      <Tabs label="Staff sections" idPrefix="st" value={tab} onChange={(t) => navigate(t === 'roles' ? '/staff/roles' : '/staff')}
        tabs={[{ value: 'staff', label: `Staff${data ? ` (${data.length})` : ''}` }, { value: 'roles', label: 'Roles & permissions' }]} />
      <TabPanel idPrefix="st" value={tab}>
        {tab === 'staff' && (
          <Card flush>
            {error ? <ErrorBlock error={error} onRetry={reload} />
              : loading && !data ? <LoadingBlock rows={3} />
              : data.length === 0 ? (
                <StateMessage icon="shield" title="No staff yet" action={<Button icon="plus" onClick={() => navigate('/staff/new')}>Add staff</Button>}>
                  Add people from your team with only the access they need: operations, collections, support or view-only.
                </StateMessage>
              ) : <Table columns={columns} rows={data} minWidth={860} />}
          </Card>
        )}
        {tab === 'roles' && (
          <Card flush>
            <div style={{ padding: '18px 24px 6px' }}>
              <span className="sub">What each staff role can do in the panel. Super admin is your own account. Changing these needs a code change, so ask before promising a role more access.</span>
            </div>
            <Table columns={permColumns} rows={permRows} minWidth={760} />
          </Card>
        )}
      </TabPanel>
      {adding && <AddStaffDialog onClose={() => navigate('/staff', { replace: true })} onDone={() => { navigate('/staff', { replace: true }); reload(); }} />}
    </div>
  );
}

function AddStaffDialog({ onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ name: '', email: '', mobile: '', role: 'STAFF_OPERATIONS', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors({}); };
  const save = async () => {
    const e = {};
    if (!v.name.trim()) e.name = 'Enter their name';
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email. They sign in with it.';
    if (v.mobile && v.mobile.replace(/\D/g, '').length < 10) e.mobile = 'Enter a 10-digit mobile number, or leave it empty';
    if (v.password.length < 8) e.password = 'Use at least 8 characters';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await adminApi.createStaff(v);
      toast(`${v.name.trim()} added · they sign in with ${v.email.trim().toLowerCase()}`);
      onDone();
    } catch (err) {
      setErrors({ email: err.data?.email?.[0], form: err.data?.email ? undefined : err.message });
      setBusy(false);
    }
  };
  const role = STAFF_ROLE_OPTIONS.find((o) => o.value === v.role);
  return (
    <Dialog open onClose={onClose} width={560} title="Add staff" subtitle="Share the email and password with them. They can change the password in My profile."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Adding…' : 'Add staff'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <FormRow>
        <Field label="Full name" value={v.name} onChange={set('name')} error={errors.name} data-autofocus />
        <Field label={<>Mobile <span className="optional">(optional)</span></>} type="tel" value={v.mobile} onChange={set('mobile')} error={errors.mobile} />
      </FormRow>
      <Field label="Email (sign-in)" type="email" autoComplete="off" value={v.email} onChange={set('email')} error={errors.email} />
      <SelectField label="Role" value={v.role} onChange={set('role')} options={STAFF_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} hint={role?.note} />
      <Field label="Password" type="text" autoComplete="new-password" value={v.password} onChange={set('password')} error={errors.password}
        labelAction={<button type="button" className="btn btn-text" style={{ padding: 0, height: 'auto' }}
          onClick={() => setV((s) => ({ ...s, password: `PL-${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}` }))}>Generate</button>} />
    </Dialog>
  );
}

export function NeedsServer({ title }) {
  return (
    <div className="page">
      <PageHeader title={title} />
      <Card><StateMessage icon="construction" title="This screen reads live data">Add <span className="mono">admin</span> to VITE_LIVE_MODULES in .env, then restart the panel.</StateMessage></Card>
    </div>
  );
}
