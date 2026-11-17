import { http, mockDelay, USE_MOCK, ApiError, isLive } from './http';
import { keysLive } from './keysLive';
import { partnersLive } from './partnersLive';

/** Partners + retailers: live backend when 'partners' is in VITE_LIVE_MODULES (see partnersLive.js). */
const PARTNERS_LIVE = isLive('partners');
import {
  ORGS, LEDGER, REQUESTS, orgById, childrenOf, descendantsOf, ancestry, keysUsed, addLedger,
} from './mock/network';
import { currentMockUser } from './authApi';
import { can, P } from '../config/permissions';
import { LEVELS, levelBelow } from '../config/roles';
import { paginate, matches } from './mock/scope';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
export const fmtDateTime = (d) => `${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const LOW_DAYS = 21;

/** Lets the sidebar badge (and anything else) refresh after keys move or a request changes. */
export const KEYS_CHANGED = 'plp:keys-changed';
const notify = (result) => { window.dispatchEvent(new Event(KEYS_CHANGED)); return result; }; // fewer days of keys than this → "Low keys"

/* ---------------- scope helpers (mock only — the backend must do this) ---------------- */
function me() {
  const u = currentMockUser();
  return { user: u, orgId: u?.level === LEVELS.COMPANY ? 'pl' : u?.org?.id };
}
function scopeIds() {
  const { orgId } = me();
  return new Set([orgId, ...descendantsOf(orgId).map((o) => o.id)]);
}
function findInScope(id) {
  const o = orgById(id);
  if (!o || !scopeIds().has(id)) throw new ApiError('Partner not found', 404);
  return o;
}

/* ---------------- derived values ---------------- */
function daysLeft(o) {
  if (!o.usedPerMonth) return null;
  return Math.round((o.balance / o.usedPerMonth) * 30);
}
function waitingFrom(id) {
  return REQUESTS.find((r) => r.fromId === id && r.status === 'waiting');
}
/** Status shown in the "Keys"/"Status" columns. */
export function keyStatus(o, { detailed = false } = {}) {
  if (o.status === 'pending') return { tone: 'mute', label: 'Awaiting approval' };
  if (o.status === 'suspended') return { tone: 'bad', label: 'Suspended' };
  const req = waitingFrom(o.id);
  if (req) return { tone: 'warn', label: `Asked for ${req.qty.toLocaleString('en-IN')}` };
  const days = daysLeft(o);
  if (days != null && days < LOW_DAYS) return { tone: 'warn', label: detailed ? `Low · ${days} days left` : 'Low keys', low: true };
  return { tone: 'ok', label: 'Healthy' };
}

export function toRow(o) {
  const below = descendantsOf(o.id);
  const parent = o.parentId ? orgById(o.parentId) : null;
  const days = daysLeft(o);
  return {
    id: o.id, level: o.level, name: o.name, owner: o.owner, mobile: o.mobile, city: o.city, area: o.area, status: o.status,
    since: o.since, gstin: o.gstin, flags: o.flags,
    parent: parent ? { id: parent.id, name: parent.name, level: parent.level } : null,
    counts: {
      distributors: below.filter((x) => x.level === LEVELS.DISTRIBUTOR).length,
      subDistributors: below.filter((x) => x.level === LEVELS.SUB_DISTRIBUTOR).length,
      retailers: below.filter((x) => x.level === LEVELS.RETAILER).length,
      children: childrenOf(o.id).length,
    },
    received: o.received, sent: o.sent, balance: o.balance, used: keysUsed(o.id), usedPerMonth: o.usedPerMonth,
    daysLeft: days, low: days != null && days < LOW_DAYS,
    collection: o.collection, overdue: o.overdue,
    devices: keysUsed(o.id),
    lockedNow: o.level === LEVELS.RETAILER ? o.retailerRef?.stats.lockedNow ?? 0
      : below.filter((x) => x.level === LEVELS.RETAILER).reduce((n, r) => n + (r.retailerRef?.stats.lockedNow ?? 0), 0),
    keyStatus: keyStatus(o),
    keyStatusDetailed: keyStatus(o, { detailed: true }),
  };
}

function entryRow(e) {
  const from = e.fromId ? orgById(e.fromId) : null;
  const to = e.toId ? orgById(e.toId) : null;
  let path;
  if (e.type === 'generated') path = `Prime Locker · ${e.note ?? 'new batch'}`;
  else if (e.type === 'used') path = `${from?.name} → ${e.to}`;
  else path = `${from?.name} → ${to?.name}`;
  return { id: e.id, at: fmtDateTime(e.at), date: fmtDate(e.at), type: e.type, path, qty: e.qty, ref: e.ref, by: e.by, fromId: e.fromId, toId: e.toId };
}

function requestRow(r) {
  const from = orgById(r.fromId);
  const row = toRow(from);
  return {
    id: r.id, status: r.status, qty: r.qty, note: r.note, by: r.by, at: fmtDateTime(r.at),
    from: { id: from.id, name: from.name, level: from.level, balance: from.balance, usedPerMonth: from.usedPerMonth, low: row.low },
    approvedQty: r.approvedQty ?? null, decidedAt: r.decidedAt ? fmtDateTime(r.decidedAt) : null, decidedBy: r.decidedBy ?? null, reason: r.reason ?? null,
  };
}

function actorName() { return currentMockUser()?.name ?? 'Staff'; }

/** Moves keys parent → direct child. Shared by send, approve and opening keys. */
function transfer({ fromId, toId, qty, ref, by }) {
  const from = orgById(fromId);
  const to = orgById(toId);
  if (!from || !to) throw new ApiError('Partner not found', 404);
  if (to.parentId !== from.id) throw new ApiError('Keys can only go to a partner directly below.', 422);
  if (to.status === 'suspended') throw new ApiError(`${to.name} is suspended and can’t receive keys.`, 422);
  if (!Number.isInteger(qty) || qty <= 0) throw new ApiError('Enter how many keys to send.', 422);
  if (qty > from.balance) throw new ApiError(`${from.name} has only ${from.balance.toLocaleString('en-IN')} keys.`, 422);
  from.balance -= qty; from.sent += qty;
  to.balance += qty; to.received += qty;
  addLedger({ type: 'sent', fromId, toId, qty, ref: ref || '—', by: by ?? actorName() });
}

/** Company staff may act for any partner (e.g. send Vijaya's keys to Bijapur); partners only for themselves. */
function assertCanSendFrom(fromId) {
  const { user, orgId } = me();
  if (user.level === LEVELS.COMPANY) {
    if (!can(user, P.KEYS_SEND)) throw new ApiError('Your role can’t send keys.', 403);
    return;
  }
  if (fromId !== orgId) throw new ApiError('You can only send your own keys.', 403);
}

/* ======================================================================= */

export const networkApi = {
  /** GET /network/summary → counts per level in the signed-in user's network */
  async summary() {
    if (PARTNERS_LIVE) return partnersLive.summary();
    if (!USE_MOCK) return http.get('/network/summary');
    const ids = scopeIds();
    const mine = ORGS.filter((o) => ids.has(o.id));
    const count = (l) => mine.filter((o) => o.level === l).length;
    return mockDelay({
      superDistributors: count(LEVELS.SUPER_DISTRIBUTOR), distributors: count(LEVELS.DISTRIBUTOR),
      subDistributors: count(LEVELS.SUB_DISTRIBUTOR), retailers: count(LEVELS.RETAILER),
    }, 150);
  },

  /** GET /network/tree → flat list of nodes with depth; the client expands/collapses. */
  async tree() {
    if (PARTNERS_LIVE) return partnersLive.tree();
    if (!USE_MOCK) return http.get('/network/tree');
    const { orgId } = me();
    const nodes = [];
    const walk = (o, depth) => {
      const kids = childrenOf(o.id);
      nodes.push({ ...toRow(o), depth, hasChildren: kids.length > 0, generated: o.generated ?? null });
      kids.forEach((k) => walk(k, depth + 1));
    };
    walk(orgById(orgId), 0);
    return mockDelay(nodes);
  },

  /** GET /partners?level=&q=&parentId=&page= */
  async partners({ level = LEVELS.DISTRIBUTOR, q = '', parentId = '', page = 1 } = {}) {
    if (PARTNERS_LIVE) return partnersLive.partners({ level, q, parentId, page });
    if (!USE_MOCK) return http.get('/partners', { params: { level, q, parentId, page } });
    const ids = scopeIds();
    const mine = ORGS.filter((o) => ids.has(o.id) && o.level !== LEVELS.COMPANY && o.level !== LEVELS.RETAILER && o.id !== me().orgId);
    const counts = {
      [LEVELS.SUPER_DISTRIBUTOR]: mine.filter((o) => o.level === LEVELS.SUPER_DISTRIBUTOR).length,
      [LEVELS.DISTRIBUTOR]: mine.filter((o) => o.level === LEVELS.DISTRIBUTOR).length,
      [LEVELS.SUB_DISTRIBUTOR]: mine.filter((o) => o.level === LEVELS.SUB_DISTRIBUTOR).length,
    };
    const rows = mine
      .filter((o) => o.level === level)
      .filter((o) => !parentId || ancestry(o.id).some((a) => a.id === parentId))
      .filter((o) => matches(q, o.name, o.owner, o.city))
      .map(toRow);
    const parentLevel = { [LEVELS.DISTRIBUTOR]: LEVELS.SUPER_DISTRIBUTOR, [LEVELS.SUB_DISTRIBUTOR]: LEVELS.DISTRIBUTOR }[level];
    const parents = parentLevel ? mine.filter((o) => o.level === parentLevel).map((o) => ({ value: o.id, label: o.name })) : [];
    return mockDelay({ ...paginate(rows, page, 10), counts, parents });
  },

  /** GET /partners/:id */
  async partner(id) {
    if (PARTNERS_LIVE) return partnersLive.partner(id);
    if (!USE_MOCK) return http.get(`/partners/${id}`);
    const o = findInScope(id);
    const { orgId } = me();
    const chain = ancestry(id).filter((a) => scopeIds().has(a.id) || a.id === orgId);
    const kids = childrenOf(id).map(toRow);
    const retailers = descendantsOf(id).filter((x) => x.level === LEVELS.RETAILER).map(toRow);
    const movements = LEDGER.filter((e) => e.fromId === id || e.toId === id).slice(0, 4).map((e) => {
      const incoming = e.toId === id;
      const other = orgById(incoming ? e.fromId : e.toId);
      return { id: e.id, date: fmtDate(e.at), label: e.type === 'used' ? `used for ${e.to}` : `${incoming ? 'from' : 'to'} ${other?.name ?? '—'}`, delta: incoming ? e.qty : -e.qty };
    });
    return mockDelay({
      ...toRow(o),
      chain: chain.map((a) => ({ id: a.id, name: a.name, level: a.level })),
      children: kids,
      retailers,
      movements,
      logins: [{ id: 'l1', name: o.owner, role: 'Owner', mobile: o.mobile, lastSignIn: 'Today, 09:42' }],
      parentBalance: o.parentId ? orgById(o.parentId).balance : null,
      waitingRequest: waitingFrom(id) ? requestRow(waitingFrom(id)) : null,
    });
  },

  /** Possible parents for a new partner of `level`. GET /partners/options?level=… */
  async parentOptions(level) {
    if (PARTNERS_LIVE) return partnersLive.parentOptions(level);
    if (!USE_MOCK) return http.get('/partners/options', { params: { level } });
    const parentLevel = { [LEVELS.SUPER_DISTRIBUTOR]: LEVELS.COMPANY, [LEVELS.DISTRIBUTOR]: LEVELS.SUPER_DISTRIBUTOR, [LEVELS.SUB_DISTRIBUTOR]: LEVELS.DISTRIBUTOR, [LEVELS.RETAILER]: LEVELS.SUB_DISTRIBUTOR }[level];
    const ids = scopeIds();
    return mockDelay(ORGS.filter((o) => o.level === parentLevel && ids.has(o.id) && o.status !== 'suspended')
      .map((o) => ({ id: o.id, name: o.name, city: o.city, balance: o.balance, chain: ancestry(o.id).map((a) => ({ id: a.id, name: a.name, level: a.level })) })), 150);
  },

  /**
   * POST /partners { level, parentId, name, gstin, owner, mobile, city, area, flags, openingKeys }
   * Super admins create active partners; anyone else's go to "Awaiting approval".
   */
  async createPartner(payload) {
    if (PARTNERS_LIVE) return partnersLive.createPartner(payload);
    if (!USE_MOCK) return http.post('/partners', payload);
    const { user, orgId } = me();
    const parent = orgById(payload.parentId);
    if (!parent || !scopeIds().has(parent.id)) throw new ApiError('Pick who this partner reports to.', 422);
    if (levelBelow(parent.level) !== payload.level) throw new ApiError('A partner must sit directly under the level above it.', 422);
    if (user.level !== LEVELS.COMPANY && parent.id !== orgId) throw new ApiError('You can only add partners directly below you.', 403);
    if (ORGS.some((o) => o.mobile?.replace(/\D/g, '').slice(-10) === payload.mobile.replace(/\D/g, '').slice(-10))) {
      throw new ApiError('This mobile number already has a login. Use a different number.', 409);
    }
    const id = `${payload.level === LEVELS.SUPER_DISTRIBUTOR ? 'sd' : payload.level === LEVELS.DISTRIBUTOR ? 'd' : 's'}${Date.now()}`;
    ORGS.push({
      id, level: payload.level, name: payload.name, owner: payload.owner, mobile: payload.mobile, city: payload.city,
      area: payload.area || null, gstin: payload.gstin || null, parentId: parent.id,
      status: can(user, P.PARTNER_APPROVE) ? 'active' : 'pending',
      since: `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`,
      received: 0, sent: 0, balance: 0, usedPerMonth: 0, collection: null, overdue: 0, flags: payload.flags,
    });
    if (payload.openingKeys > 0) transfer({ fromId: parent.id, toId: id, qty: payload.openingKeys, ref: 'Opening keys' });
    return mockDelay({ id, status: orgById(id).status });
  },

  /** POST /partners/:id/status { status: active | suspended, reason } — also approves new partners */
  async setPartnerStatus(id, status, reason) {
    if (PARTNERS_LIVE) return partnersLive.setStatus(id, status, reason);
    if (!USE_MOCK) return http.post(`/partners/${id}/status`, { status, reason });
    const o = findInScope(id);
    o.status = status;
    return mockDelay({ id, status });
  },

  /** Retailers come from the network store too (used by the Add retailer form). */
  /** DELETE a partner or retailer (Super Admin, live only). */
  async removePartner(id) {
    if (PARTNERS_LIVE) return partnersLive.remove(id);
    throw new ApiError('Deleting partners isn’t available in demo mode.', 400);
  },

  async subDistributorOptions() {
    if (PARTNERS_LIVE) return (await partnersLive.parentOptions(LEVELS.RETAILER)).map((o) => ({ id: o.id, label: [o.name, o.city].filter(Boolean).join(' · ') + (o.level === LEVELS.DISTRIBUTOR ? ' (distributor)' : '') }));
    if (!USE_MOCK) return http.get('/partners/options', { params: { level: LEVELS.SUB_DISTRIBUTOR } });
    const ids = scopeIds();
    return mockDelay(ORGS.filter((o) => o.level === LEVELS.SUB_DISTRIBUTOR && ids.has(o.id) && o.status === 'active')
      .map((o) => ({ id: o.id, label: `${o.name} · ${o.city}` })), 150);
  },
};

/** Enrolment keys: live backend when 'keys' is in VITE_LIVE_MODULES (see keysLive.js), mock otherwise. */
const KEYS_LIVE = isLive('keys');

export const keysApi = {
  /** GET /keys/company — N-05 (Prime Locker staff only) */
  async company() {
    if (KEYS_LIVE) return keysLive.company();
    const pl = orgById('pl');
    const withNetwork = ORGS.filter((o) => o.level !== LEVELS.COMPANY).reduce((n, o) => n + o.balance, 0);
    const used = keysUsed('pl');
    const rows = childrenOf('pl').map((o) => {
      const last = LEDGER.find((e) => e.type === 'sent' && e.toId === o.id);
      const req = waitingFrom(o.id);
      return {
        ...toRow(o),
        lastLabel: req ? `Requested ${req.qty.toLocaleString('en-IN')} keys · ${fmtDate(req.at)}`
          : last ? `Last sent ${fmtDate(last.at)} · ${last.qty.toLocaleString('en-IN')} keys` : 'No keys sent yet',
      };
    });
    return mockDelay({
      generated: pl.generated, batches: pl.batches, stock: pl.balance, withNetwork, used, usedThisMonth: pl.usedPerMonth, rows,
    });
  },

  /** POST /keys/generate { qty, ref } */
  async generate(qty, ref, deviceType) {
    if (KEYS_LIVE) return keysLive.generate(qty, ref, deviceType).then(notify);
    const pl = orgById('pl');
    pl.generated += qty; pl.balance += qty; pl.batches += 1;
    addLedger({ type: 'generated', toId: 'pl', qty, ref: ref || `BATCH-${new Date().getFullYear()}-${pad(pl.batches)}`, by: actorName(), note: `batch ${pl.batches}` });
    return mockDelay({ stock: pl.balance });
  },

  /** GET /keys/wallet — N-12 (and the balance on partner dashboards) */
  async wallet() {
    if (KEYS_LIVE) return keysLive.wallet();
    if (!USE_MOCK) return http.get('/keys/wallet');
    const { orgId } = me();
    const o = orgById(orgId);
    const parent = o.parentId ? orgById(o.parentId) : null;
    let running = o.balance;
    const movements = LEDGER.filter((e) => e.fromId === orgId || e.toId === orgId).slice(0, 30).map((e) => {
      const incoming = e.toId === orgId;
      const other = orgById(incoming ? e.fromId : e.toId);
      const row = {
        id: e.id, date: fmtDate(e.at),
        what: e.type === 'used' ? `Used on ${e.to}'s device` : incoming ? `Received from ${other?.name}` : `Sent to ${other?.name}`,
        delta: incoming ? e.qty : -e.qty, balance: running, ref: e.ref,
      };
      running -= row.delta;
      return row;
    });
    const outgoing = REQUESTS.find((r) => r.fromId === orgId && r.status === 'waiting');
    return mockDelay({
      ...toRow(o),
      parent: parent ? { id: parent.id, name: parent.name } : null,
      movements,
      pendingRequest: outgoing ? requestRow(outgoing) : null,
    });
  },

  /** GET /keys/ledger?type=&orgId=&page= — N-07; scoped to the user's network. orgId narrows to one partner. */
  async ledger({ type = 'all', orgId = '', page = 1 } = {}) {
    if (KEYS_LIVE) return keysLive.ledger({ type, page });
    const ids = scopeIds();
    const rows = LEDGER
      .filter((e) => ids.has(e.fromId) || ids.has(e.toId))
      .filter((e) => !orgId || e.fromId === orgId || e.toId === orgId)
      .filter((e) => type === 'all' || e.type === type)
      .map(entryRow);
    return mockDelay(paginate(rows, page, 10));
  },

  /** GET /key-requests?status=waiting|approved|declined — requests sent TO the user's org */
  async requests(status = 'waiting') {
    if (KEYS_LIVE) return keysLive.requests(status);
    const { orgId } = me();
    const incoming = REQUESTS.filter((r) => r.toId === orgId);
    const counts = {
      waiting: incoming.filter((r) => r.status === 'waiting').length,
      approved: incoming.filter((r) => r.status === 'approved').length,
      declined: incoming.filter((r) => r.status === 'declined').length,
    };
    const rows = incoming.filter((r) => r.status === status).sort((a, b) => b.at - a.at).map(requestRow);
    const needed = incoming.filter((r) => r.status === 'waiting').reduce((n, r) => n + r.qty, 0);
    return mockDelay({ rows, counts, balance: orgById(orgId).balance, needed, orgName: orgById(orgId).name });
  },

  /** Waiting requests to the user's org — the red count in the sidebar. GET /key-requests/count */
  async pendingCount() {
    if (KEYS_LIVE) return keysLive.pendingCount();
    const { orgId } = me();
    if (!orgId) return 0;
    return REQUESTS.filter((r) => r.toId === orgId && r.status === 'waiting').length;
  },

  /** POST /keys/send { fromId?, toId, qty, ref } — fromId defaults to the user's own org */
  async send({ fromId, toId, qty, ref, deviceType, role }) {
    if (KEYS_LIVE) return keysLive.send({ toId, qty, deviceType, role, ref }).then(notify);
    const from = fromId ?? me().orgId;
    assertCanSendFrom(from);
    transfer({ fromId: from, toId, qty, ref });
    return mockDelay({ fromBalance: orgById(from).balance, toBalance: orgById(toId).balance }).then(notify);
  },

  /** Partners the user can send to (direct children of `fromId`, default: own org). */
  async recipients(fromId, opts) {
    if (KEYS_LIVE) return keysLive.recipients(fromId, opts);
    const from = orgById(fromId ?? me().orgId);
    return mockDelay({
      from: { id: from.id, name: from.name, balance: from.balance, level: from.level },
      options: childrenOf(from.id).filter((o) => o.status !== 'suspended').map((o) => ({ ...toRow(o), waiting: waitingFrom(o.id) ? requestRow(waitingFrom(o.id)) : null })),
    }, 150);
  },

  /** POST /key-requests/:id/approve { qty } — sends the keys and closes the request */
  async approve(id, qty) {
    if (KEYS_LIVE) return keysLive.approve(id, qty).then(notify);
    const r = REQUESTS.find((x) => x.id === id);
    if (!r || r.status !== 'waiting') throw new ApiError('This request was already handled.', 409);
    assertCanSendFrom(r.toId);
    transfer({ fromId: r.toId, toId: r.fromId, qty, ref: r.id });
    Object.assign(r, { status: 'approved', approvedQty: qty, decidedAt: new Date(), decidedBy: actorName() });
    return mockDelay({ id, status: 'approved' }).then(notify);
  },

  /** POST /key-requests/:id/decline { reason } */
  async decline(id, reason) {
    if (KEYS_LIVE) return keysLive.decline(id, reason).then(notify);
    const r = REQUESTS.find((x) => x.id === id);
    if (!r || r.status !== 'waiting') throw new ApiError('This request was already handled.', 409);
    Object.assign(r, { status: 'declined', reason: reason || null, decidedAt: new Date(), decidedBy: actorName() });
    return mockDelay({ id, status: 'declined' }).then(notify);
  },

  /** POST /key-requests { qty, note } — always goes to the level directly above */
  async request(qty, note, deviceType) {
    if (KEYS_LIVE) return keysLive.request(qty, note, deviceType).then(notify);
    const { orgId } = me();
    const o = orgById(orgId);
    if (!o.parentId) throw new ApiError('Prime Locker generates keys instead of requesting them.', 422);
    if (REQUESTS.some((r) => r.fromId === orgId && r.status === 'waiting')) throw new ApiError('You already have a request waiting. Wait for an answer before asking again.', 409);
    const id = `KR-${Math.floor(1000 + Math.random() * 8999)}`;
    REQUESTS.unshift({ id, fromId: orgId, toId: o.parentId, qty, note, by: actorName(), at: new Date(), status: 'waiting' });
    return mockDelay({ id, to: orgById(o.parentId).name }).then(notify);
  },
};

/** Partner dashboards (N-09, N-10, N-11): the signed-in partner, their direct children and incoming requests. */
export async function partnerDashboard() {
  if (PARTNERS_LIVE) return partnersLive.dashboard();
  if (!USE_MOCK) return http.get('/dashboard/partner');
  const { orgId } = me();
  const o = orgById(orgId);
  const row = toRow(o);
  const children = childrenOf(orgId).map((c) => ({ ...toRow(c), waiting: waitingFrom(c.id) ? requestRow(waitingFrom(c.id)) : null }));
  const outgoing = REQUESTS.find((r) => r.fromId === orgId && r.status === 'waiting');
  return mockDelay({
    ...row,
    parent: o.parentId ? { id: o.parentId, name: orgById(o.parentId).name } : null,
    children,
    requests: REQUESTS.filter((r) => r.toId === orgId && r.status === 'waiting').map(requestRow),
    pendingRequest: outgoing ? requestRow(outgoing) : null,
    // TODO(api): money figures come from the collections service
    collectionMoney: { collected: '₹15.1L', due: '₹17.2L', month: 'Sep' },
  });
}