/**
 * Mock network: every organisation from Prime Locker down to the retailers, their key
 * balances, the key ledger and key requests. One store, so a send or an approval shows up
 * on every screen (wallet, partner page, tree, history, dashboards).
 *
 * Balance rules (the backend must enforce the same):
 *  - Keys only move one level down: parent → direct child.
 *  - balance = what's left to send down (partners) or to enrol devices with (retailers).
 */
import { RETAILERS } from './retailers';

const FLAGS = { addPartners: true, seeDevices: true, seePhones: false };

const org = (o) => ({
  gstin: null, area: null, status: 'active', since: 'Feb 2026', flags: { ...FLAGS },
  usedPerMonth: 0, collection: 90, overdue: 0, ...o,
});

export const ORGS = [
  org({ id: 'pl', level: 'company', name: 'Prime Locker', city: 'Company stock', parentId: null, generated: 10000, batches: 4, received: 10000, sent: 7500, balance: 2500, usedPerMonth: 118 }),

  org({ id: 'sd1', level: 'super_distributor', name: 'Vijaya Telecom', owner: 'Prakash Hegde', mobile: '+91 94480 11220', city: 'Hubballi', parentId: 'pl', received: 3500, sent: 3080, balance: 420, usedPerMonth: 95, collection: 88, overdue: 49, since: 'Feb 2026' }),
  org({ id: 'sd2', level: 'super_distributor', name: 'Coastal Mobile Traders', owner: 'Rahul Shenoy', mobile: '+91 98450 66012', city: 'Mangaluru', parentId: 'pl', received: 2500, sent: 1300, balance: 1200, usedPerMonth: 20, collection: 90, overdue: 11, since: 'Apr 2026' }),
  org({ id: 'sd3', level: 'super_distributor', name: 'Kalyan Karnataka Distributors', owner: 'Syed Imran', mobile: '+91 90080 33771', city: 'Kalaburagi', parentId: 'pl', received: 1500, sent: 1420, balance: 80, usedPerMonth: 150, collection: 84, overdue: 12, since: 'May 2026' }),

  org({ id: 'd1', level: 'distributor', name: 'Bijapur Mobile Hub', owner: 'Shivaraj Patil', mobile: '+91 94481 77520', city: 'Vijayapura', area: 'Vijayapura, Talikota, Muddebihal', parentId: 'sd1', received: 1400, sent: 1150, balance: 250, usedPerMonth: 42, collection: 88, overdue: 27 }),
  org({ id: 'd2', level: 'distributor', name: 'Gadag Mobile Distributors', owner: 'Anand Hosur', mobile: '+91 94482 51190', city: 'Gadag', parentId: 'sd1', received: 680, sent: 585, balance: 95, usedPerMonth: 31, collection: 91, overdue: 6 }),
  org({ id: 'd3', level: 'distributor', name: 'Dharwad Cell Point', owner: 'Mohan Joshi', mobile: '+91 99000 41255', city: 'Hubballi', parentId: 'sd1', received: 560, sent: 420, balance: 140, usedPerMonth: 14, collection: 93, overdue: 8 }),
  org({ id: 'd4', level: 'distributor', name: 'Belagavi Digital Links', owner: 'Farhan Sayyed', mobile: '+91 97411 80234', city: 'Belagavi', parentId: 'sd1', received: 440, sent: 330, balance: 110, usedPerMonth: 9, collection: 71, overdue: 8 }),
  org({ id: 'd5', level: 'distributor', name: 'Udupi Mobile Network', owner: 'Sandeep Rao', mobile: '+91 98861 22045', city: 'Udupi', parentId: 'sd2', received: 1300, sent: 1262, balance: 38, usedPerMonth: 60, collection: 89, overdue: 9 }),
  org({ id: 'd6', level: 'distributor', name: 'Bidar Telecom Agency', owner: 'Salim Qureshi', mobile: '+91 90350 66721', city: 'Bidar', parentId: 'sd3', received: 1420, sent: 1398, balance: 22, usedPerMonth: 50, collection: 82, overdue: 12 }),
  org({ id: 'd7', level: 'distributor', name: 'Mangaluru Cell Hub', owner: 'Ashwin Pai', mobile: '+91 99642 10388', city: 'Mangaluru', parentId: 'sd2', received: 0, sent: 0, balance: 0, status: 'pending', since: 'Sep 2026' }),

  org({ id: 's1', level: 'sub_distributor', name: 'Talikota Traders', owner: 'Basavaraj Nadagouda', mobile: '+91 94482 30090', city: 'Talikota', parentId: 'd1', received: 500, sent: 440, balance: 60, usedPerMonth: 19, collection: 89, overdue: 11 }),
  org({ id: 's2', level: 'sub_distributor', name: 'Muddebihal Mobile Agency', owner: 'Irfan Mulla', mobile: '+91 99860 41275', city: 'Muddebihal', parentId: 'd1', received: 300, sent: 260, balance: 40, usedPerMonth: 120, collection: 84, overdue: 14 }),
  org({ id: 's3', level: 'sub_distributor', name: 'Vijayapura City Links', owner: 'Ravindra Kattimani', mobile: '+91 97420 55601', city: 'Vijayapura', parentId: 'd1', received: 350, sent: 295, balance: 55, usedPerMonth: 9, collection: 86, overdue: 11 }),
  org({ id: 's4', level: 'sub_distributor', name: 'Hubballi Mobile Links', owner: 'Prashant Kulkarni', mobile: '+91 98455 10220', city: 'Hubballi', parentId: 'd3', received: 300, sent: 220, balance: 80, usedPerMonth: 12 }),
  org({ id: 's5', level: 'sub_distributor', name: 'Gadag Telecom Agency', owner: 'Veeresh Angadi', mobile: '+91 94480 70115', city: 'Gadag', parentId: 'd2', received: 400, sent: 330, balance: 70, usedPerMonth: 18 }),
  org({ id: 's6', level: 'sub_distributor', name: 'Belagavi Retail Links', owner: 'Yusuf Bagwan', mobile: '+91 97418 26651', city: 'Belagavi', parentId: 'd4', received: 250, sent: 200, balance: 50, usedPerMonth: 7 }),
  org({ id: 's7', level: 'sub_distributor', name: 'Bagalkot Traders', owner: 'Mallikarjun Biradar', mobile: '+91 90080 77315', city: 'Bagalkot', parentId: 'd5', received: 900, sent: 820, balance: 80, usedPerMonth: 30 }),
  org({ id: 's8', level: 'sub_distributor', name: 'Haveri Mobile Point', owner: 'Nagaraj Badiger', mobile: '+91 99644 28174', city: 'Haveri', parentId: 'd6', received: 1398, sent: 1350, balance: 48, usedPerMonth: 25, status: 'active' }),
  org({ id: 's9', level: 'sub_distributor', name: 'Dharwad Sub Agency', owner: 'Kiran Desai', mobile: '+91 99008 11442', city: 'Dharwad', parentId: 'd3', received: 120, sent: 0, balance: 120, since: 'Aug 2026' }),
  org({ id: 's10', level: 'sub_distributor', name: 'Ron Mobile Point', owner: 'Shankar Hiremath', mobile: '+91 81970 40231', city: 'Ron', parentId: 'd2', received: 185, sent: 150, balance: 35, usedPerMonth: 13 }),
  org({ id: 's11', level: 'sub_distributor', name: 'Chikodi Traders', owner: 'Ajit Patil', mobile: '+91 94838 90217', city: 'Chikodi', parentId: 'd4', received: 80, sent: 0, balance: 80, since: 'Sep 2026' }),
  org({ id: 's12', level: 'sub_distributor', name: 'Kundapura Links', owner: 'Prasad Shetty', mobile: '+91 98860 51173', city: 'Kundapura', parentId: 'd5', received: 362, sent: 300, balance: 62, usedPerMonth: 22 }),
];

// Retailers join the tree as the bottom level. Their balance is what's left to enrol devices with.
const RETAILER_KEYS = { r1: [260, 28, 90], r2: [220, 45, 40], r3: [210, 60, 35], r4: [200, 70, 30], r5: [170, 55, 28], r6: [130, 40, 20], r7: [0, 0, 0], r8: [80, 12, 6], r9: [180, 150, 10], r10: [95, 35, 14], r11: [80, 30, 12], r12: [60, 20, 9], r13: [0, 0, 0], r14: [45, 25, 8] };
RETAILERS.forEach((r) => {
  const [received, balance, usedPerMonth] = RETAILER_KEYS[r.id] ?? [0, 0, 0];
  ORGS.push(org({
    id: r.id, level: 'retailer', name: r.store, owner: r.owner, mobile: r.ownerMobile, city: r.city,
    parentId: r.network.subDistributorId, received, sent: 0, balance, usedPerMonth, status: r.status,
    collection: r.stats.due ? Math.round((r.stats.collected / r.stats.due) * 100) : null, overdue: r.stats.overdue, since: r.since,
    retailerRef: r,
  }));
});

export const orgById = (id) => ORGS.find((o) => o.id === id);
export const childrenOf = (id) => ORGS.filter((o) => o.parentId === id);

/** Every org below `id` (not including it). */
export function descendantsOf(id) {
  const out = [];
  const walk = (pid) => childrenOf(pid).forEach((c) => { out.push(c); walk(c.id); });
  walk(id);
  return out;
}

/** Chain from Prime Locker down to `id` (inclusive). */
export function ancestry(id) {
  const chain = [];
  let o = orgById(id);
  while (o) { chain.unshift(o); o = o.parentId ? orgById(o.parentId) : null; }
  return chain;
}

/** Keys used on devices anywhere below (or at) this org = devices enrolled by its retailers. */
export function keysUsed(id) {
  const o = orgById(id);
  const retailers = o.level === 'retailer' ? [o] : descendantsOf(id).filter((x) => x.level === 'retailer');
  return retailers.reduce((n, r) => n + (r.retailerRef?.stats.devices ?? 0), 0);
}

/* ---------------- Key ledger ---------------- */
let seq = 100;
const d = (day, month, h, m) => new Date(2026, month - 1, day, h, m);

export const LEDGER = [
  { at: d(28, 9, 11, 2), type: 'used', fromId: 'r1', to: 'Basavaraj Hugar', qty: 1, ref: 'Vivo Y28 · 862…551308', by: 'Sri Mobiles' },
  { at: d(27, 9, 18, 40), type: 'used', fromId: 'r1', to: 'Pooja Angadi', qty: 1, ref: 'Redmi Note 13 · 869…902214', by: 'Sri Mobiles' },
  { at: d(26, 9, 16, 20), type: 'sent', fromId: 's1', toId: 'r1', qty: 50, ref: 'KR-0418', by: 'Basavaraj N.' },
  { at: d(24, 9, 12, 5), type: 'sent', fromId: 'd1', toId: 's1', qty: 100, ref: 'KR-0409', by: 'Shivaraj Patil' },
  { at: d(22, 9, 10, 31), type: 'returned', fromId: 'd7', toId: 'sd2', qty: 20, ref: 'Partner closed', by: 'Sarojini N.' },
  { at: d(18, 9, 15, 44), type: 'sent', fromId: 'sd1', toId: 'd1', qty: 300, ref: 'VT-INV-2231', by: 'Prakash Hegde' },
  { at: d(18, 9, 9, 12), type: 'sent', fromId: 'pl', toId: 'sd1', qty: 500, ref: 'INV-PL-0917', by: 'Sarojini N.' },
  { at: d(15, 9, 17, 30), type: 'generated', toId: 'pl', qty: 2500, ref: 'BATCH-2026-04', by: 'Sarojini N.', note: 'batch 4' },
  { at: d(11, 9, 13, 2), type: 'sent', fromId: 'd1', toId: 's2', qty: 80, ref: 'KR-0371', by: 'Shivaraj Patil' },
  { at: d(2, 9, 11, 48), type: 'sent', fromId: 'pl', toId: 'sd2', qty: 1000, ref: 'INV-PL-0902', by: 'Sarojini N.' },
  { at: d(2, 9, 10, 15), type: 'sent', fromId: 'd1', toId: 's3', qty: 120, ref: 'KR-0352', by: 'Shivaraj Patil' },
  { at: d(28, 8, 14, 20), type: 'sent', fromId: 'sd1', toId: 'd1', qty: 200, ref: 'VT-INV-2190', by: 'Prakash Hegde' },
  { at: d(20, 8, 12, 0), type: 'sent', fromId: 'd1', toId: 's1', qty: 100, ref: 'KR-0318', by: 'Shivaraj Patil' },
  { at: d(9, 8, 16, 45), type: 'sent', fromId: 'd1', toId: 's2', qty: 60, ref: 'KR-0297', by: 'Shivaraj Patil' },
  { at: d(5, 8, 11, 30), type: 'sent', fromId: 'pl', toId: 'sd3', qty: 500, ref: 'INV-PL-0855', by: 'Sarojini N.' },
  { at: d(3, 8, 9, 40), type: 'sent', fromId: 'sd1', toId: 'd2', qty: 150, ref: 'VT-INV-2150', by: 'Prakash Hegde' },
  { at: d(25, 7, 13, 10), type: 'sent', fromId: 'sd1', toId: 'd3', qty: 120, ref: 'VT-INV-2101', by: 'Prakash Hegde' },
  { at: d(20, 7, 10, 0), type: 'generated', toId: 'pl', qty: 2500, ref: 'BATCH-2026-03', by: 'Sarojini N.', note: 'batch 3' },
].map((e) => ({ id: `kl${seq++}`, ...e }));

export function addLedger(entry) {
  const e = { id: `kl${seq++}`, at: new Date(), ...entry };
  LEDGER.unshift(e);
  return e;
}

/* ---------------- Key requests ---------------- */
export const REQUESTS = [
  { id: 'KR-0431', fromId: 'sd3', toId: 'pl', qty: 1000, note: 'Two new sub distributors in Bidar and Yadgir are starting next week.', by: 'Syed Imran', at: d(28, 9, 10, 14), status: 'waiting' },
  { id: 'KR-0428', fromId: 'sd1', toId: 'pl', qty: 1500, note: 'Dasara stock for all 4 distributors.', by: 'Prakash Hegde', at: d(27, 9, 17, 5), status: 'waiting' },
  { id: 'KR-0424', fromId: 'sd2', toId: 'pl', qty: 500, note: 'Udupi Mobile Network is low on keys.', by: 'Rahul Shenoy', at: d(25, 9, 12, 30), status: 'waiting' },
  { id: 'KR-0427', fromId: 'd4', toId: 'sd1', qty: 200, note: 'Two new retailers in Gokak', by: 'Farhan Sayyed', at: d(27, 9, 11, 0), status: 'waiting' },
  { id: 'KR-0426', fromId: 'd2', toId: 'sd1', qty: 150, note: 'Dasara sales', by: 'Anand Hosur', at: d(26, 9, 15, 10), status: 'waiting' },
  { id: 'KR-0425', fromId: 's2', toId: 'd1', qty: 100, note: 'Festival season, 4 phones a day', by: 'Irfan Mulla', at: d(26, 9, 9, 50), status: 'waiting' },
  { id: 'KR-0429', fromId: 'r1', toId: 's1', qty: 50, note: 'Dasara rush — 5–6 phones a day', by: 'Mahesh Patil', at: d(27, 9, 18, 0), status: 'waiting' },
  { id: 'KR-0409', fromId: 's1', toId: 'd1', qty: 100, note: 'Restock', by: 'Basavaraj N.', at: d(23, 9, 17, 0), status: 'approved', approvedQty: 100, decidedAt: d(24, 9, 12, 5), decidedBy: 'Shivaraj Patil' },
  { id: 'KR-0398', fromId: 'sd2', toId: 'pl', qty: 2000, note: 'Coastal expansion', by: 'Rahul Shenoy', at: d(1, 9, 10, 0), status: 'approved', approvedQty: 1000, decidedAt: d(2, 9, 11, 48), decidedBy: 'Sarojini N.' },
  { id: 'KR-0390', fromId: 'sd3', toId: 'pl', qty: 3000, note: 'Year stock', by: 'Syed Imran', at: d(20, 8, 10, 0), status: 'declined', decidedAt: d(21, 8, 9, 0), decidedBy: 'Sarojini N.', reason: 'Too many for current usage — request monthly.' },
];