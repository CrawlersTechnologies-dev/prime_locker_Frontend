import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { devicesApi } from '../../services/devicesApi';
import { useAuth } from '../../context/AuthContext';
import { P } from '../../config/permissions';
import { downloadCsv } from '../../utils/format';
import { Breadcrumb, Button, Card, ErrorBlock, Icon, LoadingBlock, PageHeader, Segmented, useToast } from '../../components/ui';
import { MapPlaceholder } from './deviceParts';
import './devices.css';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
];
const RANGE_LABEL = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days' };

/** Map + timeline. Used on its own page (A-15) and in the device's "Location history" tab. */
export function LocationPanel({ deviceId, range: controlledRange, height = 520, showControls = true }) {
  const [own, setOwn] = useState('today');
  const range = controlledRange ?? own;
  const { data, loading, error, reload } = useApi(() => devicesApi.locations(deviceId, range), [deviceId, range]);

  if (error) return <Card><ErrorBlock error={error} onRetry={reload} /></Card>;
  if (!data) return <div className="skeleton" style={{ height }} />;

  const today = data.groups[0];
  const pointsOnMap = [...today.points].reverse(); // oldest → newest for the trail
  const total = data.groups.reduce((n, g) => n + g.points.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.6 : 1 }}>
      {showControls && !controlledRange && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Segmented label="Range" options={RANGES} value={own} onChange={setOwn} />
        </div>
      )}
      <div className="loc-layout">
        <Card flush>
          <MapPlaceholder points={pointsOnMap} height={height} label={`${today.points.length} location points today`}>
            <div className="map-card">
              <span style={{ fontSize: 13, fontWeight: 600 }}>{RANGE_LABEL[range]} · {total} points</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>About {data.distanceKm} km travelled</span>
            </div>
          </MapPlaceholder>
        </Card>
        <Card flush>
          {data.groups.map((g, gi) => (
            <div key={g.label}>
              {gi === 0
                ? <div className="card-title" style={{ padding: '18px 20px' }}><h2 className="h2">{g.label}</h2><span className="sub">Newest first</span></div>
                : <div className="loc-day">{g.label}</div>}
              {g.points.map((p, i) => (
                <div key={`${g.label}-${p.n}`} className="loc-point">
                  <span className={`loc-num${gi === 0 && i === 0 ? ' is-current' : ''}`}>{p.n}</span>
                  <div className="cell-stack" style={{ gap: 3 }}>
                    <span className="fw-600">{p.place}</span>
                    <span className="sub">{p.time} · ±{p.accuracy} m</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {data.flags.map((f) => (
            <div key={f.title} className="loc-flag">
              <Icon name="alert" />
              <div className="cell-stack" style={{ gap: 3 }}>
                <span className="fw-600">{f.title}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{f.detail}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/** A-15 · Location history */
export default function LocationHistory() {
  const { deviceId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState('today');
  const device = useApi(() => devicesApi.get(deviceId), [deviceId]);

  if (device.loading && !device.data) return <LoadingBlock rows={3} />;
  if (device.error) return <div className="page"><Card><ErrorBlock error={device.error} onRetry={device.reload} /></Card></div>;
  const d = device.data;

  const exportCsv = async () => {
    const data = await devicesApi.locations(deviceId, range);
    const rows = data.groups.flatMap((g) => g.points.map((p) => ({ ...p, day: g.label })));
    downloadCsv(`location-${d.imei}.csv`, [
      { key: 'day', header: 'Day' }, { key: 'time', header: 'Time' }, { key: 'place', header: 'Place' },
      { header: 'Accuracy (m)', value: (r) => r.accuracy },
    ], rows);
    toast(`Exported ${rows.length} points`);
  };

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: 'Mobile devices', to: '/devices' }, { label: d.name, to: `/devices/${d.id}` }, { label: 'Location history' }]} />
      <PageHeader
        title="Location history"
        subtitle={`${d.customer.name} · location checked every 30 minutes while online`}
        actions={<>
          <Segmented label="Range" options={RANGES} value={range} onChange={setRange} />
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv}>Export</Button>}
        </>}
      />
      <LocationPanel deviceId={deviceId} range={range} height={700} />
    </div>
  );
}