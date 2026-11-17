import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { devicesApi, DEVICES_LIVE } from '../../services/devicesApi';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import {
  Badge, Button, Card, Dialog, ErrorBlock, FilterBar, FilterChips, Icon, PageHeader, Pagination, SearchInput, Table,
} from '../../components/ui';
import { DeviceStatusBadge } from './deviceParts';
import './devices.css';

const SUPPORTED = [
  ['Google TV · Android TV', 'All 5 controls', 'TCL, Mi, OnePlus, Acer, Vu, Sony'],
  ['Samsung (Tizen)', 'Screen lock and messages', '2 of 5 controls'],
  ['LG (webOS)', 'Messages only', '1 of 5 controls'],
];

/** A-17 · TV devices */
export default function TvList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [showModels, setShowModels] = useState(false);
  const [f, setF] = useQueryState({ q: '', status: 'all', page: 1 });
  const { data, loading, error, reload } = useApi(() => devicesApi.list({ ...f, kind: 'tv' }), [f.q, f.status, f.page]);

  const columns = [
    { key: 'model', header: 'TV', width: '1.7fr', render: (r) => (
      <div className="cell-person">
        <span className="device-tile-icon"><Icon name="tv" /></span>
        <div className="cell-stack"><span className="fw-600">{r.model}</span><span className="cell-sub mono">{r.serialLabel}</span></div>
      </div>
    ) },
    { key: 'os', header: 'Platform', width: '1fr', render: (r) => <span className="ink-2">{r.os}</span> },
    { key: 'customer', header: 'Customer', width: '1.3fr' },
    { key: 'retailer', header: 'Retailer', width: '1.2fr', render: (r) => <span className="ink-2">{r.retailer}</span> },
    { key: 'lastSeen', header: 'Last seen', width: '1fr', render: (r) => <span className="ink-2">{r.lastSeen}</span> },
    { key: 'controls', header: 'Controls', width: '1.1fr', render: (r) => <span className="ink-2">{r.controls}</span> },
    { key: 'status', header: 'Status', width: '1fr', render: (r) => (r.limited && !r.status.key.match(/locked|alert/)
      ? <Badge tone="warn">Limited</Badge> : <DeviceStatusBadge status={r.status} />) },
    { key: 'go', header: '', width: '24px', render: () => <span className="row-chevron"><Icon name="chevronRight" size={16} /></span> },
  ];

  const c = data?.counts;
  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="TV devices"
        subtitle={data ? `${num(data.totals.devices)} smart TVs · Android TV and Google TV` : ' '}
        actions={<>
          <Button variant="secondary" onClick={() => setShowModels(true)}>Supported models</Button>
          {can(P.DEVICES_REGISTER) && !DEVICES_LIVE && <Button icon="plus" to="/devices/register?type=tv">Register TV</Button>}
        </>}
      />

      <div className="info-box">
        <Icon name="info" />
        <span>Controls depend on the TV's brand and model. Every TV is checked when it is registered, and unsupported controls are hidden on its page.</span>
      </div>

      <FilterBar>
        <SearchInput placeholder="Serial, model or customer" label="Search TVs" value={f.q} onChange={(q) => setF({ q })} />
        <FilterChips label="TV status" value={f.status} onChange={(status) => setF({ status })} options={[
          { value: 'all', label: 'All', count: c?.all },
          { value: 'online', label: 'Online', count: c?.online },
          { value: 'offline', label: 'Offline', count: c?.offline },
          { value: 'locked', label: 'Locked', count: c?.locked },
        ]} />
      </FilterBar>

      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading TVs…</div>
          : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table columns={columns} rows={data.items} onRowClick={(r) => navigate(`/tvs/${r.id}`)} minWidth={980}
                  empty="No TVs match. Clear the search or pick another status." />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>

      <Dialog open={showModels} onClose={() => setShowModels(false)} width={520} title="Supported TV models"
        subtitle="What Prime Locker can control on each TV platform."
        actions={<Button onClick={() => setShowModels(false)}>Done</Button>}>
        <dl className="kv-list">
          {SUPPORTED.map(([k, v, n]) => (
            <div key={k} className="kv-row"><dt>{k}</dt><dd><div className="cell-stack"><span style={{ color: 'var(--ink)' }}>{v}</span><span className="cell-sub">{n}</span></div></dd></div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}