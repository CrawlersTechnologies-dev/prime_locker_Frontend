/**
 * Reports (A-32, A-33) and audit logs (A-37). Live only — these screens have no mock data.
 *   GET /reports/collections-summary/?start_date&end_date&retailer_id&payment_mode
 *   GET /reports/overdue-ageing/   /reports/retailer-performance/   /reports/payments-by-mode/
 *   GET /reports/locks-unlocks/    /reports/customer-kyc/?status=
 *   GET /audit-logs/?page&search&action&role&start_date&end_date
 * Every endpoint takes ?export=csv and returns a spreadsheet.
 */
import { http, isLive, toNum, downloadExport } from './http';

export const REPORTS_LIVE = isLive('reports');
export const AUDIT_LIVE = isLive('audit');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'; };
const fmtDateTime = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—'; };
const MODE = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', ONLINE_GATEWAY: 'Online', OTHER: 'Other' };
const CONTRACT = { ACTIVE: 'Active', LOCKED: 'Locked', COMPLETED: 'Paid off', DRAFT: 'Draft', DEFAULTED: 'Defaulted' };

export const REPORTS = [
  { key: 'collections', path: '/reports/collections-summary/', file: 'collections-summary.csv', title: 'Collections', dates: true },
  { key: 'overdue', path: '/reports/overdue-ageing/', file: 'overdue-ageing.csv', title: 'Overdue ageing' },
  { key: 'retailers', path: '/reports/retailer-performance/', file: 'retailer-performance.csv', title: 'Retailer performance' },
  { key: 'modes', path: '/reports/payments-by-mode/', file: 'payments-by-mode.csv', title: 'Payments by mode' },
  { key: 'locks', path: '/reports/locks-unlocks/', file: 'locks-unlocks.csv', title: 'Locks & devices' },
  { key: 'kyc', path: '/reports/customer-kyc/', file: 'customer-kyc.csv', title: 'Customer KYC' },
];
const byKey = (k) => REPORTS.find((r) => r.key === k);

function params(key, { from, to, status } = {}) {
  if (key === 'collections') return { start_date: from || undefined, end_date: to || undefined };
  if (key === 'kyc') return { status: status || undefined };
  return {};
}

const parsers = {
  collections: (d) => ({
    kpis: {
      due: toNum(d.summary?.total_amount_due),
      collected: toNum(d.summary?.total_amount_collected),
      pending: toNum(d.summary?.total_amount_pending),
      rate: toNum(d.summary?.overall_collection_rate_pct),
    },
    modes: (d.by_payment_mode ?? []).map((m) => ({ mode: MODE[m.payment_mode] ?? m.payment_mode ?? 'Other', amount: toNum(m.total), count: toNum(m.count) })),
    rows: (d.by_retailer ?? []).map((r) => ({
      id: String(r.retailer_id), store: r.store_name, due: toNum(r.amount_due), collected: toNum(r.amount_collected),
      pending: toNum(r.amount_pending), rate: toNum(r.collection_rate_pct),
    })),
  }),
  overdue: (d) => ({
    kpis: {
      count: toNum(d.kpis?.total_overdue_count),
      amount: toNum(d.kpis?.total_overdue_amount),
      buckets: Object.values(d.kpis?.buckets ?? {}).map((b) => ({ label: b.label, count: toNum(b.count), amount: toNum(b.amount) })),
    },
    rows: (d.overdue_customers ?? []).map((r) => ({
      id: String(r.installment_id), contractId: r.contract_id, customer: r.customer_name, phone: r.customer_phone,
      device: r.device_name, imei: r.device_imei, store: r.store_name, due: fmtDate(r.due_date), amount: toNum(r.overdue_amount),
      days: toNum(r.days_overdue), bucket: r.bucket, status: CONTRACT[r.device_status] ?? r.device_status,
    })),
  }),
  retailers: (d) => ({
    kpis: { stores: toNum(d.total_stores_evaluated) },
    rows: (d.stores ?? []).map((s) => ({
      id: String(s.retailer_id), store: s.store_name, owner: s.owner_name, phone: s.mobile_number, place: [s.city, s.state].filter(Boolean).join(', '),
      devices: toNum(s.devices_sold), financed: toNum(s.total_financed_amount), collected: toNum(s.total_collected),
      rate: toNum(s.collection_rate_pct), overdue: toNum(s.overdue_count),
    })),
  }),
  modes: (d) => ({
    kpis: { total: toNum(d.total_revenue_collected) },
    rows: (d.modes ?? []).map((m) => ({ id: m.payment_mode, mode: MODE[m.payment_mode] ?? m.payment_mode, count: toNum(m.transaction_count), amount: toNum(m.total_amount), share: toNum(m.percentage_share) })),
  }),
  locks: (d) => ({
    kpis: { total: toNum(d.summary?.total_monitored_devices), locked: toNum(d.summary?.locked_devices_count), active: toNum(d.summary?.active_devices_count) },
    rows: (d.devices ?? []).map((r) => ({
      id: String(r.contract_id), device: r.device_name, imei: r.device_imei, customer: r.customer_name, phone: r.customer_phone,
      store: r.store_name, status: r.current_status, statusLabel: CONTRACT[r.current_status] ?? r.current_status,
      autoLock: !!r.auto_lock_enabled, grace: toNum(r.grace_period_days), updated: fmtDateTime(r.last_updated),
    })),
  }),
  kyc: (d) => ({
    kpis: { total: toNum(d.kpis?.total_customers), complete: toNum(d.kpis?.complete_kyc_count), missing: toNum(d.kpis?.missing_or_partial_kyc_count) },
    rows: (d.customers ?? []).map((c) => ({
      id: String(c.customer_id), customer: c.customer_name, phone: c.primary_phone, alt: c.alternate_phone,
      photo: !!c.customer_photo_uploaded, signature: !!c.customer_signature_uploaded, store: c.registered_store,
      status: c.kyc_status, joined: fmtDate(c.date_joined),
    })),
  }),
};

/** Turns an action code (CREATED_RETAILER) into words (Created retailer). */
export function actionLabel(a = '') {
  const s = String(a).toLowerCase().replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function detailText(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export const reportsApi = {
  async get(key, filters) {
    const r = byKey(key);
    const d = await http.get(r.path, { params: params(key, filters) });
    return parsers[key](d ?? {});
  },

  exportCsv(key, filters) {
    const r = byKey(key);
    return downloadExport(r.path, params(key, filters), r.file);
  },

  /** A-37 · one page of the audit log (50 per page). */
  async audit({ q = '', role = '', from = '', to = '', action = '', page = 1 } = {}) {
    const d = await http.get('/audit-logs/', { params: { search: q, role, start_date: from, end_date: to, action, page } });
    const total = toNum(d?.count ?? 0);
    return {
      items: (d?.results ?? []).map((l) => ({
        id: String(l.id),
        at: fmtDateTime(l.timestamp),
        who: l.user_details?.name ?? 'System',
        whoSub: [l.user_details?.business_name, l.user_details?.role ? actionLabel(l.user_details.role) : null].filter(Boolean).join(' · '),
        action: l.action,
        actionLabel: actionLabel(l.action),
        details: detailText(l.details),
        ip: l.ip_address ?? '',
      })),
      total,
      page: Number(page) || 1,
      pages: Math.max(1, Math.ceil(total / 50)),
      pageSize: 50,
    };
  },

  auditCsv({ q = '', role = '', from = '', to = '', action = '' } = {}) {
    return downloadExport('/audit-logs/', { search: q, role, start_date: from, end_date: to, action }, 'audit-logs.csv');
  },
};
