import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { retailersApi } from '../../services/retailersApi';
import { P } from '../../config/permissions';
import { LEVELS } from '../../config/roles';
import { num, downloadCsv } from '../../utils/format';
import {
  Avatar, Badge, Button, Card, ErrorBlock, FilterBar, FilterChips, Icon, PageHeader, Pagination,
  Progress, SearchInput, SelectFilter, StateMessage, Table, useToast,
} from '../../components/ui';

const MONTH = 'September'; // TODO(api): from the response once the backend sends the period

/** A-04 · Retailers (staff) — also "All retailers" for partners, scoped to their network. */
export default function RetailersList({ screen }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useQueryState({ q: '', status: 'all', district: '', page: 1 });
  const { data, loading, error, reload } = useApi(() => retailersApi.list(f), [f.q, f.status, f.district, f.page]);

  const isPartner = user.level !== LEVELS.COMPANY;
  const live = !!data?.live;
  const period = live ? 'Overall' : MONTH;
  const subtitle = data
    ? `${num(data.totals.stores)} stores${data.totals.pending ? ` · ${data.totals.pending} awaiting approval` : ''}${isPartner ? ' in your network' : ''}`
    : ' ';

  const exportCsv = async () => {
    const rows = await retailersApi.exportRows(f);
    downloadCsv('retailers.csv', [
      { key: 'store', header: 'Store' }, { key: 'owner', header: 'Owner' }, { key: 'location', header: 'Location' },
      { key: 'devices', header: 'Devices' }, { key: 'activeEmis', header: 'Active EMIs' }, { key: 'overdue', header: 'Overdue' },
      { key: 'collectionRate', header: `${period} collection %` }, { key: 'status', header: 'Status' },
    ], rows);
    toast(`Exported ${rows.length} retailers`);
  };

  const columns = [
    { key: 'store', header: 'Store', width: '2fr', render: (r) => (
      <div className="cell-person">
        <Avatar text={r.initials} shape="square" />
        <div className="cell-stack"><span className="fw-600">{r.store}</span><span className="cell-sub">{r.owner}</span></div>
      </div>
    ) },
    { key: 'location', header: 'Location', width: '1.4fr', render: (r) => <span className="ink-2">{r.location}</span> },
    { key: 'devices', header: 'Devices', width: '0.7fr', align: 'right', render: (r) => num(r.devices) },
    ...(live ? [{ key: 'balance', header: 'Keys', width: '0.7fr', align: 'right', render: (r) => num(r.balance) }]
      : [{ key: 'activeEmis', header: 'Active EMIs', width: '0.8fr', align: 'right', render: (r) => num(r.activeEmis) }]),
    { key: 'overdue', header: 'Overdue', width: '0.7fr', align: 'right', render: (r) => (
      <span style={{ color: r.overdue ? 'var(--bad)' : 'var(--ink-2)', fontWeight: 500 }}>{num(r.overdue)}</span>
    ) },
    { key: 'collection', header: `${period} collection`, width: '1.3fr', render: (r) => (
      <Progress value={r.collectionRate ?? 0} label={r.collectionRate == null ? '—' : `${r.collectionRate}%`} labelWidth={36} />
    ) },
    { key: 'status', header: 'Status', width: '1fr', render: (r) => <Badge status={r.status} /> },
    { key: 'go', header: '', width: '24px', render: () => <span className="row-chevron"><Icon name="chevronRight" size={16} /></span> },
  ];

  const c = data?.counts;
  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title={screen.title}
        subtitle={subtitle}
        actions={<>
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!data}>Export</Button>}
          {can(P.RETAILERS_MANAGE) && <Button icon="plus" to="/retailers/new">Add retailer</Button>}
        </>}
      />

      <FilterBar>
        <SearchInput placeholder="Store, owner or city" label="Search retailers" value={f.q} onChange={(q) => setF({ q })} />
        <FilterChips
          label="Status"
          value={f.status}
          onChange={(status) => setF({ status })}
          options={[
            { value: 'all', label: 'All', count: c?.all },
            { value: 'active', label: 'Active', count: c?.active },
            ...(live ? [] : [{ value: 'pending', label: 'Awaiting approval', count: c?.pending }]),
            { value: 'suspended', label: 'Suspended', count: c?.suspended },
          ]}
        />
        <div className="grow" />
        <SelectFilter
          label={live ? 'City' : 'District'}
          value={f.district}
          onChange={(district) => setF({ district })}
          options={(data?.districts ?? []).map((d) => ({ value: d, label: d }))}
        />
      </FilterBar>

      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading retailers…</div>
          : data.total === 0 && !f.q && f.status === 'all' && !f.district ? (
            <StateMessage
              icon="store"
              title="No retailers yet"
              action={can(P.RETAILERS_MANAGE) && <Button icon="plus" to="/retailers/new">Add retailer</Button>}
            >
              {live ? 'Stores you add show up here. The owner signs in to the Retailer app with the email and password you set.'
                : 'Stores you add show up here. A super admin approves each new store before the owner can sign in to the Retailer app.'}
            </StateMessage>
          ) : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table
                  columns={columns}
                  rows={data.items}
                  onRowClick={(r) => navigate(`/retailers/${r.id}`)}
                  minWidth={920}
                  empty="No stores match these filters. Clear the search or pick another status."
                />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>
    </div>
  );
}
