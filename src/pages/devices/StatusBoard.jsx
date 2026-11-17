import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { devicesApi } from '../../services/devicesApi';
import { num } from '../../utils/format';
import { Badge, Button, Card, ErrorBlock, Icon, LoadingBlock, PageHeader } from '../../components/ui';
import { DeviceStatusBadge } from './deviceParts';
import './devices.css';

const REFRESH_MS = 30000;
const ALERT_ICON = { warn: 'alert', bad: 'shield', mute: 'clock' };

/** A-16 · Device status board — refreshes every 30 seconds. TODO(api): switch to websockets/SSE if the backend offers it. */
export default function StatusBoard() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => devicesApi.statusBoard(), []);

  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const c = data.counts;
  const SUMMARY = [
    ['online', 'ok', 'Online', c.online], ['offline', 'mute', 'Offline', c.offline], ['locked', 'bad', 'Locked', c.locked],
    ['all', 'info', 'Unlocked', c.unlocked], ['alerts', 'warn', 'Alerts', c.alerts],
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Device status board"
        subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="live-dot" />Live · updates every 30 seconds</span>}
        actions={<Button variant="secondary" to="/devices">List view</Button>}
      />

      <div className="status-summary">
        {SUMMARY.map(([key, tone, label, value]) => (
          <button key={label} type="button" className="status-tile" onClick={() => navigate(`/devices?status=${key}`)}>
            <Badge tone={tone}>{label}</Badge>
            <b>{num(value)}</b>
          </button>
        ))}
      </div>

      <div className="board">
        <div className="board-tiles">
          {data.tiles.map((t) => (
            <Link key={t.id} to={`/devices/${t.id}`} className="board-tile">
              <div className="board-tile-top"><span className="fw-600">{t.short}</span><DeviceStatusBadge status={t.status} /></div>
              <div className="cell-stack" style={{ gap: 3 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{t.customer}</span>
                <span className="cell-sub mono">{t.ref}</span>
              </div>
              <div className="board-tile-foot"><span>{t.lastSeen}</span><span>Battery {t.battery != null ? `${t.battery}%` : '—'}</span></div>
            </Link>
          ))}
        </div>

        <Card flush>
          <div className="card-head" style={{ padding: '18px 20px' }}>
            <h2 className="h2">Alerts</h2>
            <Badge tone="warn">{data.alerts.length} open</Badge>
          </div>
          {data.alerts.map((a, i) => (
            <Link key={`${a.id}-${i}`} to={`/devices/${a.id}`} className="alert-row">
              <span className={`alert-icon tone-${a.tone}`}><Icon name={ALERT_ICON[a.tone]} size={16} /></span>
              <div className="cell-stack" style={{ gap: 3 }}><span className="fw-600">{a.title}</span><span className="sub">{a.meta}</span></div>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}