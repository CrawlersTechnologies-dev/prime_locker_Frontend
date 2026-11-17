import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { devicesLive } from '../../services/devicesLive';
import { isLive } from '../../services/http';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import {
  Badge, Button, Card, CardHeader, Checkbox, Dialog, ErrorBlock, Field, FilterBar, FormRow, LoadingBlock, PageHeader,
  SearchInput, SelectField, SelectFilter, StateMessage, Table, Toggle, useToast,
} from '../../components/ui';
import { NeedsServer } from '../admin-tools/Staff';

const ENVS = [
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'STAGING', label: 'Staging (testing)' },
  { value: 'ALL', label: 'Both' },
];
const envLabel = (v) => ({ PRODUCTION: 'Production', STAGING: 'Staging', ALL: 'Both' }[v] ?? v);
const onlyDigits = (v) => String(v).replace(/\D/g, '');

/**
 * Approved phone models — RocketPay only enrols phones whose TAC (first 8 digits of the IMEI)
 * is on this list. GET/POST/PATCH/DELETE /tac-list/ · GET /tac-list/check/?imei=
 */
export default function ApprovedModels() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can(P.TAC_MANAGE);
  const [f, setF] = useQueryState({ q: '', environment: '' });
  const live = isLive('devices');
  const { data, loading, error, reload } = useApi(() => (live ? devicesLive.tacList(f) : Promise.resolve(null)), [f.q, f.environment]);
  const [editing, setEditing] = useState(null); // { row? }
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);

  if (!live) return <NeedsServer title="Approved phone models" />;

  const toggle = async (t) => {
    setBusy(t.id);
    try { await devicesLive.setTacActive(t.id, !t.active); toast(t.active ? `${t.tac} switched off` : `${t.tac} approved`); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy(deleting.id);
    try { await devicesLive.deleteTac(deleting.id); toast('Model removed'); setDeleting(null); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };

  const columns = [
    { key: 'tac', header: 'TAC', width: '0.9fr', render: (t) => <span className="mono fw-600">{t.tac}</span> },
    { key: 'model', header: 'Phone', width: '1.6fr', render: (t) => <div className="cell-stack"><span className="fw-600">{t.brand} {t.name}</span><span className="cell-sub">{t.model || '—'}</span></div> },
    { key: 'environment', header: 'For', width: '0.8fr', render: (t) => <Badge tone={t.environment === 'STAGING' ? 'warn' : 'info'}>{envLabel(t.environment)}</Badge> },
    { key: 'active', header: 'Approved', width: '0.8fr', render: (t) => (canEdit
      ? <Toggle label={`Approve ${t.tac}`} checked={t.active} disabled={busy === t.id} onChange={() => toggle(t)} />
      : <Badge tone={t.active ? 'ok' : 'mute'}>{t.active ? 'Yes' : 'Off'}</Badge>) },
    { key: 'updatedAt', header: 'Changed', width: '0.9fr', render: (t) => <span className="ink-2">{t.updatedAt}</span> },
    ...(canEdit ? [{ key: 'actions', header: '', width: '150px', render: (t) => (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={() => setEditing({ row: t })}>Edit</Button>
        <Button variant="secondary" size="sm" icon="close" aria-label={`Remove ${t.tac}`} onClick={() => setDeleting(t)} />
      </div>
    ) }] : []),
  ];
  const active = (data ?? []).filter((t) => t.active).length;

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Approved phone models"
        subtitle="RocketPay can only lock these models. The Retailer app checks the IMEI against this list before enrolment."
        actions={canEdit && <>
          <Button variant="secondary" icon="upload" onClick={() => setImporting(true)}>Paste a list</Button>
          <Button icon="plus" onClick={() => setEditing({})}>Add model</Button>
        </>}
      />

      <ImeiCheck />

      <FilterBar>
        <SearchInput label="Search models" placeholder="TAC, brand or model" value={f.q} onChange={(q) => setF({ q })} />
        <SelectFilter label="For" allLabel="Production and staging" value={f.environment} onChange={(environment) => setF({ environment })}
          options={[{ value: 'PRODUCTION', label: 'Production' }, { value: 'STAGING', label: 'Staging' }]} />
      </FilterBar>

      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <LoadingBlock rows={4} />
          : data.length === 0 && !f.q && !f.environment ? (
            <StateMessage icon="phone" title="No approved models yet"
              action={canEdit && <Button icon="upload" onClick={() => setImporting(true)}>Paste RocketPay’s list</Button>}>
              Until this list has entries the server lets every phone through. Add RocketPay’s approved TAC list before going live.
            </StateMessage>
          ) : (
            <>
              <CardHeader title={`${num(active)} approved · ${num(data.length)} listed`} />
              <Table columns={columns} rows={data} minWidth={760} empty="No models match." />
            </>
          )}
      </Card>

      {editing && <TacDialog row={editing.row} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {importing && <ImportDialog existing={data ?? []} onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload(); }} />}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} role="alertdialog" icon="alert" title={`Remove TAC ${deleting?.tac ?? ''}?`}
        subtitle="Phones of this model can't be enrolled any more. Phones already enrolled stay locked as before. Switch it off instead if it may come back."
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy === deleting?.id} onClick={remove}>Remove model</Button>
        </>} />
    </div>
  );
}

/** Type an IMEI → is this phone approved? */
function ImeiCheck() {
  const [imei, setImei] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const check = async () => {
    const v = onlyDigits(imei);
    if (v.length < 8) { setErr('Type at least the first 8 digits of the IMEI'); return; }
    setBusy(true); setErr(null);
    try { setRes(await devicesLive.checkImei(v)); }
    catch (e) { setErr(e.message); setRes(null); }
    finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px' }}>
        <Field label="Check a phone" placeholder="IMEI (15 digits) or its first 8" inputMode="numeric" className="mono-input" value={imei}
          onChange={(e) => { setImei(e.target.value); setRes(null); setErr(null); }} onKeyDown={(e) => e.key === 'Enter' && check()} error={err} />
      </div>
      <Button variant="secondary" disabled={busy} onClick={check}>{busy ? 'Checking…' : 'Check'}</Button>
      {res && (
        <div className="note" style={{ flex: '1 1 100%', background: res.eligible ? 'var(--ok-bg)' : 'var(--bad-bg)', color: 'var(--ink)' }}>
          <strong>{res.eligible ? 'Approved' : 'Not approved'}</strong>&nbsp;· TAC <span className="mono">{res.tac}</span>{res.message ? ` · ${res.message}` : ''}
        </div>
      )}
    </Card>
  );
}

function TacDialog({ row, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({
    tac: row?.tac ?? '', brand: row?.brand ?? '', model: row?.model ?? '', name: row?.name ?? '',
    environment: row?.environment ?? 'PRODUCTION', active: row ? row.active : true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { const val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e; setV((s) => ({ ...s, [k]: val })); setErrors({}); };
  const save = async () => {
    const e = {};
    if (!/^\d{8}$/.test(v.tac.trim())) e.tac = 'TAC is exactly 8 digits';
    if (!v.brand.trim()) e.brand = 'Enter the brand';
    if (!v.model.trim() && !v.name.trim()) e.model = 'Enter the model number or name';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await devicesLive.saveTac({ ...v, model: v.model.trim() || v.name.trim() }, row?.id);
      toast(row ? 'Model updated' : 'Model added');
      onDone();
    } catch (err) { setErrors({ form: err.message }); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} width={560} title={row ? `Edit TAC ${row.tac}` : 'Add an approved model'}
      subtitle="Copy the details from RocketPay’s approved TAC list."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save model'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <FormRow>
        <Field label="TAC" inputMode="numeric" maxLength={8} className="mono-input" placeholder="35824791" value={v.tac}
          onChange={(e) => set('tac')({ target: { value: onlyDigits(e.target.value).slice(0, 8) } })} error={errors.tac} data-autofocus />
        <SelectField label="For" value={v.environment} onChange={set('environment')} options={ENVS} />
      </FormRow>
      <FormRow>
        <Field label="Brand" placeholder="INFINIX" value={v.brand} onChange={set('brand')} error={errors.brand} />
        <Field label="Model number" placeholder="X6730" value={v.model} onChange={set('model')} error={errors.model} />
      </FormRow>
      <Field label={<>Marketing name <span className="optional">(optional)</span></>} placeholder="Hot 60i 5G" value={v.name} onChange={set('name')} />
      <Checkbox label="Approved for enrolment" checked={v.active} onChange={set('active')} />
    </Dialog>
  );
}

/**
 * Paste rows copied from RocketPay's sheet: OEM, model number, marketing name, TAC (tabs or commas).
 * The TAC is found as the 8-digit value in each row, so column order doesn't matter much.
 */
function parseRows(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const cells = line.split(/\t|,(?![^"]*")|;|\s{2,}/).map((c) => c.replace(/^"|"$/g, '').trim());
    const tacIdx = cells.findIndex((c) => /^\d{8}$/.test(c));
    if (tacIdx < 0) return { line, error: 'no 8-digit TAC' };
    const rest = cells.filter((_, i) => i !== tacIdx);
    const [brand = '', model = '', name = ''] = rest;
    if (!brand || /^oem$/i.test(brand)) return { line, error: 'header or missing brand' };
    return { tac: cells[tacIdx], brand, model: model || name, name: name || '' };
  });
}

function ImportDialog({ existing, onClose, onDone }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [environment, setEnvironment] = useState('STAGING');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const parsed = parseRows(text);
  const seen = new Set(existing.map((t) => `${t.tac}:${t.environment}`));
  const good = parsed.filter((r) => !r.error);
  const fresh = good.filter((r, i) => !seen.has(`${r.tac}:${environment}`) && good.findIndex((x) => x.tac === r.tac) === i);
  const skipped = parsed.length - fresh.length;

  const run = async () => {
    setBusy(true);
    let ok = 0; const failed = [];
    for (const [i, r] of fresh.entries()) {
      setProgress(`${i + 1} of ${fresh.length}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await devicesLive.saveTac({ tac: r.tac, brand: r.brand, model: r.model || r.name, name: r.name, environment, active: true });
        ok += 1;
      } catch (e) { failed.push(`${r.tac}: ${e.message}`); }
    }
    setBusy(false);
    toast(failed.length ? `${ok} added · ${failed.length} failed (${failed[0]})` : `${ok} models added`, failed.length ? 'bad' : undefined);
    onDone();
  };

  return (
    <Dialog open onClose={onClose} width={640} title="Paste RocketPay’s list"
      subtitle="Copy the rows from their sheet (OEM, model number, marketing name, TAC) and paste them here, one phone per line."
      actions={<>
        <Button variant="secondary" data-close onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !fresh.length} onClick={run}>{busy ? `Adding ${progress}…` : `Add ${fresh.length} model${fresh.length === 1 ? '' : 's'}`}</Button>
      </>}>
      <SelectField label="These models are for" value={environment} onChange={(e) => setEnvironment(e.target.value)} options={ENVS} />
      <div className="field">
        <label className="field-label" htmlFor="tac-paste">Rows</label>
        <textarea id="tac-paste" className="textarea mono-input" style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'VIVO\tV2521\tY31\t86615008\nINFINIX\tX6730 X6728B\tHot 60i 5G\t35824791'} />
        <span className="field-hint">
          {parsed.length ? `${fresh.length} new · ${skipped} skipped (already listed, repeated, header or no TAC)` : 'Tabs or commas between columns both work'}
        </span>
      </div>
    </Dialog>
  );
}
