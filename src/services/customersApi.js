import { http, mockDelay, USE_MOCK, ApiError, isLive } from './http';
import { customersLive } from './customersLive';

/** Customers: live backend when 'customers' is in VITE_LIVE_MODULES (see customersLive.js). */
const LIVE = isLive('customers');
import { CUSTOMERS, CUSTOMER_MESSAGES } from './mock/customers';
import { RETAILERS } from './mock/retailers';
import { inMyNetwork, paginate, matches, MOCK_TODAY } from './mock/scope';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Sep 2026" / "12 Sep" — fixed format, independent of the browser's locale data */
const fmt = (d, withYear = true) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
const retailerOf = (c) => RETAILERS.find((r) => r.id === c.retailerId);

export const LATE_FEE = 50; // ₹ per late installment (A-21). TODO(api): from settings

/**
 * Installment schedule built from the EMI terms.
 * emi.paidLog holds installments paid through "Record payment" ({ [n]: Date }); older ones are derived.
 */
export function schedule(c) {
  if (!c.emi) return [];
  return Array.from({ length: c.emi.months }, (_, i) => {
    const due = new Date(c.emi.startYear ?? 2026, c.emi.startMonth + i, c.emi.day);
    const n = i + 1;
    let status = 'upcoming';
    let paidOnDate = null;
    if (n <= c.emi.paid) {
      const logged = c.emi.paidLog?.[n];
      const late = logged ? logged > new Date(due.getTime() + 86399999) : c.id === 'c1' && n === 3; // c1 #3 matches the design
      status = late ? 'paid_late' : 'paid';
      paidOnDate = logged ?? new Date(due.getTime() + (late ? 3 : -1) * 86400000);
    } else if (due < MOCK_TODAY) {
      status = 'overdue';
    }
    return {
      n, due: fmt(due), dueDate: due, amount: c.emi.amount,
      lateFee: status === 'overdue' || status === 'paid_late' ? LATE_FEE : 0,
      paidOn: paidOnDate ? fmt(paidOnDate, false) : null, paidOnDate, status,
    };
  });
}

export function toCustomerRow(c) {
  const r = retailerOf(c);
  const next = schedule(c).find((s) => s.status !== 'paid' && s.status !== 'paid_late');
  return {
    id: c.id, initials: initials(c.name), name: c.name, phone: c.phone,
    device: c.device?.short ?? null, deviceRef: c.device?.ref ?? null, deviceType: c.device?.type ?? null,
    deviceId: c.device?.id ?? null, deviceStatus: c.device?.status ?? null, since: c.since,
    retailerId: c.retailerId, retailer: r?.store ?? '—',
    emi: c.emi ? `₹${c.emi.amount.toLocaleString('en-IN')} × ${c.emi.months}` : '—',
    paid: c.emi ? c.emi.paid : 0, months: c.emi?.months ?? 0,
    nextDue: next ? fmt(next.dueDate, false) : '—',
    status: c.status,
  };
}

/** Customer status from the schedule. Applied to generated rows at start and to anyone after a payment. */
export function computeStatus(c) {
  if (!c.emi) return c.status;
  const inst = schedule(c);
  if (inst.every((s) => s.paidOn)) return 'completed';
  if (inst.some((s) => s.status === 'overdue')) return 'overdue';
  const next = inst.find((s) => !s.paidOn);
  return (next.dueDate - MOCK_TODAY) / 86400000 <= 7 ? 'due_soon' : 'on_track';
}
CUSTOMERS.forEach((c) => { if (c.generated) c.status = computeStatus(c); });

function scoped() {
  return CUSTOMERS.filter((c) => inMyNetwork(retailerOf(c)?.network));
}

export const customersApi = {
  /**
   * GET /customers?q=&status=&retailerId=&deviceType=&page=
   * status: all | on_emi | overdue | completed
   */
  async list({ q = '', status = 'all', retailerId = '', deviceType = '', page = 1 } = {}) {
    if (LIVE) return customersLive.list({ q, status, retailerId, deviceType, page });
    if (!USE_MOCK) return http.get('/customers', { params: { q, status, retailerId, deviceType, page } });
    const mine = scoped();
    const searched = mine
      .filter((c) => matches(q, c.name, c.phone, c.device?.imei, c.device?.ref))
      .filter((c) => !retailerId || c.retailerId === retailerId)
      .filter((c) => !deviceType || c.device?.type === deviceType);
    const onEmi = (c) => ['on_track', 'due_soon', 'overdue'].includes(c.status);
    const counts = {
      all: searched.length,
      on_emi: searched.filter(onEmi).length,
      overdue: searched.filter((c) => c.status === 'overdue').length,
      completed: searched.filter((c) => c.status === 'completed').length,
    };
    const filtered = searched.filter((c) => status === 'all' || (status === 'on_emi' ? onEmi(c) : c.status === status));
    const retailerIds = new Set(mine.map((c) => c.retailerId));
    return mockDelay({
      ...paginate(filtered.map(toCustomerRow), page),
      counts,
      totals: { customers: mine.length, retailers: retailerIds.size },
      retailers: RETAILERS.filter((r) => retailerIds.has(r.id)).map((r) => ({ id: r.id, label: r.store })),
    });
  },

  /** GET /customers/:id */
  async get(id) {
    if (LIVE) return customersLive.get(id);
    if (!USE_MOCK) return http.get(`/customers/${id}`);
    const c = scoped().find((x) => x.id === id);
    if (!c) throw new ApiError('Customer not found', 404);
    const r = retailerOf(c);
    const inst = schedule(c);
    const paid = inst.filter((s) => s.status === 'paid' || s.status === 'paid_late');
    const collected = paid.length * (c.emi?.amount ?? 0);
    const financed = c.emi ? c.emi.amount * c.emi.months : 0;
    return mockDelay({
      ...c,
      initials: initials(c.name),
      retailer: r ? { id: r.id, name: r.store, city: r.city } : null,
      schedule: inst,
      balance: { outstanding: financed - collected, collected, paidCount: paid.length, months: c.emi?.months ?? 0 },
      messages: CUSTOMER_MESSAGES[id] ?? [],
      documents: [
        { id: 'front', label: `${c.idType} · front`, file: 'id-front.jpg' },
        { id: 'back', label: `${c.idType} · back`, file: 'id-back.jpg' },
        { id: 'photo', label: 'Customer photo', file: 'photo.jpg' },
        { id: 'agreement', label: 'Signed EMI agreement', file: 'agreement.pdf' },
      ],
    });
  },

  /**
   * POST /customers  (multipart: fields + idFront, idBack, photo)
   * draft = true saves without the agreement/KYC checks.
   */
  async create(payload, { draft = false } = {}) {
    if (LIVE) return customersLive.create(payload, { draft });
    if (!USE_MOCK) {
      const body = new FormData();
      Object.entries({ ...payload, draft }).forEach(([k, v]) => v != null && body.append(k, v));
      return http.post('/customers', body);
    }
    const id = `c${Date.now()}`;
    CUSTOMERS.unshift({
      id, name: payload.name, phone: payload.mobile, altPhone: payload.altMobile || null,
      retailerId: payload.retailerId, device: null, emi: null,
      status: draft ? 'draft' : 'on_track',
      since: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      address: payload.address, idType: payload.idType, idLast4: payload.idNumber.replace(/\s/g, '').slice(-4),
      kyc: 'pending',
    });
    return mockDelay({ id });
  },

  /** POST /customers/:id/reminders — sends the WhatsApp payment reminder */
  async sendReminder(id) {
    if (LIVE) return customersLive.sendReminder(id);
    if (!USE_MOCK) return http.post(`/customers/${id}/reminders`);
    const c = CUSTOMERS.find((x) => x.id === id);
    if (c) c.remindersSent = (c.remindersSent ?? 0) + 1;
    return mockDelay({ ok: true }, 500);
  },

  /** GET /customers/export?… */
  async exportRows(filters) {
    if (LIVE) return customersLive.exportRows(filters);
    if (!USE_MOCK) return http.get('/customers/export', { params: filters });
    const all = [];
    let page = 1; let pages = 1;
    do {
      // eslint-disable-next-line no-await-in-loop
      const res = await customersApi.list({ ...filters, page });
      all.push(...res.items); pages = res.pages; page += 1;
    } while (page <= pages);
    return all;
  },

  /** Lock / unlock the customer's device (live only). */
  setLocked: (id, locked) => customersLive.setLocked(id, locked),
};
