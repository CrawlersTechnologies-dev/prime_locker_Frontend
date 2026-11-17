import { Badge, Icon } from '../../components/ui';

/** Device status pill used in device lists (alert → locked → online/offline). */
export function DeviceStatusBadge({ status }) {
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

/** One row in "Remote controls" / "TV controls". `danger` gives the red icon tile (screen lock). */
export function ControlRow({ icon, title, description, danger, muted, children }) {
  return (
    <div className={`control-row${muted ? ' is-muted' : ''}`}>
      <span className={`control-icon${danger ? ' is-danger' : ''}`}><Icon name={icon} /></span>
      <div className="control-text">
        <span className="control-title">{title}</span>
        <span className="sub">{description}</span>
      </div>
      <div className="control-action">{children}</div>
    </div>
  );
}

/**
 * Placeholder map: a light street grid with the points plotted.
 * points: [{ n, x, y }] with x/y in 0–1. The last point is the current one.
 * TODO(map): swap for Google Maps / Leaflet when the API sends lat/lng.
 */
export function MapPlaceholder({ points = [], height = 220, children, label = 'Map' }) {
  const current = points[points.length - 1];
  return (
    <div className="map" style={{ height }} role="img" aria-label={label}>
      <div className="map-road" style={{ left: 0, right: 0, top: '54%', height: 10 }} />
      <div className="map-road" style={{ top: 0, bottom: 0, left: '38%', width: 10 }} />
      <div className="map-road" style={{ left: 0, right: 0, top: '78%', height: 7 }} />
      <div className="map-park" />
      {points.length > 1 && (
        <svg className="map-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} />
        </svg>
      )}
      {points.slice(0, -1).map((p) => (
        <span key={p.n} className="map-pin" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>{p.n}</span>
      ))}
      {current && (
        <>
          <span className="map-halo" style={{ left: `${current.x * 100}%`, top: `${current.y * 100}%` }} />
          <span className={`map-pin is-current${points.length === 1 ? ' is-dot' : ''}`} style={{ left: `${current.x * 100}%`, top: `${current.y * 100}%` }}>
            {points.length > 1 ? current.n : ''}
          </span>
        </>
      )}
      {children}
      <span className="map-note">Map placeholder</span>
    </div>
  );
}

const DOT = { bad: 'var(--bad)', info: 'var(--navy)', ok: 'var(--ok)', warn: 'var(--alert)', mute: 'var(--offline)' };

export function ActivityList({ items }) {
  return (
    <ul className="activity">
      {items.map((a) => (
        <li key={a.id}>
          <span className="activity-dot" style={{ background: DOT[a.tone] ?? DOT.info }} />
          <div className="cell-stack"><span>{a.text}</span><span className="cell-sub">{a.by ? `${a.at} · ${a.by}` : a.at}</span></div>
        </li>
      ))}
    </ul>
  );
}