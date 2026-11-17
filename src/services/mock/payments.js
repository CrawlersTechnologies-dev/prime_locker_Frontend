/**
 * Mock payments. Seeded from every installment already marked paid (plus down payments), so
 * receipts exist for the whole history. New payments are added by paymentsApi.record().
 */
import { CUSTOMERS } from './customers';
import { RETAILERS } from './retailers';
import { schedule } from '../customersApi';

export const ONLINE_MODES = ['UPI (online)', 'Card (online)', 'Netbanking'];
const MODES = ['UPI (online)', 'Cash at store', 'UPI (online)', 'UPI at store', 'Card (online)', 'Cash at store', 'Netbanking'];
const store = (c) => RETAILERS.find((r) => r.id === c.retailerId)?.store ?? 'Store';
const utr = (i) => String(426800000000 + i * 7919).slice(0, 12);

const raw = [];
let k = 0;
CUSTOMERS.forEach((c) => {
  if (!c.emi) return;
  const sched = schedule(c);
  const start = sched[0]?.dueDate;
  if (start) {
    raw.push({ customerId: c.id, kind: 'down', installments: [], amount: c.emi.down, lateFee: 0, mode: 'Cash at store',
      at: new Date(start.getFullYear(), start.getMonth() - 1, start.getDate(), 11, 20), by: store(c), status: 'paid' });
  }
  sched.filter((s) => s.paidOnDate).forEach((s) => {
    const mode = MODES[k++ % MODES.length];
    raw.push({
      customerId: c.id, kind: 'installment', installments: [s.n], amount: s.amount + s.lateFee, lateFee: s.lateFee, mode,
      at: new Date(s.paidOnDate.getFullYear(), s.paidOnDate.getMonth(), s.paidOnDate.getDate(), 9 + (k % 11), (k * 13) % 60),
      by: ONLINE_MODES.includes(mode) ? 'Customer' : store(c), status: 'paid', utr: mode === 'Cash at store' ? null : utr(k),
    });
  });
});

// Two that need checking, as on A-23.
raw.push({ customerId: 'c2', kind: 'installment', installments: [5], amount: 1899, lateFee: 0, mode: 'Card (online)', at: new Date(2026, 8, 24, 18, 2), by: 'Customer', status: 'failed', utr: null, failReason: 'Card declined by the bank' });
raw.push({ customerId: 'c107', kind: 'installment', installments: [6], amount: 2000, lateFee: 0, mode: 'Netbanking', at: new Date(2026, 8, 23, 20, 47), by: 'Customer', status: 'pending', utr: '426811207731' });

raw.sort((a, b) => a.at - b.at);
let receipt = 10482 - raw.length + 1;
export const PAYMENTS = raw.map((p) => ({ ...p, id: `PL-${receipt++}` })).reverse();

export function nextReceiptId() {
  const max = PAYMENTS.reduce((m, p) => Math.max(m, Number(p.id.slice(3))), 0);
  return `PL-${max + 1}`;
}