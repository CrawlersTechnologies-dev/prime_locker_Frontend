/**
 * Customers, EMI contracts and EMI plans on the real backend.
 *   GET/POST /customers/            GET/PATCH/DELETE /customers/:id/
 *   GET /emi-contracts/             GET /emi-contracts/:id/schedule/   POST /emi-contracts/:id/lock/ | unlock/
 *   POST /emi-installments/:id/record-payment/  { amount, payment_mode, transaction_ref, notes }
 *   GET /emi-overdue/?bucket=       GET /devices/       POST /devices/:id/lock/ | push-reminder/
 *   GET/POST /emi-plans/   PATCH /emi-plans/:id/   POST /emi-plans/:id/toggle-status/
 *   GET /reports/customer-kyc/      (customer names + KYC status)
 * The customer endpoint doesn't return the name, so names come from the KYC report, EMI contracts
 * and devices. Everything is loaded once into a snapshot (cached a few seconds) and filtered here.
 * TODO(api): customer name on /customers/, server-side search + filters, customer filter on /emi-contracts/.
 */
import { http, allPages, toNum, ApiError } from './http';
import { paginate, matches } from './mock/scope';
import { initials } from '../utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const toDate = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
export const fmtDate = (v, withYear = true) => { const d = toDate(v); return d ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}` : '—'; };
export const fmtDateTime = (v) => { const d = toDate(v); return d ? `${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—'; };
const addMonths = (d, n) => { const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE_GATEWAY', label: 'Online' },
];
export const modeLabel = (m) => PAYMENT_MODES.find((x) => x.value === m)?.label ?? (m ? String(m) : '—');

/** Panel device type from backend device / contract fields. */
function deviceKind({ device_category: cat, os_type: os, device_type: type } = {}) {
  if (cat === 'TV' || type === 'TV' || os === 'SMART_TV') return 'tv';
  if (os === 'IOS') return 'iphone';
  return 'android';
}

/* ---------------- snapshot ---------------- */
let cache = null;
const TTL = 15000;
export function invalidateCustomers() { cache = null; }

async function loadSnapshot() {
  const [customers, contracts, devices, kyc, overdue] = await Promise.all([
    allPages('/customers/'),
    allPages('/emi-contracts/').catch(() => []),
    allPages('/devices/').catch(() => []),
    http.get('/reports/customer-kyc/').then((d) => d?.customers ?? []).catch(() => []),
    http.get('/emi-overdue/').then((d) => d?.overdue_customers ?? []).catch(() => []),
  ]);
  // Partners: /customers/ only returns a user's direct children (none for a distributor), but EMI
  // contracts and devices are scoped to their whole downline, so customers are filled in from those.
  const known = new Set(customers.map((u) => u.id));
  const stub = (id, details, retailer, joined) => {
    if (!id || known.has(id)) return;
    known.add(id);
    customers.push({
      id, email: details?.email ?? '', mobile_number: details?.mobile_number ?? '', alternate_mobile_number: details?.alternate_mobile_number ?? '',
      parent: retailer ? { id: retailer.id, name: retailer.name, role: 'RETAILER', business_name: retailer.business_name } : null,
      is_active: true, date_joined: joined, customer_photo: details?.customer_photo ?? null, customer_signature: details?.customer_signature ?? null,
    });
  };
  contracts.forEach((k) => stub(k.customer, k.customer_details, k.retailer_details, k.created_at));
  devices.forEach((d) => stub(d.customer, d.customer_details, d.retailer_details, d.created_at));
  const kycById = new Map(kyc.map((k) => [k.customer_id, k]));
  const overdueByContract = new Map();
  overdue.forEach((o) => {
    const list = overdueByContract.get(o.contract_id) ?? [];
    list.push(o);
    overdueByContract.set(o.contract_id, list);
  });
  const contractsByCustomer = new Map();
  contracts.forEach((c) => {
    const list = contractsByCustomer.get(c.customer) ?? [];
    list.push(c);
    contractsByCustomer.set(c.customer, list);
  });
  const devicesByCustomer = new Map();
  devices.forEach((d) => {
    const list = devicesByCustomer.get(d.customer) ?? [];
    list.push(d);
    devicesByCustomer.set(d.customer, list);
  });

  const today = startOfToday();
  const list = customers.map((u) => {
    const cs = (contractsByCustomer.get(u.id) ?? []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const contract = cs.find((c) => c.status !== 'COMPLETED') ?? cs[0] ?? null;
    const ds = devicesByCustomer.get(u.id) ?? [];
    const device = (contract && ds.find((d) => d.imei === contract.device_imei)) ?? ds[0] ?? null;
    const k = kycById.get(u.id);
    const name = (u.name && u.name !== u.username ? u.name : '') || k?.customer_name || contract?.customer_details?.name || device?.customer_details?.name || u.mobile_number || u.email;
    const late = contract ? overdueByContract.get(contract.id) ?? [] : [];

    // Next due: the first unpaid installment (installments are monthly from first_emi_date).
    let nextDue = null;
    if (contract && toNum(contract.remaining_installments_count) > 0) {
      nextDue = addMonths(new Date(contract.first_emi_date), toNum(contract.paid_installments_count));
    }
    let status = u.draft_status === 'DRAFT' ? 'draft' : 'no_emi';
    if (contract) {
      if (contract.status === 'DRAFT') status = 'draft';
      else if (contract.status === 'COMPLETED') status = 'completed';
      else if (late.length || contract.status === 'LOCKED' || contract.status === 'DEFAULTED') status = 'overdue';
      else if (nextDue && (nextDue - today) / 86400000 <= 7) status = 'due_soon';
      else status = 'on_track';
    }
    const kind = device ? deviceKind(device) : contract ? deviceKind(contract) : null;
    const deviceName = device?.device_name || contract?.device_name || [device?.brand, device?.model].filter(Boolean).join(' ') || null;
    const imei = device?.imei || contract?.device_imei || null;
    return {
      id: String(u.id),
      backendId: u.id,
      raw: u,
      name,
      initials: initials(name) || 'C',
      phone: u.mobile_number ?? '',
      altPhone: u.alternate_mobile_number ?? '',
      email: u.email ?? '',
      address: [u.address, u.city, u.state, u.pincode].filter(Boolean).join(', '),
      since: fmtDate(u.date_joined),
      active: u.is_active !== false,
      retailerId: u.parent?.role === 'RETAILER' ? String(u.parent.id) : '',
      retailer: u.parent?.business_name || u.parent?.name || '—',
      retailerRole: u.parent?.role ?? '',
      kyc: k?.kyc_status ?? (u.customer_photo && u.customer_signature ? 'COMPLETE' : u.customer_photo || u.customer_signature ? 'PARTIAL' : 'MISSING'),
      photo: u.customer_photo ?? null,
      signature: u.customer_signature ?? null,
      idType: u.id_type || null,
      idMasked: u.masked_id_number || null,
      idFront: u.id_front_image ?? null,
      idBack: u.id_back_image ?? null,
      agreement: !!u.signed_emi_agreement_flag,
      contract,
      contracts: cs,
      device,
      deviceKind: kind,
      deviceName,
      imei,
      late,
      nextDue,
      status,
    };
  });
  return { list, byId: new Map(list.map((c) => [c.id, c])), contracts, devices };
}

async function snapshot() {
  if (!cache || Date.now() - cache.at > TTL) {
    cache = { at: Date.now(), promise: loadSnapshot().catch((e) => { cache = null; throw e; }) };
  }
  return cache.promise;
}

/** Shared with devicesLive / paymentsLive. */
export const customersSnapshot = () => snapshot();

async function findCustomer(id) {
  const s = await snapshot();
  const c = s.byId.get(String(id));
  if (!c) throw new ApiError('Customer not found', 404);
  return c;
}

/** Row shape used by customerColumns (A-07 and the retailer's Customers tab). */
function toRow(c) {
  const k = c.contract;
  return {
    id: c.id,
    initials: c.initials,
    name: c.name,
    phone: c.phone,
    device: c.deviceName,
    deviceRef: c.imei,
    deviceType: c.deviceKind,
    deviceId: c.device ? String(c.device.id) : null,
    deviceStatus: c.device?.status === 'LOCKED' || k?.status === 'LOCKED' ? 'locked' : null,
    since: c.since,
    retailerId: c.retailerId,
    retailer: c.retailer,
    emi: k ? `₹${Math.round(toNum(k.monthly_emi_amount)).toLocaleString('en-IN')} × ${toNum(k.tenure_months)}` : '—',
    paid: k ? toNum(k.paid_installments_count) : 0,
    months: k ? toNum(k.tenure_months) : 0,
    nextDue: c.nextDue ? fmtDate(c.nextDue, false) : '—',
    status: c.status,
  };
}

/** Installment from /schedule/ → the panel's schedule row. */
function toInstallment(i) {
  const due = toDate(i.due_date);
  const paidAt = toDate(i.collection_date);
  let status = 'upcoming';
  if (i.status === 'PAID') status = paidAt && due && paidAt > new Date(due.getTime() + 86399999) ? 'paid_late' : 'paid';
  else if (i.status === 'OVERDUE') status = 'overdue';
  else if (i.status === 'DUE') status = 'due';
  return {
    id: i.id,
    n: i.installment_number,
    due: fmtDate(i.due_date),
    dueDate: due,
    amount: toNum(i.amount),
    paidAmount: toNum(i.paid_amount),
    lateFee: toNum(i.late_fee), // M6 — 0 once paid (the fee is then inside paid_amount)
    paidOn: paidAt ? fmtDate(paidAt, false) : null,
    paidOnDate: paidAt,
    mode: i.payment_mode ? modeLabel(i.payment_mode) : null,
    ref: i.transaction_ref || '',
    by: i.collected_by_name || '',
    daysLate: toNum(i.days_overdue),
    receipt: null,
    status,
  };
}

const kycBadge = (s) => (s === 'COMPLETE' ? 'verified' : s === 'PARTIAL' ? 'partial' : 'missing');

export const customersLive = {
  /** A-07 list. status: all | on_emi | overdue | completed | no_emi */
  async list({ q = '', status = 'all', retailerId = '', deviceType = '', page = 1 } = {}) {
    const s = await snapshot();
    const searched = s.list
      .filter((c) => matches(q, c.name, c.phone, c.imei, c.email))
      .filter((c) => !retailerId || c.retailerId === retailerId)
      .filter((c) => !deviceType || c.deviceKind === deviceType);
    const onEmi = (c) => ['on_track', 'due_soon', 'overdue'].includes(c.status);
    const counts = {
      all: searched.length,
      on_emi: searched.filter(onEmi).length,
      overdue: searched.filter((c) => c.status === 'overdue').length,
      completed: searched.filter((c) => c.status === 'completed').length,
      no_emi: searched.filter((c) => c.status === 'no_emi').length,
    };
    const filtered = searched.filter((c) => status === 'all' || (status === 'on_emi' ? onEmi(c) : c.status === status));
    const retailers = new Map();
    s.list.forEach((c) => { if (c.retailerId) retailers.set(c.retailerId, c.retailer); });
    return {
      live: true,
      ...paginate(filtered.map(toRow), page, 20),
      counts,
      totals: { customers: s.list.length, retailers: retailers.size },
      retailers: [...retailers].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
    };
  },

  /** Every row matching the filters (no paging), for CSV export. */
  async exportRows(filters) {
    const first = await customersLive.list({ ...filters, page: 1 });
    const out = [...first.items];
    for (let p = 2; p <= first.pages; p += 1) {
      // eslint-disable-next-line no-await-in-loop
      out.push(...(await customersLive.list({ ...filters, page: p })).items);
    }
    return out;
  },

  /** Customers of one store (retailer detail → Customers tab). */
  async forRetailer(retailerId) {
    const s = await snapshot();
    return s.list.filter((c) => c.retailerId === String(retailerId)).map(toRow);
  },

  /** A-09 detail. */
  async get(id) {
    const c = await findCustomer(id);
    const k = c.contract;
    let sched = [];
    if (k) {
      const d = await http.get(`/emi-contracts/${k.id}/schedule/`).catch(() => null);
      sched = (d?.installments ?? []).map(toInstallment);
    }
    const paid = sched.filter((x) => x.status === 'paid' || x.status === 'paid_late');
    const documents = [
      c.photo && { id: 'photo', label: 'Customer photo', file: 'photo', url: c.photo },
      c.signature && { id: 'signature', label: 'Customer signature', file: 'signature', url: c.signature },
      c.idFront && { id: 'front', label: `${c.idType || 'ID'} · front`, file: 'id-front', url: c.idFront },
      c.idBack && { id: 'back', label: `${c.idType || 'ID'} · back`, file: 'id-back', url: c.idBack },
    ].filter(Boolean);
    const d = c.device;
    return {
      live: true,
      id: c.id,
      backendId: c.backendId,
      name: c.name,
      initials: c.initials,
      phone: c.phone,
      altPhone: c.altPhone,
      email: c.email,
      address: c.address || '—',
      since: c.since,
      status: c.status,
      kyc: kycBadge(c.kyc),
      idType: c.idType,
      idLast4: c.idMasked ? c.idMasked.slice(-4) : null,
      agreement: c.agreement,
      retailer: c.retailerId ? { id: c.retailerId, name: c.retailer, city: '' } : null,
      device: d || k ? {
        id: d ? String(d.id) : null,
        type: c.deviceKind,
        name: c.deviceName || 'Device',
        imei: c.imei,
        os: d ? ({ ANDROID: 'Android', IOS: 'iOS', SMART_TV: 'Smart TV' }[d.os_type] ?? d.os_type) : '',
        lastSeen: d?.last_online_at ? fmtDateTime(d.last_online_at) : 'never',
        status: d?.status === 'LOCKED' || k?.status === 'LOCKED' ? 'locked' : d?.is_online ? 'online' : 'offline',
      } : null,
      emi: k ? {
        contractId: k.id,
        price: toNum(k.total_amount),
        down: toNum(k.down_payment),
        amount: toNum(k.monthly_emi_amount),
        months: toNum(k.tenure_months),
        plan: k.plan_template_name || 'Custom',
      } : null,
      schedule: sched,
      balance: {
        outstanding: k ? Math.max(0, toNum(k.total_remaining)) : 0,
        collected: k ? toNum(k.total_paid) : 0,
        paidCount: k ? toNum(k.paid_installments_count) : paid.length,
        months: k ? toNum(k.tenure_months) : 0,
      },
      documents,
      messages: [],
    };
  },

  /**
   * POST /customers/ (multipart). The backend logs customers in with email + password, so a
   * placeholder email and a starter password are set when they're left empty (same rule as the retailer app).
   */
  async create(v, { draft = false } = {}) {
    const mobile = String(v.mobile).replace(/\D/g, '').slice(-10);
    const body = new FormData();
    const fields = {
      full_name: v.name.trim(),
      mobile_number: mobile,
      alternate_mobile_number: String(v.altMobile || '').replace(/\D/g, '').slice(-10),
      email: (v.email || '').trim() || `${mobile}@customer.primelocker.com`,
      password: v.password || `PL@${mobile.slice(-4)}`,
      address: v.address?.trim() ?? '',
      city: v.city?.trim() ?? '',
      state: v.state?.trim() ?? '',
      pincode: v.pincode?.trim() ?? '',
      parent: v.retailerId,
      id_type: v.idNumber ? v.idType : '',
      id_number: v.idNumber || '',
      signed_emi_agreement_flag: v.agreement ? 'true' : 'false',
      draft_status: draft ? 'DRAFT' : 'COMPLETED',
    };
    Object.entries(fields).forEach(([key, val]) => { if (val !== '' && val != null) body.append(key, val); });
    if (v.photo) body.append('customer_photo', v.photo);
    if (v.signature) body.append('customer_signature', v.signature);
    if (v.idFront) body.append('id_front_image', v.idFront);
    if (v.idBack) body.append('id_back_image', v.idBack);
    let res;
    try {
      res = await http.post('/customers/', body);
    } catch (e) {
      if (e.status >= 500) throw new ApiError('The server couldn’t save this customer. The mobile number or email may already be in use.', e.status);
      throw e;
    }
    invalidateCustomers();
    return { id: String(res.id), password: fields.password, email: fields.email };
  },

  /** Payment reminder on WhatsApp (POST /whatsapp/campaigns/) and on the device screen if enrolled. */
  async sendReminder(id) {
    const c = await findCustomer(id);
    if (!c.device && !c.phone) throw new ApiError('This customer has no mobile number or device to remind.', 422);
    const amount = c.late.reduce((n, o) => n + toNum(o.overdue_amount), 0) || toNum(c.contract?.monthly_emi_amount);
    const rupees = Math.round(amount).toLocaleString('en-IN');
    const message = c.late.length
      ? `Your EMI of ₹${rupees} is overdue. Please pay now to avoid your device being locked.`
      : `Reminder: your EMI of ₹${rupees} is due${c.nextDue ? ` on ${fmtDate(c.nextDue)}` : ''}.`;
    const sent = { whatsapp: false, screen: false };
    if (c.phone) {
      sent.whatsapp = await http.post('/whatsapp/campaigns/', {
        template_name: c.late.length ? 'emi_overdue_warning' : 'emi_due_reminder',
        segment: 'CUSTOM',
        phone_numbers: [c.phone],
        parameters: { customer_name: c.name, amount: rupees, device_name: c.deviceName || 'your device', due_date: c.nextDue ? fmtDate(c.nextDue) : '', payment_link: '' },
      }).then(() => true).catch(() => false);
    }
    if (c.device) sent.screen = await http.post(`/devices/${c.device.id}/push-reminder/`, { message }).then(() => true).catch(() => false);
    if (!sent.whatsapp && !sent.screen) throw new ApiError('The reminder couldn’t be sent. Try again in a minute.', 502);
    return { ok: true, ...sent };
  },

  /* ---------------- EMI plans (A-19) ---------------- */

  async plans(status = 'all') {
    const list = (await allPages('/emi-plans/')).map((p) => ({
      id: String(p.id),
      backendId: p.id,
      name: p.name,
      description: p.description || '',
      months: toNum(p.tenure_months),
      minDownPct: toNum(p.min_down_payment_percentage),
      fee: toNum(p.processing_fee),
      interestPct: toNum(p.interest_rate_percentage),
      graceDays: toNum(p.grace_period_days),
      deviceType: p.device_type,
      deviceTypes: p.device_type === 'TV' ? ['tv'] : p.device_type === 'MOBILE' ? ['mobile'] : ['mobile', 'tv'],
      status: p.is_active ? 'active' : 'draft',
      customers: toNum(p.active_contracts_count),
    }));
    return {
      live: true,
      items: list.filter((p) => status === 'all' || p.status === status),
      counts: { all: list.length, active: list.filter((p) => p.status === 'active').length, draft: list.filter((p) => p.status === 'draft').length },
    };
  },

  /** Create or edit a plan; activation is a separate toggle on the backend. */
  async savePlan(plan, id, currentStatus) {
    const types = plan.deviceTypes ?? [];
    const body = {
      name: plan.name,
      description: plan.description,
      tenure_months: plan.months,
      min_down_payment_percentage: plan.minDownPct,
      processing_fee: plan.fee,
      interest_rate_percentage: plan.interestPct ?? 0,
      grace_period_days: plan.graceDays,
      device_type: types.includes('mobile') && types.includes('tv') ? 'ALL' : types.includes('tv') ? 'TV' : 'MOBILE',
      is_active: plan.status === 'active',
    };
    if (id) {
      await http.patch(`/emi-plans/${id}/`, body);
      if (currentStatus && currentStatus !== plan.status) await http.post(`/emi-plans/${id}/toggle-status/`, {}).catch(() => null);
    } else {
      await http.post('/emi-plans/', body);
    }
    return { ok: true };
  },

  async togglePlan(id) {
    return http.post(`/emi-plans/${id}/toggle-status/`, {});
  },

  /* ---------------- Schedule (A-21) ---------------- */

  async schedule(customerId) {
    const c = await findCustomer(customerId);
    const k = c.contract;
    if (!k) throw new ApiError('No EMI set up for this customer yet.', 404);
    const d = await http.get(`/emi-contracts/${k.id}/schedule/`);
    const rows = (d.installments ?? []).map(toInstallment);
    const sum = d.summary ?? {};
    return {
      live: true,
      contractId: k.id,
      customer: { id: c.id, name: c.name, phone: c.phone },
      device: { id: c.device ? String(c.device.id) : null, name: c.deviceName || 'Device', type: c.deviceKind, locked: k.status === 'LOCKED' || c.device?.status === 'LOCKED' },
      plan: k.plan_template_name || 'Custom',
      started: rows[0]?.due,
      draft: k.status === 'DRAFT',
      status: k.status,
      price: toNum(k.total_amount),
      down: toNum(k.down_payment),
      fee: toNum(k.processing_fee),
      financed: toNum(sum.financed_amount ?? k.financed_amount),
      paid: toNum(sum.total_paid),
      outstanding: Math.max(0, toNum(sum.total_remaining)),
      rows,
      closed: k.status === 'COMPLETED' || rows.every((r) => r.status === 'paid' || r.status === 'paid_late'),
      // TV / appliance EMIs: what's financed vs the phone that gets locked (lock_device).
      product: {
        type: k.product_type || 'PHONE',
        name: [k.product_brand, k.product_model].filter(Boolean).join(' ') || null,
        serial: k.product_serial_number || null,
      },
      lockPhone: k.lock_device ? { id: String(k.lock_device), imei: k.lock_device_imei || '' } : null,
    };
  },

  /** POST /emi-contracts/:id/swap-lock-device/ {imei} — change the phone that secures this EMI. */
  async swapLockPhone(contractId, imei) {
    const r = await http.post(`/emi-contracts/${contractId}/swap-lock-device/`, { imei });
    invalidateCustomers();
    return r;
  },

  /** POST /emi-installments/:id/record-payment/ */
  async recordPayment(installmentId, { amount, mode, reference, notes }) {
    const res = await http.post(`/emi-installments/${installmentId}/record-payment/`, {
      amount, payment_mode: mode, transaction_ref: reference || '', notes: notes || '',
    });
    invalidateCustomers();
    return res;
  },

  /** Lock or unlock one customer's device (device command if enrolled, otherwise the EMI contract). */
  async setLocked(customerId, locked, reason = '') {
    const c = await findCustomer(customerId);
    const verb = locked ? 'lock' : 'unlock';
    if (c.device) await http.post(`/devices/${c.device.id}/${verb}/`, { reason });
    else if (c.contract) await http.post(`/emi-contracts/${c.contract.id}/${verb}/`, { reason });
    else throw new ApiError('This customer has no device or EMI to lock.', 422);
    invalidateCustomers();
  },

  /* ---------------- Overdue (A-22) ---------------- */

  async overdue({ bucket = 'all', q = '', page = 1 } = {}) {
    const [s, d] = await Promise.all([snapshot(), http.get('/emi-overdue/')]);
    const customerOfContract = new Map(s.contracts.map((k) => [k.id, String(k.customer)]));
    // One row per customer: oldest overdue installment, total overdue amount.
    const byCustomer = new Map();
    (d?.overdue_customers ?? []).forEach((o) => {
      const id = customerOfContract.get(o.contract_id) ?? `k${o.contract_id}`;
      const row = byCustomer.get(id);
      if (!row) {
        const c = s.byId.get(id);
        byCustomer.set(id, {
          id,
          contractId: o.contract_id,
          name: c?.name || o.customer_name,
          phone: o.customer_phone ?? '',
          device: o.device_name,
          deviceId: c?.device ? String(c.device.id) : null,
          deviceType: c?.deviceKind ?? 'android',
          deviceStatus: o.device_status === 'LOCKED' ? 'locked' : c?.device?.is_online ? 'online' : 'offline',
          retailer: o.retailer_store || o.retailer_name,
          dueDate: o.due_date,
          due: fmtDate(o.due_date, false),
          // total_due = EMI + late fee (M6); older servers only send overdue_amount.
          amount: toNum(o.total_due ?? o.overdue_amount),
          lateFee: toNum(o.late_fee),
          daysLate: toNum(o.days_overdue),
          installments: 1,
          reminders: null,
        });
      } else {
        row.amount += toNum(o.total_due ?? o.overdue_amount);
        row.lateFee += toNum(o.late_fee);
        row.installments += 1;
        if (toNum(o.days_overdue) > row.daysLate) { row.daysLate = toNum(o.days_overdue); row.due = fmtDate(o.due_date, false); }
      }
    });
    const rows = [...byCustomer.values()].sort((a, b) => b.daysLate - a.daysLate);
    const inBucket = (r, b) => (b === '1-7' ? r.daysLate <= 7 : b === '8-15' ? r.daysLate >= 8 && r.daysLate <= 15
      : b === '16-30' ? r.daysLate >= 16 && r.daysLate <= 30 : b === '30+' ? r.daysLate > 30 : true);
    const buckets = ['1-7', '8-15', '16-30', '30+'].map((b) => {
      const list = rows.filter((r) => inBucket(r, b));
      return { key: b, count: list.length, amount: list.reduce((n, r) => n + r.amount, 0) };
    });
    const filtered = rows.filter((r) => inBucket(r, bucket)).filter((r) => matches(q, r.name, r.phone, r.device, r.retailer));
    return {
      live: true,
      ...paginate(filtered, page, 20),
      buckets,
      totals: { customers: rows.length, amount: rows.reduce((n, r) => n + r.amount, 0) },
      allIds: filtered.map((r) => r.id),
    };
  },

  /** Screen reminder to each customer's device. */
  async remind(customerIds) {
    let sent = 0; let skipped = 0;
    for (const id of customerIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await customersLive.sendReminder(id);
        sent += 1;
      } catch { skipped += 1; }
    }
    if (!sent && skipped) throw new ApiError('None of these customers has an enrolled device to send a reminder to.', 422);
    return { sent, skipped };
  },

  async lockMany(customerIds, reason = '') {
    let locked = 0;
    for (const id of customerIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await customersLive.setLocked(id, true, reason);
        locked += 1;
      } catch { /* skip customers without a device */ }
    }
    return { locked, queued: 0 };
  },
};
