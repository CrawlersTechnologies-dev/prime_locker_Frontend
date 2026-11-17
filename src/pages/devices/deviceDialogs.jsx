import { useEffect, useMemo, useState } from 'react';
import { devicesApi, LOCK_MESSAGES } from '../../services/devicesApi';
import { inr } from '../../utils/format';
import { adminApi, ADMIN_LIVE } from '../../services/adminApi';
import { Button, Checkbox, Dialog, Field, Icon, MediaLink, Segmented, SelectField, Toggle, UploadBox, useToast } from '../../components/ui';

/** 123 456 / 1234 5678 */
export const fmtCode = (code = '') => String(code).replace(/^(\d{3,4})(\d{3,4})$/, '$1 $2');

function useAction(onDone) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn, message) => {
    setBusy(true);
    try {
      const updated = await fn();
      toast(updated?.queued ? `${message} · applies when the device is back online` : message);
      onDone(updated);
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

/** A-13 · Lock device confirmation */
export function LockDialog({ device, open, onClose, onDone }) {
  const kind = device.type === 'tv' ? 'TV' : 'phone';
  const [message, setMessage] = useState('EMI overdue — pay to unlock');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState(null);
  const [busy, run] = useAction(onDone);
  const amount = device.emi?.overdue?.amount ?? device.emi?.amount;
  // Saved lock-screen messages (Settings → Lock-screen messages); the default one is filled in.
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    if (!device.live || !ADMIN_LIVE) return;
    let on = true;
    adminApi.lockMessages().then((list) => {
      if (!on) return;
      setTemplates(list);
      const def = list.find((t) => t.isDefault);
      if (def) setMessage(def.text);
    }).catch(() => null);
    return () => { on = false; };
  }, [device.live]);
  const picked = templates.find((t) => t.text === message)?.id ?? '';

  const submit = () => {
    if (!device.live && !reason.trim()) { setError('Add a reason. It’s saved in the audit log.'); return; }
    run(() => devicesApi.setLock(device.id, true, { message, reason, notifyCustomer: notify }), 'Device locked');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      role="alertdialog"
      icon="lock"
      width={480}
      title={`Lock ${device.customer.name}'s ${kind}?`}
      subtitle={`The ${device.name} will show the payment screen${device.type === 'tv' ? '' : ' and allow only emergency calls'}. It unlocks by itself once the ${amount ? inr(amount) : ''} payment is recorded.`}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={submit}>{busy ? 'Locking…' : 'Lock device'}</Button>
      </>}
    >
      {templates.length > 0 && (
        <SelectField label="Saved message" value={picked} onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setMessage(t.text); }}
          options={[{ value: '', label: 'Type my own' }, ...templates.map((t) => ({ value: t.id, label: t.isDefault ? `${t.title} (default)` : t.title }))]} />
      )}
      <Field label="Message on lock screen" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={device.live ? 300 : 80} />
      <Field
        label={<>Reason <span className="optional">(saved in the audit log)</span></>}
        placeholder="For example: EMI overdue 5 days, 2 reminders ignored"
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(null); }}
        error={error}
        data-autofocus
      />
      {!device.live && <Checkbox label="Also send a WhatsApp message to the customer" checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
    </Dialog>
  );
}

/** Manual unlock (no design screen — follows A-13's pattern). */
export function UnlockDialog({ device, open, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, run] = useAction(onDone);
  const submit = () => {
    if (!device.live && !reason.trim()) { setError('Add a reason. It’s saved in the audit log.'); return; }
    run(() => devicesApi.setLock(device.id, false, { reason }), 'Device unlocked');
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon="unlock"
      tone="info"
      width={480}
      title={`Unlock ${device.customer.name}'s ${device.type === 'tv' ? 'TV' : 'phone'}?`}
      subtitle={device.emi?.overdue
        ? `${inr(device.emi.overdue.amount)} is still overdue. Without a recorded payment, the device locks again after the grace period.`
        : 'The payment screen is removed and the device works normally.'}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={submit}>{busy ? 'Unlocking…' : 'Unlock device'}</Button>
      </>}
    >
      {<Field
        label={<>Reason <span className="optional">(saved in the audit log)</span></>}
        placeholder="For example: payment received in cash, receipt to follow"
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(null); }}
        error={error}
        data-autofocus
      />}
    </Dialog>
  );
}

/** A-14 · Offline unlock code */
export function OfflineCodeDialog({ device, open, onClose, onDone }) {
  const toast = useToast();
  const closed = device.emi?.closed;
  const [duration, setDuration] = useState(closed ? 'permanent' : 'next_due');
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const d = await devicesApi.issueOfflineCode(device.id, duration);
      setIssued(d.offlineCode);
      onDone(d, { keepOpen: true });
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(issued.code); toast('Code copied'); } catch { toast('Couldn’t copy. Select the code and copy it.', 'bad'); }
  };
  const close = () => { setIssued(null); onClose(); };
  const [sending, setSending] = useState(false);
  const sendToRetailer = async () => {
    setSending(true);
    try {
      const r = await devicesApi.sendOfflineCode(device.id);
      toast(`Code sent to ${device.retailer?.name ?? 'the retailer'}${r.whatsapp ? ' on WhatsApp and in the app' : ' in the app'}`);
    } catch (err) { toast(err.message, 'bad'); }
    finally { setSending(false); }
  };

  const OPTIONS = [
    { value: 'next_due', title: 'Until the next due date', note: device.emi?.nextDue ? `Locks again on ${device.emi.nextDue.slice(0, 6)} if unpaid` : 'Locks again on the next due date if unpaid', disabled: closed },
    { value: '24h', title: '24 hours', note: 'Time to arrange payment', disabled: closed },
    { value: 'permanent', title: 'Permanently', note: 'Only when the EMI is fully closed', disabled: !closed },
  ];

  return (
    <Dialog
      open={open}
      onClose={close}
      width={520}
      title="Offline unlock code"
      subtitle={`For ${device.customer.name}'s ${device.short} when it has no SIM or internet. The customer types it on the lock screen.`}
      actions={issued ? <>
        <Button variant="secondary" icon="copy" onClick={copy}>Copy</Button>
        <Button variant="secondary" icon="send" disabled={sending || !device.retailer} onClick={sendToRetailer}>{sending ? 'Sending…' : 'Send to retailer'}</Button>
        <Button onClick={close}>Done</Button>
      </> : <>
        <Button variant="secondary" data-close onClick={close}>Cancel</Button>
        <Button disabled={busy} onClick={generate}>{busy ? 'Creating code…' : 'Create code'}</Button>
      </>}
    >
      {device.live && (
        <p className="sub" style={{ margin: '0 0 12px' }}>Creating a new code replaces the current one{device.offlineCode ? ` (${fmtCode(device.offlineCode.code)})` : ''}. The device takes the new code the next time it checks in.</p>
      )}
      <fieldset className="options" disabled={Boolean(issued)}>
        <legend>Unlock for</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="option">
            <input type="radio" name="duration" value={o.value} checked={duration === o.value} disabled={o.disabled} onChange={() => setDuration(o.value)} />
            <span><strong>{o.title}</strong><span className="sub">{o.note}</span></span>
          </label>
        ))}
      </fieldset>
      {issued && (
        <div className="code-box is-large" aria-live="polite">
          <span className="code-label">ONE-TIME CODE</span>
          <span className="code">{fmtCode(issued.code)}</span>
          <span className="sub">{device.live ? `Works until ${issued.expires}` : `Works once · expires ${issued.expires}`}</span>
        </div>
      )}
    </Dialog>
  );
}

const initial = (name) => name[0].toUpperCase();

/** A-12 · Manage apps (lock & hide) */
export function AppsDialog({ device, open, onClose, onDone }) {
  const [apps, setApps] = useState(device.apps);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, run] = useAction(onDone);

  const counts = { all: device.appCount, locked: apps.filter((a) => a.locked).length, hidden: apps.filter((a) => a.hidden).length };
  const shown = useMemo(() => apps
    .filter((a) => filter === 'all' || a[filter])
    .filter((a) => !q || `${a.name} ${a.pkg}`.toLowerCase().includes(q.toLowerCase())), [apps, filter, q]);
  const changed = apps.some((a, i) => a.locked !== device.apps[i].locked || a.hidden !== device.apps[i].hidden);
  const set = (pkg, key, value) => setApps((l) => l.map((a) => (a.pkg === pkg ? { ...a, [key]: value } : a)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      flush
      width={640}
      title="Manage apps"
      subtitle={`${device.customer.name} · ${device.name} · ${device.appCount} apps installed`}
      footerNote="System apps like Phone and Settings can't be hidden."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !changed} onClick={() => run(() => devicesApi.applyApps(device.id, apps.map(({ pkg, locked, hidden }) => ({ pkg, locked, hidden }))), 'Apps updated on the device')}>
          {busy ? 'Applying…' : 'Apply to device'}
        </Button>
      </>}
    >
      <div className="app-tools">
        <label className="filter-search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search apps" aria-label="Search apps" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Segmented label="Filter apps" value={filter} onChange={setFilter} options={[
          { value: 'all', label: `All ${counts.all}` },
          { value: 'locked', label: `Locked ${counts.locked}` },
          { value: 'hidden', label: `Hidden ${counts.hidden}` },
        ]} />
      </div>
      <div className="app-row is-head"><span /><span>App</span><span>Lock</span><span>Hide</span></div>
      <div className="app-list">
        {shown.length === 0 && <p className="sub" style={{ padding: '16px 24px' }}>No apps match.</p>}
        {shown.map((a) => (
          <div key={a.pkg} className="app-row">
            <span className={`app-icon tone-${a.tone}`} aria-hidden="true">{initial(a.name)}</span>
            <div className="cell-stack"><span className="fw-600">{a.name}</span><span className="cell-sub mono">{a.pkg}</span></div>
            <div><Toggle label={`Lock ${a.name}`} checked={a.locked} onChange={(v) => set(a.pkg, 'locked', v)} disabled={a.system} /></div>
            <div><Toggle label={`Hide ${a.name}`} checked={a.hidden} onChange={(v) => set(a.pkg, 'hidden', v)} disabled={a.system} /></div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/** "Message on screen" → Send */
export function MessageDialog({ device, open, onClose, onDone }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [busy, run] = useAction(onDone);
  const submit = () => {
    if (!text.trim()) { setError('Write the message to show'); return; }
    run(() => devicesApi.sendMessage(device.id, text.trim()), 'Message sent to the device');
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={480}
      title="Message on screen"
      subtitle={device.type === 'tv' ? 'Shown full screen. The customer dismisses it with the remote.' : 'Shown on the device until the customer taps OK.'}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button icon="send" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send'}</Button>
      </>}
    >
      <div className="field">
        <label className="field-label" htmlFor="screen-msg">Message</label>
        <textarea id="screen-msg" className="textarea" maxLength={160} value={text} placeholder="Your EMI is due on 12 Oct. Please visit the store or pay online."
          onChange={(e) => { setText(e.target.value); setError(null); }} aria-invalid={!!error} />
        <span className={error ? 'field-error' : 'field-hint'}>{error ?? `${text.length}/160`}</span>
      </div>
    </Dialog>
  );
}

/** "Lock-screen wallpaper" → Change. Messages come from Settings · Lock-screen messages (A-40). */
export function WallpaperDialog({ device, open, onClose, onDone }) {
  const [key, setKey] = useState(device.wallpaper);
  const [busy, run] = useAction(onDone);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={480}
      title="Lock-screen wallpaper"
      subtitle="Pick a message. Edit the wording in Settings → Lock-screen messages."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy || key === device.wallpaper} onClick={() => run(() => devicesApi.setWallpaper(device.id, key), 'Wallpaper changed')}>
          {busy ? 'Saving…' : 'Set wallpaper'}
        </Button>
      </>}
    >
      <fieldset className="options">
        <legend className="visually-hidden">Wallpaper</legend>
        {LOCK_MESSAGES.map((m) => (
          <label key={m.key} className="option">
            <input type="radio" name="wallpaper" checked={key === m.key} onChange={() => setKey(m.key)} />
            <span><strong>{m.label}</strong></span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
/** Live: upload an image as the lock-screen wallpaper (POST /devices/:id/set-wallpaper/). */
export function LiveWallpaperDialog({ device, open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [lock, setLock] = useState(true);
  const [error, setError] = useState(null);
  const [busy, run] = useAction(onDone);
  const submit = () => {
    if (!file) { setError('Pick an image'); return; }
    run(() => devicesApi.setWallpaperFile(device.id, file, lock), 'Wallpaper sent to the device');
  };
  return (
    <Dialog open={open} onClose={onClose} width={480} title="Lock-screen wallpaper"
      subtitle="Shown on the lock screen. Use a portrait image with your payment message on it."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={submit}>{busy ? 'Uploading…' : 'Set wallpaper'}</Button>
      </>}>
      {device.wallpaperUrl && <MediaLink url={device.wallpaperUrl} className="btn btn-text">See the current wallpaper</MediaLink>}
      <UploadBox label="Wallpaper image" accept="image/*" file={file} onFile={(f) => { setFile(f); setError(null); }} error={error} wide />
      <Checkbox label="Stop the customer changing the wallpaper" checked={lock} onChange={(e) => setLock(e.target.checked)} />
    </Dialog>
  );
}
