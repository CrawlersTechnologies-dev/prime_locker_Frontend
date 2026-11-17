import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Field from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { isLive } from '../../services/http';
import { MOCK_USERS } from '../../services/mock/users';
import { roleLabel } from '../../config/roles';

/** A-01 · Admin login — the same sign-in page for staff and every partner level. */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e, override) => {
    e?.preventDefault();
    const creds = override ?? form;
    const next = {};
    if (!creds.identifier.trim()) next.identifier = 'Enter your username, email or mobile number';
    if (!creds.password) next.password = 'Enter your password';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await login(creds);
      navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true });
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-form-side">
        <div className="auth-brand">
          <img src="/prime-locker-pro-mark.png" alt="" />
          <span>Prime Locker Pro</span>
        </div>

        <div className="auth-center">
          <form className="auth-form" onSubmit={submit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h1>Sign in</h1>
              <p className="lead">Admin console for retailers, customers, EMIs and device controls.</p>
            </div>

            {errors.form && <div role="alert" className="badge badge-bad" style={{ height: 'auto', padding: '10px 12px', borderRadius: 10, whiteSpace: 'normal' }}>{errors.form}</div>}

            <Field
              label={isLive('auth') ? 'Username, email or mobile number' : 'Email or mobile number'}
              autoComplete="username"
              value={form.identifier}
              onChange={set('identifier')}
              error={errors.identifier}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              labelAction={<Link to="/login" style={{ fontSize: 13, fontWeight: 500 }}>Forgot password?</Link>}
            />
            <label className="checkbox">
              <input type="checkbox" checked={form.remember} onChange={set('remember')} />
              Keep me signed in on this computer
            </label>
            <Button type="submit" size="lg" block disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button>
            <div className="auth-or">or</div>
            <Button variant="secondary" size="lg" block>Sign in with OTP</Button>

            {!isLive('auth') && (
              <div className="demo-box">
                <span className="demo-title">Demo accounts (mock mode only) — password: primelocker</span>
                <div className="demo-grid">
                  {MOCK_USERS.map((u) => (
                    <Button
                      key={u.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => submit(null, { identifier: u.email, password: 'primelocker' })}
                    >
                      {roleLabel(u)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        <p className="auth-foot">Every sign-in is recorded in the audit log.</p>
      </section>

      <section className="auth-hero" aria-hidden="true">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="eyebrow">PRIME LOCKER CONSOLE</span>
          <h2>Every financed device, in one calm console.</h2>
          <p>Track EMIs, collect payments and lock or unlock phones and TVs remotely — with every action logged.</p>
        </div>
        <div className="hero-card">
          <div className="row">
            <span className="hero-tile"><Icon name="phone" /></span>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Samsung Galaxy A15</span>
              <span className="sub">Ravi Kulkarni · IMEI …448210</span>
            </div>
            <Badge status="locked" />
          </div>
          <hr />
          <div className="row-between"><span className="sub">EMI plan</span><span className="fw-600">₹1,225 × 12</span></div>
          <div className="row-between"><span className="sub">Overdue</span><span className="fw-600 text-bad">₹1,225 · 15 days</span></div>
          <div className="row" style={{ gap: 8 }}>
            <span className="btn btn-primary btn-sm" style={{ flexGrow: 1 }}>Record payment</span>
            <span className="btn btn-secondary btn-sm" style={{ flexGrow: 1 }}>Unlock</span>
          </div>
        </div>
        <div className="hero-features">
          <span><Icon name="phone" />Android &amp; iPhone</span>
          <span><Icon name="tv" />Mobiles &amp; smart TVs</span>
          <span><Icon name="chat" />WhatsApp reminders</span>
        </div>
      </section>
    </div>
  );
}
