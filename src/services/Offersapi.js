/**
 * Offers & promotions (Super Admin).
 *   GET /offers/?target_role=   POST /offers/ (multipart for the banner)   PATCH|DELETE /offers/:id/
 *   POST /offers/:id/toggle-status/
 * Live with 'offers' in VITE_LIVE_MODULES; otherwise a small in-memory list.
 */
import { http, allPages, isLive, mockDelay, toNum } from './http';

const LIVE = isLive('offers');

export const OFFER_TYPES = [
  { value: 'KEY_BONUS', label: 'Bonus keys' },
  { value: 'DISCOUNT', label: 'Discount / fee waiver' },
  { value: 'FESTIVE_SCHEME', label: 'Festive scheme' },
  { value: 'CASHBACK', label: 'Cashback / commission' },
  { value: 'GENERAL', label: 'Announcement' },
];
export const OFFER_AUDIENCE = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'SUPER_DISTRIBUTOR', label: 'Super distributors' },
  { value: 'DISTRIBUTOR', label: 'Distributors' },
  { value: 'SUB_DISTRIBUTOR', label: 'Sub distributors' },
  { value: 'RETAILER', label: 'Retailers' },
  { value: 'CUSTOMER', label: 'Customers' },
];
export const offerTypeLabel = (v) => OFFER_TYPES.find((t) => t.value === v)?.label ?? v;
export const audienceLabel = (v) => OFFER_AUDIENCE.find((t) => t.value === v)?.label ?? v;

const MOCK = [
  { id: 1, title: 'Diwali bonus keys', description: 'Buy 100 keys, get 10 free.', target_role: 'DISTRIBUTOR', offer_type: 'KEY_BONUS', bonus_keys: 10, min_key_purchase: 100, valid_from: '2026-10-15T00:00:00Z', valid_to: '2026-11-15T23:59:00Z', is_active: true, is_currently_valid: true, created_by_name: 'Prime Locker' },
];

function toOffer(o) {
  return {
    id: String(o.id),
    title: o.title,
    description: o.description ?? '',
    banner: o.banner_image ?? null,
    audience: o.target_role,
    type: o.offer_type,
    promoCode: o.promo_code ?? '',
    discountPct: o.discount_percentage == null ? null : toNum(o.discount_percentage),
    discountAmount: o.discount_amount == null ? null : toNum(o.discount_amount),
    bonusKeys: o.bonus_keys ?? null,
    minKeys: o.min_key_purchase ?? null,
    validFrom: o.valid_from ?? null,
    validTo: o.valid_to ?? null,
    active: !!o.is_active,
    live: !!o.is_currently_valid,
    by: o.created_by_name ?? '',
  };
}

/** Panel form values → backend fields (FormData when there's a banner file). */
function toBody(v) {
  const fields = {
    title: v.title.trim(),
    description: v.description.trim(),
    target_role: v.audience,
    offer_type: v.type,
    promo_code: v.promoCode.trim(),
    discount_percentage: v.type === 'DISCOUNT' && v.discountPct !== '' ? v.discountPct : null,
    discount_amount: (v.type === 'DISCOUNT' || v.type === 'CASHBACK') && v.discountAmount !== '' ? v.discountAmount : null,
    bonus_keys: v.type === 'KEY_BONUS' && v.bonusKeys !== '' ? v.bonusKeys : null,
    min_key_purchase: v.type === 'KEY_BONUS' && v.minKeys !== '' ? v.minKeys : null,
    valid_from: v.validFrom ? new Date(`${v.validFrom}T00:00:00`).toISOString() : new Date().toISOString(),
    valid_to: v.validTo ? new Date(`${v.validTo}T23:59:59`).toISOString() : null,
    is_active: v.active,
  };
  if (!v.banner) return fields;
  const body = new FormData();
  Object.entries(fields).forEach(([k, val]) => { if (val != null) body.append(k, val); });
  body.append('banner_image', v.banner);
  return body;
}

export const offersApi = {
  async list({ audience = '' } = {}) {
    const list = LIVE
      ? await allPages('/offers/', { target_role: audience || undefined })
      : await mockDelay(MOCK.filter((o) => !audience || o.target_role === audience));
    const items = list.map(toOffer);
    return {
      live: LIVE,
      items,
      counts: { all: items.length, running: items.filter((o) => o.live).length, paused: items.filter((o) => !o.active).length },
    };
  },

  async save(v, id) {
    if (!LIVE) {
      const row = { ...toBody({ ...v, banner: null }), id: id ? Number(id) : Date.now(), is_currently_valid: v.active, created_by_name: 'You' };
      if (id) MOCK.splice(MOCK.findIndex((o) => String(o.id) === id), 1, row); else MOCK.unshift(row);
      return mockDelay({ ok: true });
    }
    const body = toBody(v);
    return id ? http.patch(`/offers/${id}/`, body) : http.post('/offers/', body);
  },

  async toggle(id) {
    if (!LIVE) { const o = MOCK.find((x) => String(x.id) === id); o.is_active = !o.is_active; o.is_currently_valid = o.is_active; return mockDelay({ ok: true }); }
    return http.post(`/offers/${id}/toggle-status/`, {});
  },

  async remove(id) {
    if (!LIVE) { MOCK.splice(MOCK.findIndex((o) => String(o.id) === id), 1); return mockDelay({ ok: true }); }
    return http.delete(`/offers/${id}/`);
  },
};
