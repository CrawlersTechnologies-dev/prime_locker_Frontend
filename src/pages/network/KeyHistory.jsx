import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { keysApi } from '../../services/networkApi';
import { keysLive } from '../../services/keysLive';
import { isLive } from '../../services/http';

const KEYS_LIVE = isLive('keys');
import { P } from '../../config/permissions';
import { LEVELS } from '../../config/roles';
import { num, downloadCsv } from '../../utils/format';
import { Breadcrumb, Button, Card, ErrorBlock, FilterBar, FilterChips, PageHeader, Pagination, Table, useToast } from '../../components/ui';

const TYPES = {
  generated: ['Generated', 'var(--ok)'],
  sent: ['Sent', 'var(--navy)'],
  used: ['Used on device', 'var(--alert)'],
  returned: ['Returned', 'var(--faint)'],
};

/** N-07 · Key history (ledger). Staff see the whole network; partners see their own part of it. */
export default function KeyHistory() {
  const { user, can } = useAuth();
  const toast = useToast();
  const [f, setF] = useQueryState({ type: 'all', page: 1 });
  const { data, loading, error, reload } = useApi(() => keysApi.ledger(f), [f.type, f.page]);
  const isCompany = user.level === LEVELS.COMPANY;

  const keysMode = data?.mode === 'keys';
  const KEY_STATUS = { AVAILABLE: ['Available', 'var(--ok)'], ACTIVATED: ['Used on device', 'var(--alert)'], REVOKED: ['Revoked', 'var(--faint)'] };
  const ks = (s) => KEY_STATUS[s] ?? [s, 'var(--faint)'];

  const exportCsv = async () => {
    if (KEYS_LIVE) {
      try { await keysLive.exportLedger(f.type); toast('Key history downloaded (one row per key)'); } catch (err) { toast(err.message, 'bad'); }
      return;
    }
    const all = [];
    for (let page = 1, pages = 1; page <= pages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await keysApi.ledger({ type: f.type, page });
      all.push(...res.items); pages = res.pages;
    }
    if (keysMode) {
      downloadCsv('keys.csv', [
        { key: 'key', header: 'Key' }, { key: 'type', header: 'Type' }, { header: 'Status', value: (r) => ks(r.status)[0] },
        { key: 'holder', header: 'Held by' }, { key: 'customer', header: 'Customer' }, { key: 'created', header: 'Created' }, { key: 'activated', header: 'Used on' },
      ], all);
      toast(`Exported ${all.length} keys`);
      return;
    }
    downloadCsv('key-history.csv', [
      { key: 'at', header: 'Date' }, { header: 'Type', value: (r) => TYPES[r.type][0] }, { key: 'path', header: 'From → to' },
      { key: 'qty', header: 'Keys' }, { key: 'ref', header: 'Reference' }, { key: 'by', header: 'Done by' },
    ], all);
    toast(`Exported ${all.length} entries`);
  };

  const columns = [
    { key: 'at', header: 'Date', width: '1fr', render: (e) => <span className="ink-2">{e.at}</span> },
    { key: 'type', header: 'Type', width: '1.1fr', render: (e) => <span className="ty"><i style={{ background: TYPES[e.type][1] }} />{TYPES[e.type][0]}</span> },
    { key: 'path', header: 'From → to', width: '2.4fr', render: (e) => <span className="ink-2">{e.path}</span> },
    { key: 'qty', header: 'Keys', width: '0.6fr', align: 'right', render: (e) => <span className="fw-600">{num(e.qty)}</span> },
    { key: 'ref', header: 'Reference', width: '1.4fr', render: (e) => <span className="mono small muted">{e.ref}</span> },
    { key: 'by', header: 'Done by', width: '1fr', render: (e) => <span className="ink-2">{e.by}</span> },
  ];

  const keyColumns = [
    { key: 'key', header: 'Key', width: '1.6fr', render: (k) => <span className="mono small">{k.key}</span> },
    { key: 'type', header: 'Type', width: '0.8fr', render: (k) => <span className="ink-2">{k.type}</span> },
    { key: 'status', header: 'Status', width: '1fr', render: (k) => <span className="ty"><i style={{ background: ks(k.status)[1] }} />{ks(k.status)[0]}</span> },
    { key: 'holder', header: 'Held by', width: '1.4fr', render: (k) => <span className="ink-2">{k.holder || '—'}</span> },
    { key: 'customer', header: 'Customer', width: '1.2fr', render: (k) => <span className="ink-2">{k.customer || '—'}</span> },
    { key: 'created', header: 'Created', width: '0.9fr', render: (k) => <span className="ink-2">{k.created}</span> },
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[isCompany ? { label: 'Enrolment keys', to: '/keys' } : { label: 'Key wallet', to: '/wallet' }, { label: 'Key history' }]} />
      <PageHeader
        title={keysMode ? 'Your keys' : 'Key history'}
        subtitle={keysMode ? `${num(data.total)} keys you hold right now, one row per key` : data?.perKey ? `${num(data.total)} key events · keys moved together show as one line`
          : isCompany ? 'Every key sent, received and used across the whole network' : 'Every key sent, received and used in your network'}
        actions={can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!data}>Export</Button>}
      />
      {!keysMode && <FilterBar>
        <FilterChips label="Type" value={f.type} onChange={(type) => setF({ type })} options={[
          { value: 'all', label: 'All' },
          ...(isCompany ? [{ value: 'generated', label: 'Generated' }] : []),
          { value: 'sent', label: 'Sent' },
          { value: 'used', label: 'Used on device' },
          { value: 'returned', label: 'Returned' },
        ]} />
      </FilterBar>}
      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading key history…</div>
          : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table columns={keysMode ? keyColumns : columns} rows={data.items} minWidth={900}
                  empty={keysMode ? 'You hold no keys right now. Generate a batch first.' : 'No entries of this type yet.'} />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>
    </div>
  );
}