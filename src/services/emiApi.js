import { http, mockDelay, USE_MOCK, ApiError, isLive } from './http';
import { customersLive } from './customersLive';
import { devicesLive } from './devicesLive';
const DEVICES_LIVE = isLive('devices');

/** EMI plans: live with 'emi' in VITE_LIVE_MODULES. Schedule + overdue: live with 'customers'. */
const PLANS_LIVE = isLive('emi');
const CUSTOMERS_LIVE = isLive('customers');
import { CUSTOMERS } from './mock/customers';
import { RETAILERS } from './mock/retailers';
import { EMI_PLANS, planFor } from './mock/emiPlans';
import { PAYMENTS, nextReceiptId } from './mock/payments';
import { allDevices, syncStatus } from './mock/devices';
import { inMyNetwork, paginate, matches, MOCK_TODAY } from './mock/scope';
import { schedule, computeStatus } from './customersApi';
import { currentMockUser } from './authApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const retailerOf = (c) => RETAILERS.find((r) => r.id === c.retailerId);
const scoped = () => CUSTOMERS.filter((c) => inMyNetwork(retailerOf(c)?.network));
const findCustomer = (id) => {
  const c = scoped().find((x) => x.id === id);
  if (!c) throw new ApiError('Customer not found', 404);
  return c;
};

/** Monthly installment: what's financed, split evenly, rounded up to the rupee. */
export function monthlyEmi(price, down, months) {
  const financed = Math.max(0, price - down);
  return { financed, amount: months > 0 ? Math.ceil(financed / months) : 0 };
}

function overdueInfo(c) {
  const late = schedule(c).filter((s) => s.status === 'overdue');
  if (!late.length) return null;
  const oldest = late[0];
  return {
    count: late.length,
    amount: late.reduce((n, s) => n + s.amount, 0),
    fees: late.reduce((n, s) => n + s.lateFee, 0),
    due: oldest.due.slice(0, 6),
    daysLate: Math.round((MOCK_TODAY - oldest.dueDate) / 86400000),
  };
}

export const emiApi = {
  /* ---------------- Plan templates (A-19) ---------------- */

  /** GET /emi-plans?status= */
  async plans(status = 'all') {
    if (PLANS_LIVE) return customersLive.plans(status);
    if (!USE_MOCK) return http.get('/emi-plans', { params: { status } });
    const count = (id) => CUSTOMERS.filter((c) => c.emi && planFor(c) === id).length;
    const rows = EMI_PLANS.map((p) => ({ ...p, customers: p.status === 'draft' ? null : count(p.id) }));
    return mockDelay({
      items: rows.filter((p) => status === 'all' || p.status === status),
      counts: { all: rows.length, active: rows.filter((p) => p.status === 'active').length, draft: rows.filter((p) => p.status === 'draft').length },
    });
  },

  /** POST /emi-plans  ·  PUT /emi-plans/:id */
  async savePlan(plan, id, currentStatus) {
    if (PLANS_LIVE) return customersLive.savePlan(plan, id, currentStatus);
    if (!USE_MOCK) return id ? http.put(`/emi-plans/${id}`, plan) : http.post('/emi-plans', plan);
    if (EMI_PLANS.some((p) => p.name.toLowerCase() === plan.name.trim().toLowerCase() && p.id !== id)) {
      throw new ApiError('A plan with this name already exists.', 409);
    }
    if (id) Object.assign(EMI_PLANS.find((p) => p.id === id), plan);
    else EMI_PLANS.push({ ...plan, id: `p${Date.now()}` });
    return mockDelay({ ok: true });
  },

  /* ---------------- Set up EMI (A-20) ---------------- */

  /** Customers with a registered device but no EMI yet. GET /emi/pending-setup */
  async awaitingSetup() {
    if (DEVICES_LIVE) return devicesLive.awaitingSetup();
    if (!USE_MOCK) return http.get('/emi/pending-setup');
    return mockDelay(scoped().filter((c) => c.device && !c.emi).map((c) => ({
      id: c.id, name: c.name, phone: c.phone,
      device: { id: c.device.id, type: c.device.type, label: `${c.device.name} · ${c.device.type === 'android' ? 'IMEI' : 'SN'} ${c.device.ref}`, price: c.device.price ?? null },
      graceDays: retailerOf(c)?.gracePeriodDays ?? 3,
    })), 150);
  },

  /**
   * POST /emi { customerId, planId, price, down, fee, months, firstDue, reminders, autoLock, graceDays, draft }
   * Activating also records the down payment (+ fee) as a payment at the store.
   */
  async setup(payload) {
    if (DEVICES_LIVE) {
      const list = await devicesLive.awaitingSetup();
      const c = list.find((x) => x.id === payload.customerId);
      if (!c) throw new ApiError('This customer has no enrolled device waiting for an EMI.', 404);
      await devicesLive.attachEmi(c.device.id, payload);
      return { customerId: payload.customerId, draft: false };
    }
    if (!USE_MOCK) return http.post('/emi', payload);
    const c = findCustomer(payload.customerId);
    if (!c.device) throw new ApiError('Register the device first.', 422);
    if (c.emi && !c.emi.draft) throw new ApiError('This customer already has an active EMI.', 409);
    const first = new Date(payload.firstDue);
    const { amount } = monthlyEmi(payload.price, payload.down, payload.months);
    c.emi = {
      planId: payload.planId, price: payload.price, down: payload.down, fee: payload.fee, amount, months: payload.months, paid: 0,
      startYear: first.getFullYear(), startMonth: first.getMonth(), day: first.getDate(),
      reminders: payload.reminders, autoLock: payload.autoLock, graceDays: payload.graceDays, draft: payload.draft, paidLog: {},
    };
    c.status = payload.draft ? 'draft' : computeStatus(c);
    if (!payload.draft) {
      PAYMENTS.unshift({
        id: nextReceiptId(), customerId: c.id, kind: 'down', installments: [], amount: payload.down + payload.fee, lateFee: 0,
        mode: 'Cash at store', at: new Date(), by: currentMockUser()?.name ?? 'Staff', status: 'paid',
      });
    }
    return mockDelay({ customerId: c.id, draft: payload.draft });
  },

  /* ---------------- Schedule (A-21) ---------------- */

  /** GET /emi/:customerId */
  swapLockPhone(contractId, imei) {
    if (CUSTOMERS_LIVE) return customersLive.swapLockPhone(contractId, imei);
    return Promise.reject(new Error('Connect the server to change the lock phone.'));
  },

  async schedule(customerId) {
    if (CUSTOMERS_LIVE) return customersLive.schedule(customerId);
    if (!USE_MOCK) return http.get(`/emi/${customerId}`);
    const c = findCustomer(customerId);
    if (!c.emi) throw new ApiError('No EMI set up for this customer yet.', 404);
    const rows = schedule(c).map((s) => {
      const p = PAYMENTS.find((x) => x.customerId === c.id && x.status === 'paid' && x.installments.includes(s.n));
      return { ...s, mode: p?.mode ?? null, receipt: p?.id ?? null };
    });
    const paidAmount = rows.filter((r) => r.paidOnDate).reduce((n, r) => n + r.amount, 0);
    const price = c.emi.price ?? c.emi.down + c.emi.amount * c.emi.months;
    const financed = price - c.emi.down;
    const plan = EMI_PLANS.find((p) => p.id === planFor(c));
    return mockDelay({
      customer: { id: c.id, name: c.name, phone: c.phone },
      device: c.device ? { id: c.device.id, name: c.device.name, type: c.device.type, locked: c.device.status === 'locked' } : null,
      plan: plan?.name ?? 'Custom', started: rows[0]?.due, draft: Boolean(c.emi.draft),
      // Installments are rounded up to the rupee, so the last one can be a few rupees over — outstanding never goes below 0.
      price, down: c.emi.down, financed, paid: paidAmount,
      outstanding: Math.max(0, financed - paidAmount), rows, closed: rows.every((r) => r.paidOnDate),
    });
  },

  /* ---------------- Overdue (A-22) ---------------- */

  /** GET /emi/overdue?bucket=&q=&page=  bucket: all | 1-7 | 8-15 | 16-30 | 30+ */
  async overdue({ bucket = 'all', q = '', page = 1 } = {}) {
    if (CUSTOMERS_LIVE) return customersLive.overdue({ bucket, q, page });
    if (!USE_MOCK) return http.get('/emi/overdue', { params: { bucket, q, page } });
    const rows = scoped().map((c) => ({ c, o: overdueInfo(c) })).filter((x) => x.o).map(({ c, o }) => ({
      id: c.id, name: c.name, phone: c.phone, device: c.device?.short, deviceId: c.device?.id, deviceType: c.device?.type,
      deviceStatus: c.device?.status, retailer: retailerOf(c)?.store, due: o.due, amount: o.amount + o.fees, daysLate: o.daysLate,
      installments: o.count, reminders: c.remindersSent ?? Math.min(8, 1 + Math.floor(o.daysLate / 3)),
    })).sort((a, b) => a.daysLate - b.daysLate);
    const inBucket = (r, b) => (b === '1-7' ? r.daysLate <= 7 : b === '8-15' ? r.daysLate >= 8 && r.daysLate <= 15
      : b === '16-30' ? r.daysLate >= 16 && r.daysLate <= 30 : b === '30+' ? r.daysLate > 30 : true);
    const buckets = ['1-7', '8-15', '16-30', '30+'].map((b) => {
      const list = rows.filter((r) => inBucket(r, b));
      return { key: b, count: list.length, amount: list.reduce((n, r) => n + r.amount, 0) };
    });
    const filtered = rows.filter((r) => inBucket(r, bucket)).filter((r) => matches(q, r.name, r.phone, r.device));
    return mockDelay({
      ...paginate(filtered, page, 10), buckets,
      totals: { customers: rows.length, amount: rows.reduce((n, r) => n + r.amount, 0) },
      allIds: filtered.map((r) => r.id),
    });
  },

  /** POST /emi/reminders { customerIds } — WhatsApp reminder to each */
  async remind(customerIds) {
    if (CUSTOMERS_LIVE) return customersLive.remind(customerIds);
    if (!USE_MOCK) return http.post('/emi/reminders', { customerIds });
    customerIds.forEach((id) => { const c = CUSTOMERS.find((x) => x.id === id); if (c) c.remindersSent = (c.remindersSent ?? 0) + 1; });
    return mockDelay({ sent: customerIds.length }, 500);
  },

  /** POST /devices/lock { customerIds, reason } — bulk lock from the overdue list */
  async lockMany(customerIds, reason) {
    if (CUSTOMERS_LIVE) return customersLive.lockMany(customerIds, reason);
    if (!USE_MOCK) return http.post('/devices/lock', { customerIds, reason });
    const devices = allDevices();
    let locked = 0; let queued = 0;
    customerIds.forEach((id) => {
      const d = devices.find((x) => x.customerId === id);
      if (!d || d.locked) return;
      d.locked = true; d.controls.screenLock = true; d.lockedBy = currentMockUser()?.name; d.lockedAt = 'just now';
      d.activity.unshift({ id: `a${Date.now()}-${id}`, tone: 'bad', text: `Locked by admin — ${reason}`, at: 'just now', by: currentMockUser()?.name });
      syncStatus(d);
      if (d.connection === 'online') locked += 1; else queued += 1;
    });
    return mockDelay({ locked, queued }, 500);
  },
};

/** Live only: record one installment's payment. */
emiApi.recordPayment = (installmentId, payload) => customersLive.recordPayment(installmentId, payload);
emiApi.togglePlan = (id) => customersLive.togglePlan(id);

export { fmt as fmtLongDate };