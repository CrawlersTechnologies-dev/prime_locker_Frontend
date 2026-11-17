import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { networkApi } from '../../services/networkApi';
import { P } from '../../config/permissions';
import { num, downloadCsv } from '../../utils/format';
import {
  Badge, Button, Card, ErrorBlock, FilterBar, Icon, PageHeader, Pagination, SearchInput, SelectFilter, Table, Tabs, useToast,
} from '../../components/ui';
import { LevelChip } from './networkParts';

const TABS = [
  { value: 'super_distributor', label: 'Super distributors', singular: 'Super distributor', parent: null },
  { value: 'distributor', label: 'Distributors', singular: 'Distributor', parent: 'Super distributor' },
  { value: 'sub_distributor', label: 'Sub distributors', singular: 'Sub distributor', parent: 'Distributor' },
];

function statusBadge(r) {
  if (r.status === 'pending') return <Badge tone="mute">Awaiting approval</Badge>;
  if (r.status === 'suspended') return <Badge tone="bad">Suspended</Badge>;
  if (r.low) return <Badge tone="warn">Low keys</Badge>;
  return <Badge tone="ok">Active</Badge>;
}

/** N-02 · Partners (Prime Locker staff) */
export default function PartnersList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useQueryState({ level: 'super_distributor', q: '', parentId: '', page: 1 });
  const { data, loading, error, reload } = useApi(() => networkApi.partners(f), [f.level, f.q, f.parentId, f.page]);
  const tab = TABS.find((t) => t.value === f.level) ?? TABS[0];

  const columns = [
    { key: 'name', header: tab.singular, width: '2fr', render: (r) => (
      <div className="cell-stack"><span className="fw-600">{r.name}</span><span className="cell-sub">{[r.owner, r.city].filter(Boolean).join(' · ') || r.email}</span></div>
    ) },
    ...(tab.parent ? [{ key: 'parent', header: 'Reports to', width: '1.6fr', render: (r) => (
      r.parent ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{r.parent.level && <LevelChip level={r.parent.level} />}<span className="ink-2">{r.parent.name}</span></div> : <span className="muted">—</span>
    ) }] : []),
    ...(f.level === 'super_distributor' ? [{ key: 'd', header: 'Distributors', width: '0.8fr', align: 'right', render: (r) => num(r.counts.distributors) }] : []),
    ...(f.level !== 'sub_distributor' ? [{ key: 's', header: 'Sub dist.', width: '0.7fr', align: 'right', render: (r) => num(r.counts.subDistributors) }] : []),
    { key: 'r', header: 'Retailers', width: '0.7fr', align: 'right', render: (r) => num(r.counts.retailers) },
    { key: 'balance', header: data?.live ? 'Keys available' : 'Keys balance', width: '0.9fr', align: 'right', render: (r) => <span className="fw-600" style={{ color: r.low ? 'var(--bad)' : undefined }}>{num(r.balance)}</span> },
    { key: 'used', header: data?.live ? 'Devices' : 'Keys used', width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{num(r.used)}</span> },
    { key: 'status', header: 'Status', width: '1.1fr', render: statusBadge },
    { key: 'go', header: '', width: '24px', render: () => <span className="row-chevron"><Icon name="chevronRight" size={16} /></span> },
  ];

  const exportCsv = async () => {
    const all = [];
    for (let page = 1, pages = 1; page <= pages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await networkApi.partners({ ...f, page });
      all.push(...res.items); pages = res.pages;
    }
    downloadCsv(`${f.level}s.csv`, [
      { key: 'name', header: tab.singular }, { key: 'owner', header: 'Owner' }, { key: 'mobile', header: 'Mobile' }, { key: 'city', header: 'City' },
      { header: 'Reports to', value: (r) => r.parent?.name }, { header: 'Retailers', value: (r) => r.counts.retailers },
      { key: 'balance', header: 'Keys balance' }, { key: 'used', header: 'Keys used' }, { key: 'status', header: 'Status' },
    ], all);
    toast(`Exported ${all.length} partners`);
  };

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Partners"
        subtitle="Everyone between Prime Locker and the retailers"
        actions={<>
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!data}>Export</Button>}
          {can(P.PARTNER_ADD) && <Button icon="plus" to={`/partners/new?level=${f.level}`}>Add partner</Button>}
        </>}
      />

      <Tabs label="Partner level" idPrefix="pt" value={f.level} onChange={(level) => setF({ level, parentId: '' })}
        tabs={TABS.map((t) => ({ value: t.value, label: `${t.label}${data ? ` (${data.counts[t.value]})` : ''}` }))} />

      <FilterBar>
        <SearchInput placeholder="Business, owner or city" label="Search partners" value={f.q} onChange={(q) => setF({ q })} />
        {tab.parent && (
          <SelectFilter label={tab.parent} value={f.parentId} onChange={(parentId) => setF({ parentId })} options={data?.parents ?? []} />
        )}
      </FilterBar>

      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading partners…</div>
          : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table columns={columns} rows={data.items} onRowClick={(r) => navigate(`/partners/${r.id}`)} minWidth={900}
                  empty={f.q || f.parentId ? 'No partners match. Clear the search or filter.' : `No ${tab.label.toLowerCase()} yet.`} />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>
    </div>
  );
}