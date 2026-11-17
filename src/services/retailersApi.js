import { http, mockDelay, USE_MOCK, ApiError, isLive } from './http';
import { partnersLive } from './partnersLive';

const LIVE = isLive('partners');
const CUSTOMERS_LIVE = isLive('customers');
import { customersLive } from './customersLive';
import { RETAILERS, STORE_STAFF } from './mock/retailers';
import { ORGS, orgById, ancestry } from './mock/network';
import { networkApi } from './networkApi';
import { CUSTOMERS } from './mock/customers';
import { inMyNetwork, paginate, matches } from './mock/scope';
import { currentMockUser } from './authApi';
import { can, P } from '../config/permissions';
import { LEVELS } from '../config/roles';
import { toCustomerRow } from './customersApi';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function toRow(r) {
  const s = r.stats;
  return {
    id: r.id, initials: initials(r.store), store: r.store, owner: r.owner,
    location: r.city === r.district ? r.city : `${r.city}, ${r.district}`,
    district: r.district, devices: s.devices, activeEmis: s.activeEmis, overdue: s.overdue,
    collectionRate: s.due ? Math.round((s.collected / s.due) * 100) : null, status: r.status,
  };
}

function scoped() {
  return RETAILERS.filter((r) => inMyNetwork(r.network));
}

function findOr404(id) {
  const r = scoped().find((x) => x.id === id);
  if (!r) throw new ApiError('Retailer not found', 404);
  return r;
}

export const retailersApi = {
  /**
   * GET /retailers?q=&status=&district=&page=
   * → { items, total, page, pages, pageSize, counts: { all, active, pending, suspended }, districts }
   */
  async list({ q = '', status = 'all', district = '', page = 1 } = {}) {
    if (LIVE) return partnersLive.retailers({ q, status, district, page });
    if (!USE_MOCK) return http.get('/retailers', { params: { q, status, district, page } });
    const mine = scoped();
    const searched = mine.filter((r) => matches(q, r.store, r.owner, r.city, r.district));
    const counts = {
      all: searched.length,
      active: searched.filter((r) => r.status === 'active').length,
      pending: searched.filter((r) => r.status === 'pending').length,
      suspended: searched.filter((r) => r.status === 'suspended').length,
    };
    const filtered = searched
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !district || r.district === district);
    return mockDelay({
      ...paginate(filtered.map(toRow), page),
      counts,
      totals: { stores: mine.length, pending: mine.filter((r) => r.status === 'pending').length },
      districts: [...new Set(mine.map((r) => r.district))].sort(),
    });
  },

  /** GET /retailers/:id */
  async get(id) {
    if (LIVE) return partnersLive.retailer(id);
    if (!USE_MOCK) return http.get(`/retailers/${id}`);
    const r = findOr404(id);
    const customers = CUSTOMERS.filter((c) => c.retailerId === id);
    const recentDevices = customers.filter((c) => c.device).slice(0, 5).map((c) => ({
      id: c.device.id, customerId: c.id, customer: c.name, device: c.device.name, ref: c.device.ref,
      enrolled: c.since, emiStatus: c.status === 'overdue' ? 'overdue' : c.status === 'completed' ? 'completed' : 'active',
      deviceStatus: c.device.status,
    }));
    return mockDelay({ ...r, initials: initials(r.store), recentDevices });
  },

  /** GET /retailers/:id/customers */
  async customers(id) {
    if (CUSTOMERS_LIVE) return customersLive.forRetailer(id);
    if (LIVE) return [];
    if (!USE_MOCK) return http.get(`/retailers/${id}/customers`);
    findOr404(id);
    return mockDelay(CUSTOMERS.filter((c) => c.retailerId === id).map(toCustomerRow));
  },

  /** GET /retailers/:id/staff */
  async staff(id) {
    if (LIVE) {
      const r = await partnersLive.retailer(id);
      return [{ id: 'own', name: r.owner || r.email, role: 'Owner', mobile: r.ownerMobile || '—', lastActive: '—' }];
    }
    if (!USE_MOCK) return http.get(`/retailers/${id}/staff`);
    const r = findOr404(id);
    return mockDelay(STORE_STAFF[id] ?? [{ id: 'own', name: r.owner, role: 'Owner', mobile: r.ownerMobile, lastActive: '—' }]);
  },

  /** Active retailers for pickers (e.g. "Assign to retailer"). GET /retailers/options */
  async options() {
    if (LIVE) return partnersLive.retailerOptions();
    if (!USE_MOCK) return http.get('/retailers/options');
    return mockDelay(scoped().filter((r) => r.status === 'active')
      .map((r) => ({ id: r.id, label: `${r.store}, ${r.city}` })), 150);
  },

  /** Sub distributors a new retailer can sit under. GET /partners/options?level=sub_distributor */
  async parentOptions() {
    return networkApi.subDistributorOptions();
  },

  /**
   * POST /retailers  (or PUT /retailers/:id when editing)
   * Stores added by someone who can't approve start as "pending" (A-05: a super admin approves).
   */
  async save(payload, id) {
    if (LIVE) return partnersLive.saveRetailer(payload, id);
    if (!USE_MOCK) return id ? http.put(`/retailers/${id}`, payload) : http.post('/retailers', payload);
    if (id) {
      const r = findOr404(id);
      Object.assign(r, payload);
      return mockDelay({ ...r });
    }
    const user = currentMockUser();
    const parentId = user.level === LEVELS.SUB_DISTRIBUTOR ? user.org.id : payload.subDistributorId;
    // Build the retailer's network chain from the partner tree.
    const chain = ancestry(parentId);
    const at = (lvl) => chain.find((o) => o.level === lvl);
    const network = {
      superDistributorId: at('super_distributor')?.id, distributorId: at('distributor')?.id,
      subDistributorId: parentId, subDistributorName: orgById(parentId)?.name,
    };
    const r = {
      ...payload,
      id: `r${Date.now()}`,
      status: can(user, P.RETAILERS_APPROVE) ? 'active' : 'pending',
      since: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      network,
      stats: { devices: 0, lockedNow: 0, activeEmis: 0, fullyPaid: 0, overdue: 0, overdueAmount: 0, collected: 0, due: 0 },
    };
    RETAILERS.unshift(r);
    // …and into the partner tree, so it shows on the network screens and can receive keys.
    ORGS.push({
      id: r.id, level: 'retailer', name: r.store, owner: r.owner, mobile: r.ownerMobile, city: r.city, parentId,
      received: 0, sent: 0, balance: 0, usedPerMonth: 0, status: r.status, collection: null, overdue: 0, since: r.since,
      flags: {}, retailerRef: r,
    });
    return mockDelay({ ...r });
  },

  /** POST /retailers/:id/status { status: active | suspended, reason } — also used to approve. */
  async setStatus(id, status, reason) {
    if (LIVE) return partnersLive.setStatus(id, status, reason);
    if (!USE_MOCK) return http.post(`/retailers/${id}/status`, { status, reason });
    const r = findOr404(id);
    r.status = status;
    const o = orgById(id);
    if (o) o.status = status;
    return mockDelay({ id, status });
  },

  /** GET /retailers/export?… — every matching row, not just the current page */
  async exportRows(filters) {
    if (!USE_MOCK && !LIVE) return http.get('/retailers/export', { params: filters });
    const all = [];
    let page = 1; let pages = 1;
    do {
      // eslint-disable-next-line no-await-in-loop
      const res = await retailersApi.list({ ...filters, page });
      all.push(...res.items); pages = res.pages; page += 1;
    } while (page <= pages);
    return all;
  },
};