import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { authApi } from '../../services/authApi';
import { num } from '../../utils/format';
import { Badge, Button, Card, ErrorBlock, Field, KeyValue, LoadingBlock, PageHeader, useToast } from '../../components/ui';

const ROLE = {
  SUPER_ADMIN: 'Super admin', SUPER_DISTRIBUTOR: 'Super distributor', DISTRIBUTOR: 'Distributor', SUB_DISTRIBUTOR: 'Sub distributor', RETAILER: 'Retailer',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const since = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'; };

/** A-42 · My profile & security: account details from GET /auth/me/ and change password. */
export default function Profile() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { data: p, loading, error, reload } = useApi(() => authApi.profile(), []);
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (loading && !p) return <LoadingBlock rows={3} />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors({}); };
  const save = async (e) => {
    e.preventDefault();
    const x = {};
    if (!v.current) x.current = 'Enter your current password';
    if (v.next.length < 6) x.next = 'Use at least 6 characters';
    else if (v.next === v.current) x.next = 'Pick a password different from the current one';
    if (v.confirm !== v.next) x.confirm = 'The two new passwords don’t match';
    setErrors(x);
    if (Object.keys(x).length) return;
    setBusy(true);
    try {
      await authApi.changePassword(v);
      setV({ current: '', next: '', confirm: '' });
      toast('Password changed. Use the new one next time you sign in.');
    } catch (err) {
      const d = err.data ?? {};
      setErrors({
        current: d.old_password?.[0],
        next: d.new_password?.[0],
        confirm: d.confirm_password?.[0],
        form: !d.old_password && !d.new_password && !d.confirm_password ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const name = p?.name || user.name;
  const keys = p?.available_keys;
  const counts = p?.children_counts;
  const isCompany = (p?.role ?? user.role) === 'SUPER_ADMIN';

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader title="My profile & security" subtitle={`${name} · ${ROLE[p?.role ?? user.role] ?? ''}`}
        actions={<Button variant="secondary" icon="logout" onClick={logout}>Sign out</Button>} />

      <div className="split-side">
        <Card style={{ padding: '20px 24px' }}>
          <h2 className="h2" style={{ paddingBottom: 8 }}>Account</h2>
          <KeyValue items={[
            ['Name', name],
            ['Sign-in username', p?.username ?? user.username],
            ['Email', p?.email || '—'],
            ['Mobile', p?.mobile_number || '—'],
            !isCompany && ['Business', p?.business_name || '—'],
            !isCompany && ['Reports to', p?.parent ? (p.parent.business_name || p.parent.name) : '—'],
            !isCompany && ['Address', [p?.address, p?.city, p?.state, p?.pincode].filter(Boolean).join(', ') || '—'],
            ['Member since', since(p?.date_joined)],
            ['Status', p?.is_active === false ? <Badge tone="bad" key="s">Inactive</Badge> : <Badge tone="ok" key="s">Active</Badge>],
          ]} />
          {keys && (
            <>
              <h2 className="h2" style={{ padding: '18px 0 8px' }}>Keys and network</h2>
              <KeyValue items={[
                ['Keys you hold', `${num(keys.total ?? 0)}${keys.MOBILE != null || keys.TV != null ? ` (Mobile ${num(keys.MOBILE ?? 0)} · TV ${num(keys.TV ?? 0)})` : ''}`],
                counts && !isCompany && ['Below you', [
                  counts.distributors && `${num(counts.distributors)} distributors`,
                  counts.sub_distributors && `${num(counts.sub_distributors)} sub distributors`,
                  `${num(counts.retailers ?? 0)} retailers`,
                  `${num(counts.customers ?? 0)} customers`,
                ].filter(Boolean).join(' · ')],
              ]} />
            </>
          )}
        </Card>

        <Card as="form" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={save} noValidate>
          <h2 className="h2">Change password</h2>
          {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
          <Field label="Current password" type="password" autoComplete="current-password" value={v.current} onChange={set('current')} error={errors.current} />
          <Field label="New password" type="password" autoComplete="new-password" value={v.next} onChange={set('next')} error={errors.next} hint="At least 6 characters" />
          <Field label="Repeat new password" type="password" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={errors.confirm} />
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</Button>
        </Card>
      </div>
    </div>
  );
}
