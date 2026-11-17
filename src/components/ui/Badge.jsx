/** Status pill. Colour is reserved for status, so every status maps to one tone. */
const STATUS_TONE = {
  online: ['ok', 'Online'],
  offline: ['mute', 'Offline'],
  locked: ['bad', 'Locked'],
  unlocked: ['info', 'Unlocked'],
  alert: ['warn', 'Alert'],
  paid: ['ok', 'Paid'],
  overdue: ['bad', 'Overdue'],
  due_soon: ['warn', 'Due soon'],
  active: ['ok', 'Active'],
  pending: ['warn', 'Awaiting approval'],
  suspended: ['bad', 'Suspended'],
  draft: ['mute', 'Draft'],
};

export default function Badge({ tone, status, children }) {
  const [t, label] = status ? STATUS_TONE[status] ?? ['mute', status] : [tone ?? 'mute', null];
  return <span className={`badge badge-${t}`}>{children ?? label}</span>;
}
