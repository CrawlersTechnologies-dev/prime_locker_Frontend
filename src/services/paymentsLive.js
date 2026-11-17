/**
 * Payments (A-23 list, A-24 record, A-25 receipt) on the real backend.
 *   GET /payments/?search=&mode=&start_date=&end_date=&page=   GET /payments/:id/   ?export=csv
 *   POST /emi-installments/:id/record-payment/  (once per installment covered)
 * A payment is one paid installment; its receipt number is REC-<installment id, 6 digits>.
 */
import { http, allPages, rows, toNum, ApiError, downloadExport } from './http';
import { paginate } from './mock/scope';
import { customersSnapshot, invalidateCustomers, modeLabel, fmtDate } from './customersLive';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');
const fmtShort = (d) => `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtLong = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ONLINE = 'ONLINE_GATEWAY';
// Record-payment drawer labels → backend modes.
const MODE_IN = { 'Cash at store': 'CASH', 'UPI at store': 'UPI', 'Card at store': 'CARD', 'Bank transfer': 'ONLINE_GATEWAY' };
const receiptNo = (id) => `REC-${String(id).padStart(6, '0')}`;
const installmentId = (receipt) => Number(String(receipt).replace(/^(REC|PL)-/i, '')) || null;

const toRow = (p) => {
  const at = new Date(p.collection_date);
  return {
    id: p.receipt_number || receiptNo(p.id),
    customerId: p.customer ? String(p.customer.id) : '',
    customer: p.customer?.name ?? '—',
    installment: `Installment ${p.installment_number}`,
    amount: toNum(p.paid_amount || p.amount),
    mode: modeLabel(p.payment_mode),
    at: Number.isNaN(at.getTime()) ? '—' : fmtShort(at),
    by: p.collected_by_name || '—',
    retailer: p.retailer?.store_name ?? '',
    ref: p.transaction_ref || '',
    status: 'paid',
    online: p.payment_mode === ONLINE,
  };
};

export const paymentsLive = {
  /** filter: all | online | store | issues (the backend has no failed payments) */
  async list({ filter = 'all', q = '', page = 1 } = {}) {
    const now = new Date();
    const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const [month, listed] = await Promise.all([
      allPages('/payments/', { start_date: monthStart }),
      filter === 'store'
        // "At store" = every mode except online, so it is filtered here.
        ? allPages('/payments/', { search: q || undefined }).then((all) => {
          const rowsAll = all.filter((p) => p.payment_mode !== ONLINE).map(toRow);
          return paginate(rowsAll, page, 50);
        })
        : filter === 'issues'
          ? Promise.resolve(paginate([], 1, 50))
          : http.get('/payments/', { params: { page, search: q || undefined, mode: filter === 'online' ? ONLINE : undefined } }).then((d) => {
            const total = toNum(d?.count ?? 0);
            return { items: rows(d).map(toRow), total, page: Number(page) || 1, pages: Math.max(1, Math.ceil(total / 50)), pageSize: 50 };
          }),
    ]);
    const sum = (l) => l.reduce((n, p) => n + toNum(p.paid_amount || p.amount), 0);
    return {
      live: true,
      ...listed,
      kpis: {
        month: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`, collected: sum(month), count: month.length,
        online: sum(month.filter((p) => p.payment_mode === ONLINE)), store: sum(month.filter((p) => p.payment_mode !== ONLINE)),
        issues: 0, issuesCount: 0,
      },
    };
  },

  /** Spreadsheet built by the backend. */
  exportCsv({ filter = 'all', q = '' } = {}) {
    return downloadExport('/payments/', { search: q || undefined, mode: filter === 'online' ? ONLINE : undefined }, 'payments.csv');
  },

  /** A-25 · receipt for REC-000123 (older links used PL-123). */
  async get(id) {
    const instId = installmentId(id);
    if (!instId) throw new ApiError('Receipt not found', 404);
    const p = await http.get(`/payments/${instId}/`);
    const sum = p.contract_summary ?? {};
    const sched = sum.contract_id ? await http.get(`/emi-contracts/${sum.contract_id}/schedule/`).catch(() => null) : null;
    const next = (sched?.installments ?? []).find((i) => i.status !== 'PAID');
    const paidUpTo = (sched?.installments ?? []).filter((i) => i.status === 'PAID' && i.installment_number <= p.installment_number)
      .reduce((n, i) => n + toNum(i.paid_amount || i.amount), 0);
    const at = new Date(p.collection_date);
    const store = p.retailer_address ?? {};
    return {
      live: true,
      id: p.receipt_number || receiptNo(p.id),
      status: 'paid',
      amount: toNum(p.paid_amount || p.amount),
      lateFee: 0,
      at: Number.isNaN(at.getTime()) ? '—' : fmtLong(at),
      mode: modeLabel(p.payment_mode),
      utr: p.transaction_ref || null,
      by: p.collected_by_name || '—',
      customer: { id: String(p.customer?.id ?? ''), name: p.customer?.name ?? '—', phone: p.customer?.mobile_number ?? '' },
      store: [store.business_name || p.retailer?.store_name, store.city].filter(Boolean).join(', ') || null,
      for: `Installment ${p.installment_number}${sum.tenure_months ? ` of ${sum.tenure_months}` : ''}`,
      device: { name: p.device?.device_name || [p.device?.brand, p.device?.model].filter(Boolean).join(' ') || 'Device', ref: `…${String(p.device?.imei ?? '').slice(-6)}`, label: 'IMEI' },
      balanceAfter: sched ? Math.max(0, toNum(sum.financed_amount) - paidUpTo) : Math.max(0, toNum(sum.total_remaining)),
      next: next ? { amount: toNum(next.amount), due: fmtDate(next.due_date) } : null,
      events: [{ tone: 'ok', text: `Recorded by ${p.collected_by_name || 'System'}${p.notes ? ` · ${p.notes}` : ''}`, at: Number.isNaN(at.getTime()) ? '' : fmtShort(at) }],
    };
  },

  async payers() {
    const s = await customersSnapshot();
    return s.list.filter((c) => c.contract && c.contract.status !== 'COMPLETED' && toNum(c.contract.remaining_installments_count) > 0)
      .map((c) => ({ id: c.id, label: `${c.name} · ${c.deviceName ?? 'device'} · ${c.retailer}`, overdue: c.status === 'overdue' }));
  },

  async due(customerId) {
    const s = await customersSnapshot();
    const c = s.byId.get(String(customerId));
    if (!c?.contract) throw new ApiError('This customer has no active EMI.', 404);
    const d = await http.get(`/emi-contracts/${c.contract.id}/schedule/`);
    const unpaid = (d.installments ?? []).filter((i) => i.status !== 'PAID');
    const overdue = unpaid.filter((i) => i.status === 'OVERDUE');
    const next = unpaid[0] ?? null;
    const toCover = overdue.length ? overdue : next ? [next] : [];
    // late_fee / total_due come from the backend (M6: late fee per day after the grace period).
    const fee = (i) => toNum(i.late_fee);
    const owed = (i) => (i.total_due != null ? toNum(i.total_due) : toNum(i.amount));
    const round = (n) => Math.round(n * 100) / 100;
    return {
      live: true,
      contractId: c.contract.id,
      customer: { id: c.id, name: c.name, phone: c.phone },
      device: { id: c.device ? String(c.device.id) : null, name: c.deviceName ?? 'Device', locked: c.contract.status === 'LOCKED' || c.device?.status === 'LOCKED' },
      months: toNum(c.contract.tenure_months),
      lateFee: round(unpaid.reduce((n, i) => n + fee(i), 0)),
      next: next ? { n: next.installment_number, due: fmtDate(next.due_date, false), amount: toNum(next.amount) } : null,
      overdueCount: overdue.length,
      defaultAmount: round(toCover.reduce((n, i) => n + owed(i), 0)),
      feeIncluded: round(toCover.reduce((n, i) => n + fee(i), 0)),
      autoUnlock: true, // the backend unlocks the device once nothing is overdue (B1)
      unpaid: unpaid.map((i) => ({ id: i.id, n: i.installment_number, amount: owed(i), lateFee: fee(i) })),
    };
  },

  /** Splits the amount over whole installments, oldest first, and records each one. */
  async record(payload) {
    const due = await paymentsLive.due(payload.customerId);
    let left = Math.round(payload.amount * 100) / 100;
    const covered = [];
    for (const i of due.unpaid) {
      if (left + 0.005 < i.amount) break;
      left = Math.round((left - i.amount) * 100) / 100;
      covered.push(i);
    }
    if (!covered.length) throw new ApiError(`The amount must cover at least one installment (₹${due.unpaid[0]?.amount.toLocaleString('en-IN')}).`, 422);
    if (left > 0.5) throw new ApiError(`₹${left.toLocaleString('en-IN')} is left over. Enter an amount that covers whole installments.`, 422);
    const mode = MODE_IN[payload.mode] ?? 'CASH';
    const notes = payload.mode === 'Bank transfer' ? 'Bank transfer' : '';
    // Back-dated payments (M3): collection_date at noon local time on the chosen day.
    const collection_date = payload.date ? new Date(`${payload.date}T12:00:00`).toISOString() : undefined;
    for (const i of covered) {
      const body = { amount: i.amount, payment_mode: mode, transaction_ref: payload.reference || '', notes: [notes, i.lateFee ? `Includes ₹${i.lateFee} late fee` : ''].filter(Boolean).join(' · ') };
      if (collection_date) body.collection_date = collection_date;
      // eslint-disable-next-line no-await-in-loop
      await http.post(`/emi-installments/${i.id}/record-payment/`, body);
    }
    // The backend unlocks the device (and RocketPay) itself once no installment is overdue.
    invalidateCustomers();
    return { id: receiptNo(covered[covered.length - 1].id) };
  },
};
