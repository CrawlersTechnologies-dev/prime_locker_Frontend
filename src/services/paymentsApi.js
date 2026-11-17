import { http, mockDelay, USE_MOCK, ApiError, isLive } from './http';
import { paymentsLive } from './paymentsLive';

/** Payments: live with 'payments' in VITE_LIVE_MODULES (see paymentsLive.js). */
const LIVE = isLive('payments');
import { CUSTOMERS } from './mock/customers';
import { RETAILERS } from './mock/retailers';
import { PAYMENTS, ONLINE_MODES, nextReceiptId } from './mock/payments';
import { allDevices, syncStatus } from './mock/devices';
import { inMyNetwork, paginate, matches } from './mock/scope';
import { schedule, computeStatus, LATE_FEE } from './customersApi';
import { currentMockUser } from './authApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const fmtShort = (d) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtLong = (d) => `${d.getDate()} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const customerOf = (id) => CUSTOMERS.find((c) => c.id === id);
const retailerOf = (c) => RETAILERS.find((r) => r.id === c?.retailerId);
const scoped = () => PAYMENTS.filter((p) => inMyNetwork(retailerOf(customerOf(p.customerId))?.network));

export const isOnline = (mode) => ONLINE_MODES.includes(mode);

function forLabel(p, c) {
  if (p.kind === 'down') return 'Down payment';
  const ns = p.installments;
  return ns.length === 1 ? `${ns[0]} of ${c?.emi?.months ?? '—'}` : `${ns[0]}–${ns[ns.length - 1]} of ${c?.emi?.months ?? '—'}`;
}

function toRow(p) {
  const c = customerOf(p.customerId);
  return {
    id: p.id, customerId: p.customerId, customer: c?.name ?? '—', installment: forLabel(p, c), amount: p.amount, mode: p.mode,
    at: fmtShort(p.at), by: p.by, status: p.status, online: isOnline(p.mode),
  };
}

/** What the customer owes right now (A-24 header and default amount). */
function dueFor(c) {
  const inst = schedule(c);
  const unpaid = inst.filter((s) => !s.paidOnDate);
  const overdue = unpaid.filter((s) => s.status === 'overdue');
  const next = unpaid[0] ?? null;
  const toCover = overdue.length ? overdue : next ? [next] : [];
  return {
    next: next ? { n: next.n, due: next.due.slice(0, 6), amount: next.amount } : null,
    overdueCount: overdue.length,
    defaultAmount: toCover.reduce((n, s) => n + s.amount + s.lateFee, 0),
    feeIncluded: toCover.reduce((n, s) => n + s.lateFee, 0),
    unpaid: unpaid.map((s) => ({ n: s.n, amount: s.amount, lateFee: s.lateFee })),
  };
}

export const paymentsApi = {
  /** GET /payments?filter=all|online|store|issues&q=&page=  (+ month KPIs) */
  async list({ filter = 'all', q = '', page = 1 } = {}) {
    if (LIVE) return paymentsLive.list({ filter, q, page });
    if (!USE_MOCK) return http.get('/payments', { params: { filter, q, page } });
    const mine = scoped();
    const month = mine.filter((p) => p.at.getMonth() === 8 && p.at.getFullYear() === 2026); // TODO(api): current period
    const paid = month.filter((p) => p.status === 'paid');
    const sum = (l) => l.reduce((n, p) => n + p.amount, 0);
    const issues = mine.filter((p) => p.status !== 'paid');
    const rows = mine
      .filter((p) => (filter === 'online' ? isOnline(p.mode) : filter === 'store' ? !isOnline(p.mode) : filter === 'issues' ? p.status !== 'paid' : true))
      .filter((p) => matches(q, p.id, customerOf(p.customerId)?.name))
      .map(toRow);
    return mockDelay({
      ...paginate(rows, page, 8),
      kpis: {
        month: 'September 2026', collected: sum(paid), count: paid.length,
        online: sum(paid.filter((p) => isOnline(p.mode))), store: sum(paid.filter((p) => !isOnline(p.mode))),
        issues: sum(issues), issuesCount: issues.length,
      },
    });
  },

  /** GET /payments/:id — receipt (A-25) */
  async get(id) {
    if (LIVE) return paymentsLive.get(id);
    if (!USE_MOCK) return http.get(`/payments/${id}`);
    const p = scoped().find((x) => x.id === id);
    if (!p) throw new ApiError('Receipt not found', 404);
    const c = customerOf(p.customerId);
    const inst = schedule(c);
    const lastN = p.installments[p.installments.length - 1] ?? 0;
    const next = inst.find((s) => s.n > lastN);
    const balanceAfter = c.emi ? Math.max(0, (c.emi.months - lastN) * c.emi.amount) : 0;
    const events = p.events ?? [
      p.status === 'paid'
        ? { tone: 'ok', text: isOnline(p.mode) ? 'Payment confirmed by gateway' : `Recorded by ${p.by}`, at: fmtShort(p.at) }
        : p.status === 'failed'
          ? { tone: 'bad', text: `Payment failed — ${p.failReason ?? 'declined'}`, at: fmtShort(p.at) }
          : { tone: 'warn', text: 'Waiting for the bank to confirm', at: fmtShort(p.at) },
      ...(p.status === 'paid' ? [{ tone: 'info', text: 'Receipt sent on WhatsApp', at: fmtShort(p.at) }] : []),
      ...(p.status === 'paid' ? [{ tone: 'mute', text: 'Device was not locked — no action needed', at: fmtShort(p.at) }] : []),
    ];
    return mockDelay({
      id: p.id, status: p.status, amount: p.amount, lateFee: p.lateFee, at: fmtLong(p.at), mode: p.mode, utr: p.utr ?? null,
      by: p.by, failReason: p.failReason ?? null,
      customer: { id: c.id, name: c.name, phone: c.phone },
      store: retailerOf(c) ? `${retailerOf(c).store}, ${retailerOf(c).city}` : null,
      for: p.kind === 'down' ? 'Down payment' : `Installment ${forLabel(p, c)}`,
      device: c.device ? { name: c.device.short, ref: c.device.ref, label: c.device.type === 'android' ? 'IMEI' : 'SN' } : null,
      balanceAfter, next: next && !next.paidOnDate ? { amount: next.amount, due: next.due } : null,
      events,
    });
  },

  /** Customers who can pay now (active EMI, not fully paid). GET /payments/payers */
  async payers() {
    if (LIVE) return paymentsLive.payers();
    if (!USE_MOCK) return http.get('/payments/payers');
    return mockDelay(CUSTOMERS.filter((c) => c.emi && !c.emi.draft && inMyNetwork(retailerOf(c)?.network) && c.emi.paid < c.emi.months)
      .map((c) => ({ id: c.id, label: `${c.name} · ${c.device?.short ?? 'no device'} · ${retailerOf(c)?.store}`, overdue: c.status === 'overdue' })), 150);
  },

  /** GET /payments/due?customerId= — what the customer owes now */
  async due(customerId) {
    if (LIVE) return paymentsLive.due(customerId);
    if (!USE_MOCK) return http.get('/payments/due', { params: { customerId } });
    const c = customerOf(customerId);
    if (!c?.emi) throw new ApiError('This customer has no active EMI.', 404);
    return mockDelay({
      customer: { id: c.id, name: c.name, phone: c.phone },
      device: c.device ? { id: c.device.id, name: c.device.short, locked: c.device.status === 'locked' } : null,
      months: c.emi.months, lateFee: LATE_FEE, ...dueFor(c),
    }, 150);
  },

  /**
   * POST /payments { customerId, amount, mode, reference, date, unlock, sendReceipt }
   * The amount must cover whole installments (oldest first), including their late fees.
   */
  async record(payload) {
    if (LIVE) return paymentsLive.record(payload);
    if (!USE_MOCK) return http.post('/payments', payload);
    const c = customerOf(payload.customerId);
    if (!c?.emi) throw new ApiError('This customer has no active EMI.', 404);
    const { unpaid } = dueFor(c);
    let left = payload.amount;
    const covered = [];
    let fees = 0;
    for (const s of unpaid) {
      const need = s.amount + s.lateFee;
      if (left < need) break;
      left -= need; covered.push(s.n); fees += s.lateFee;
    }
    if (!covered.length) throw new ApiError(`The amount must cover at least one installment (₹${(unpaid[0].amount + unpaid[0].lateFee).toLocaleString('en-IN')}).`, 422);
    if (left > 0) throw new ApiError(`₹${left.toLocaleString('en-IN')} is left over. Enter an amount that covers whole installments.`, 422);

    const at = new Date(payload.date);
    const now = new Date();
    at.setHours(now.getHours(), now.getMinutes());
    c.emi.paid += covered.length;
    c.emi.paidLog = { ...(c.emi.paidLog ?? {}), ...Object.fromEntries(covered.map((n) => [n, at])) };
    c.status = computeStatus(c);

    const events = [{ tone: 'ok', text: `Recorded by ${currentMockUser()?.name ?? 'Staff'}`, at: fmtShort(now) }];
    const d = allDevices().find((x) => x.customerId === c.id);
    if (d && d.locked && payload.unlock && c.status !== 'overdue') {
      d.locked = false; d.controls.screenLock = false; d.lockedAt = null;
      d.activity.unshift({ id: `a${Date.now()}`, tone: 'ok', text: 'Unlocked — payment recorded', at: fmtShort(now), by: currentMockUser()?.name });
      syncStatus(d);
      events.push({ tone: 'info', text: d.connection === 'online' ? 'Unlock command sent to the device' : 'Unlock queued — device is offline', at: fmtShort(now) });
    } else if (d && d.locked) {
      events.push({ tone: 'warn', text: c.status === 'overdue' ? 'Device stays locked — more installments are still overdue' : 'Device left locked', at: fmtShort(now) });
    } else {
      events.push({ tone: 'mute', text: 'Device was not locked — no action needed', at: fmtShort(now) });
    }
    if (payload.sendReceipt) events.push({ tone: 'info', text: 'Receipt sent on WhatsApp', at: fmtShort(now) });

    const id = nextReceiptId();
    PAYMENTS.unshift({
      id, customerId: c.id, kind: 'installment', installments: covered, amount: payload.amount, lateFee: fees, mode: payload.mode,
      at, by: currentMockUser()?.name ?? 'Staff', status: 'paid', utr: payload.reference || null, events,
    });
    return mockDelay({ id });
  },
};