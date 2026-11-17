import { P } from './permissions';
import { LEVELS, LEVEL_META } from './roles';

/** Admin sidebar — matches the "Component · Admin sidebar" board. */
export const ADMIN_NAV = [
  { items: [{ key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'dashboard' }] },
  { group: 'Network', items: [
    { key: 'network', label: 'Network', path: '/network', icon: 'network', perm: P.NETWORK_VIEW },
    { key: 'partners', label: 'Partners', path: '/partners', icon: 'partners', perm: P.NETWORK_VIEW },
    { key: 'keys', label: 'Enrolment keys', path: '/keys', icon: 'key', perm: P.KEYS_GENERATE },
    { key: 'requests', label: 'Key requests', path: '/key-requests', icon: 'request', perm: P.KEYS_APPROVE, countKey: 'keyRequests' },
  ] },
  { group: 'Manage', items: [
    { key: 'retailers', label: 'Retailers', path: '/retailers', icon: 'store', perm: P.RETAILERS_VIEW },
    { key: 'customers', label: 'Customers', path: '/customers', icon: 'users', perm: P.CUSTOMERS_VIEW },
    { key: 'mobiles', label: 'Mobile devices', path: '/devices', icon: 'phone', perm: P.DEVICES_VIEW, exclude: ['/devices/approved-models'] },
    { key: 'tvs', label: 'TV devices', path: '/tvs', icon: 'tv', perm: P.DEVICES_VIEW },
    { key: 'tac', label: 'Approved models', path: '/devices/approved-models', icon: 'check', perm: P.DEVICES_VIEW },
  ] },
  { group: 'Finance', items: [
    { key: 'emi', label: 'EMI plans', path: '/emi-plans', icon: 'calendar', perm: P.EMI_TEMPLATES, match: ['/emi'] },
    { key: 'payments', label: 'Payments', path: '/payments', icon: 'card', perm: P.COLLECTIONS_VIEW },
  ] },
  { group: 'Engage & insights', items: [
    { key: 'whatsapp', label: 'WhatsApp campaigns', path: '/whatsapp', icon: 'chat', perm: P.WHATSAPP_SEND },
    { key: 'offers', label: 'Offers', path: '/offers', icon: 'send', perm: P.BANNERS_MANAGE },
    { key: 'banners', label: 'App banners', path: '/banners', icon: 'image', perm: P.BANNERS_MANAGE },
    { key: 'apps', label: 'App downloads & QR', path: '/app-versions', icon: 'download', perm: P.SETTINGS_MANAGE },
    { key: 'reports', label: 'Reports', path: '/reports', icon: 'chart', perm: P.REPORTS_VIEW },
    { key: 'audit', label: 'Audit logs', path: '/audit-logs', icon: 'file', perm: P.AUDIT_VIEW },
  ] },
  { group: 'Admin', items: [
    { key: 'staff', label: 'Staff & roles', path: '/staff', icon: 'shield', perm: P.STAFF_MANAGE, match: ['/access'] },
    { key: 'settings', label: 'Settings', path: '/settings', icon: 'sliders', perm: P.SETTINGS_MANAGE },
  ] },
];

/** Partner sidebar — matches the "Component · Partner sidebar" board. Same app, scoped per level. */
export function partnerNav(level) {
  const downline = LEVEL_META[level]?.downline ?? 'My network';
  return [
    { items: [{ key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'dashboard' }] },
    { group: 'My network', items: [
      { key: 'network', label: downline, path: '/network', icon: 'network', perm: P.NETWORK_VIEW, match: ['/partners'] },
      // A sub distributor's downline already *is* their retailers, so the extra link is hidden.
      ...(level !== LEVELS.SUB_DISTRIBUTOR
        ? [{ key: 'retailers', label: 'All retailers', path: '/retailers', icon: 'store', perm: P.RETAILERS_VIEW }]
        : []),
      { key: 'devices', label: 'Devices', path: '/devices', icon: 'phone', perm: P.DEVICES_VIEW },
    ] },
    { group: 'Keys', items: [
      { key: 'keys', label: 'Key wallet', path: '/wallet', icon: 'key', perm: P.KEYS_SEND, match: ['/keys'] },
      { key: 'requests', label: 'Key requests', path: '/key-requests', icon: 'request', perm: P.KEYS_APPROVE, countKey: 'keyRequests' },
    ] },
    { group: 'Insights', items: [
      { key: 'collections', label: 'EMI collections', path: '/collections', icon: 'card', perm: P.COLLECTIONS_VIEW },
      { key: 'reports', label: 'Reports', path: '/reports', icon: 'chart', perm: P.REPORTS_VIEW },
    ] },
  ];
}

export const PARTNER_FOOTER_NAV = { key: 'profile', label: 'Business profile', path: '/business-profile', icon: 'storefront', perm: P.BUSINESS_PROFILE };
