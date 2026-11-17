import { LEVELS, STAFF_ROLES } from './roles';

/**
 * Every permission the panel checks. Pages, buttons and nav items refer to these keys,
 * never to role names, so the rules can change here without touching screens.
 *
 * Value per role:
 *   true   → allowed everywhere
 *   'own'  → allowed only inside their own network (the API must filter by network too)
 *   false  → not allowed
 */
export const P = {
  // Keys
  KEYS_GENERATE: 'keys.generate',
  KEYS_SEND: 'keys.send',
  KEYS_REQUEST: 'keys.request',
  KEYS_APPROVE: 'keys.approve',
  KEYS_HISTORY: 'keys.history',
  // Network
  NETWORK_VIEW: 'network.view',
  PARTNER_ADD: 'partner.add',
  PARTNER_SUSPEND: 'partner.suspend',
  PARTNER_APPROVE: 'partner.approve',
  // Retailers & customers
  RETAILERS_VIEW: 'retailers.view',
  RETAILERS_MANAGE: 'retailers.manage',
  RETAILERS_APPROVE: 'retailers.approve',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  CUSTOMER_PHONE_VIEW: 'customers.phone',
  // Devices
  DEVICES_VIEW: 'devices.view',
  DEVICES_REGISTER: 'devices.register',
  DEVICES_CONTROL: 'devices.control', // lock, unlock, app lock, camera…
  DEVICES_OFFLINE_CODE: 'devices.offlineCode',
  DEVICES_LOCATION: 'devices.location',
  TAC_MANAGE: 'devices.tacManage', // approved phone models (RocketPay TAC list)
  // EMI & payments
  EMI_TEMPLATES: 'emi.templates',
  EMI_CREATE: 'emi.create',
  PAYMENTS_RECORD: 'payments.record',
  COLLECTIONS_VIEW: 'collections.view',
  // Engage & insights
  WHATSAPP_SEND: 'whatsapp.send',
  WHATSAPP_TEMPLATES: 'whatsapp.templates',
  BANNERS_MANAGE: 'banners.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  // System
  AUDIT_VIEW: 'audit.view',
  STAFF_MANAGE: 'staff.manage',
  SETTINGS_MANAGE: 'settings.manage',
  BUSINESS_PROFILE: 'business.profile',
};

/* ------------------------------------------------------------------
   Company staff — from A-36 "Roles & permissions".
   Network/key rows aren't on A-36; given to Super admin + Operations
   (marked ASSUMED — confirm with client).
------------------------------------------------------------------- */
const SA = true, OP = true;
const STAFF_MATRIX = {
  [P.KEYS_GENERATE]:       { super_admin: SA, operations: false, collections: false, viewer: false },
  [P.KEYS_SEND]:           { super_admin: SA, operations: OP,    collections: false, viewer: false }, // ASSUMED
  [P.KEYS_REQUEST]:        { super_admin: false, operations: false, collections: false, viewer: false },
  [P.KEYS_APPROVE]:        { super_admin: SA, operations: OP,    collections: false, viewer: false }, // ASSUMED
  [P.KEYS_HISTORY]:        { super_admin: SA, operations: OP,    collections: true,  viewer: true },  // ASSUMED
  [P.NETWORK_VIEW]:        { super_admin: SA, operations: OP,    collections: true,  viewer: true },  // ASSUMED
  [P.PARTNER_ADD]:         { super_admin: SA, operations: OP,    collections: false, viewer: false }, // ASSUMED
  [P.PARTNER_SUSPEND]:     { super_admin: SA, operations: false, collections: false, viewer: false }, // ASSUMED
  [P.PARTNER_APPROVE]:     { super_admin: SA, operations: false, collections: false, viewer: false }, // ASSUMED (same as stores, A-05)

  [P.RETAILERS_VIEW]:      { super_admin: SA, operations: OP,    collections: true,  viewer: true },
  [P.RETAILERS_MANAGE]:    { super_admin: SA, operations: OP,    collections: false, viewer: false },
  [P.RETAILERS_APPROVE]:   { super_admin: SA, operations: false, collections: false, viewer: false }, // A-05 copy
  [P.CUSTOMERS_VIEW]:      { super_admin: SA, operations: OP,    collections: true,  viewer: true },
  [P.CUSTOMERS_MANAGE]:    { super_admin: SA, operations: OP,    collections: false, viewer: false },
  [P.CUSTOMER_PHONE_VIEW]: { super_admin: SA, operations: OP,    collections: true,  viewer: true },

  [P.DEVICES_VIEW]:        { super_admin: SA, operations: OP,    collections: true,  viewer: true },
  [P.DEVICES_REGISTER]:    { super_admin: SA, operations: OP,    collections: false, viewer: false },
  [P.DEVICES_CONTROL]:     { super_admin: SA, operations: OP,    collections: true,  viewer: false },
  [P.DEVICES_OFFLINE_CODE]:{ super_admin: SA, operations: OP,    collections: true,  viewer: false },
  [P.DEVICES_LOCATION]:    { super_admin: SA, operations: OP,    collections: true,  viewer: false },

  [P.EMI_TEMPLATES]:       { super_admin: SA, operations: OP,    collections: false, viewer: false },
  [P.EMI_CREATE]:          { super_admin: SA, operations: OP,    collections: false, viewer: false },
  [P.PAYMENTS_RECORD]:     { super_admin: SA, operations: OP,    collections: true,  viewer: false },
  [P.COLLECTIONS_VIEW]:    { super_admin: SA, operations: OP,    collections: true,  viewer: true },

  [P.WHATSAPP_SEND]:       { super_admin: SA, operations: OP,    collections: true,  viewer: false },
  [P.WHATSAPP_TEMPLATES]:  { super_admin: SA, operations: false, collections: false, viewer: false },
  [P.BANNERS_MANAGE]:      { super_admin: SA, operations: true, collections: false, viewer: false }, // backend: SUPER_ADMIN + STAFF_OPERATIONS
  [P.TAC_MANAGE]:          { super_admin: SA, operations: true, collections: false, viewer: false }, // backend: SUPER_ADMIN + STAFF_OPERATIONS
  [P.REPORTS_VIEW]:        { super_admin: SA, operations: OP,    collections: true,  viewer: true },
  [P.REPORTS_EXPORT]:      { super_admin: SA, operations: OP,    collections: false, viewer: true },

  [P.AUDIT_VIEW]:          { super_admin: SA, operations: OP,    collections: false, viewer: false },
  [P.STAFF_MANAGE]:        { super_admin: SA, operations: false, collections: false, viewer: false },
  [P.SETTINGS_MANAGE]:     { super_admin: SA, operations: false, collections: false, viewer: false },
  [P.BUSINESS_PROFILE]:    { super_admin: false, operations: false, collections: false, viewer: false },
};

// Technical support (backend role STAFF_SUPPORT, not on A-36): devices and customer lookups, no money or keys.
const SUPPORT_ALLOWED = new Set([
  P.NETWORK_VIEW, P.RETAILERS_VIEW, P.CUSTOMERS_VIEW, P.CUSTOMER_PHONE_VIEW,
  P.DEVICES_VIEW, P.DEVICES_CONTROL, P.DEVICES_OFFLINE_CODE, P.DEVICES_LOCATION,
  P.COLLECTIONS_VIEW, P.REPORTS_VIEW, P.KEYS_HISTORY,
]);
Object.keys(STAFF_MATRIX).forEach((k) => { STAFF_MATRIX[k].support = SUPPORT_ALLOWED.has(k); });

/* ------------------------------------------------------------------
   Network levels — from N-13 "Who can do what (by level)".
   Columns: super distributor, distributor, sub distributor, retailer app.
   Rows not on N-13 are marked ASSUMED.
------------------------------------------------------------------- */
const o = 'own';
const LEVEL_MATRIX = {
  [P.KEYS_GENERATE]:       { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.KEYS_SEND]:           { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false },
  [P.KEYS_REQUEST]:        { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: o },
  [P.KEYS_APPROVE]:        { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false }, // follows "send"
  [P.KEYS_HISTORY]:        { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: o },
  [P.NETWORK_VIEW]:        { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false },
  [P.PARTNER_ADD]:         { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false },
  [P.PARTNER_SUSPEND]:     { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false },
  [P.PARTNER_APPROVE]:     { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },

  [P.RETAILERS_VIEW]:      { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false }, // ASSUMED
  [P.RETAILERS_MANAGE]:    { super_distributor: false, distributor: false, sub_distributor: o,     retailer: false }, // N-11 "Add retailer"
  [P.RETAILERS_APPROVE]:   { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.CUSTOMERS_VIEW]:      { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },     // ASSUMED
  [P.CUSTOMERS_MANAGE]:    { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.CUSTOMER_PHONE_VIEW]: { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },

  [P.DEVICES_VIEW]:        { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: o },
  [P.DEVICES_REGISTER]:    { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.DEVICES_CONTROL]:     { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.DEVICES_OFFLINE_CODE]:{ super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.DEVICES_LOCATION]:    { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },

  [P.EMI_TEMPLATES]:       { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.EMI_CREATE]:          { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.PAYMENTS_RECORD]:     { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.COLLECTIONS_VIEW]:    { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: o },

  [P.WHATSAPP_SEND]:       { super_distributor: false, distributor: false, sub_distributor: false, retailer: o },
  [P.WHATSAPP_TEMPLATES]:  { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.BANNERS_MANAGE]:      { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.TAC_MANAGE]:          { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.REPORTS_VIEW]:        { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: o },
  [P.REPORTS_EXPORT]:      { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false }, // ASSUMED

  [P.AUDIT_VIEW]:          { super_distributor: o,     distributor: o,     sub_distributor: o,     retailer: false },
  [P.STAFF_MANAGE]:        { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.SETTINGS_MANAGE]:     { super_distributor: false, distributor: false, sub_distributor: false, retailer: false },
  [P.BUSINESS_PROFILE]:    { super_distributor: true,  distributor: true,  sub_distributor: true,  retailer: true },
};

/** Returns true | 'own' | false. */
export function access(user, permission) {
  if (!user) return false;
  // When the backend is connected it can send the resolved list on login.
  if (user.permissions && permission in user.permissions) return user.permissions[permission];
  if (user.level === LEVELS.COMPANY) {
    return STAFF_MATRIX[permission]?.[user.staffRole ?? STAFF_ROLES.VIEWER] ?? false;
  }
  const base = LEVEL_MATRIX[permission]?.[user.level] ?? false;
  // Per-partner switches set on "Add partner" (N-03 · "This partner can"). They can only narrow
  // the defaults above — except phone numbers, which stay hidden unless switched on.
  const f = user.flags;
  if (f) {
    if (permission === P.PARTNER_ADD && f.addPartners === false) return false;
    if (permission === P.DEVICES_VIEW && f.seeDevices === false) return false;
    if (permission === P.CUSTOMER_PHONE_VIEW && f.seePhones === true) return 'own';
  }
  return base;
}

/** True when the user may do it at all (everywhere or within their own network). */
export function can(user, permission) {
  return access(user, permission) !== false;
}

export function canAll(user, permissions = []) {
  return permissions.every((p) => can(user, p));
}

export function canAny(user, permissions = []) {
  return permissions.length === 0 || permissions.some((p) => can(user, p));
}

/* The N-13 matrix, as displayed on the "Who can do what" screen. */
export const ACCESS_TABLE = [
  { group: 'Keys', rows: [
    ['Generate new keys', 'y----'],
    ['Send keys to the level directly below', 'yooo-'],
    ['Request keys from the level above', '-oooo'],
    ['Use a key to enrol a device', '----o'],
    ['See key history', 'yoooo'],
  ] },
  { group: 'Network', rows: [
    ['Add a partner one level below', 'yooo-'],
    ['Suspend a partner below', 'yooo-'],
    ['See the network tree below them', 'yooo-'],
  ] },
  { group: 'Customers & devices', rows: [
    ['Add customers and register devices', 'y---o'],
    ['See devices and their status', 'yoooo'],
    ['Lock, unlock, offline code', 'y---o'],
    ['See live location', 'y---o'],
    ['See customer phone numbers', 'y---o'],
  ] },
  { group: 'EMI & payments', rows: [
    ['Create EMI plan templates', 'y----'],
    ['Record payments', 'y---o'],
    ['See collection reports', 'yoooo'],
  ] },
  { group: 'System', rows: [
    ['Settings, integrations, lock-screen messages', 'y----'],
    ['Audit logs', 'yooo-'],
  ] },
];
/** A-36 · the company staff matrix, for the "Roles & permissions" screen. */
export const staffMatrix = () => STAFF_MATRIX;
