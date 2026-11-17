/**
 * Devices (phones + TVs) on the real backend.
 *   GET /devices/   GET /devices/:id/   GET /devices/:id/location-history/
 *   POST /devices/:id/lock/ | unlock/   POST /devices/:id/controls/ {camera_disabled, block_factory_reset, social_media_disabled, streaming_blocked}
 *   GET /devices/:id/commands/ (activity)   POST /devices/:id/audio-reminder/ | refresh-location/ | apps/lock/ | apps/unlock/
 *   POST /devices/:id/push-reminder/ {message}   POST /devices/:id/generate-offline-code/ {expiry_option}
 *   POST /devices/:id/set-wallpaper/ (multipart wallpaper_file, lock_wallpaper)
 *   POST /devices/:id/attach-emi/ {plan_template_id, total_amount, down_payment, processing_fee, tenure_months, first_emi_date}
 * Devices are enrolled in the Retailer app (POST /customers/enroll/), so the panel has no "register device".
 * EMI status per device comes from the customers snapshot (customersLive.js).
 */
import { http, allPages, toNum, ApiError } from './http';
import { paginate, matches } from './mock/scope';
import { customersSnapshot, invalidateCustomers, fmtDate, fmtDateTime } from './customersLive';
import { initials } from '../utils/format';

const MIN = 60000;
function ago(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Never';
  const m = Math.round((Date.now() - d.getTime()) / MIN);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

const kindOf = (d) => (d.device_category === 'TV' || d.os_type === 'SMART_TV' ? 'tv' : d.os_type === 'IOS' ? 'iphone' : 'android');
const OS = { ANDROID: 'Android', IOS: 'iOS', SMART_TV: 'Smart TV' };
const EMI_LABEL = { overdue: ['bad', 'Overdue'], due_soon: ['warn', 'Due soon'], on_track: ['ok', 'On track'], completed: ['mute', 'Completed'], draft: ['mute', 'Draft'], no_emi: ['mute', 'No EMI'] };
// TV controls the backend can drive (streaming block + audio reminder added with M10).
const TV_LIVE = ['screenLock', 'message', 'resetProtection', 'blockApps', 'audioReminder'];

/** Who actually locks the phone (Device.lock_provider). */
export const LOCK_PROVIDERS = {
  ROCKETPAY: 'RocketPay',
  OWN_AGENT: 'Prime Locker app',
  APPLE_MDM: 'Apple MDM',
  NONE: 'Not controlled',
};
const PROVIDER_STATUS = { ENROLLED: 'Enrolled', LOCKED: 'Locked', UNLOCKED: 'Unlocked', FAILED: 'Failed', TAMPERED: 'Tamper alert' };

// Panel control key → backend field for POST /devices/:id/controls/ (set-style, no toggling).
const CONTROL_FIELD = {
  camera: 'camera_disabled',
  protection: 'block_factory_reset',
  resetProtection: 'block_factory_reset',
  blockApps: 'social_media_disabled',
};

const CMD = {
  LOCK: ['bad', 'Lock'], UNLOCK: ['ok', 'Unlock'], REBOOT: ['info', 'Restart'], SYNC_LOCATION: ['info', 'Location refresh'],
  UPDATE_POLICY: ['info', 'Controls changed'], SET_WALLPAPER: ['info', 'Wallpaper changed'], PUSH_MESSAGE: ['info', 'Message on screen'], WIPE: ['bad', 'Factory wipe'],
};
function commandText(c) {
  const p = c.parameters || {};
  const [, label] = CMD[c.command_type] ?? ['info', c.command_type_display || c.command_type];
  let text = label;
  if (c.command_type === 'PUSH_MESSAGE' && p.action === 'AUDIO_REMINDER') text = 'Audio reminder';
  else if (p.reason) text = `${label} · ${p.reason}`;
  else if (p.message) text = `${label}: “${p.message}”`;
  else if (c.command_type === 'UPDATE_POLICY') {
    const on = Object.entries(p).filter(([, v]) => v === true).map(([k]) => k.replace(/_/g, ' '));
    if (on.length) text = `${label} · on: ${on.join(', ')}`;
  }
  const state = c.status === 'PENDING' ? ' (waiting for the device)' : c.status === 'FAILED' ? ` (failed${c.error_message ? `: ${c.error_message}` : ''})` : '';
  return text + state;
}
function commandRow(c) {
  const [tone] = CMD[c.command_type] ?? ['info'];
  return {
    id: `cmd${c.id}`,
    tone: c.status === 'FAILED' ? 'warn' : c.status === 'PENDING' ? 'mute' : tone,
    text: commandText(c),
    at: fmtDateTime(c.created_at),
    by: c.issued_by?.username || 'System',
    sort: new Date(c.created_at).getTime() || 0,
  };
}

const EXPIRY_OPTION = { next_due: 'UNTIL_NEXT_DUE_DATE', '24h': '24_HOURS', permanent: 'PERMANENT' };
function offlineExpiry(at, type) {
  if (type === 'PERMANENT') return 'never (permanent)';
  if (!at) return 'when you create a new code';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return 'when you create a new code';
  return d < new Date() ? `expired ${fmtDateTime(at)}` : fmtDateTime(at);
}

function statusOf(d) {
  if (d.status === 'LOCKED') return { tone: 'bad', label: 'Locked', key: 'locked' };
  if (d.status === 'UNENROLLED') return { tone: 'mute', label: 'Released', key: 'offline' };
  return d.is_online ? { tone: 'ok', label: 'Online', key: 'online' } : { tone: 'mute', label: 'Offline', key: 'offline' };
}

async function loadDevices() {
  try {
    return await allPages('/devices/');
  } catch (e) {
    if (e.status >= 500) {
      throw new ApiError('The server couldn’t list devices. This is a known backend bug (devices/serializers.py reads customer.aadhar_number, which was removed). Ask the backend developer to delete that line.', e.status);
    }
    throw e;
  }
}

function toRow(d, s) {
  const c = s.byId.get(String(d.customer));
  const type = kindOf(d);
  return {
    id: String(d.id),
    type,
    model: d.device_name || [d.brand, d.model].filter(Boolean).join(' ') || 'Device',
    short: d.model || d.device_name || 'Device',
    imei: d.imei,
    ref: `…${String(d.imei).slice(-6)}`,
    serialLabel: type === 'tv' ? `SN ${d.serial_number || d.imei}` : d.imei,
    customerId: d.customer ? String(d.customer) : null,
    customer: c?.name || d.customer_details?.name || '—',
    retailerId: d.retailer ? String(d.retailer) : '',
    retailer: d.retailer_details?.business_name || d.retailer_details?.name || '—',
    os: OS[d.os_type] ?? d.os_type,
    lastSeen: ago(d.last_online_at),
    battery: d.battery_level ?? null,
    emi: EMI_LABEL[c?.status ?? 'no_emi'],
    status: statusOf(d),
    controls: type === 'tv' ? `${TV_LIVE.length} of 5` : null,
    limited: false,
    raw: d,
  };
}

/** Lat/lng points → 0..1 positions for the placeholder map. */
function project(points) {
  if (!points.length) return [];
  const lats = points.map((p) => p.lat); const lngs = points.map((p) => p.lng);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const sx = d - c || 1; const sy = b - a || 1;
  return points.map((p) => ({ ...p, x: 0.1 + 0.8 * ((p.lng - c) / sx), y: 0.9 - 0.8 * ((p.lat - a) / sy) }));
}
function km(points) {
  let t = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [p, q] = [points[i - 1], points[i]];
    const r = Math.PI / 180;
    const dLat = (q.lat - p.lat) * r; const dLng = (q.lng - p.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * r) * Math.cos(q.lat * r) * Math.sin(dLng / 2) ** 2;
    t += 12742 * Math.asin(Math.sqrt(h));
  }
  return t.toFixed(1);
}

export const devicesLive = {
  /** kind: phone | tv | all · status: all | online | offline | locked | alerts */
  async list({ kind = 'phone', q = '', status = 'all', os = '', retailerId = '', page = 1 } = {}) {
    const [list, s] = await Promise.all([loadDevices(), customersSnapshot().catch(() => ({ byId: new Map() }))]);
    const rows = list.map((d) => toRow(d, s)).filter((r) => kind === 'all' || (kind === 'tv' ? r.type === 'tv' : r.type !== 'tv'));
    const searched = rows
      .filter((r) => matches(q, r.imei, r.model, r.customer, r.retailer))
      .filter((r) => !retailerId || r.retailerId === retailerId)
      .filter((r) => !os || (os === 'android' ? r.type === 'android' : os === 'ios' ? r.type === 'iphone' : r.type === 'tv'));
    const counts = {
      all: searched.length,
      online: searched.filter((r) => r.status.key === 'online').length,
      offline: searched.filter((r) => r.status.key === 'offline').length,
      locked: searched.filter((r) => r.status.key === 'locked').length,
      alerts: 0,
    };
    const filtered = searched.filter((r) => status === 'all' || (status === 'alerts' ? false : r.status.key === status));
    const retailers = new Map(rows.filter((r) => r.retailerId).map((r) => [r.retailerId, r.retailer]));
    return {
      live: true,
      ...paginate(filtered, page, 20),
      counts,
      totals: { devices: rows.length, locked: counts.locked, attention: rows.filter((r) => r.status.key !== 'online').length },
      retailers: [...retailers].map(([id, label]) => ({ id, label })),
    };
  },

  async get(id) {
    let d;
    let commands = [];
    try {
      [d, commands] = await Promise.all([
        http.get(`/devices/${id}/`),
        http.get(`/devices/${id}/commands/`).then((r) => r.commands ?? []).catch(() => []),
      ]);
    } catch (e) {
      if (e.status >= 500) throw new ApiError('The server couldn’t load this device (known backend bug: customer.aadhar_number in devices/serializers.py).', e.status);
      throw e;
    }
    const s = await customersSnapshot().catch(() => ({ byId: new Map() }));
    const c = s.byId.get(String(d.customer));
    const k = c?.contract;
    const type = kindOf(d);
    const locked = d.status === 'LOCKED';
    const late = c?.late ?? [];
    const oldest = late.reduce((m, o) => (!m || toNum(o.days_overdue) > toNum(m.days_overdue) ? o : m), null);
    const name = c?.name || d.customer_details?.name || 'Customer';
    // Command history (GET /devices/:id/commands/, newest first) + check-in + enrolment.
    const activity = [
      d.last_online_at && { id: 'seen', tone: 'ok', text: `Last check-in${d.battery_level != null ? ` · battery ${d.battery_level}%` : ''}`, at: fmtDateTime(d.last_online_at), by: 'Device', sort: new Date(d.last_online_at).getTime() },
      ...commands.map(commandRow),
      { id: 'enrol', tone: 'ok', text: d.lock_provider === 'ROCKETPAY' ? 'Device enrolled with RocketPay' : 'Device enrolled', at: fmtDateTime(d.created_at), by: d.retailer_details?.business_name || 'Retailer', sort: new Date(d.created_at).getTime() || 0 },
    ].filter(Boolean).sort((a, b) => b.sort - a.sort);
    const lastLock = commands.find((c) => c.command_type === 'LOCK');
    const provider = d.lock_provider || 'OWN_AGENT';
    const pStatus = d.provider_status || '';
    const providerAlert = pStatus === 'FAILED'
      ? { label: 'RocketPay error', kind: 'failed', title: `The last RocketPay command failed${d.provider_error ? `: ${d.provider_error}` : ''}`, at: fmtDateTime(d.updated_at) }
      : pStatus === 'TAMPERED' ? { label: 'Tamper alert', title: 'RocketPay reported a tamper attempt and locked the phone', at: fmtDateTime(d.updated_at) } : null;
    const phoneSupported = ['screenLock', 'camera', 'location', 'protection', 'media', 'audio', 'refresh', ...(provider === 'ROCKETPAY' ? [] : ['offlineCode'])];
    return {
      live: true,
      id: String(d.id),
      type,
      name: d.device_name || [d.brand, d.model].filter(Boolean).join(' ') || 'Device',
      short: d.model || d.device_name || 'Device',
      imei: d.imei,
      ref: `…${String(d.imei).slice(-6)}`,
      os: OS[d.os_type] ?? d.os_type,
      enrolled: fmtDate(d.created_at),
      lastSeen: ago(d.last_online_at),
      connection: d.is_online ? 'online' : 'offline',
      locked,
      lockedAt: locked ? fmtDateTime(lastLock?.created_at || d.updated_at) : null,
      lockedBy: locked ? (lastLock?.issued_by?.username || 'auto') : null,
      alert: providerAlert,
      lockProvider: provider,
      lockProviderLabel: LOCK_PROVIDERS[provider] ?? provider,
      providerStatus: pStatus ? (PROVIDER_STATUS[pStatus] ?? pStatus) : null,
      providerDeviceId: d.provider_device_id || null,
      battery: d.battery_level,
      agentVersion: d.app_version || '—',
      network: d.ip_address ? `IP ${d.ip_address}` : '—',
      controls: {
        screenLock: locked,
        camera: !!d.camera_disabled,
        protection: !!d.block_factory_reset,
        resetProtection: !!d.block_factory_reset,
        // On a TV the "block apps" row means streaming apps.
        blockApps: type === 'tv' ? !!d.streaming_blocked : !!d.social_media_disabled,
        audioReminder: false,
      },
      socialBlocked: !!d.social_media_disabled,
      streamingBlocked: !!d.streaming_blocked,
      lockedPackages: d.locked_packages ?? [],
      wallpaper: d.custom_wallpaper_url ? 'custom' : 'none',
      wallpaperUrl: d.custom_wallpaper_url || null,
      lockMessage: d.lock_message || '',
      apps: (d.installed_apps ?? []).map((a) => {
        const pkg = typeof a === 'string' ? a : a.package_name || a.pkg || '';
        return { pkg, name: typeof a === 'string' ? a : a.name || a.app_name || pkg, locked: (d.locked_packages ?? []).includes(pkg), hidden: false };
      }),
      appCount: (d.installed_apps ?? []).length,
      supported: type === 'tv' ? TV_LIVE : phoneSupported,
      location: d.current_latitude != null ? {
        place: d.current_address || `${toNum(d.current_latitude).toFixed(4)}, ${toNum(d.current_longitude).toFixed(4)}`,
        area: '', accuracy: '—', at: ago(d.last_location_at),
      } : null,
      offlineCode: d.offline_unlock_code ? {
        code: d.offline_unlock_code, issuedAt: '', used: false,
        expires: offlineExpiry(d.offline_code_expires_at, d.offline_code_expiry_type),
        expired: !!d.offline_code_expires_at && new Date(d.offline_code_expires_at) < new Date(),
      } : null,
      activity,
      displayStatus: statusOf(d),
      customer: { id: c?.id ?? String(d.customer), name, phone: c?.phone || d.customer_details?.mobile_number || '', initials: initials(name) || 'C', overdue: c?.status === 'overdue' },
      retailer: d.retailer_details ? { id: String(d.retailer_details.id), name: d.retailer_details.business_name || d.retailer_details.name } : null,
      emi: k ? {
        amount: toNum(k.monthly_emi_amount),
        months: toNum(k.tenure_months),
        paid: toNum(k.paid_installments_count),
        outstanding: Math.max(0, toNum(k.total_remaining)),
        overdue: oldest ? { amount: late.reduce((n, o) => n + toNum(o.overdue_amount), 0), due: fmtDate(oldest.due_date, false), daysLate: toNum(oldest.days_overdue) } : null,
        nextDue: c.nextDue ? fmtDate(c.nextDue) : null,
        closed: k.status === 'COMPLETED',
      } : null,
      emiContractId: d.emi_contract,
    };
  },

  /** Lock / unlock, then show the lock-screen message if one was given. */
  async setLock(id, locked, { message, reason } = {}) {
    await http.post(`/devices/${id}/${locked ? 'lock' : 'unlock'}/`, { reason: reason?.trim() || '' });
    if (locked && message?.trim()) await http.post(`/devices/${id}/push-reminder/`, { message: message.trim() }).catch(() => null);
    invalidateCustomers();
    return { ok: true, queued: false };
  },

  /** Set-style controls: POST /devices/:id/controls/ {field: bool}. Audio reminder is a one-off command. */
  async setControl(id, key, value) {
    const d = await http.get(`/devices/${id}/`).catch(() => null);
    const queued = d ? !d.is_online : false;
    if (key === 'audioReminder') {
      if (value) await this.playAudio(id);
      return { ok: true, queued };
    }
    const isTv = d && kindOf(d) === 'tv';
    const field = key === 'blockApps' && isTv ? 'streaming_blocked' : CONTROL_FIELD[key];
    if (!field) throw new ApiError('This control isn’t available on the server yet.', 422);
    await http.post(`/devices/${id}/controls/`, { [field]: !!value });
    return { ok: true, queued };
  },

  async sendMessage(id, text) {
    await http.post(`/devices/${id}/push-reminder/`, { message: text });
    return { ok: true };
  },

  /** duration: next_due | 24h | permanent */
  async issueOfflineCode(id, duration = 'next_due') {
    const r = await http.post(`/devices/${id}/generate-offline-code/`, { expiry_option: EXPIRY_OPTION[duration] ?? 'UNTIL_NEXT_DUE_DATE' });
    return { offlineCode: { code: r.offline_unlock_code, issuedAt: 'just now', used: false, expires: offlineExpiry(r.expires_at, r.expiry_option) } };
  },

  async playAudio(id, message) {
    await http.post(`/devices/${id}/audio-reminder/`, message ? { message } : {});
    return { ok: true };
  },

  async refreshLocation(id) {
    await http.post(`/devices/${id}/refresh-location/`, {});
    return { ok: true, queued: true };
  },

  /** Apply the Manage-apps dialog: only packages whose lock state changed. Hiding has no endpoint. */
  async applyApps(id, apps) {
    const d = await http.get(`/devices/${id}/`);
    const current = new Set(d.locked_packages ?? []);
    for (const a of apps) {
      if (!!a.locked !== current.has(a.pkg)) await this.setAppLocked(id, a.pkg, !!a.locked);
    }
    return { ok: true, queued: !d.is_online };
  },

  /** Per-app lock on our own agent (not RocketPay). */
  async setAppLocked(id, pkg, locked) {
    const r = await http.post(`/devices/${id}/apps/${locked ? 'lock' : 'unlock'}/`, { package_name: pkg });
    return { ok: true, lockedPackages: r.locked_packages ?? [] };
  },

  async setWallpaperFile(id, file, lock = true) {
    const body = new FormData();
    body.append('wallpaper_file', file);
    body.append('lock_wallpaper', lock ? 'true' : 'false');
    await http.post(`/devices/${id}/set-wallpaper/`, body);
    return { ok: true };
  },

  async locations(id, range = 'today') {
    const r = await http.get(`/devices/${id}/location-history/`);
    const days = range === 'today' ? 1 : range === 'week' ? 7 : 30;
    const since = Date.now() - days * 86400000;
    const pts = (r.history ?? [])
      .map((p) => ({ lat: toNum(p.latitude), lng: toNum(p.longitude), at: new Date(p.recorded_at), accuracy: p.accuracy != null ? Math.round(p.accuracy) : '—', place: p.address || `${toNum(p.latitude).toFixed(4)}, ${toNum(p.longitude).toFixed(4)}` }))
      .filter((p) => p.at.getTime() >= since)
      .sort((a, b) => a.at - b.at);
    const placed = project(pts).map((p, i) => ({ ...p, n: i + 1, time: `${String(p.at.getHours()).padStart(2, '0')}:${String(p.at.getMinutes()).padStart(2, '0')}` }));
    const byDay = new Map();
    placed.forEach((p) => {
      const key = p.at.toDateString();
      if (!byDay.has(key)) byDay.set(key, { label: p.at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), points: [] });
      byDay.get(key).points.push(p);
    });
    const groups = [...byDay.values()].reverse().map((g) => ({ ...g, points: [...g.points].reverse() }));
    return {
      device: { id: String(id) },
      groups: groups.length ? groups : [{ label: 'No location points in this period', points: [] }],
      distanceKm: km(pts),
      flags: [],
      intervalMinutes: null,
    };
  },

  async statusBoard() {
    const [list, s, al] = await Promise.all([
      loadDevices(),
      customersSnapshot().catch(() => ({ byId: new Map() })),
      this.alerts().catch(() => null),
    ]);
    const rows = list.map((d) => toRow(d, s)).filter((r) => r.type !== 'tv');
    const count = (k) => rows.filter((r) => r.status.key === k).length;
    const rank = (r) => (r.status.key === 'locked' ? 0 : r.status.key === 'offline' ? 1 : 2);
    return {
      live: true,
      counts: {
        online: count('online'),
        offline: count('offline'),
        locked: count('locked'),
        unlocked: rows.length - count('locked'),
        // Tamper + failed RocketPay commands (GET /devices/alerts/); offline has its own tile.
        alerts: al ? al.summary.tamper + al.summary.failed : 0,
      },
      tiles: [...rows].sort((a, b) => rank(a) - rank(b)).slice(0, 9),
      alerts: al
        ? [...al.items].sort((a, b) => ['TAMPER', 'FAILED_COMMAND', 'OFFLINE'].indexOf(a.type) - ['TAMPER', 'FAILED_COMMAND', 'OFFLINE'].indexOf(b.type))
          .slice(0, 8).map((a) => ({ id: a.deviceId, tone: a.tone, title: a.title, meta: `${a.message} · ${a.meta}` }))
        : rows.filter((r) => r.status.key === 'offline').slice(0, 5).map((r) => ({ id: r.id, tone: 'mute', title: `Offline · last seen ${r.lastSeen}`, meta: `${r.short} · ${r.customer}` })),
      updatedAt: new Date().toISOString(),
    };
  },

  /** Retry the last failed RocketPay lock/unlock: POST /devices/:id/retry-provider-command/ */
  async retryProvider(id) {
    const r = await http.post(`/devices/${id}/retry-provider-command/`, {});
    return { ok: true, message: r.message };
  },

  /** Sends the current offline code to the device's retailer (in-app + WhatsApp). */
  async sendOfflineCode(id) {
    const r = await http.post(`/devices/${id}/send-offline-code/`, {});
    return { ok: true, whatsapp: !!r.whatsapp_dispatched, code: r.offline_unlock_code || r.code };
  },

  /** GET /devices/alerts/?days= — tamper, failed RocketPay commands, offline > days. */
  async alerts(days = 3) {
    const r = await http.get('/devices/alerts/', { params: { days } });
    const TONE = { TAMPER: 'bad', FAILED_COMMAND: 'warn', OFFLINE: 'mute' };
    const TITLE = { TAMPER: 'Tamper alert', FAILED_COMMAND: 'RocketPay command failed', OFFLINE: `Offline for over ${days} days` };
    return {
      summary: {
        total: toNum(r.summary?.total_alerts), tamper: toNum(r.summary?.tamper_count),
        failed: toNum(r.summary?.failed_commands_count), offline: toNum(r.summary?.offline_count),
      },
      items: (r.alerts ?? []).map((a) => ({
        id: a.id,
        type: a.type,
        deviceId: String(a.device_id),
        tone: TONE[a.type] ?? 'info',
        title: TITLE[a.type] ?? a.type,
        message: a.message,
        action: a.action_required,
        meta: [[a.brand, a.model].filter(Boolean).join(' '), a.customer_name, a.retailer_store || a.retailer_name, fmtDateTime(a.timestamp)].filter(Boolean).join(' · '),
      })),
    };
  },

  /* ---------------- Approved phone models (RocketPay TAC list) ---------------- */

  async tacList({ q = '', environment = '', active = '' } = {}) {
    const list = await allPages('/tac-list/', { environment: environment || undefined, active: active || undefined });
    const rowsOut = list.map((t) => ({
      id: String(t.id), tac: t.tac, brand: t.brand, model: t.model_number, name: t.marketing_name || '',
      environment: t.environment, active: !!t.active, updatedAt: fmtDate(t.updated_at),
    })).filter((t) => matches(q, t.tac, t.brand, t.model, t.name));
    return rowsOut;
  },
  saveTac(v, id) {
    const body = { tac: v.tac.trim(), brand: v.brand.trim(), model_number: v.model.trim(), marketing_name: v.name.trim() || null, environment: v.environment, active: !!v.active };
    return id ? http.patch(`/tac-list/${id}/`, body) : http.post('/tac-list/', body);
  },
  setTacActive(id, active) { return http.patch(`/tac-list/${id}/`, { active: !!active }); },
  deleteTac(id) { return http.delete(`/tac-list/${id}/`); },
  async checkImei(imei) {
    const r = await http.get('/tac-list/check/', { params: { imei } });
    return { eligible: !!r.eligible, tac: r.tac, message: r.message || r.error || '', environment: r.environment };
  },

  /* ---------------- Set up EMI (A-20) ---------------- */

  /** Enrolled devices with no EMI yet, one per customer. */
  async awaitingSetup() {
    const [list, s] = await Promise.all([loadDevices(), customersSnapshot()]);
    const seen = new Set();
    return list.filter((d) => !d.emi_contract && d.customer && d.status !== 'UNENROLLED').filter((d) => {
      if (seen.has(d.customer)) return false;
      seen.add(d.customer);
      return true;
    }).map((d) => {
      const c = s.byId.get(String(d.customer));
      const type = kindOf(d);
      return {
        id: String(d.customer),
        name: c?.name || d.customer_details?.name || d.customer_details?.mobile_number || 'Customer',
        phone: c?.phone || d.customer_details?.mobile_number || '',
        device: { id: String(d.id), type: type === 'tv' ? 'tv' : 'mobile', label: `${d.device_name || d.model || 'Device'} · ${type === 'tv' ? 'SN' : 'IMEI'} ${d.imei}`, price: null },
        graceDays: 3,
      };
    });
  },

  async attachEmi(deviceId, p) {
    const body = {
      total_amount: p.price,
      down_payment: p.down,
      processing_fee: p.fee,
      tenure_months: p.months,
      first_emi_date: p.firstDue,
      ...(p.planId ? { plan_template_id: Number(p.planId) } : {}),
    };
    const res = await http.post(`/devices/${deviceId}/attach-emi/`, body);
    invalidateCustomers();
    return res;
  },
};
