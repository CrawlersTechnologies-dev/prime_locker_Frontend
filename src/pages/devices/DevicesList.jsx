import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { devicesApi, DEVICES_LIVE } from '../../services/devicesApi';
import { P } from '../../config/permissions';
import { LEVELS } from '../../config/roles';
import { num, downloadCsv } from '../../utils/format';
import {
  Badge, Button, Card, ErrorBlock, FilterBar, FilterChips, Icon, PageHeader, Pagination, SearchInput,
  SelectFilter, StateMessage, Table, useToast,
} from '../../components/ui';
import { DeviceStatusBadge } from './deviceParts';
import './devices.css';

/** A-10 · Mobile devices. For partners this is "Devices" and also includes their TVs. */
export default function DevicesList() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isPartner = user.level !== LEVELS.COMPANY;
  const kind = isPartner ? 'all' : 'phone';
  const [f, setF] = useQueryState({ q: '', status: 'all', os: '', retailerId: '', page: 1 });
  const { data, loading, error, reload } = useApi(() => devicesApi.list({ ...f, kind }), [f.q, f.status, f.os, f.retailerId, f.page, kind]);

  const OS = [
    { value: 'android', label: 'Android' },
    { value: 'ios', label: 'iOS' },
    ...(isPartner ? [{ value: 'tv', label: 'Smart TV' }] : []),
  ];

  const exportCsv = async () => {
    const all = [];
    for (let page = 1, pages = 1; page <= pages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await devicesApi.list({ ...f, kind, page });
      all.push(...res.items); pages = res.pages;
    }
    downloadCsv('devices.csv', [
      { key: 'model', header: 'Device' }, { key: 'imei', header: 'IMEI / serial' }, { key: 'customer', header: 'Customer' },
      { key: 'retailer', header: 'Retailer' }, { key: 'os', header: 'OS' }, { key: 'lastSeen', header: 'Last seen' },
      { header: 'EMI', value: (r) => r.emi[1] }, { header: 'Device status', value: (r) => r.status.label },
    ], all);
    toast(`Exported ${all.length} devices`);
  };

  const columns = [
    { key: 'model', header: 'Device', width: '1.7fr', render: (r) => (
      <div className="cell-person">
        <span className="device-tile-icon"><Icon name={r.type === 'tv' ? 'tv' : 'phone'} /></span>
        <div className="cell-stack"><span className="fw-600">{r.model}</span><span className="cell-sub mono">{r.serialLabel}</span></div>
      </div>
    ) },
    { key: 'customer', header: 'Customer', width: '1.3fr' },
    { key: 'retailer', header: 'Retailer', width: '1.2fr', render: (r) => <span className="ink-2">{r.retailer}</span> },
    { key: 'os', header: 'OS', width: '0.8fr', render: (r) => <span className="ink-2">{r.os}</span> },
    { key: 'lastSeen', header: 'Last seen', width: '1fr', render: (r) => <span className="ink-2">{r.lastSeen}</span> },
    { key: 'emi', header: 'EMI', width: '0.8fr', render: (r) => <Badge tone={r.emi[0]}>{r.emi[1]}</Badge> },
    { key: 'status', header: 'Device status', width: '1fr', render: (r) => <DeviceStatusBadge status={r.status} /> },
    { key: 'go', header: '', width: '24px', render: () => <span className="row-chevron"><Icon name="chevronRight" size={16} /></span> },
  ];

  const c = data?.counts;
  const t = data?.totals;
  const noun = isPartner ? 'devices' : 'phones';

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title={isPartner ? 'Devices' : 'Mobile devices'}
        subtitle={t ? `${num(t.devices)} ${noun} · ${num(t.locked)} locked · ${num(t.attention)} need attention${isPartner ? ' · in your network' : ''}` : ' '}
        actions={<>
          {!isPartner && <Button variant="secondary" icon="grid" to="/devices/status">Status board</Button>}
          {isPartner && can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!data}>Export</Button>}
          {can(P.DEVICES_REGISTER) && !DEVICES_LIVE && <Button icon="plus" to="/devices/register">Register device</Button>}
        </>}
      />

      <FilterBar>
        <SearchInput placeholder="IMEI, model or customer" label="Search devices" value={f.q} onChange={(q) => setF({ q })} />
        <FilterChips
          label="Device status"
          value={f.status}
          onChange={(status) => setF({ status })}
          options={[
            { value: 'all', label: 'All', count: c?.all },
            { value: 'online', label: 'Online', count: c?.online },
            { value: 'offline', label: 'Offline', count: c?.offline },
            { value: 'locked', label: 'Locked', count: c?.locked },
            { value: 'alerts', label: 'Alerts', count: c?.alerts },
          ]}
        />
        <div className="grow" />
        <SelectFilter label="OS" value={f.os} onChange={(os) => setF({ os })} options={OS} />
        <SelectFilter label="Retailer" value={f.retailerId} onChange={(retailerId) => setF({ retailerId })}
          options={(data?.retailers ?? []).map((r) => ({ value: r.id, label: r.label }))} />
      </FilterBar>

      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading devices…</div>
          : data.total === 0 && !f.q && f.status === 'all' && !f.os && !f.retailerId ? (
            <StateMessage icon="phone" title="No devices yet"
              action={can(P.DEVICES_REGISTER) && !DEVICES_LIVE && <Button icon="plus" to="/devices/register">Register a device</Button>}>
              Devices appear here as soon as a store enrols its first customer’s phone or TV.
            </StateMessage>
          ) : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table
                  columns={columns}
                  rows={data.items}
                  onRowClick={(r) => navigate(r.type === 'tv' ? `/tvs/${r.id}` : `/devices/${r.id}`)}
                  minWidth={980}
                  empty="No devices match these filters. Clear the search or pick another status."
                />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>
    </div>
  );
}