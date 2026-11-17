import { http, mockDelay, isLive, toNum } from './http';
import { ADMIN_DASHBOARD } from './mock/dashboard';
import { partnerDashboard } from './networkApi';
import { inr, inrShort } from '../utils/format';

const LIVE = isLive('dashboard');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Collected vs due (in lakh) for the last 6 months, from GET /reports/collections-summary/?start_date&end_date. */
async function lastSixMonths() {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(today.getFullYear(), today.getMonth() - 5 + i, 1));
  return Promise.all(months.map(async (start) => {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const r = await http.get('/reports/collections-summary/', { params: { start_date: iso(start), end_date: iso(end) } })
      .catch(() => null);
    const s = r?.summary ?? {};
    return {
      month: MONTHS[start.getMonth()],
      collected: Math.round(toNum(s.total_amount_collected) / 10000) / 10, // lakh, 1 decimal
      due: Math.round(toNum(s.total_amount_due) / 10000) / 10,
      dueRupees: toNum(s.total_amount_due),
      collectedRupees: toNum(s.total_amount_collected),
    };
  }));
}

const shortDate = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? String(d ?? '') : `${x.getDate()} ${MONTHS[x.getMonth()]}`;
};

/** Backend contract status → panel badge. */
const deviceBadge = (s) => ({ LOCKED: 'locked', ACTIVE: 'online', COMPLETED: 'paid' }[s] ?? 'offline');

/** Live: GET /dashboard/ + GET /emi-overdue/ + collections per month → the shape AdminDashboard (A-02) renders. */
async function liveAdmin(range = 'month') {
  const apiRange = { today: 'today', week: '7d', month: 'this_month' }[range] ?? 'this_month';
  const [d, overdue, collections] = await Promise.all([
    http.get('/dashboard/', { params: { range: apiRange } }),
    http.get('/emi-overdue/').catch(() => ({ overdue_customers: [] })),
    lastSixMonths(),
  ]);
  const now = new Date();
  const net = d.network_kpis ?? {};
  const dev = d.device_and_emi_kpis ?? {};
  const fin = d.financial_kpis ?? {};
  const thisMonth = collections[collections.length - 1];
  const percentOfDue = thisMonth?.dueRupees > 0 ? Math.round((thisMonth.collectedRupees / thisMonth.dueRupees) * 100) : null;

  const overdueRows = [...(overdue.overdue_customers ?? [])]
    .sort((a, b) => b.days_overdue - a.days_overdue)
    .slice(0, 8)
    .map((r) => ({
      id: String(r.contract_id),
      contractId: r.contract_id,
      customer: r.customer_name,
      phone: r.customer_phone ?? '',
      device: r.device_name,
      deviceRef: r.device_imei ? `…${String(r.device_imei).slice(-6)}` : '',
      retailer: r.retailer_store || r.retailer_name,
      due: shortDate(r.due_date),
      amount: inr(toNum(r.overdue_amount)),
      daysLate: r.days_overdue,
      status: deviceBadge(r.device_status),
    }));

  return {
    live: true,
    dateLabel: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    kpis: {
      activeDevices: {
        value: toNum(dev.active_unlocked_devices) + toNum(dev.locked_devices),
        delta: `${toNum(dev.locked_devices)} locked now`,
      },
      customersOnEmi: { value: toNum(net.customers), retailers: toNum(net.retailers) },
      collected: {
        amount: inrShort(toNum(fin.range_collected_amount ?? fin.this_month_collection_amount)),
        month: MONTHS_LONG[now.getMonth()],
        label: range === 'today' ? 'Collected today' : range === 'week' ? 'Collected in the last 7 days' : `Collected in ${MONTHS_LONG[now.getMonth()]}`,
        percentOfDue: range === 'month' ? percentOfDue : null,
        today: inrShort(toNum(fin.today_collection_amount)),
      },
      overdue: { count: toNum(fin.overdue_installments_count), outstanding: inrShort(toNum(fin.total_overdue_amount)) },
    },
    collections,
    // The backend tracks EMI contract status (no online/offline yet).
    deviceStatus: {
      total: toNum(dev.total_registered_devices),
      items: [
        { key: 'active', label: 'Active · unlocked', badge: 'online', value: toNum(dev.active_unlocked_devices), color: 'var(--ok)' },
        { key: 'locked', label: 'Locked', badge: 'locked', value: toNum(dev.locked_devices), color: 'var(--bad)' },
        { key: 'done', label: 'EMI completed', badge: 'paid', value: toNum(dev.completed_emi_contracts), color: 'var(--offline)' },
      ],
    },
    overdue: overdueRows,
    network: net,
    keys: d.key_inventory_kpis ?? {},
    recentPayments: d.recent_payments ?? [],
    recentActivity: d.recent_activity ?? [],
  };
}

export const dashboardApi = {
  /** A-02. Live: several endpoints combined (see liveAdmin). The backend has no date-range filter yet. */
  admin: (range = 'month') => (LIVE ? liveAdmin(range) : mockDelay(ADMIN_DASHBOARD)),

  /** GET /dashboard/partner — scoped to the signed-in partner's network by the backend (N-09, N-10, N-11) */
  partner: () => partnerDashboard(),
};
