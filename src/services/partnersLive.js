/**
 * Partners and retailers on the real backend (accounts app).
 *   GET/POST        /super-distributors/  /distributors/  /sub-distributors/  /retailers/
 *   GET/PATCH/DELETE  …/:id/
 * The role endpoints don't return the owner's name or key balance, so each list is joined with
 *   GET /keys/recipients/?role=…            → name + available keys (active users only)
 *   GET /reports/retailer-performance/      → devices sold, collection %, overdue per store
 * Everything is loaded once into a "network snapshot" (cached for a few seconds) and the panel
 * filters, counts and paginates from it. Fine at today's size.
 * TODO(api): server-side search/filter, owner name + key balance on the role serializers.
 */
import { http, rows, toNum, ApiError } from './http';
import { sessionUser } from './authApi';
import { LEVELS } from '../config/roles';
import { paginate, matches } from './mock/scope';

export const ROLE_PATH = {
  SUPER_DISTRIBUTOR: '/super-distributors/',
  DISTRIBUTOR: '/distributors/',
  SUB_DISTRIBUTOR: '/sub-distributors/',
  RETAILER: '/retailers/',
};
const ROLE_LEVEL = {
  SUPER_ADMIN: LEVELS.COMPANY,
  SUPER_DISTRIBUTOR: LEVELS.SUPER_DISTRIBUTOR,
  DISTRIBUTOR: LEVELS.DISTRIBUTOR,
  SUB_DISTRIBUTOR: LEVELS.SUB_DISTRIBUTOR,
  RETAILER: LEVELS.RETAILER,
};
export const LEVEL_ROLE = Object.fromEntries(Object.entries(ROLE_LEVEL).map(([r, l]) => [l, r]));
const ROLES = Object.keys(ROLE_PATH);
const COMPANY_ID = 'pl';
const UNKNOWN_ID = '?';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const since = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const digits10 = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

/** Every page of a DRF list. */
async function allPages(path) {
  const out = [];
  for (let page = 1; page < 100; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const d = await http.get(path, { params: { page } });
    out.push(...rows(d));
    if (!d?.next) break;
  }
  return out;
}

/* ---------------- network snapshot ---------------- */
let cache = null; // { at, promise }
const TTL = 15000;
export function invalidateNetwork() { cache = null; }

async function loadSnapshot() {
  const [lists, names, perf] = await Promise.all([
    Promise.all(ROLES.map((r) => allPages(ROLE_PATH[r]).catch(() => []))),
    Promise.all(ROLES.map((r) => http.get('/keys/recipients/', { params: { role: r } }).then((d) => d?.users ?? []).catch(() => []))),
    http.get('/reports/retailer-performance/').then((d) => d?.stores ?? []).catch(() => []),
  ]);
  const nameById = new Map(names.flat().map((u) => [u.id, u]));
  const perfById = new Map(perf.map((p) => [p.retailer_id, p]));
  const me = sessionUser();
  const partnerMode = !!me && me.role !== 'SUPER_ADMIN';

  // Partners: the role endpoints return only their direct children, and /keys/recipients/ lists the
  // rest of their downline without a parent. Those are added with an unknown parent.
  const listed = new Set(lists.flat().map((u) => u.id));
  const extra = names.flat().filter((u) => !listed.has(u.id)).map((u) => ({
    id: u.id, role: u.role, username: u.username, business_name: u.business_name, mobile_number: u.mobile_number,
    city: u.city, state: u.state, is_active: true, parent: null, unknownParent: true,
  }));
  if (partnerMode) lists.push(extra);

  const nodes = new Map();
  nodes.partnerMode = partnerMode;
  if (partnerMode) {
    nodes.set(String(me.backendId), {
      id: String(me.backendId), backendId: me.backendId, role: me.role, level: ROLE_LEVEL[me.role], self: true,
      name: me.org?.name || me.name, owner: me.name, email: me.email, mobile: me.mobile, city: '', state: '', pincode: '', address: '',
      gstin: '', pan: '', kycUrl: null, remarks: '', canReclaim: false, status: 'active', since: '',
      parentId: COMPANY_ID, parentName: me.org?.parentName || '', balance: null, devices: null, collection: null, overdue: 0, collected: 0,
    });
  }
  lists.forEach((list, i) => list.forEach((u) => {
    const role = u.role || ROLES[i];
    const extra = nameById.get(u.id);
    const p = perfById.get(u.id);
    const parentRole = u.parent?.role;
    nodes.set(String(u.id), {
      id: String(u.id),
      backendId: u.id,
      role,
      level: ROLE_LEVEL[role],
      name: u.business_name || extra?.name || u.username,
      owner: [u.first_name, u.last_name].filter(Boolean).join(' ') || (extra?.name && extra.name !== u.username ? extra.name : p?.owner_name && p.owner_name !== u.username ? p.owner_name : ''),
      email: u.email ?? '',
      mobile: u.mobile_number ?? '',
      city: u.city ?? '',
      state: u.state ?? '',
      pincode: u.pincode ?? '',
      address: u.address ?? '',
      gstin: u.gst_number ?? '',
      pan: u.pan_number ?? '',
      kycUrl: u.kyc_document ?? null,
      remarks: u.remarks ?? '',
      canReclaim: !!u.can_reclaim_keys,
      status: u.approval_step === 'PENDING' ? 'pending' : u.is_active === false || u.approval_step === 'SUSPENDED' ? 'suspended' : 'active',
      suspendReason: u.suspend_reason || '',
      perms: { addPartners: u.can_add_partners !== false, seeDevices: u.can_see_devices !== false, seePhones: u.can_see_customer_phones !== false },
      storePhone: u.store_phone ?? '',
      district: u.district ?? '',
      allowedDevices: Array.isArray(u.allowed_devices) ? u.allowed_devices : [],
      gracePeriod: u.grace_period ?? null,
      maxDevices: u.max_devices ?? null,
      keysReceived: u.keys_received ?? null,
      keysSent: u.keys_sent ?? null,
      keysUsed: u.keys_used ?? null,
      childCounts: u.counts_of_children ?? null,
      since: since(u.date_joined),
      parentId: u.unknownParent ? UNKNOWN_ID : !u.parent || parentRole === 'SUPER_ADMIN' ? COMPANY_ID : String(u.parent.id),
      parentName: u.parent?.business_name || u.parent?.name || '',
      balance: u.available_keys ? toNum(u.available_keys.total) : extra ? toNum(extra.current_available_keys) : null,
      balanceByType: u.available_keys ?? null,
      devices: p ? toNum(p.devices_sold) : role === 'RETAILER' ? 0 : null,
      collection: p && toNum(p.total_financed_amount) > 0 ? Math.round(toNum(p.collection_rate_pct)) : null,
      overdue: p ? toNum(p.overdue_count) : 0,
      collected: p ? toNum(p.total_collected) : 0,
    });
  }));
  return nodes;
}

async function snapshot() {
  if (!cache || Date.now() - cache.at > TTL) {
    cache = { at: Date.now(), promise: loadSnapshot().catch((e) => { cache = null; throw e; }) };
  }
  return cache.promise;
}

const childrenOf = (nodes, id) => [...nodes.values()].filter((n) => n.parentId === id);
function descendantsOf(nodes, id) {
  const out = [];
  const walk = (pid) => childrenOf(nodes, pid).forEach((c) => { out.push(c); walk(c.id); });
  walk(id);
  return out;
}
function ancestry(nodes, id) {
  const chain = [];
  let n = nodes.get(id);
  while (n) {
    chain.unshift({ id: n.id, name: n.name, level: n.level });
    if (n.parentId === COMPANY_ID) { chain.unshift({ id: COMPANY_ID, name: 'Prime Locker', level: LEVELS.COMPANY }); break; }
    n = nodes.get(n.parentId);
  }
  return chain;
}

function keyStatus(n) {
  if (n.status === 'suspended') return { tone: 'bad', label: 'Suspended' };
  if (n.balance === 0) return { tone: 'warn', label: 'No keys', low: true };
  return { tone: 'ok', label: 'Has keys' };
}

/** Same shape as the mock toRow(), with what the backend can't tell us set to null. */
function toRow(nodes, n) {
  const below = descendantsOf(nodes, n.id);
  const retailers = n.level === LEVELS.RETAILER ? [n] : below.filter((x) => x.level === LEVELS.RETAILER);
  const parent = n.parentId === COMPANY_ID ? null : nodes.get(n.parentId);
  const devices = retailers.reduce((s, r) => s + (r.devices ?? 0), 0);
  const ks = keyStatus(n);
  return {
    ...n,
    live: true,
    parent: parent ? { id: parent.id, name: parent.name, level: parent.level } : n.parentId === COMPANY_ID ? null : n.parentName ? { id: n.parentId, name: n.parentName, level: null } : null,
    // The backend counts each partner's whole downline; partners can't see who sits under their
    // children, so without those counts the numbers are unknown.
    counts: n.childCounts && n.level !== LEVELS.RETAILER ? {
      distributors: toNum(n.childCounts.distributors), subDistributors: toNum(n.childCounts.sub_distributors),
      retailers: toNum(n.childCounts.retailers), customers: toNum(n.childCounts.customers), children: childrenOf(nodes, n.id).length,
    } : nodes.partnerMode && !n.self && n.level !== LEVELS.RETAILER ? {
      distributors: null, subDistributors: null, retailers: null, children: null,
    } : {
      distributors: below.filter((x) => x.level === LEVELS.DISTRIBUTOR).length,
      subDistributors: below.filter((x) => x.level === LEVELS.SUB_DISTRIBUTOR).length,
      retailers: n.level === LEVELS.RETAILER ? 0 : retailers.length,
      children: childrenOf(nodes, n.id).length,
    },
    received: n.keysReceived, sent: n.keysSent, used: n.keysUsed ?? devices, usedPerMonth: null, daysLeft: null,
    low: n.balance === 0 && n.status === 'active',
    devices,
    overdue: retailers.reduce((s, r) => s + r.overdue, 0),
    collection: n.level === LEVELS.RETAILER ? n.collection : null,
    lockedNow: null,
    keyStatus: ks,
    keyStatusDetailed: ks,
  };
}

/* ---------------- create / update ---------------- */
function toForm(fields) {
  const body = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v == null || v === '') return;
    body.append(k, typeof v === 'boolean' ? String(v) : v);
  });
  return body;
}

/** Turns backend create errors into friendlier messages. */
function createError(err) {
  if (err.status >= 500) {
    // Username = email, and a repeated email crashes the backend instead of returning 400.
    return new ApiError('Couldn’t create the account. The email or mobile number may already be in use.', 409, err.data);
  }
  if (err.data?.mobile_number) return new ApiError('This mobile number already has an account. Use a different number.', 409, err.data);
  return err;
}

export const partnersLive = {
  invalidate: invalidateNetwork,

  /** N-02 · list for one level, filtered and paginated here. */
  async partners({ level = LEVELS.DISTRIBUTOR, q = '', parentId = '', page = 1 } = {}) {
    const nodes = await snapshot();
    const all = [...nodes.values()];
    const counts = {
      [LEVELS.SUPER_DISTRIBUTOR]: all.filter((n) => n.level === LEVELS.SUPER_DISTRIBUTOR).length,
      [LEVELS.DISTRIBUTOR]: all.filter((n) => n.level === LEVELS.DISTRIBUTOR).length,
      [LEVELS.SUB_DISTRIBUTOR]: all.filter((n) => n.level === LEVELS.SUB_DISTRIBUTOR).length,
    };
    const list = all
      .filter((n) => n.level === level)
      .filter((n) => !parentId || ancestry(nodes, n.id).some((a) => a.id === parentId))
      .filter((n) => matches(q, n.name, n.owner, n.city, n.mobile, n.email))
      .map((n) => toRow(nodes, n));
    const parentLevel = { [LEVELS.DISTRIBUTOR]: LEVELS.SUPER_DISTRIBUTOR, [LEVELS.SUB_DISTRIBUTOR]: LEVELS.DISTRIBUTOR }[level];
    const parents = parentLevel ? all.filter((n) => n.level === parentLevel).map((n) => ({ value: n.id, label: n.name })) : [];
    return { live: true, ...paginate(list, page, 10), counts, parents };
  },

  /** N-04 · one partner (any level; retailers redirect to their own page). */
  async partner(id) {
    const nodes = await snapshot();
    const n = nodes.get(String(id));
    if (!n) throw new ApiError('Partner not found', 404);
    const kids = childrenOf(nodes, n.id).map((c) => toRow(nodes, c));
    const retailers = descendantsOf(nodes, n.id).filter((x) => x.level === LEVELS.RETAILER).map((r) => toRow(nodes, r));
    return {
      ...toRow(nodes, n),
      chain: ancestry(nodes, n.id),
      children: kids,
      retailers,
      movements: [],
      logins: [{ id: 'owner', name: n.owner || n.email, role: 'Owner', mobile: n.mobile || '—', lastSignIn: '—' }],
      parentBalance: null,
      waitingRequest: null,
    };
  },

  /** N-01 · tree from Prime Locker down. */
  async tree() {
    const nodes = await snapshot();
    const all = [...nodes.values()];
    const out = [];
    const walk = (row, depth) => {
      const kids = childrenOf(nodes, row.id);
      out.push({ ...row, depth, hasChildren: kids.length > 0 });
      kids.forEach((k) => walk(toRow(nodes, k), depth + 1));
    };
    const top = childrenOf(nodes, COMPANY_ID);
    const company = {
      id: COMPANY_ID, level: LEVELS.COMPANY, name: 'Prime Locker', owner: '', city: '', status: 'active', live: true,
      parent: null, generated: null, received: null, sent: null, used: null,
      balance: null, devices: all.filter((n) => n.level === LEVELS.RETAILER).reduce((s, r) => s + (r.devices ?? 0), 0),
      counts: {
        children: top.length,
        distributors: all.filter((n) => n.level === LEVELS.DISTRIBUTOR).length,
        subDistributors: all.filter((n) => n.level === LEVELS.SUB_DISTRIBUTOR).length,
        retailers: all.filter((n) => n.level === LEVELS.RETAILER).length,
      },
      collection: null, low: false,
    };
    walk(company, 0);
    // Partners whose parent we can't see (e.g. parent deleted) still show, under Prime Locker.
    const seen = new Set(out.map((r) => r.id));
    all.filter((n) => !seen.has(n.id)).forEach((n) => out.push({ ...toRow(nodes, n), depth: 1, hasChildren: false }));
    return out;
  },

  async summary() {
    const nodes = await snapshot();
    const all = [...nodes.values()];
    const count = (l) => all.filter((n) => n.level === l).length;
    return {
      superDistributors: count(LEVELS.SUPER_DISTRIBUTOR), distributors: count(LEVELS.DISTRIBUTOR),
      subDistributors: count(LEVELS.SUB_DISTRIBUTOR), retailers: count(LEVELS.RETAILER),
    };
  },

  /** Who a new partner of `level` can report to (Super Admin picks; super distributors sit under Prime Locker). */
  async parentOptions(level) {
    if (level === LEVELS.SUPER_DISTRIBUTOR) return [{ id: COMPANY_ID, name: 'Prime Locker', city: '', balance: null, chain: [{ id: COMPANY_ID, name: 'Prime Locker', level: LEVELS.COMPANY }] }];
    const parentLevels = {
      [LEVELS.DISTRIBUTOR]: [LEVELS.SUPER_DISTRIBUTOR],
      [LEVELS.SUB_DISTRIBUTOR]: [LEVELS.DISTRIBUTOR],
      // The backend lets distributors and sub distributors add retailers.
      [LEVELS.RETAILER]: [LEVELS.SUB_DISTRIBUTOR, LEVELS.DISTRIBUTOR],
    }[level] ?? [];
    const nodes = await snapshot();
    return [...nodes.values()]
      .filter((n) => parentLevels.includes(n.level) && n.status === 'active')
      .map((n) => ({ id: n.id, name: n.name, city: n.city, level: n.level, balance: n.balance, chain: ancestry(nodes, n.id) }));
  },

  /**
   * POST /{level}/ multipart: full_name, email (= login username), mobile_number, business_name, state, city,
   * pincode, address, password, confirm_password, gst_number, pan_number, kyc_document, remarks, can_reclaim_keys, parent
   */
  async createPartner(p) {
    const role = LEVEL_ROLE[p.level];
    try {
      const res = await http.post(ROLE_PATH[role], toForm({
        full_name: p.owner,
        email: p.email,
        mobile_number: digits10(p.mobile),
        business_name: p.name,
        state: p.state,
        city: p.city,
        pincode: p.pincode,
        address: p.address,
        password: p.password,
        confirm_password: p.password,
        gst_number: p.gstin,
        pan_number: p.pan,
        kyc_document: p.idProof,
        remarks: p.remarks,
        can_reclaim_keys: p.canReclaim ?? false,
        can_add_partners: p.flags?.addPartners ?? true,
        can_see_devices: p.flags?.seeDevices ?? true,
        can_see_customer_phones: p.flags?.seePhones ?? false,
        opening_keys: p.openingKeys > 0 ? p.openingKeys : null,
        parent: p.parentId && p.parentId !== COMPANY_ID ? p.parentId : null,
      }));
      invalidateNetwork();
      return { id: String(res.id), status: 'active' };
    } catch (err) {
      throw createError(err);
    }
  },

  /** Suspend (with a reason), reactivate or approve a pending partner. */
  async setStatus(id, status, reason) {
    const nodes = await snapshot();
    const n = nodes.get(String(id));
    if (!n) throw new ApiError('Partner not found', 404);
    await http.patch(`${ROLE_PATH[n.role]}${n.backendId}/`, {
      is_active: status === 'active',
      approval_step: status === 'active' ? 'ACTIVE' : status === 'declined' ? 'REJECTED' : 'SUSPENDED',
      suspend_reason: status === 'active' ? '' : reason || '',
    });
    invalidateNetwork();
    return { id, status };
  },

  /** DELETE (Super Admin only). */
  async remove(id) {
    const nodes = await snapshot();
    const n = nodes.get(String(id));
    if (!n) throw new ApiError('Partner not found', 404);
    await http.delete(`${ROLE_PATH[n.role]}${n.backendId}/`);
    invalidateNetwork();
  },

  /**
   * N-09 / N-10 / N-11 · the signed-in partner's dashboard: their direct children, incoming key
   * requests, their own pending request, key balance and network totals from /dashboard/.
   */
  async dashboard() {
    const me = sessionUser();
    const today = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const [nodes, d, inv, reqs, coll] = await Promise.all([
      snapshot(),
      http.get('/dashboard/').catch(() => ({})),
      http.get('/keys/dashboard/').catch(() => ({})),
      http.get('/key-requests/').then(rows).catch(() => []),
      http.get('/reports/collections-summary/', { params: { start_date: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end_date: iso(today) } }).catch(() => null),
    ]);
    const myId = String(me?.backendId);
    const balance = (inv?.inventory ?? []).filter((r) => r.status === 'AVAILABLE').reduce((n, r) => n + toNum(r.count), 0);
    const net = d?.network_kpis ?? {};
    const dev = d?.device_and_emi_kpis ?? {};
    const fin = d?.financial_kpis ?? {};
    const toReq = (r) => {
      const who = r.requester_details ?? {};
      const child = nodes.get(String(who.id ?? r.requester));
      return {
        id: r.id, ref: `#${r.id}`, status: 'waiting', qty: toNum(r.quantity), note: r.notes || '',
        platform: r.platform_display || r.device_type, deviceType: r.device_type, at: r.created_at,
        from: { id: String(who.id ?? r.requester), name: who.business_name || who.name || child?.name || 'Partner', level: child?.level, balance: child?.balance ?? null },
        fullOnly: true, reasonSupported: false,
      };
    };
    const incoming = reqs.filter((r) => String(r.parent) === myId && r.status === 'PENDING').map(toReq);
    const mine = reqs.find((r) => String(r.requester) === myId && r.status === 'PENDING');
    const summary = coll?.summary ?? {};
    const due = toNum(summary.total_amount_due); const got = toNum(summary.total_amount_collected);
    const short = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
    const children = childrenOf(nodes, myId).map((c) => ({
      ...toRow(nodes, c),
      waiting: incoming.find((r) => r.from.id === c.id) ?? null,
    }));
    return {
      live: true,
      id: myId,
      name: me?.org?.name ?? me?.name,
      balance,
      low: balance === 0,
      used: toNum(dev.total_registered_devices),
      usedPerMonth: null,
      devices: toNum(dev.active_unlocked_devices) + toNum(dev.locked_devices),
      overdue: toNum(fin.overdue_installments_count),
      lockedNow: toNum(dev.locked_devices),
      collection: due > 0 ? Math.round((got / due) * 100) : null,
      counts: {
        distributors: toNum(net.distributors), subDistributors: toNum(net.sub_distributors),
        retailers: toNum(net.retailers), children: children.length,
      },
      parent: { id: null, name: me?.org?.parentName || 'the level above you' },
      children,
      requests: incoming,
      pendingRequest: mine ? { ...toReq(mine), at: new Date(mine.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) } : null,
      collectionMoney: { collected: short(got), due: short(due), month: today.toLocaleDateString('en-GB', { month: 'short' }) },
      keyStatus: balance === 0 ? { tone: 'warn', label: 'No keys' } : { tone: 'ok', label: 'Has keys' },
    };
  },

  /* ---------------- retailers (A-04 … A-06) ---------------- */

  async retailers({ q = '', status = 'all', district = '', page = 1 } = {}) {
    const nodes = await snapshot();
    const mine = [...nodes.values()].filter((n) => n.level === LEVELS.RETAILER);
    const searched = mine.filter((r) => matches(q, r.name, r.owner, r.city, r.state, r.mobile, r.email));
    const counts = {
      all: searched.length,
      active: searched.filter((r) => r.status === 'active').length,
      pending: 0,
      suspended: searched.filter((r) => r.status === 'suspended').length,
    };
    const filtered = searched
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !district || (r.district || r.city) === district);
    return {
      live: true,
      ...paginate(filtered.map((r) => retailerRow(nodes, r)), page),
      counts,
      totals: { stores: mine.length, pending: 0 },
      districts: [...new Set(mine.map((r) => r.district || r.city).filter(Boolean))].sort(),
    };
  },

  async retailer(id) {
    const nodes = await snapshot();
    const r = nodes.get(String(id));
    if (!r || r.level !== LEVELS.RETAILER) throw new ApiError('Retailer not found', 404);
    const parent = nodes.get(r.parentId);
    return {
      live: true,
      id: r.id,
      backendId: r.backendId,
      initials: initials(r.name),
      store: r.name,
      owner: r.owner,
      ownerMobile: r.mobile,
      email: r.email,
      gstin: r.gstin,
      pan: r.pan,
      address: r.address,
      city: r.city,
      state: r.state,
      pin: r.pincode,
      kycUrl: r.kycUrl,
      remarks: r.remarks,
      canReclaim: r.canReclaim,
      status: r.status,
      since: r.since,
      balance: r.balance,
      parentId: r.parentId,
      network: { subDistributorName: parent?.name ?? r.parentName ?? '—', parentLevel: parent?.level },
      storePhone: r.storePhone,
      district: r.district || r.city,
      allowedDevices: r.allowedDevices.length ? (() => {
        const a = r.allowedDevices.map((x) => String(x).toUpperCase());
        return { android: a.includes('ANDROID'), iphone: a.includes('IOS') || a.includes('IPHONE'), tv: a.includes('TV') || a.includes('SMART_TV') };
      })() : undefined,
      gracePeriodDays: r.gracePeriod,
      maxDevicesOnEmi: r.maxDevices,
      suspendReason: r.suspendReason,
      chain: ancestry(nodes, r.id),
      stats: {
        devices: r.devices ?? 0, lockedNow: null, activeEmis: null, fullyPaid: null,
        overdue: r.overdue, overdueAmount: null, collected: r.collected, due: null, collectionRate: r.collection,
      },
      recentDevices: [],
    };
  },

  /** POST /retailers/ or PATCH /retailers/:id/ */
  async saveRetailer(v, id) {
    // Backend / Retailer app values: ANDROID, IOS, TV
    const OUT = { android: 'ANDROID', iphone: 'IOS', tv: 'TV' };
    const allowed = v.allowedDevices ? Object.keys(v.allowedDevices).filter((k) => v.allowedDevices[k]).map((k) => OUT[k]) : null;
    const fields = {
      full_name: v.owner,
      email: v.email,
      mobile_number: digits10(v.ownerMobile),
      business_name: v.store,
      state: v.state,
      city: v.city,
      pincode: v.pin,
      address: v.address,
      gst_number: v.gstin,
      pan_number: v.pan,
      kyc_document: v.idProof,
      store_phone: v.storePhone?.trim() || '',
      district: v.district?.trim() || '',
      // JSON list: sent in a separate JSON PATCH, since multipart can't carry it reliably.
      allowed_devices: undefined,
      grace_period: v.gracePeriodDays || undefined,
      max_devices: v.maxDevicesOnEmi || undefined,
    };
    try {
      if (id) {
        const nodes = await snapshot();
        const n = nodes.get(String(id));
        const plain = Object.fromEntries(Object.entries(fields).filter(([k, x]) => k !== 'kyc_document' && x != null));
        if (allowed) plain.allowed_devices = allowed;
        const body = v.idProof ? toForm(fields) : plain;
        await http.patch(`/retailers/${n?.backendId ?? id}/`, body);
        if (v.idProof && allowed) await http.patch(`/retailers/${n?.backendId ?? id}/`, { allowed_devices: allowed }).catch(() => null);
        invalidateNetwork();
        return { id: String(id), status: n?.status ?? 'active' };
      }
      const res = await http.post('/retailers/', toForm({
        ...fields,
        password: v.password,
        confirm_password: v.password,
        parent: v.subDistributorId || null,
      }));
      if (allowed) await http.patch(`/retailers/${res.id}/`, { allowed_devices: allowed }).catch(() => null);
      invalidateNetwork();
      return { id: String(res.id), status: 'active' };
    } catch (err) {
      throw id ? err : createError(err);
    }
  },

  async retailerOptions() {
    const nodes = await snapshot();
    return [...nodes.values()].filter((n) => n.level === LEVELS.RETAILER && n.status === 'active')
      .map((r) => ({ id: r.id, label: [r.name, r.city].filter(Boolean).join(', ') }));
  },
};

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'R';
}

function retailerRow(nodes, r) {
  return {
    id: r.id, initials: initials(r.name), store: r.name, owner: r.owner || r.email,
    location: [r.city, r.state].filter(Boolean).join(', '),
    district: r.district || r.city, devices: r.devices ?? 0, activeEmis: null, overdue: r.overdue,
    collectionRate: r.collection, status: r.status, balance: r.balance,
    parentName: nodes.get(r.parentId)?.name ?? r.parentName,
  };
}
