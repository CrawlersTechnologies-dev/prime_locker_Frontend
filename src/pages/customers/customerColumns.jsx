import { Avatar, Badge, Icon, Progress } from '../../components/ui';

export const CUSTOMER_STATUS = {
  overdue: ['bad', 'Overdue'],
  due_soon: ['warn', 'Due soon'],
  on_track: ['ok', 'On track'],
  completed: ['mute', 'Completed'],
  draft: ['mute', 'Draft'],
  no_emi: ['mute', 'No EMI yet'],
};

export function CustomerStatus({ status }) {
  const [tone, label] = CUSTOMER_STATUS[status] ?? ['mute', status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Columns shared by A-07 and the retailer's Customers tab. */
export function customerColumns({ showPhone = true, showRetailer = true } = {}) {
  return [
    { key: 'name', header: 'Customer', width: '1.8fr', render: (c) => (
      <div className="cell-person">
        <Avatar text={c.initials} />
        <div className="cell-stack"><span className="fw-600">{c.name}</span>{showPhone && <span className="cell-sub">{c.phone}</span>}</div>
      </div>
    ) },
    { key: 'device', header: 'Device', width: '1.4fr', render: (c) => (c.device
      ? <div className="cell-stack"><span>{c.device}</span><span className="cell-sub mono">{c.deviceRef}</span></div>
      : <span className="muted">No device yet</span>) },
    ...(showRetailer ? [{ key: 'retailer', header: 'Retailer', width: '1.3fr', render: (c) => <span className="ink-2">{c.retailer}</span> }] : []),
    { key: 'emi', header: 'EMI', width: '0.9fr' },
    { key: 'paid', header: 'Paid', width: '1.1fr', render: (c) => (c.months
      ? <Progress value={(c.paid / c.months) * 100} label={`${c.paid}/${c.months}`} />
      : <span className="muted">—</span>) },
    { key: 'nextDue', header: 'Next due', width: '0.8fr', render: (c) => <span className="ink-2">{c.nextDue}</span> },
    { key: 'status', header: 'Status', width: '0.9fr', render: (c) => <CustomerStatus status={c.status} /> },
    { key: 'go', header: '', width: '24px', render: () => <span className="row-chevron"><Icon name="chevronRight" size={16} /></span> },
  ];
}
