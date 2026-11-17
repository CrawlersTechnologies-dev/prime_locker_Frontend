import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { customersApi } from '../../services/customersApi';
import { P } from '../../config/permissions';
import { num, downloadCsv } from '../../utils/format';
import {
  Button, Card, ErrorBlock, FilterBar, FilterChips, PageHeader, Pagination, SearchInput, SelectFilter,
  StateMessage, Table, useToast,
} from '../../components/ui';
import { customerColumns, CUSTOMER_STATUS } from './customerColumns';

const DEVICE_TYPES = [
  { value: 'android', label: 'Android' },
  { value: 'iphone', label: 'iPhone' },
  { value: 'tv', label: 'Smart TV' },
];

/** A-07 · Customers */
export default function CustomersList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useQueryState({ q: '', status: 'all', retailerId: '', deviceType: '', page: 1 });
  const { data, loading, error, reload } = useApi(() => customersApi.list(f), [f.q, f.status, f.retailerId, f.deviceType, f.page]);
  const showPhone = can(P.CUSTOMER_PHONE_VIEW);

  const exportCsv = async () => {
    const rows = await customersApi.exportRows(f);
    downloadCsv('customers.csv', [
      { key: 'name', header: 'Customer' },
      ...(showPhone ? [{ key: 'phone', header: 'Mobile' }] : []),
      { key: 'device', header: 'Device' }, { key: 'deviceRef', header: 'IMEI / serial' }, { key: 'retailer', header: 'Retailer' },
      { key: 'emi', header: 'EMI' }, { header: 'Paid', value: (r) => `${r.paid}/${r.months}` }, { key: 'nextDue', header: 'Next due' },
      { header: 'Status', value: (r) => CUSTOMER_STATUS[r.status]?.[1] ?? r.status },
    ], rows);
    toast(`Exported ${rows.length} customers`);
  };

  const c = data?.counts;
  const filtered = f.q || f.status !== 'all' || f.retailerId || f.deviceType;

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Customers"
        subtitle={data ? `${num(data.totals.customers)} customers across ${num(data.totals.retailers)} retailers` : ' '}
        actions={<>
          {can(P.REPORTS_EXPORT) && <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!data}>Export</Button>}
          {can(P.CUSTOMERS_MANAGE) && <Button icon="plus" to="/customers/new">Add customer</Button>}
        </>}
      />

      <FilterBar>
        <SearchInput placeholder="Name, phone or IMEI" label="Search customers" value={f.q} onChange={(q) => setF({ q })} />
        <FilterChips
          label="EMI status"
          value={f.status}
          onChange={(status) => setF({ status })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'on_emi', label: 'On EMI', count: c?.on_emi },
            { value: 'overdue', label: 'Overdue', count: c?.overdue },
            { value: 'completed', label: 'Completed', count: c?.completed },
            ...(data?.live ? [{ value: 'no_emi', label: 'No EMI yet', count: c?.no_emi }] : []),
          ]}
        />
        <div className="grow" />
        <SelectFilter
          label="Retailer"
          value={f.retailerId}
          onChange={(retailerId) => setF({ retailerId })}
          options={(data?.retailers ?? []).map((r) => ({ value: r.id, label: r.label }))}
        />
        <SelectFilter label="Device" value={f.deviceType} onChange={(deviceType) => setF({ deviceType })} options={DEVICE_TYPES} />
      </FilterBar>

      <Card flush aria-busy={loading}>
        {error ? <ErrorBlock error={error} onRetry={reload} />
          : !data ? <div className="table-empty">Loading customers…</div>
          : data.total === 0 && !filtered ? (
            <StateMessage icon="users" title="No customers yet"
              action={can(P.CUSTOMERS_MANAGE) && <Button icon="plus" to="/customers/new">Add customer</Button>}>
              {data.live ? 'Customers appear here when a retailer enrols a device in the Retailer app, or when you add one.' : 'Add a customer, then register their device and set up the EMI.'}
            </StateMessage>
          ) : (
            <>
              <div style={{ opacity: loading ? 0.6 : 1 }}>
                <Table
                  columns={customerColumns({ showPhone })}
                  rows={data.items}
                  onRowClick={(r) => navigate(`/customers/${r.id}`)}
                  minWidth={980}
                  empty="No customers match these filters. Clear the search or pick another filter."
                />
              </div>
              <Pagination {...data} onPage={(page) => setF({ page })} />
            </>
          )}
      </Card>
    </div>
  );
}
