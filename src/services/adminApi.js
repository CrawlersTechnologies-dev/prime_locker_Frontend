/**
 * Staff (A-34..A-36), settings (A-38..A-40), WhatsApp campaigns, notifications (A-41) and app banners (A-46).
 *   GET/POST /lock-messages/   PATCH|DELETE /lock-messages/:id/
 *   GET/POST /banners/ (multipart image)   PATCH|DELETE /banners/:id/
 *   GET/POST /staff/   PATCH /staff/:id/   DELETE /staff/:id/ (deactivates)
 *   GET/PATCH /settings/
 *   GET /whatsapp/campaigns/ (templates + recent deliveries)   POST { template_name, segment, phone_numbers, parameters }
 *   GET /notifications/?unread=true   GET /notifications/unread-count/   POST /notifications/:id/mark-read/ | mark-all-read/
 * Live with 'admin' in VITE_LIVE_MODULES. Without it these screens show a short "needs the server" note.
 */
import { http, allPages, rows, toNum, isLive, ApiError, tokenStore, errorMessage } from './http';

const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? 'https://api.primelocker.pro/api').replace(/\/$/, '');

export const ADMIN_LIVE = isLive('admin');

export const STAFF_ROLE_OPTIONS = [
  { value: 'STAFF_OPERATIONS', label: 'Operations', note: 'Retailers, customers, devices and EMIs' },
  { value: 'STAFF_COLLECTIONS', label: 'Collections', note: 'Payments, reminders, lock and unlock' },
  { value: 'STAFF_SUPPORT', label: 'Technical support', note: 'Devices, offline codes, customer lookups' },
  { value: 'STAFF_VIEWER', label: 'Viewer', note: 'Read-only access to reports' },
];
export const staffRoleLabel = (r) => STAFF_ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const fmt = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—'; };
const ago = (v) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return fmt(v);
};
const need = () => { if (!ADMIN_LIVE) throw new ApiError('Add admin to VITE_LIVE_MODULES to use this screen.', 400); };

export const adminApi = {
  /* ---------- staff ---------- */
  async staff() {
    need();
    return (await allPages('/staff/')).map((u) => ({
      id: String(u.id),
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
      email: u.email,
      mobile: u.mobile_number || '',
      role: u.role,
      roleLabel: staffRoleLabel(u.role),
      active: u.is_active !== false,
      since: fmt(u.date_joined).split(',')[0],
    }));
  },
  createStaff(v) {
    need();
    return http.post('/staff/', {
      full_name: v.name.trim(), email: v.email.trim().toLowerCase(), mobile_number: v.mobile.replace(/\D/g, '').slice(-10) || null,
      role: v.role, password: v.password,
    });
  },
  updateStaff(id, patch) {
    need();
    const body = {};
    if (patch.role) body.role = patch.role;
    if (patch.active != null) body.is_active = patch.active;
    return http.patch(`/staff/${id}/`, body);
  },
  deactivateStaff(id) { need(); return http.delete(`/staff/${id}/`); },

  /* ---------- settings ---------- */
  async settings() {
    need();
    const s = await http.get('/settings/');
    return {
      companyName: s.company_name ?? '', supportPhone: s.support_phone ?? '', supportEmail: s.support_email ?? '',
      address: s.company_address ?? '', gstin: s.gstin ?? '', graceDays: String(s.default_grace_period_days ?? 3),
      autoLock: !!s.auto_lock_enabled, lateFee: String(toNum(s.late_fee_per_day)),
      razorpayKeyId: s.razorpay_key_id ?? '', razorpaySecretSet: !!s.razorpay_key_secret,
      whatsappProvider: s.whatsapp_provider || 'SIMULATION', whatsappKeySet: !!s.whatsapp_api_key, whatsappSender: s.whatsapp_sender_id ?? '',
      updatedAt: fmt(s.updated_at),
    };
  },
  saveSettings(v) {
    need();
    const map = {
      companyName: 'company_name', supportPhone: 'support_phone', supportEmail: 'support_email', address: 'company_address', gstin: 'gstin',
      graceDays: 'default_grace_period_days', autoLock: 'auto_lock_enabled', lateFee: 'late_fee_per_day',
      razorpayKeyId: 'razorpay_key_id', razorpaySecret: 'razorpay_key_secret',
      whatsappProvider: 'whatsapp_provider', whatsappKey: 'whatsapp_api_key', whatsappSender: 'whatsapp_sender_id',
    };
    const body = {};
    Object.entries(v).forEach(([k, val]) => { if (map[k] && val !== undefined) body[map[k]] = val; });
    return http.patch('/settings/', body);
  },

  /* ---------- WhatsApp ---------- */
  async whatsapp() {
    need();
    const d = await http.get('/whatsapp/campaigns/');
    const templates = Object.entries(d.templates ?? {}).map(([key, t]) => ({
      key,
      description: t.description,
      body: t.sample_body,
      params: [...new Set([...(t.sample_body ?? '').matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]))],
    }));
    const deliveries = (d.recent_deliveries ?? []).map((l) => ({
      id: String(l.id), phone: l.recipient_phone, name: l.recipient_name || '', template: l.template_name,
      status: l.status, provider: l.provider, at: fmt(l.created_at),
    }));
    return { templates, deliveries };
  },
  /** segment: OVERDUE (numbers from /emi-overdue/) | LOCKED_DEVICES | CUSTOM */
  async sendCampaign({ template, segment, phones = [], params = {} }) {
    need();
    let body;
    if (segment === 'OVERDUE') {
      // The backend's OVERDUE_ALL segment filters on a contract status that doesn't exist, so the
      // overdue list is built here from /emi-overdue/.
      const od = await http.get('/emi-overdue/');
      const nums = [...new Set((od?.overdue_customers ?? []).map((o) => o.customer_phone).filter(Boolean))];
      if (!nums.length) throw new ApiError('No overdue customers right now.', 400);
      body = { template_name: template, segment: 'CUSTOM', phone_numbers: nums, parameters: params };
    } else if (segment === 'LOCKED_DEVICES') {
      body = { template_name: template, segment: 'LOCKED_DEVICES', parameters: params };
    } else {
      body = { template_name: template, segment: 'CUSTOM', phone_numbers: phones, parameters: params };
    }
    return http.post('/whatsapp/campaigns/', body);
  },

  /* ---------- notifications ---------- */
  async unreadCount() {
    if (!ADMIN_LIVE) return 0;
    const d = await http.get('/notifications/unread-count/').catch(() => null);
    return toNum(d?.unread_count);
  },
  async notifications({ unread = false, page = 1 } = {}) {
    need();
    const d = await http.get('/notifications/', { params: { unread: unread ? 'true' : undefined, page } });
    const total = toNum(d?.count ?? rows(d).length);
    return {
      items: rows(d).map((n) => ({
        id: String(n.id), title: n.title, message: n.message, type: n.notification_type, ref: n.reference_id,
        read: !!n.is_read, from: n.sender_name, at: ago(n.created_at),
      })),
      total, page: Number(page) || 1, pages: Math.max(1, Math.ceil(total / 50)), pageSize: 50,
    };
  },
  markRead(id) { need(); return http.post(`/notifications/${id}/mark-read/`, {}); },
  markAllRead() { need(); return http.post('/notifications/mark-all-read/', {}); },

  /* ---------- lock-screen message templates (A-40) ---------- */
  async lockMessages() {
    need();
    return (await allPages('/lock-messages/')).map((m) => ({
      id: String(m.id), title: m.title, text: m.text, isDefault: !!m.is_default, updatedAt: fmt(m.updated_at),
    }));
  },
  saveLockMessage(v, id) {
    need();
    const body = { title: v.title.trim(), text: v.text.trim(), is_default: !!v.isDefault };
    return id ? http.patch(`/lock-messages/${id}/`, body) : http.post('/lock-messages/', body);
  },
  deleteLockMessage(id) { need(); return http.delete(`/lock-messages/${id}/`); },

  /* ---------- app banners (A-46) ---------- */
  async banners() {
    need();
    return (await allPages('/banners/')).map((b) => ({
      id: String(b.id), title: b.title, image: b.image || null, link: b.link || '', audience: b.target_role || 'ALL',
      active: !!b.is_active, order: toNum(b.order), updatedAt: fmt(b.updated_at),
    }));
  },
  /** v: { title, link, audience, order, active, image(File|null) } — multipart when there's an image. */
  saveBanner(v, id) {
    need();
    const fields = { title: v.title.trim(), link: v.link.trim() || '', target_role: v.audience, order: Number(v.order) || 0, is_active: !!v.active };
    if (!v.image) return id ? http.patch(`/banners/${id}/`, fields) : Promise.reject(new ApiError('Add a banner image', 400));
    const body = new FormData();
    Object.entries(fields).forEach(([k, val]) => body.append(k, typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val)));
    body.append('image', v.image);
    return id ? http.patch(`/banners/${id}/`, body) : http.post('/banners/', body);
  },
  setBannerActive(id, active) { need(); return http.patch(`/banners/${id}/`, { is_active: !!active }); },
  deleteBanner(id) { need(); return http.delete(`/banners/${id}/`); },

  /* ---------- app versions (customer app QR) ---------- */
  async appVersions() {
    need();
    return (await allPages('/app-versions/')).map((a) => ({
      id: String(a.id), type: a.app_type, version: a.version_name, code: toNum(a.version_code),
      notes: a.release_notes || '', active: !!a.is_active, mandatory: !!a.is_mandatory,
      hasFile: !!a.apk_file, externalUrl: a.external_download_url || '',
      link: a.public_link || a.download_url || a.external_download_url || '',
      publicLink: a.public_link || '', by: a.uploaded_by_name || '—', at: fmt(a.created_at),
    }));
  },
  /**
   * v: { type, version, code, notes, mandatory, active, file(File|null), externalUrl }.
   * Uses XMLHttpRequest so a big APK upload can show progress (onProgress gets 0–100).
   */
  uploadAppVersion(v, onProgress) {
    need();
    const body = new FormData();
    body.append('app_type', v.type);
    body.append('version_name', v.version.trim());
    body.append('version_code', String(Number(v.code)));
    body.append('release_notes', v.notes.trim());
    body.append('is_mandatory', v.mandatory ? 'true' : 'false');
    body.append('is_active', v.active ? 'true' : 'false');
    if (v.file) body.append('apk_file', v.file);
    if (v.externalUrl.trim()) body.append('external_download_url', v.externalUrl.trim());
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/app-versions/`);
      const token = tokenStore.get();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
      xhr.onerror = () => reject(new ApiError('Upload failed. Check your internet connection and try again.', 0));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
        if (xhr.status === 413) return reject(new ApiError('The APK is too large for the server. Ask the server admin to raise the upload limit (nginx client_max_body_size).', 413));
        if (xhr.status === 401) return reject(new ApiError('Your session expired. Sign in again, then upload.', 401));
        return reject(new ApiError(errorMessage(data, xhr.status), xhr.status, data));
      };
      xhr.send(body);
    });
  },
  setAppVersionActive(id, active) { need(); return http.patch(`/app-versions/${id}/`, { is_active: !!active }); },
  deleteAppVersion(id) { need(); return http.delete(`/app-versions/${id}/`); },
};

/** The stable public link for an app type, even before the server sends one. */
export const publicAppLink = (slug) => `${API_BASE}/app-versions/download/${slug}/`;
