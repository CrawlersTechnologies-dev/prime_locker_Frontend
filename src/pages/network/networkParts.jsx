import { useEffect, useMemo, useState } from 'react';
import { keysApi } from '../../services/networkApi';
import { KEY_PLATFORMS, KEY_TYPES, LEVEL_ROLE } from '../../services/keysLive';
import { isLive } from '../../services/http';
import { LEVEL_META } from '../../config/roles';
import { num } from '../../utils/format';
import { useApi } from '../../hooks/useApi';
import { Badge, Button, Dialog, Field, Segmented, SelectField, useToast } from '../../components/ui';
import './network.css';

const SHORT = { company: 'SA', super_distributor: 'SD', distributor: 'D', sub_distributor: 'Sub', retailer: 'R' };

/** SA / SD / D / Sub / R chip. `long` shows the full level name. */
export function LevelChip({ level, long }) {
  const label = long ? (level === 'company' ? 'Super admin' : LEVEL_META[level]?.label) : SHORT[level];
  return <span className={`lv lv-${level}`} title={LEVEL_META[level]?.label}>{label}</span>;
}

export function KeyStatusBadge({ status }) {
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

const parseQty = (v) => Number(String(v).replace(/[,\s]/g, ''));

const KEYS_LIVE = isLive('keys');
const LEVEL_NAME = { super_distributor: 'Super distributor', distributor: 'Distributor', sub_distributor: 'Sub distributor', retailer: 'Retailer' };

/** Mobile / Smart TV switch (backend keys have a type). */
function KeyTypeSwitch({ value, onChange, platforms = false }) {
  return (
    <div className="field">
      <span className="field-label">Key type</span>
      <Segmented label="Key type" options={(platforms ? KEY_PLATFORMS : KEY_TYPES).map((t) => ({ value: t.value, label: t.label }))} value={value} onChange={onChange} />
    </div>
  );
}

/**
 * N-06 · Send keys. Keys only go to partners directly below `fromId` (default: the user's own org).
 * Pass `toId` to fix the recipient, `requestId` to approve a request at the same time.
 */
export function SendKeysDialog({ open, onClose, onDone, fromId, toId: fixedTo, toLevel, presetQty }) {
  const toast = useToast();
  const [deviceType, setDeviceType] = useState('MOBILE');
  // Live: the backend lists recipients per role, so a fixed recipient needs its level.
  const [role, setRole] = useState(toLevel ? LEVEL_ROLE[toLevel] : undefined);
  const { data } = useApi(
    () => (open ? keysApi.recipients(fromId, { deviceType, role, toId: fixedTo }) : Promise.resolve(null)),
    [open, fromId, deviceType, role],
  );
  const [toId, setToId] = useState(fixedTo ?? '');
  const [qty, setQty] = useState(presetQty ? String(presetQty) : '');
  const [ref, setRef] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const to = useMemo(() => data?.options.find((o) => o.id === toId), [data, toId]);
  useEffect(() => {
    if (to?.waiting && !qty) setQty(String(to.waiting.qty));
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const from = data?.from;
  const n = parseQty(qty);
  const valid = Number.isInteger(n) && n > 0;
  const tooMany = from && valid && n > from.balance;
  const quick = from ? [100, 500, 1000].filter((q) => q < from.balance) : [];

  const submit = async () => {
    if (!toId) { setError('Pick who gets the keys'); return; }
    if (!valid) { setError('Enter a whole number of keys'); return; }
    if (tooMany) { setError(`You have ${num(from.balance)} keys`); return; }
    setBusy(true);
    try {
      if (to?.waiting) await keysApi.approve(to.waiting.id, n);
      else await keysApi.send({ fromId: from.id, toId, qty: n, ref: ref.trim(), deviceType, role: data.role });
      toast(`${num(n)} keys sent to ${to.name}`);
      onDone?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      width={520}
      title="Send keys"
      subtitle={data?.live
        ? `${KEY_TYPES.find((t) => t.value === deviceType)?.label} keys you hold: ${num(from?.balance ?? 0)}`
        : from && from.level !== 'company' && fromId ? `From ${from.name}. Keys can only go to partners directly below.` : 'You can only send to partners directly below you.'}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !data} onClick={submit}>{busy ? 'Sending…' : valid ? `Send ${num(n)} keys` : 'Send keys'}</Button>
      </>}
    >
      {KEYS_LIVE && <KeyTypeSwitch value={deviceType} onChange={(v) => { setDeviceType(v); setError(null); }} />}
      {data?.live && !fixedTo && data.roles.length > 1 && (
        <SelectField
          label="Send to"
          value={data.role}
          onChange={(e) => { setRole(e.target.value); setToId(''); setError(null); }}
          options={data.roles.map((r) => ({ value: r.value, label: LEVEL_NAME[r.level] ?? r.value }))}
        />
      )}
      {!data ? <div className="skeleton" style={{ height: 160 }} /> : (
        <>
          {fixedTo && to ? (
            <div className="field">
              <span className="field-label">To</span>
              <div className="recipient">
                <LevelChip level={to.level} />
                <div className="cell-stack" style={{ flexGrow: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{to.name}</span>
                  <span style={{ fontSize: 13, color: to.low || to.waiting ? 'var(--bad)' : 'var(--muted)' }}>
                    Balance {num(to.balance)}{to.waiting ? ` · requested ${num(to.waiting.qty)}` : ''}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <SelectField
              label="To"
              value={toId}
              onChange={(e) => { setToId(e.target.value); setError(null); }}
              options={data.options.map((o) => ({ value: o.id, label: `${o.name} · balance ${num(o.balance)}${o.waiting ? ` · asked for ${num(o.waiting.qty)}` : ''}` }))}
              placeholder={data.options.length ? 'Select a partner' : data.live ? 'No active accounts at this level yet' : 'No partners below you yet'}
            />
          )}
          <div className="field">
            <label className="field-label" htmlFor="send-qty">How many keys</label>
            <input id="send-qty" className={`input qty-big${error ? ' has-error' : ''}`} inputMode="numeric" value={qty}
              onChange={(e) => { setQty(e.target.value); setError(null); }} aria-invalid={!!error} data-autofocus />
            <div className="quick" role="group" aria-label="Quick amounts">
              {quick.map((q) => <button key={q} type="button" aria-pressed={n === q} onClick={() => setQty(String(q))}>{num(q)}</button>)}
              {from && <button type="button" aria-pressed={n === from.balance} disabled={!from.balance} onClick={() => setQty(String(from.balance))}>{num(from.balance)} (all)</button>}
            </div>
            {error && <span className="field-error" role="alert">{error}</span>}
          </div>
          {!to?.waiting && (
            <Field label={<>Reference <span className="optional">(invoice or payment note)</span></>} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="INV-PL-0931 · paid by NEFT" />
          )}
          {to?.waiting && <span className="sub">This also approves their request {to.waiting.id}.</span>}
          {from && (
            <div className="after-box">
              <div><span>{from.level === 'company' ? 'Company stock' : data.live ? 'Your keys' : `${from.name} balance`} after</span><span className="fw-600" style={{ color: tooMany ? 'var(--bad)' : undefined }}>{valid ? num(from.balance - n) : num(from.balance)}</span></div>
              {to && <div><span>{to.name} balance after</span><span className="fw-600">{valid ? num(to.balance + n) : num(to.balance)}</span></div>}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

/** Ask the level above for keys (no design screen — follows the Send keys dialog). */
export function RequestKeysDialog({ open, onClose, onDone, parentName, balance, usedPerMonth }) {
  const toast = useToast();
  const [deviceType, setDeviceType] = useState('ANDROID');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const suggested = usedPerMonth ? Math.max(50, Math.ceil((usedPerMonth * 2) / 50) * 50) : 100;
  const submit = async () => {
    const n = parseQty(qty);
    if (!Number.isInteger(n) || n <= 0) { setError('Enter a whole number of keys'); return; }
    setBusy(true);
    try {
      await keysApi.request(n, note.trim(), deviceType);
      toast(`Request for ${num(n)} keys sent to ${parentName}`);
      onDone?.();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} width={480} title={`Request keys from ${parentName}`}
      subtitle={`You have ${num(balance)} keys${usedPerMonth ? ` and use about ${num(usedPerMonth)} a month` : ''}.`}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send request'}</Button>
      </>}>
      {KEYS_LIVE && <KeyTypeSwitch platforms value={deviceType} onChange={setDeviceType} />}
      <div className="field">
        <label className="field-label" htmlFor="req-qty">How many keys</label>
        <input id="req-qty" className={`input qty-big${error ? ' has-error' : ''}`} inputMode="numeric" value={qty} placeholder={String(suggested)}
          onChange={(e) => { setQty(e.target.value); setError(null); }} aria-invalid={!!error} data-autofocus />
        <div className="quick">
          <button type="button" aria-pressed={parseQty(qty) === suggested} onClick={() => setQty(String(suggested))}>{num(suggested)} · about 2 months</button>
        </div>
        {error && <span className="field-error" role="alert">{error}</span>}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="req-note">Note <span className="optional">(why you need them)</span></label>
        <textarea id="req-note" className="textarea" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dasara rush — 5–6 phones a day" />
      </div>
    </Dialog>
  );
}

/** Decline a key request, with an optional reason the requester sees. */
export function DeclineRequestDialog({ request, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!request) return null;
  const submit = async () => {
    setBusy(true);
    try { await keysApi.decline(request.id, reason.trim()); toast('Request declined'); onDone?.(); }
    catch (err) { toast(err.message, 'bad'); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} width={460} title={`Decline ${request.from.name}'s request?`}
      subtitle={`They asked for ${num(request.qty)} keys. They can send a new request later.`}
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={submit}>Decline request</Button>
      </>}>
      {request.reasonSupported !== false && (
        <div className="field">
          <label className="field-label" htmlFor="decline-reason">Reason <span className="optional">(shown to {request.from.name})</span></label>
          <textarea id="decline-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Too many for your current usage — ask for one month at a time." />
        </div>
      )}
    </Dialog>
  );
}

/** N-05 · Generate keys (company only) */
export function GenerateKeysDialog({ open, onClose, onDone }) {
  const toast = useToast();
  const [deviceType, setDeviceType] = useState('ANDROID');
  const [qty, setQty] = useState('2500');
  const [ref, setRef] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    const n = parseQty(qty);
    if (!Number.isInteger(n) || n <= 0) { setError('Enter a whole number of keys'); return; }
    const max = KEYS_LIVE ? 10000 : 50000;
    if (n > max) { setError(`Generate at most ${num(max)} keys in one batch`); return; }
    setBusy(true);
    try {
      await keysApi.generate(n, ref.trim(), deviceType);
      toast(`${num(n)} ${KEYS_LIVE ? `${KEY_PLATFORMS.find((t) => t.value === deviceType)?.label} ` : ''}keys added to company stock`);
      onDone?.();
    }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} width={480} title="Generate keys" subtitle="New keys go into company stock. You send them to super distributors from there."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={submit}>{busy ? 'Generating…' : 'Generate keys'}</Button>
      </>}>
      {KEYS_LIVE && <KeyTypeSwitch platforms value={deviceType} onChange={setDeviceType} />}
      <div className="field">
        <label className="field-label" htmlFor="gen-qty">How many keys</label>
        <input id="gen-qty" className={`input qty-big${error ? ' has-error' : ''}`} inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value); setError(null); }} aria-invalid={!!error} data-autofocus />
        <div className="quick">
          {[1000, 2500, 5000].map((q) => <button key={q} type="button" aria-pressed={parseQty(qty) === q} onClick={() => setQty(String(q))}>{num(q)}</button>)}
        </div>
        {error && <span className="field-error" role="alert">{error}</span>}
      </div>
      {<Field label={<>Batch reference <span className="optional">(optional)</span></>} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="BATCH-2026-05" />}
    </Dialog>
  );
}