import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { devicesApi, TV_CONTROLS } from '../../services/devicesApi';
import { P } from '../../config/permissions';
import { Badge, Breadcrumb, Button, Card, CardHeader, ErrorBlock, Icon, KeyValue, LoadingBlock, StateMessage, Toggle, useToast } from '../../components/ui';
import { ControlRow } from './deviceParts';
import { LockDialog, MessageDialog, UnlockDialog } from './deviceDialogs';
import { CustomerEmiCard } from './DeviceDetail';
import './devices.css';

const STREAMING = ['Netflix', 'Prime Video', 'Hotstar', 'YouTube'];

/** A-18 · TV detail & controls. Controls the model doesn't support are shown greyed out. */
export default function TvDetail() {
  const { tvId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { data: d, loading, error, reload } = useApi(() => devicesApi.get(tvId), [tvId]);
  const [dialog, setDialog] = useState(null);
  const [pending, setPending] = useState(null);

  if (loading && !d) return <LoadingBlock />;
  if (error) {
    return <div className="page"><Card>{error.status === 404
      ? <StateMessage icon="tv" title="This TV isn’t in your list" action={<Button to="/tvs">Back to TVs</Button>}>It may have been removed, or it belongs to a store you can’t see.</StateMessage>
      : <ErrorBlock error={error} onRetry={reload} />}</Card></div>;
  }
  if (d.type !== 'tv') return <Navigate to={`/devices/${d.id}`} replace />;

  const canControl = can(P.DEVICES_CONTROL);
  const has = (k) => d.supported.includes(k);
  const done = () => { setDialog(null); reload(); };
  const toggle = async (key, value) => {
    setPending(key);
    try { const u = await devicesApi.setControl(d.id, key, value); toast(u.queued ? 'Saved · applies when the TV is back online' : 'Saved on the TV'); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setPending(null); }
  };
  const state = (on) => <span className="control-state">{on ? 'On' : 'Off'}</span>;
  const notSupported = <Badge tone="mute">Not supported</Badge>;

  const row = (key, props, control) => (
    <ControlRow key={key} {...props} muted={!has(key)}>{has(key) ? control : notSupported}</ControlRow>
  );

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: 'TV devices', to: '/tvs' }, { label: d.name }]} />

      <div className="detail-head">
        <span className="device-head-icon"><Icon name="tv" size={24} /></span>
        <div className="detail-head-main">
          <div className="detail-head-title">
            <h1 className="h1">{d.name}</h1>
            {d.locked ? <Badge status="locked" /> : <Badge status="unlocked" />}
            <Badge status={d.connection} />
          </div>
          <span className="sub" style={{ fontSize: 14 }}>
            {d.os} · Serial <span className="mono">{d.imei}</span> · {d.customer.name} · {d.retailer?.name}
          </span>
        </div>
        {canControl && (
          <div className="page-actions">
            {has('message') && <Button variant="secondary" onClick={() => setDialog('message')}>Send message</Button>}
            {has('screenLock') && (d.locked
              ? <Button icon="unlock" onClick={() => setDialog('unlock')}>Unlock TV</Button>
              : <Button variant="danger" icon="lock" onClick={() => setDialog('lock')}>Lock TV</Button>)}
          </div>
        )}
      </div>

      <div className="split-side side-360">
        <Card flush>
          <CardHeader
            title="TV controls"
            action={<Badge tone={d.supported.length === TV_CONTROLS.length ? 'ok' : 'warn'}>Model verified · {d.supported.length} of {TV_CONTROLS.length} supported</Badge>}
          />
          {row('screenLock', { icon: 'lock', danger: true, title: 'Screen lock', description: 'Shows the payment screen on every input and app' },
            canControl ? <Toggle danger label="Screen lock" checked={d.locked} onChange={(v) => setDialog(v ? 'lock' : 'unlock')} /> : state(d.locked))}
          {row('message', { icon: 'chat', title: 'Message on screen', description: 'Full-screen notice, dismissed with the remote' },
            canControl && <Button variant="secondary" size="sm" onClick={() => setDialog('message')}>Send</Button>)}
          {row('blockApps', { icon: 'apps', title: 'Block streaming apps', description: d.controls.blockApps ? `${STREAMING.join(', ')} blocked` : 'Streaming apps allowed' },
            canControl ? <Toggle label="Block streaming apps" checked={d.controls.blockApps} disabled={pending === 'blockApps'} onChange={(v) => toggle('blockApps', v)} /> : state(d.controls.blockApps))}
          {row('audioReminder', { icon: 'volume', title: 'Audio reminder', description: d.live ? 'Plays a spoken payment reminder on the TV' : 'Plays when the TV is switched on' },
            d.live
              ? (canControl && <Button variant="secondary" size="sm" disabled={pending === 'audioReminder'} onClick={() => toggle('audioReminder', true)}>Play now</Button>)
              : canControl ? <Toggle label="Audio reminder" checked={d.controls.audioReminder} disabled={pending === 'audioReminder'} onChange={(v) => toggle('audioReminder', v)} /> : state(d.controls.audioReminder))}
          {row('resetProtection', { icon: 'shield', title: 'Reset protection', description: 'Blocks factory reset from settings' },
            canControl ? <Toggle label="Reset protection" checked={d.controls.resetProtection} disabled={pending === 'resetProtection'} onChange={(v) => toggle('resetProtection', v)} /> : state(d.controls.resetProtection))}
          <ControlRow icon="pin" muted title="Location" description="Not available on TVs — uses Wi-Fi network area only">{notSupported}</ControlRow>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <CustomerEmiCard d={d} compact canPhone={can(P.CUSTOMER_PHONE_VIEW)} />
          <Card style={{ padding: '20px 24px' }}>
            <h2 className="h2" style={{ paddingBottom: 6 }}>Device</h2>
            <KeyValue items={[
              ['Platform', d.os],
              ['Network', d.network],
              ['Agent version', <span className="mono" style={{ fontSize: 13 }}>{d.agentVersion}</span>],
              ['Enrolled', d.enrolled],
            ]} />
          </Card>
        </div>
      </div>

      {dialog === 'lock' && <LockDialog open device={d} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'unlock' && <UnlockDialog open device={d} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'message' && <MessageDialog open device={d} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}