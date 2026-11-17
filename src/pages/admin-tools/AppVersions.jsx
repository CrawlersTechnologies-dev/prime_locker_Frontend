import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApi } from '../../hooks/useApi';
import { adminApi, ADMIN_LIVE, publicAppLink } from '../../services/adminApi';
import {
  Badge, Button, Card, CardHeader, Checkbox, Dialog, ErrorBlock, Field, FormRow, KeyValue, LoadingBlock, PageHeader,
  Progress, SelectField, StateMessage, Table, UploadBox, useToast,
} from '../../components/ui';
import { NeedsServer } from './Staff';

// AppVersion.app_type on the backend. `slug` = the public download link (no login needed).
const APP_TYPES = [
  { value: 'CUSTOMER_APP', label: 'Customer app', slug: 'customer' },
  { value: 'RETAILER_APP', label: 'Retailer app', slug: 'retailer' },
  { value: 'ANDROID_LOCKER', label: 'Android locker (MDM)' },
  { value: 'TV_LOCKER', label: 'Smart TV locker' },
];
const typeMeta = (t) => APP_TYPES.find((a) => a.value === t) ?? { value: t, label: t };

/** Draws `text` as a QR code image. Returns the PNG data URL (for download / print). */
function useQr(text, size = 280) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    if (!text) { setUrl(null); return undefined; }
    QRCode.toDataURL(text, { width: size, margin: 2, errorCorrectionLevel: 'M' })
      .then((u) => live && setUrl(u))
      .catch(() => live && setUrl(null));
    return () => { live = false; };
  }, [text, size]);
  return url;
}

/** App downloads & QR — the admin uploads the customer app; retailers show its QR to customers. */
export default function AppVersions() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => (ADMIN_LIVE ? adminApi.appVersions() : Promise.resolve(null)), []);
  const [uploading, setUploading] = useState(null); // { type }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);

  if (!ADMIN_LIVE) return <NeedsServer title="App downloads & QR" />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;
  if (loading && !data) return <LoadingBlock />;

  const liveOf = (type) => data.find((a) => a.type === type && a.active);

  const makeLive = async (a) => {
    setBusy(a.id);
    try {
      await adminApi.setAppVersionActive(a.id, !a.active);
      toast(a.active ? `${typeMeta(a.type).label} v${a.version} taken offline` : `${typeMeta(a.type).label} v${a.version} is now the download`);
      reload();
    } catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy(deleting.id);
    try { await adminApi.deleteAppVersion(deleting.id); toast('Version deleted'); setDeleting(null); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(null); }
  };

  const columns = [
    { key: 'type', header: 'App', width: '1.3fr', render: (a) => typeMeta(a.type).label },
    { key: 'version', header: 'Version', width: '0.9fr', render: (a) => <span className="mono">v{a.version} ({a.code})</span> },
    { key: 'source', header: 'File', width: '0.8fr', render: (a) => (a.hasFile ? 'APK uploaded' : a.externalUrl ? 'External link' : '—') },
    { key: 'at', header: 'Uploaded', width: '1.3fr', render: (a) => <span>{a.at}<br /><span className="muted">{a.by}</span></span> },
    { key: 'status', header: 'Status', width: '0.9fr', render: (a) => <Badge tone={a.active ? 'ok' : 'mute'}>{a.active ? 'Live' : 'Old'}</Badge> },
    { key: 'actions', header: '', width: '1.4fr', align: 'right', render: (a) => (
      <div style={{ display: 'inline-flex', gap: 8 }}>
        <Button variant="secondary" size="sm" disabled={busy === a.id} onClick={() => makeLive(a)}>{a.active ? 'Take offline' : 'Make live'}</Button>
        <Button variant="secondary" size="sm" icon="close" aria-label={`Delete v${a.version}`} onClick={() => setDeleting(a)} />
      </div>
    ) },
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="App downloads & QR"
        subtitle="Upload the apps here. The QR always opens the newest live version, so a printed QR keeps working after updates."
        actions={<Button icon="upload" onClick={() => setUploading({ type: 'CUSTOMER_APP' })}>Upload app</Button>}
      />

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <QrCard
          title="Customer app QR"
          subtitle="Retailers show this in the Retailer app (Customer QR tab). The customer scans it and installs the app."
          slug="customer"
          live={liveOf('CUSTOMER_APP')}
          onUpload={() => setUploading({ type: 'CUSTOMER_APP' })}
        />
        <QrCard
          title="Retailer app QR"
          subtitle="Share with new retailers so they can install the Retailer app."
          slug="retailer"
          live={liveOf('RETAILER_APP')}
          onUpload={() => setUploading({ type: 'RETAILER_APP' })}
        />
      </div>

      <Card flush>
        <div style={{ padding: '16px 20px 0' }}><CardHeader title="All versions" subtitle="One live version per app. Making a version live takes the previous one offline." /></div>
        <Table columns={columns} rows={data} empty="No apps uploaded yet." />
      </Card>

      {uploading && (
        <UploadDialog
          initialType={uploading.type}
          versions={data}
          onClose={() => setUploading(null)}
          onDone={() => { setUploading(null); reload(); }}
        />
      )}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} role="alertdialog" icon="alert"
        title={`Delete v${deleting?.version ?? ''}?`}
        subtitle={deleting?.active ? 'This is the live version. After deleting, the QR won’t download anything until you make another version live.' : 'The file is removed from the server.'}
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy === deleting?.id} onClick={remove}>Delete version</Button>
        </>} />
    </div>
  );
}

function QrCard({ title, subtitle, slug, live, onUpload }) {
  const toast = useToast();
  const link = live?.publicLink || publicAppLink(slug);
  const qr = useQr(live ? link : null, 560);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Download link copied'); }
    catch { toast('Couldn’t copy. Select the link and copy it.', 'bad'); }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = qr; a.download = `prime-locker-${slug}-app-qr.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const print = () => {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) { toast('Allow pop-ups for this site to print the poster.', 'bad'); return; }
    const customer = slug === 'customer';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prime Locker ${customer ? 'Customer' : 'Retailer'} App</title>
      <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;color:#0B1F44;margin:40px}
      h1{font-size:30px;margin:0 0 6px}p{font-size:18px;margin:6px 0}img{width:340px;height:340px;margin:22px 0}
      ol{text-align:left;display:inline-block;font-size:18px;line-height:1.7;margin:0}small{color:#5B6B82;font-size:13px;word-break:break-all}</style></head>
      <body><h1>Prime Locker ${customer ? 'Customer' : 'Retailer'} App</h1><p>Scan with your phone camera to download</p>
      <img src="${qr}" alt="QR code"><br>
      <ol>${customer
        ? '<li><b>Step 1:</b> Scan this QR and install the Prime Locker app.</li><li><b>Step 2:</b> Open the app and sign in with your mobile number.</li>'
        : '<li>Scan this QR and install the Retailer app.</li><li>Sign in with the login your distributor gave you.</li>'}</ol>
      <p><small>${link}</small></p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <Card pad>
      <CardHeader title={title} subtitle={subtitle} />
      {!live ? (
        <StateMessage icon="upload" title="Not uploaded yet" action={<Button icon="upload" onClick={onUpload}>Upload APK</Button>}>
          Upload the {slug} app’s release APK. The QR appears here once a version is live.
        </StateMessage>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 12 }}>
          <div style={{ background: '#fff', padding: 10, borderRadius: 14, border: '1px solid var(--line, #E3E8F0)' }}>
            {qr ? <img src={qr} alt={`${title}`} width={190} height={190} style={{ display: 'block' }} /> : <div style={{ width: 190, height: 190 }} />}
          </div>
          <div style={{ flex: '1 1 180px', display: 'grid', gap: 12, minWidth: 0 }}>
            <KeyValue items={[
              ['Live version', `v${live.version} (${live.code})`],
              ['Uploaded', live.at],
              ['Link', <span key="l" className="mono" style={{ wordBreak: 'break-all', fontSize: 12.5 }}>{link}</span>],
            ]} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button variant="secondary" size="sm" icon="copy" onClick={copy}>Copy link</Button>
              <Button variant="secondary" size="sm" icon="download" disabled={!qr} onClick={download}>QR image</Button>
              <Button variant="secondary" size="sm" icon="file" disabled={!qr} onClick={print}>Print poster</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function UploadDialog({ initialType, versions, onClose, onDone }) {
  const toast = useToast();
  const nextCode = (type) => Math.max(0, ...versions.filter((a) => a.type === type).map((a) => a.code)) + 1;
  const [v, setV] = useState(() => ({
    type: initialType, version: '', code: String(nextCode(initialType)), notes: '',
    mandatory: false, active: true, file: null, externalUrl: '',
  }));
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const set = (k) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setV((s) => ({ ...s, [k]: value, ...(k === 'type' ? { code: String(nextCode(value)) } : {}) }));
    setErrors((x) => ({ ...x, [k]: undefined, form: undefined }));
  };

  const save = async () => {
    const e = {};
    if (!/^\d+(\.\d+){0,3}$/.test(v.version.trim())) e.version = 'Like 1.0.0 (from pubspec.yaml, before the +)';
    if (!Number.isInteger(Number(v.code)) || Number(v.code) < 1) e.code = 'Whole number (after the + in pubspec.yaml)';
    else if (versions.some((a) => a.type === v.type && a.code === Number(v.code))) e.code = 'This build number is already uploaded';
    if (v.file && !v.file.name.toLowerCase().endsWith('.apk')) e.file = 'Choose the .apk file';
    if (!v.file && !v.externalUrl.trim()) e.file = 'Choose the APK file, or give a download link';
    if (v.externalUrl.trim() && !/^https:\/\/\S+$/.test(v.externalUrl.trim())) e.externalUrl = 'Start the link with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    setProgress(0);
    try {
      await adminApi.uploadAppVersion(v, setProgress);
      toast(v.active ? `${typeMeta(v.type).label} v${v.version} is live` : `${typeMeta(v.type).label} v${v.version} uploaded`);
      onDone();
    } catch (err) { setErrors({ form: err.message }); setProgress(null); }
  };
  const busy = progress != null;
  const mb = v.file ? (v.file.size / 1048576).toFixed(1) : null;

  return (
    <Dialog open onClose={busy ? () => {} : onClose} width={560} title="Upload app"
      subtitle="Use the signed release APK (flutter build apk --release)."
      actions={<>
        <Button variant="secondary" data-close disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={save}>{busy ? `Uploading… ${progress}%` : 'Upload'}</Button>
      </>}>
      {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
      <SelectField label="App" value={v.type} onChange={set('type')} options={APP_TYPES.map(({ value, label }) => ({ value, label }))} />
      <FormRow>
        <Field label="Version" value={v.version} onChange={set('version')} error={errors.version} placeholder="1.0.0" data-autofocus />
        <Field label="Build number" inputMode="numeric" value={v.code} onChange={set('code')} error={errors.code} hint="Must go up every upload" />
      </FormRow>
      <UploadBox label="Choose APK file" accept=".apk,application/vnd.android.package-archive" file={v.file} onFile={set('file')} error={errors.file} wide />
      {mb && <span className="muted" style={{ fontSize: 13 }}>{mb} MB</span>}
      <Field label={<>Or download link <span className="optional">(optional)</span></>} type="url" value={v.externalUrl} onChange={set('externalUrl')} error={errors.externalUrl} placeholder="https://play.google.com/store/apps/details?id=…" hint="Used only when no APK file is uploaded" />
      <Field label={<>What’s new <span className="optional">(optional)</span></>} value={v.notes} onChange={set('notes')} placeholder="Faster sign-in, bug fixes" />
      <Checkbox label="Make this the live download now" note="(the QR opens this version)" checked={v.active} onChange={set('active')} />
      <Checkbox label="Force update" note="(older versions must update before use)" checked={v.mandatory} onChange={set('mandatory')} />
      {busy && <Progress value={progress} label={`${progress}%`} labelWidth={44} />}
    </Dialog>
  );
}
