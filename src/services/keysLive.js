/**
 * Enrolment keys on the real backend (keys app).
 *   GET  /keys/dashboard/                     my inventory by device_type + status
 *   POST /keys/generate/                      { prefix, device_type, quantity }        (Super Admin)
 *   GET  /keys/recipients/?role=&device_type= users I can send to, with their available keys
 *   POST /keys/allocate/                      { target_role, target_user_id, device_type, quantity }
 *   GET  /keys/?page=                         keys I currently hold (one row per key)
 *   GET  /key-requests/                       requests I made + requests made to me
 *   POST /key-requests/:id/approve/ | /reject/
 *   POST /key-requests/                       { device_type, quantity, notes }
 * Backend keys have a type: MOBILE or TV.
 */
import { http, rows, toNum, downloadExport } from './http';
import { sessionUser } from './authApi';
import { invalidateNetwork } from './partnersLive';

const after = (promise) => promise.then((r) => { invalidateNetwork(); return r; });
import { LEVELS } from '../config/roles';

export const KEY_TYPES = [
  { value: 'MOBILE', label: 'Mobile', prefix: 'MOB' },
  { value: 'TV', label: 'Smart TV', prefix: 'TV' },
];
/**
 * Platforms for generating and requesting keys. The OS lives in the key prefix (AND-, IOS-, TV-);
 * device_type stays MOBILE or TV, so balances and Send keys are per MOBILE / TV.
 */
export const KEY_PLATFORMS = [
  { value: 'ANDROID', label: 'Android', prefix: 'AND', deviceType: 'MOBILE' },
  { value: 'IOS', label: 'iPhone', prefix: 'IOS', deviceType: 'MOBILE' },
  { value: 'TV', label: 'Smart TV', prefix: 'TV', deviceType: 'TV' },
];
const platformOf = (v) => KEY_PLATFORMS.find((p) => p.value === v) ?? (v === 'MOBILE' ? KEY_PLATFORMS[0] : KEY_PLATFORMS[0]);
const typeLabel = (t) => KEY_TYPES.find((k) => k.value === String(t).toUpperCase())?.label ?? t;

export const ROLE_LEVEL = {
  SUPER_ADMIN: LEVELS.COMPANY,
  SUPER_DISTRIBUTOR: LEVELS.SUPER_DISTRIBUTOR,
  DISTRIBUTOR: LEVELS.DISTRIBUTOR,
  SUB_DISTRIBUTOR: LEVELS.SUB_DISTRIBUTOR,
  RETAILER: LEVELS.RETAILER,
};
export const LEVEL_ROLE = Object.fromEntries(Object.entries(ROLE_LEVEL).map(([r, l]) => [l, r]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const fmtDateTime = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * { MOBILE: { AVAILABLE: 900 }, ANDROID: {…}, IOS: {…}, TV: {…} } from /keys/dashboard/.
 * Since B5 the backend groups by platform (ANDROID / IOS / TV); MOBILE = ANDROID + IOS for older screens.
 */
async function myInventory() {
  const d = await http.get('/keys/dashboard/');
  const inv = {};
  const add = (t, status, n) => { inv[t] ??= {}; inv[t][status] = (inv[t][status] ?? 0) + n; };
  for (const r of d?.inventory ?? []) {
    const t = String(r.device_type).toUpperCase();
    const n = toNum(r.count);
    add(t, r.status, n);
    if (t === 'ANDROID' || t === 'IOS') add('MOBILE', r.status, n);
  }
  return inv;
}
const available = (inv, type) => (type ? inv[type]?.AVAILABLE ?? 0 : (inv.MOBILE?.AVAILABLE ?? 0) + (inv.TV?.AVAILABLE ?? 0));

/** Users of one role I can send keys to, with their available keys (of `type`, or all types). */
async function usersOfRole(role, type) {
  const d = await http.get('/keys/recipients/', { params: { role, device_type: type } });
  return (d?.users ?? []).map((u) => ({
    id: String(u.id),
    backendId: u.id,
    role: u.role,
    level: ROLE_LEVEL[u.role],
    name: u.business_name || u.name || u.username,
    owner: u.name,
    mobile: u.mobile_number,
    city: u.city,
    status: 'active',
    balance: toNum(u.current_available_keys),
    received: null,
    sent: null,
    used: null,
    low: toNum(u.current_available_keys) === 0,
    keyStatus: toNum(u.current_available_keys) === 0 ? { tone: 'warn', label: 'No keys' } : { tone: 'ok', label: 'Has keys' },
    lastLabel: [u.name !== (u.business_name || u.name) ? u.name : null, u.city, u.mobile_number].filter(Boolean).join(' · ') || u.username,
    waiting: null,
  }));
}

/** Roles the signed-in user may send keys to (backend decides). */
async function selectableRoles() {
  const d = await http.get('/keys/recipients/');
  return d?.selectable_roles ?? [];
}

function requestRow(r) {
  const who = r.requester_details ?? {};
  // The backend appends decisions to the notes: "… [Partially Approved: 5/10] [Rejected Reason: …]"
  const rawNotes = String(r.notes || '');
  const reason = rawNotes.match(/\[Rejected Reason: ([^\]]*)\]/)?.[1] ?? null;
  const note = rawNotes.replace(/\s*\[(Partially Approved|Rejected Reason):[^\]]*\]/g, '').trim();
  const status = { PENDING: 'waiting', APPROVED: 'approved', REJECTED: 'declined' }[r.status] ?? 'waiting';
  return {
    id: r.id,
    ref: `#${r.id}`,
    status,
    qty: toNum(r.quantity),
    note,
    platform: r.platform_display || typeLabel(r.device_type),
    deviceType: r.device_type,
    by: who.name ?? '',
    at: fmtDateTime(r.created_at),
    from: {
      id: String(who.id ?? r.requester),
      name: who.business_name || who.name || 'Partner',
      level: ROLE_LEVEL[who.role] ?? LEVELS.RETAILER,
      balance: r.requester_key_balance ?? null,
      usedPerMonth: r.requester_keys_used_this_month ?? null,
      low: r.requester_key_balance === 0,
    },
    approvedQty: status === 'approved' ? toNum(r.quantity) : null,
    decidedAt: status !== 'waiting' ? fmtDateTime(r.updated_at) : null,
    decidedBy: null,
    reason,
    fullOnly: false,
    reasonSupported: true,
    parentId: r.parent,
    requesterId: r.requester,
  };
}

async function allRequests() {
  return rows(await http.get('/key-requests/')).map(requestRow);
}
const meId = () => sessionUser()?.backendId;

export const keysLive = {
  /** N-05 · company key overview (Super Admin). */
  async company() {
    const [inv, dash, superDistributors, ...network] = await Promise.all([
      myInventory(),
      http.get('/dashboard/').catch(() => null),
      usersOfRole('SUPER_DISTRIBUTOR'),
      ...['DISTRIBUTOR', 'SUB_DISTRIBUTOR', 'RETAILER'].map((r) => usersOfRole(r).catch(() => [])),
    ]);
    const stock = available(inv);
    const withNetwork = [superDistributors, ...network].flat().reduce((n, u) => n + u.balance, 0);
    // Keys used = devices enrolled (EMI contracts) across the network.
    const used = toNum(dash?.device_and_emi_kpis?.total_registered_devices);
    return {
      live: true,
      generated: stock + withNetwork + used,
      batches: null,
      stock,
      stockByType: KEY_TYPES.map((t) => ({ ...t, count: available(inv, t.value) })),
      withNetwork,
      used,
      usedThisMonth: null,
      rows: superDistributors,
    };
  },

  /** Generate a batch into company stock. */
  generate(qty, ref, platform = 'ANDROID') {
    const p = platformOf(platform);
    return after(http.post('/keys/generate/', { prefix: p.prefix, device_type: p.deviceType, quantity: qty, reference_note: ref || '' }));
  },

  /** Who the user can send to, for one role and key type. */
  async recipients(_fromId, { role, deviceType = 'MOBILE', toId } = {}) {
    const [inv, roles] = await Promise.all([myInventory(), selectableRoles()]);
    let pick = role && roles.includes(role) ? role : roles[0];
    let options = pick ? await usersOfRole(pick, deviceType) : [];
    // A fixed recipient (Send keys on a partner row): find the level they're at.
    if (toId && !role && !options.some((o) => o.id === String(toId))) {
      for (const r of roles.slice(1)) {
        // eslint-disable-next-line no-await-in-loop
        const list = await usersOfRole(r, deviceType);
        if (list.some((o) => o.id === String(toId))) { pick = r; options = list; break; }
      }
    }
    const u = sessionUser();
    return {
      live: true,
      roles: roles.map((r) => ({ value: r, level: ROLE_LEVEL[r] })),
      role: pick,
      deviceType,
      from: { id: u?.id, name: u?.org?.name ?? 'You', level: u?.level, balance: available(inv, deviceType) },
      options,
    };
  },

  /** POST /keys/allocate/ */
  send({ toId, qty, deviceType = 'MOBILE', role, ref }) {
    return after(http.post('/keys/allocate/', { target_role: role, target_user_id: Number(toId), device_type: deviceType, quantity: qty, reference_note: ref || '' }));
  },

  /** N-08 · requests made to me, by tab. */
  async requests(status = 'waiting') {
    const [all, inv] = await Promise.all([allRequests(), myInventory()]);
    const incoming = all.filter((r) => r.parentId === meId());
    const counts = {
      waiting: incoming.filter((r) => r.status === 'waiting').length,
      approved: incoming.filter((r) => r.status === 'approved').length,
      declined: incoming.filter((r) => r.status === 'declined').length,
    };
    const needed = incoming.filter((r) => r.status === 'waiting').reduce((n, r) => n + r.qty, 0);
    return {
      live: true,
      rows: incoming.filter((r) => r.status === status),
      counts,
      balance: available(inv),
      balanceByType: KEY_TYPES.map((t) => ({ ...t, count: available(inv, t.value) })),
      needed,
      orgName: sessionUser()?.org?.name ?? '',
    };
  },

  async pendingCount() {
    const all = await allRequests();
    return all.filter((r) => r.parentId === meId() && r.status === 'waiting').length;
  },

  /** qty below the requested amount approves part of it. */
  approve(id, qty) {
    return after(http.post(`/key-requests/${id}/approve/`, qty ? { quantity: qty } : {}));
  },

  decline(id, reason) {
    return http.post(`/key-requests/${id}/reject/`, reason ? { reason } : {});
  },

  /**
   * N-12 · key wallet for a partner. Totals come from /auth/me/ + the partner's own row; movements
   * are the latest key events in or out of their own account (GET /keys/transactions/).
   */
  async wallet() {
    const [inv, all, tx] = await Promise.all([
      myInventory(),
      allRequests(),
      http.get('/keys/transactions/', { params: { page: 1 } }).then(rows).catch(() => []),
    ]);
    const u = sessionUser();
    const balance = available(inv);
    const myId = meId();
    const name = (x) => (x ? x.business_name || x.name : '');
    // Group per-key events into one line per transfer.
    const groups = [];
    tx.filter((t) => t.from_user === myId || t.to_user === myId).forEach((t) => {
      const incoming = t.to_user === myId && t.from_user !== myId;
      const key = `${t.action}|${t.from_user}|${t.to_user}|${t.notes || ''}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key && Math.abs(new Date(last.ts) - new Date(t.timestamp)) < 60000) { last.n += 1; return; }
      groups.push({ key, n: 1, ts: t.timestamp, t, incoming });
    });
    let running = balance;
    const movements = groups.map(({ n, t, incoming, key }) => {
      const delta = t.action === 'ACTIVATED' || (!incoming && t.action !== 'GENERATED') ? -n : n;
      const row = {
        id: key + t.id,
        date: fmtDateTime(t.timestamp),
        what: t.action === 'ACTIVATED' ? `Used on ${name(t.to_user_details) || 'a customer'}'s device`
          : t.action === 'RECLAIMED' ? (incoming ? `Reclaimed from ${name(t.from_user_details)}` : `Taken back by ${name(t.to_user_details)}`)
            : incoming ? `Received from ${name(t.from_user_details)}` : `Sent to ${name(t.to_user_details)}`,
        delta,
        balance: running,
        ref: t.notes || '',
      };
      running -= delta;
      return row;
    });
    const mine = all.find((r) => r.requesterId === meId() && r.status === 'waiting');
    return {
      live: true,
      id: u?.id,
      name: u?.org?.name,
      balance,
      balanceByType: KEY_TYPES.map((t) => ({ ...t, count: available(inv, t.value) })),
      used: Object.values(inv).reduce((n, s) => n + (s.ACTIVATED ?? 0), 0),
      received: null,
      sent: null,
      usedPerMonth: null,
      daysLeft: null,
      low: balance === 0,
      parent: { id: null, name: u?.org?.parentName || 'the level above you' },
      movements,
      pendingRequest: mine ? { ...mine, at: mine.at } : null,
    };
  },

  request(qty, note, platform = 'ANDROID') {
    const p = platformOf(platform);
    return http.post('/key-requests/', { device_type: p.deviceType, os_type: p.value === 'TV' ? 'SMART_TV' : p.value, quantity: qty, notes: note || '' });
  },

  /**
   * N-07 · key history from GET /keys/transactions/ (one row per key per event). Events on the same
   * page with the same type, people and note within a minute are shown as one line with a count.
   */
  async ledger({ type = 'all', page = 1 } = {}) {
    const action = { generated: 'GENERATED', sent: 'ALLOCATED', used: 'ACTIVATED', returned: 'RECLAIMED' }[type];
    const d = await http.get('/keys/transactions/', { params: { page, type: action } });
    const list = rows(d);
    const total = toNum(d?.count ?? list.length);
    const who = (u) => (u ? u.business_name || u.name : '');
    const TYPE = { GENERATED: 'generated', ALLOCATED: 'sent', ACTIVATED: 'used', RECLAIMED: 'returned' };
    const items = [];
    list.forEach((t) => {
      const kind = TYPE[t.action] ?? 'sent';
      const from = who(t.from_user_details); const to = who(t.to_user_details);
      const at = new Date(t.timestamp);
      const last = items[items.length - 1];
      const key = `${kind}|${from}|${to}|${t.notes || ''}|${t.device_type}`;
      if (last && last.groupKey === key && Math.abs(last.time - at) < 60000) { last.qty += 1; return; }
      items.push({
        id: String(t.id),
        groupKey: key,
        time: at,
        at: fmtDateTime(t.timestamp),
        type: kind,
        path: kind === 'generated' ? `Added to ${from || 'company stock'}`
          : kind === 'used' ? `${from} → device of ${to || 'customer'}`
            : `${from || '—'} → ${to || '—'}`,
        qty: 1,
        ref: t.notes || '',
        by: from || 'System',
        deviceType: /^IOS-/i.test(t.key_string) ? 'iPhone' : /^AND-/i.test(t.key_string) ? 'Android' : typeLabel(t.device_type),
      });
    });
    return { mode: 'ledger', items, total, page: Number(page) || 1, pages: Math.max(1, Math.ceil(total / 50)), pageSize: 50, perKey: true };
  },

  /** CSV of every key event (backend export). */
  exportLedger(type = 'all') {
    const action = { generated: 'GENERATED', sent: 'ALLOCATED', used: 'ACTIVATED', returned: 'RECLAIMED' }[type];
    return downloadExport('/keys/transactions/', { type: action }, 'key-history.csv');
  },

};
