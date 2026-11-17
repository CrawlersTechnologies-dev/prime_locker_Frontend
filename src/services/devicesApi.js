import { http, mockDelay, USE_MOCK, ApiError, isLive } from './http';
import { devicesLive } from './devicesLive';

/** Devices: live with 'devices' in VITE_LIVE_MODULES (see devicesLive.js). */
export const DEVICES_LIVE = isLive('devices');
const LIVE = DEVICES_LIVE;
import { CUSTOMERS } from './mock/customers';
import { RETAILERS } from './mock/retailers';
import { allDevices, syncStatus, locationTrail, LOCK_MESSAGES, PHONE_CAPABILITIES, TV_CONTROLS } from './mock/devices';
import { inMyNetwork, paginate, matches, MOCK_TODAY } from './mock/scope';
import { currentMockUser } from './authApi';
import { schedule } from './customersApi';

export { LOCK_MESSAGES, PHONE_CAPABILITIES, TV_CONTROLS };

const retailerOf = (id) => RETAILERS.find((r) => r.id === id);
const customerOf = (id) => CUSTOMERS.find((c) => c.id === id);
const actor = () => currentMockUser()?.name ?? 'Staff';
const now = () => {
  const d = new Date();
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Single status shown in lists: alert wins, then locked, then online/offline. */
export function displayStatus(d) {
  if (d.alert) return { tone: 'warn', label: d.alert.label, key: 'alert' };
  if (d.locked) return { tone: 'bad', label: 'Locked', key: 'locked' };
  return d.connection === 'online' ? { tone: 'ok', label: 'Online', key: 'online' } : { tone: 'mute', label: 'Offline', key: 'offline' };
}

const EMI_LABEL = { overdue: ['bad', 'Overdue'], due_soon: ['warn', 'Due soon'], on_track: ['ok', 'On track'], completed: ['mute', 'Completed'], draft: ['mute', 'Draft'] };

function toRow(d) {
  const c = customerOf(d.customerId);
  const r = retailerOf(d.retailerId);
  return {
    id: d.id, type: d.type, model: d.name, short: d.short, imei: d.imei, ref: d.ref,
    serialLabel: d.type === 'android' ? d.imei : `SN ${d.imei}`,
    customerId: d.customerId, customer: c?.name, retailer: r?.store, os: d.os, lastSeen: d.lastSeen,
    battery: d.battery, emi: EMI_LABEL[c?.status] ?? ['mute', '—'], status: displayStatus(d),
    controls: d.type === 'tv' ? `${d.supported.length} of ${TV_CONTROLS.length}` : null,
    limited: d.type === 'tv' && d.supported.length <= 1,
  };
}

function scoped() {
  return allDevices().filter((d) => inMyNetwork(retailerOf(d.retailerId)?.network));
}

function find(id) {
  const d = scoped().find((x) => x.id === id);
  if (!d) throw new ApiError('Device not found', 404);
  return d;
}

let logSeq = 0;
function log(d, text, tone = 'info') {
  logSeq += 1;
  d.activity.unshift({ id: `a${Date.now()}-${logSeq}`, tone, text, at: now(), by: actor() });
}

/** EMI summary for the device sidebar (A-03, A-18). */
function emiSummary(c) {
  if (!c?.emi) return null;
  const inst = schedule(c);
  const paid = inst.filter((s) => s.paidOn).length;
  const overdue = inst.find((s) => s.status === 'overdue');
  const next = inst.find((s) => s.status === 'upcoming');
  return {
    amount: c.emi.amount, months: c.emi.months, paid,
    outstanding: (c.emi.months - paid) * c.emi.amount,
    overdue: overdue ? { amount: overdue.amount, due: overdue.due.slice(0, 6), daysLate: Math.round((MOCK_TODAY - overdue.dueDate) / 86400000) } : null,
    nextDue: next?.due ?? null,
    closed: paid === c.emi.months,
  };
}

function mutate(id, fn, ms = 400) {
  const d = find(id);
  fn(d);
  syncStatus(d);
  return mockDelay({ ...d, queued: d.connection !== 'online' }, ms);
}

export const devicesApi = {
  /**
   * GET /devices?kind=phone|tv|all&q=&status=&os=&retailerId=&page=
   * status: all | online | offline | locked | alerts
   */
  async list({ kind = 'phone', q = '', status = 'all', os = '', retailerId = '', page = 1 } = {}) {
    if (LIVE) return devicesLive.list({ kind, q, status, os, retailerId, page });
    if (!USE_MOCK) return http.get('/devices', { params: { kind, q, status, os, retailerId, page } });
    const mine = scoped().filter((d) => kind === 'all' || (kind === 'tv' ? d.type === 'tv' : d.type !== 'tv'));
    const searched = mine
      .filter((d) => matches(q, d.imei, d.name, customerOf(d.customerId)?.name))
      .filter((d) => !retailerId || d.retailerId === retailerId)
      .filter((d) => !os || (os === 'android' ? d.type === 'android' : os === 'ios' ? d.type === 'iphone' : d.type === 'tv'));
    const counts = {
      all: searched.length,
      online: searched.filter((d) => d.connection === 'online').length,
      offline: searched.filter((d) => d.connection === 'offline').length,
      locked: searched.filter((d) => d.locked).length,
      alerts: searched.filter((d) => d.alert).length,
    };
    const filtered = searched.filter((d) => status === 'all'
      || (status === 'locked' ? d.locked : status === 'alerts' ? Boolean(d.alert) : d.connection === status));
    const retailerIds = new Set(mine.map((d) => d.retailerId));
    return mockDelay({
      ...paginate(filtered.map(toRow), page, kind === 'tv' ? 7 : 8),
      counts,
      totals: { devices: mine.length, locked: mine.filter((d) => d.locked).length, attention: mine.filter((d) => d.alert || d.connection === 'offline').length },
      retailers: RETAILERS.filter((r) => retailerIds.has(r.id)).map((r) => ({ id: r.id, label: r.store })),
    });
  },

  /** GET /devices/:id */
  async get(id) {
    if (LIVE) return devicesLive.get(id);
    if (!USE_MOCK) return http.get(`/devices/${id}`);
    const d = find(id);
    const c = customerOf(d.customerId);
    const r = retailerOf(d.retailerId);
    return mockDelay({
      ...d,
      displayStatus: displayStatus(d),
      customer: { id: c.id, name: c.name, phone: c.phone, initials: c.name.split(' ').map((w) => w[0]).join('').slice(0, 2), overdue: c.status === 'overdue' },
      retailer: r ? { id: r.id, name: r.store } : null,
      emi: emiSummary(c),
    });
  },

  /** POST /devices/:id/lock { message, reason, notifyCustomer }  ·  POST /devices/:id/unlock { reason } */
  setLock(id, locked, { message, reason, notifyCustomer } = {}) {
    if (LIVE) return devicesLive.setLock(id, locked, { message, reason });
    if (!USE_MOCK) return http.post(`/devices/${id}/${locked ? 'lock' : 'unlock'}`, { message, reason, notifyCustomer });
    return mutate(id, (d) => {
      d.locked = locked;
      d.controls.screenLock = locked;
      d.lockedAt = locked ? now() : null;
      d.lockedBy = locked ? actor() : null;
      if (locked) d.wallpaper = 'payment_reminder';
      log(d, locked ? `Locked by admin${reason ? ` — ${reason}` : ''}` : `Unlocked${reason ? ` — ${reason}` : ''}`, locked ? 'bad' : 'ok');
      if (locked && notifyCustomer) log(d, 'Lock notice sent on WhatsApp');
    });
  },

  /** PATCH /devices/:id/controls { [key]: boolean } — camera, protection, audioReminder, resetProtection, blockApps */
  setControl(id, key, value) {
    if (LIVE) return devicesLive.setControl(id, key, value);
    if (!USE_MOCK) return http.patch(`/devices/${id}/controls`, { [key]: value });
    const LABEL = { camera: 'Camera', protection: 'Uninstall protection', audioReminder: 'Audio reminder', resetProtection: 'Reset protection', blockApps: 'Streaming app block' };
    return mutate(id, (d) => {
      d.controls[key] = value;
      log(d, `${LABEL[key] ?? key} ${value ? 'turned on' : 'turned off'}`);
    });
  },

  /** PUT /devices/:id/apps { apps: [{ pkg, locked, hidden }] } */
  async applyApps(id, apps) {
    if (LIVE) return devicesLive.applyApps(id, apps);
    if (!USE_MOCK) return http.put(`/devices/${id}/apps`, { apps });
    return mutate(id, (d) => {
      d.apps = d.apps.map((a) => ({ ...a, ...apps.find((x) => x.pkg === a.pkg) }));
      const l = d.apps.filter((a) => a.locked).length;
      const h = d.apps.filter((a) => a.hidden).length;
      log(d, `Apps updated — ${l} locked, ${h} hidden`);
    });
  },

  /** POST /devices/:id/offline-code { duration: next_due | 24h | permanent } → { code, expiresAt } */
  issueOfflineCode(id, duration) {
    if (LIVE) return devicesLive.issueOfflineCode(id, duration);
    if (!USE_MOCK) return http.post(`/devices/${id}/offline-code`, { duration });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = duration === '24h' ? 'in 24 hours' : duration === 'permanent' ? 'never' : 'on the next due date';
    return mutate(id, (d) => {
      d.offlineCode = { code, issuedAt: now(), used: false, duration, expires };
      log(d, 'Offline unlock code issued');
    }, 500);
  },

  /** Sends the current offline code to the retailer (in-app + WhatsApp). */
  sendOfflineCode(id) {
    if (LIVE) return devicesLive.sendOfflineCode(id);
    return mockDelay({ ok: true, whatsapp: true });
  },

  /** Retry a failed RocketPay lock/unlock. */
  retryProvider(id) {
    if (LIVE) return devicesLive.retryProvider(id);
    return mockDelay({ ok: true });
  },

  /** POST /devices/:id/message { text } */
  sendMessage(id, text) {
    if (LIVE) return devicesLive.sendMessage(id, text);
    if (!USE_MOCK) return http.post(`/devices/${id}/message`, { text });
    return mutate(id, (d) => log(d, `Message shown on screen: “${text}”`));
  },

  /** POST /devices/:id/audio-reminder */
  playAudio(id) {
    if (LIVE) return devicesLive.playAudio(id);
    if (!USE_MOCK) return http.post(`/devices/${id}/audio-reminder`);
    return mutate(id, (d) => log(d, 'Audio reminder played'));
  },

  /** PUT /devices/:id/wallpaper { key } */
  setWallpaper(id, key) {
    if (!USE_MOCK) return http.put(`/devices/${id}/wallpaper`, { key });
    return mutate(id, (d) => {
      d.wallpaper = key;
      log(d, `Lock-screen wallpaper set to “${LOCK_MESSAGES.find((m) => m.key === key)?.label}”`);
    });
  },

  /** POST /devices/:id/location/refresh */
  refreshLocation(id) {
    if (LIVE) return devicesLive.refreshLocation(id);
    if (!USE_MOCK) return http.post(`/devices/${id}/location/refresh`);
    return mutate(id, (d) => { if (d.location) d.location.at = 'Just now'; }, 700);
  },

  /** GET /devices/:id/locations?range=today|week|month */
  async locations(id, range = 'today') {
    if (LIVE) return devicesLive.locations(id, range);
    if (!USE_MOCK) return http.get(`/devices/${id}/locations`, { params: { range } });
    const d = find(id);
    return mockDelay({ device: { id: d.id, name: d.name, customer: customerOf(d.customerId)?.name }, ...locationTrail(d, range) });
  },

  /** GET /devices/status-board — counts, devices needing attention, open alerts */
  async statusBoard() {
    if (LIVE) return devicesLive.statusBoard();
    if (!USE_MOCK) return http.get('/devices/status-board');
    const phones = scoped().filter((d) => d.type !== 'tv');
    const rank = (d) => (d.alert ? 0 : d.locked ? 1 : d.connection === 'offline' ? 2 : 3);
    const tiles = [...phones].sort((a, b) => rank(a) - rank(b)).slice(0, 9).map(toRow);
    const alerts = [
      ...phones.filter((d) => d.alert).map((d) => ({ id: d.id, tone: d.alert.kind === 'tamper' ? 'bad' : 'warn', title: d.alert.title, meta: `${d.short} · ${customerOf(d.customerId)?.name} · ${d.alert.at}` })),
      ...phones.filter((d) => d.connection === 'offline').slice(0, 3).map((d) => ({ id: d.id, tone: 'mute', title: `Offline for ${d.lastSeen.replace(' ago', '')}`, meta: `${d.short} · ${customerOf(d.customerId)?.name}` })),
      { id: 'dv1', tone: 'warn', title: 'Outside usual area', meta: 'Galaxy A15 · Ravi Kulkarni · 22 Sep' },
    ];
    return mockDelay({
      counts: {
        online: phones.filter((d) => d.connection === 'online').length,
        offline: phones.filter((d) => d.connection === 'offline').length,
        locked: phones.filter((d) => d.locked).length,
        unlocked: phones.filter((d) => !d.locked).length,
        alerts: phones.filter((d) => d.alert).length,
      },
      tiles,
      alerts,
      updatedAt: new Date().toISOString(),
    }, 250);
  },

  /** POST /devices/check-model { type, brand, model } → which controls this model supports */
  async checkModel({ type, brand, model }) {
    if (!USE_MOCK) return http.post('/devices/check-model', { type, brand, model });
    if (type === 'tv') {
      const m = `${brand} ${model}`.toLowerCase();
      const platform = /lg/.test(m) ? 'webOS' : /samsung/.test(m) ? 'Tizen' : 'Google TV';
      const support = { 'Google TV': TV_CONTROLS, Tizen: ['screenLock', 'message'], webOS: ['message'] }[platform];
      return mockDelay({ platform, supported: support, total: TV_CONTROLS.length }, 300);
    }
    return mockDelay({ platform: type === 'iphone' ? 'iOS' : 'Android', supported: PHONE_CAPABILITIES.map(([k]) => k), total: PHONE_CAPABILITIES.length }, 300);
  },

  /** Customers who can get a device registered (no device yet). GET /customers/options?withoutDevice=true */
  async customerOptions() {
    if (!USE_MOCK) return http.get('/customers/options', { params: { withoutDevice: true } });
    return mockDelay(CUSTOMERS.filter((c) => !c.device && inMyNetwork(retailerOf(c.retailerId)?.network)).map((c) => ({
      id: c.id, name: c.name, phone: c.phone, retailerId: c.retailerId, retailer: retailerOf(c.retailerId)?.store,
      allowed: retailerOf(c.retailerId)?.allowedDevices,
    })), 150);
  },

  /** POST /devices — registers the device against the customer; enrolment happens at the store. */
  async register(payload) {
    if (!USE_MOCK) return http.post('/devices', payload);
    const c = customerOf(payload.customerId);
    if (!c) throw new ApiError('Customer not found', 404);
    if (allDevices().some((d) => d.imei === payload.imei1)) throw new ApiError('A device with this IMEI or serial is already registered.', 409);
    const id = `dv${Date.now()}`;
    c.device = {
      id, type: payload.type, name: `${payload.brand} ${payload.model}`, short: payload.model,
      ref: payload.type === 'android' ? `…${payload.imei1.slice(-6)}` : `SN …${payload.imei1.slice(-4)}`,
      imei: payload.imei1, imei2: payload.imei2 || null,
      os: payload.type === 'tv' ? payload.platform ?? 'Google TV' : payload.type === 'iphone' ? 'iOS' : 'Android',
      lastSeen: 'Not enrolled yet', status: 'offline', price: payload.price, invoice: payload.invoice,
    };
    return mockDelay({ id, customerId: c.id });
  },

  /** Live only: upload a lock-screen wallpaper image. */
  setWallpaperFile: (id, file, lock) => devicesLive.setWallpaperFile(id, file, lock),
};
