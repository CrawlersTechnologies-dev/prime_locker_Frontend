import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { devicesApi, LOCK_MESSAGES } from '../../services/devicesApi';
import { P } from '../../config/permissions';
import { LEVELS } from '../../config/roles';
import { inr } from '../../utils/format';
import {
  Avatar, Badge, Breadcrumb, Button, Card, CardHeader, ErrorBlock, Icon, LoadingBlock, StateMessage,
  Tabs, TabPanel, Toggle, useToast,
} from '../../components/ui';
import { ActivityList, ControlRow, MapPlaceholder } from './deviceParts';
import { AppsDialog, LiveWallpaperDialog, LockDialog, MessageDialog, OfflineCodeDialog, UnlockDialog, WallpaperDialog, fmtCode } from './deviceDialogs';
import { LocationPanel } from './LocationHistory';
import './devices.css';

/** A-03 · Device detail & remote control. A-12/A-13/A-14 open as dialogs on top of it. */
export default function DeviceDetail({ initialDialog = null }) {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: d, loading, error, reload } = useApi(() => devicesApi.get(deviceId), [deviceId]);
  const [q, setQ] = useQueryState({ tab: 'controls' });
  const [dialog, setDialog] = useState(initialDialog);
  const [pending, setPending] = useState(null); // control key being saved

  if (loading && !d) return <LoadingBlock />;
  if (error) {
    return (
      <div className="page"><Card>
        {error.status === 404
          ? <StateMessage icon="phone" title="This device isn’t in your list" action={<Button to="/devices">Back to devices</Button>}>It may have been removed, or it belongs to a store you can’t see.</StateMessage>
          : <ErrorBlock error={error} onRetry={reload} />}
      </Card></div>
    );
  }
  if (d.type === 'tv') return <Navigate to={`/tvs/${d.id}`} replace />;

  const closeDialog = () => {
    setDialog(null);
    if (initialDialog) navigate(`/devices/${d.id}`, { replace: true }); // opened from /devices/:id/lock etc.
  };
  const done = (_updated, opts) => { if (!opts?.keepOpen) closeDialog(); reload(); };

  const canControl = can(P.DEVICES_CONTROL);
  const canCode = can(P.DEVICES_OFFLINE_CODE) && (!d.live || d.supported.includes('offlineCode'));
  const canLocation = can(P.DEVICES_LOCATION);
  const canPhone = can(P.CUSTOMER_PHONE_VIEW);
  const isPartner = user.level !== LEVELS.COMPANY;
  const listLabel = isPartner ? 'Devices' : 'Mobile devices';

  const toggle = async (key, value) => {
    setPending(key);
    try {
      const u = await devicesApi.setControl(d.id, key, value);
      toast(u.queued ? 'Saved · applies when the device is back online' : 'Saved on the device');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setPending(null);
    }
  };
  const quick = async (fn, msg) => {
    try { const u = await fn(); toast(u.queued ? `${msg} · when the device is back online` : msg); reload(); } catch (err) { toast(err.message, 'bad'); }
  };

  const lockedApps = d.apps.filter((a) => a.locked).map((a) => a.name);
  const hiddenCount = d.apps.filter((a) => a.hidden).length;
  const state = (on) => <span className="control-state">{on ? 'On' : 'Off'}</span>;

  const tabs = [
    { value: 'controls', label: 'Controls' },
    ...(canLocation ? [{ value: 'location', label: 'Location history' }] : []),
    ...(can(P.COLLECTIONS_VIEW) && d.emi ? [{ value: 'emi', label: 'EMI & payments' }] : []),
    { value: 'activity', label: 'Activity' },
  ];
  const tab = tabs.some((t) => t.value === q.tab) ? q.tab : 'controls';

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: listLabel, to: '/devices' }, { label: d.name }]} />

      <div className="detail-head">
        <span className="device-head-icon"><Icon name="phone" size={24} /></span>
        <div className="detail-head-main">
          <div className="detail-head-title">
            <h1 className="h1">{d.name}</h1>
            {d.locked ? <Badge status="locked" /> : <Badge status="unlocked" />}
            <Badge status={d.connection} />
            {d.alert && <Badge tone="warn">{d.alert.label}</Badge>}
          </div>
          <span className="sub" style={{ fontSize: 14 }}>
            {d.os} · {d.type === 'android' ? 'IMEI' : 'Serial'} <span className="mono">{d.imei}</span> · Enrolled {d.enrolled} · Last seen {d.lastSeen}
          </span>
        </div>
        <div className="page-actions">
          {canCode && <Button variant="secondary" icon="hash" onClick={() => setDialog('code')}>Offline code</Button>}
          {canControl && (d.locked
            ? <Button icon="unlock" onClick={() => setDialog('unlock')}>Unlock device</Button>
            : <Button variant="danger" icon="lock" onClick={() => setDialog('lock')}>Lock device</Button>)}
        </div>
      </div>

      {d.alert && (
        <div className="warn-box" role="status">
          <Icon name="alert" />
          <span style={{ flexGrow: 1 }}><strong>{d.alert.title}</strong> · {d.alert.at}.{d.alert.kind === 'failed' ? ' The phone may not match what the panel shows until this succeeds.' : ' Check with the customer before taking action.'}</span>
          {d.alert.kind === 'failed' && canControl && (
            <Button variant="secondary" size="sm" icon="refresh" onClick={() => quick(() => devicesApi.retryProvider(d.id), `${d.locked ? 'Lock' : 'Unlock'} sent to RocketPay again`)}>Retry</Button>
          )}
        </div>
      )}

      <Tabs label="Device sections" idPrefix="dv" tabs={tabs} value={tab} onChange={(t) => setQ({ tab: t })} />

      <TabPanel idPrefix="dv" value={tab}>
        {tab === 'controls' && (
          <div className="split-side side-360">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <Card flush>
                <CardHeader
                  title="Remote controls"
                  subtitle={d.live && d.lockProvider === 'ROCKETPAY'
                    ? 'Lock and unlock go through RocketPay. The other controls need the Prime Locker app on the phone.'
                    : d.connection === 'online' ? 'Changes reach the device within a few seconds when it is online' : `Device is offline. Changes are sent when it reconnects (last seen ${d.lastSeen}).`}
                  action={d.live
                    ? <Badge tone={d.providerStatus === 'Failed' || d.providerStatus === 'Tamper alert' ? 'bad' : 'info'}>Locks through {d.lockProviderLabel}{d.providerStatus ? ` · ${d.providerStatus}` : ''}</Badge>
                    : canControl ? <Badge tone="info">All controls supported on this model</Badge> : <Badge tone="mute">View only</Badge>}
                />
                <ControlRow icon="lock" danger title="Screen lock"
                  description={d.locked ? `Locked ${d.lockedBy === 'auto' ? 'automatically' : `by ${d.lockedBy}`} on ${d.lockedAt}${d.lockedBy === 'auto' ? ' — EMI overdue after grace period' : ''}` : 'Device is unlocked'}>
                  {canControl ? <Toggle danger label="Screen lock" checked={d.locked} onChange={(v) => setDialog(v ? 'lock' : 'unlock')} /> : state(d.locked)}
                </ControlRow>
                <ControlRow icon="camera" title="Block camera" description="Camera app and camera access for all apps">
                  {canControl ? <Toggle label="Block camera" checked={d.controls.camera} disabled={pending === 'camera'} onChange={(v) => toggle('camera', v)} /> : state(d.controls.camera)}
                </ControlRow>
                {d.live && d.lockProvider === 'ROCKETPAY' ? (
                  <ControlRow icon="apps" muted title="Block apps" description="Not available on RocketPay phones yet. RocketPay locks the whole phone.">
                    <Badge tone="mute">Not supported</Badge>
                  </ControlRow>
                ) : d.live ? (
                  <>
                    <ControlRow icon="apps" title="Block social media apps" description={d.socialBlocked ? 'WhatsApp, Instagram and Facebook are blocked' : 'WhatsApp, Instagram and Facebook are allowed'}>
                      {canControl ? <Toggle label="Block social media apps" checked={d.controls.blockApps} disabled={pending === 'blockApps'} onChange={(v) => toggle('blockApps', v)} /> : state(d.controls.blockApps)}
                    </ControlRow>
                    <ControlRow icon="apps" title="App lock" description={d.appCount ? (d.lockedPackages.length ? `${d.lockedPackages.length} of ${d.appCount} apps locked` : 'No apps locked') : 'The app list appears after the Prime Locker app syncs it'}>
                      {canControl && d.appCount > 0 && <Button variant="secondary" size="sm" onClick={() => setDialog('apps')}>Manage</Button>}
                    </ControlRow>
                  </>
                ) : (
                  <>
                    <ControlRow icon="apps" title="App lock" description={lockedApps.length ? `${lockedApps.join(' and ')} locked` : 'No apps locked'}>
                      {canControl && <Button variant="secondary" size="sm" onClick={() => setDialog('apps')}>Manage</Button>}
                    </ControlRow>
                    <ControlRow icon="eyeOff" title="Hide apps" description={hiddenCount ? `${hiddenCount} apps hidden from the home screen` : 'No apps hidden'}>
                      {canControl && <Button variant="secondary" size="sm" onClick={() => setDialog('apps')}>Manage</Button>}
                    </ControlRow>
                  </>
                )}
                <ControlRow icon="shield" title={d.live ? 'Factory-reset protection' : 'Uninstall protection'} description={d.live ? 'Blocks factory reset and turns on FRP lock' : 'Stops the Prime Locker agent from being removed or reset'}>
                  {canControl ? <Toggle label="Uninstall protection" checked={d.controls.protection} disabled={pending === 'protection'} onChange={(v) => toggle('protection', v)} /> : state(d.controls.protection)}
                </ControlRow>
                <ControlRow icon="image" title="Lock-screen wallpaper" description={d.live ? (d.wallpaperUrl ? 'Custom image set' : 'Default Prime Locker screen') : `Showing: ${LOCK_MESSAGES.find((m) => m.key === d.wallpaper)?.label}`}>
                  {canControl && <Button variant="secondary" size="sm" onClick={() => setDialog('wallpaper')}>Change</Button>}
                </ControlRow>
                {(!d.live || d.supported.includes('audio')) && (
                  <ControlRow icon="volume" title="Audio reminder" description="Plays a spoken payment reminder at full volume">
                    {canControl && <Button variant="secondary" size="sm" onClick={() => quick(() => devicesApi.playAudio(d.id), 'Audio reminder played')}>Play now</Button>}
                  </ControlRow>
                )}
                <ControlRow icon="chat" title="Message on screen" description={d.live && d.lockMessage ? `Showing: “${d.lockMessage}”` : 'Show a custom message on the device'}>
                  {canControl && <Button variant="secondary" size="sm" onClick={() => setDialog('message')}>Send</Button>}
                </ControlRow>
              </Card>

              {canLocation && d.location && (
                <Card pad style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div className="card-title">
                      <h2 className="h2">Live location</h2>
                      <span className="sub">{d.live ? `${d.location.place} · ${d.location.at}` : `${d.location.place}, ${d.location.area} · accurate to ${d.location.accuracy} m · ${d.location.at}`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" size="sm" onClick={() => setQ({ tab: 'location' })}>History</Button>
                      {canControl && <Button variant="secondary" size="sm" icon="refresh" onClick={() => quick(() => devicesApi.refreshLocation(d.id), d.live ? 'Location requested' : 'Location updated')}>Refresh</Button>}
                    </div>
                  </div>
                  <MapPlaceholder points={[{ n: 1, x: 0.5, y: 0.47 }]} label={`Current location: ${d.location.place}`} />
                </Card>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <CustomerEmiCard d={d} canPhone={canPhone} />
              {canCode && (
                <Card className="side-card">
                  <div className="card-title">
                    <h2 className="h2">Offline unlock code</h2>
                    <span className="sub" style={{ lineHeight: '19px' }}>For a device with no SIM or internet. Each code works once.</span>
                  </div>
                  {d.offlineCode ? (
                    <>
                      <div className="code-box"><span className="code">{fmtCode(d.offlineCode.code)}</span></div>
                      <div className="side-row" style={{ fontSize: 13 }}>
                        <span>{d.live ? `Works until ${d.offlineCode.expires}` : `Issued ${d.offlineCode.issuedAt}`}</span>
                        {d.live
                          ? <span style={{ color: d.offlineCode.expired ? 'var(--muted)' : 'var(--warn)', fontWeight: 500 }}>{d.offlineCode.expired ? 'Expired' : 'Active'}</span>
                          : <span style={{ color: d.offlineCode.used ? 'var(--muted)' : 'var(--warn)', fontWeight: 500 }}>{d.offlineCode.used ? 'Used' : 'Not used yet'}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" size="sm" block onClick={async () => { try { await navigator.clipboard.writeText(d.offlineCode.code); toast('Code copied'); } catch { toast('Couldn’t copy the code', 'bad'); } }}>Copy code</Button>
                        <Button variant="secondary" size="sm" block onClick={() => setDialog('code')}>New code</Button>
                      </div>
                    </>
                  ) : (
                    <Button variant="secondary" block onClick={() => setDialog('code')}>Create a code</Button>
                  )}
                </Card>
              )}
              <Card className="side-card">
                <h2 className="h2">Recent activity</h2>
                <ActivityList items={d.activity.slice(0, 4)} />
                <button type="button" className="btn btn-text" style={{ alignSelf: 'flex-start', padding: 0, height: 'auto' }} onClick={() => setQ({ tab: 'activity' })}>View full activity log</button>
              </Card>
            </div>
          </div>
        )}

        {tab === 'location' && <LocationPanel deviceId={d.id} />}

        {tab === 'emi' && (
          <Card>
            <StateMessage icon="calendar" title={`${inr(d.emi.amount)} × ${d.emi.months} months`}
              action={<div className="page-actions" style={{ justifyContent: 'center' }}>
                <Button variant="secondary" to={`/emi/${d.customer.id}`}>Full EMI schedule</Button>
                {can(P.PAYMENTS_RECORD) && !d.emi.closed && <Button to={`/payments/new?customer=${d.customer.id}`}>Record payment</Button>}
              </div>}>
              {d.emi.paid} of {d.emi.months} installments paid · {inr(d.emi.outstanding)} outstanding.
              {d.emi.overdue ? ` ${inr(d.emi.overdue.amount)} overdue since ${d.emi.overdue.due}.` : ''}
            </StateMessage>
          </Card>
        )}

        {tab === 'activity' && (
          <Card pad>
            <h2 className="h2" style={{ marginBottom: 16 }}>Activity</h2>
            <ActivityList items={d.activity} />
          </Card>
        )}
      </TabPanel>

      {dialog === 'lock' && <LockDialog open device={d} onClose={closeDialog} onDone={done} />}
      {dialog === 'unlock' && <UnlockDialog open device={d} onClose={closeDialog} onDone={done} />}
      {dialog === 'code' && <OfflineCodeDialog open device={d} onClose={closeDialog} onDone={done} />}
      {dialog === 'apps' && <AppsDialog open device={d} onClose={closeDialog} onDone={done} />}
      {dialog === 'message' && <MessageDialog open device={d} onClose={closeDialog} onDone={done} />}
      {dialog === 'wallpaper' && !d.live && <WallpaperDialog open device={d} onClose={closeDialog} onDone={done} />}
      {dialog === 'wallpaper' && d.live && <LiveWallpaperDialog open device={d} onClose={closeDialog} onDone={done} />}
    </div>
  );
}

/** Customer + EMI summary, used on A-03 and A-18. */
export function CustomerEmiCard({ d, canPhone, compact }) {
  const { can } = useAuth();
  const e = d.emi;
  return (
    <Card className="side-card">
      {!compact && (
        <>
          <Link to={`/customers/${d.customer.id}`} className="cell-person" style={{ color: 'var(--ink)' }}>
            <Avatar text={d.customer.initials} tone={d.customer.overdue ? 'warn' : 'plain'} />
            <div className="cell-stack">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{d.customer.name}</span>
              <span className="sub">{[canPhone && d.customer.phone, d.retailer?.name].filter(Boolean).join(' · ')}</span>
            </div>
          </Link>
          <div style={{ height: 1, background: 'var(--line-soft)' }} />
        </>
      )}
      {compact && <h2 className="h2">EMI</h2>}
      {e ? (
        <>
          <div className="side-row"><span>{compact ? 'Plan' : 'EMI plan'}</span><span className="fw-600">{inr(e.amount)} × {e.months} months</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!compact && <div className="side-row" style={{ fontSize: 13 }}><span>Installments paid</span><span className="ink-2" style={{ fontWeight: 500 }}>{e.paid} of {e.months}</span></div>}
            <div className="progress"><div style={{ width: `${(e.paid / e.months) * 100}%` }} /></div>
            {compact && <span className="sub">{e.paid} of {e.months} paid · {inr(e.outstanding)} outstanding</span>}
          </div>
          {!compact && <div className="side-row"><span>Outstanding</span><span className="fw-600">{inr(e.outstanding)}</span></div>}
          {e.overdue && (
            <div className="overdue-box">
              <strong>{inr(e.overdue.amount)} overdue</strong>
              <span>Due {e.overdue.due} · {e.overdue.daysLate} days late</span>
            </div>
          )}
          {can(P.PAYMENTS_RECORD) && !e.closed && <Button block to={`/payments/new?customer=${d.customer.id}`}>Record payment</Button>}
        </>
      ) : <span className="sub">No EMI set up for this device yet.</span>}
    </Card>
  );
}

/* Route wrappers so /devices/:id/apps, /lock and /offline-code open the right dialog. */
export const DeviceAppsRoute = () => <DeviceDetail initialDialog="apps" />;
export const DeviceLockRoute = () => <DeviceDetail initialDialog="lock" />;
export const DeviceOfflineCodeRoute = () => <DeviceDetail initialDialog="code" />;