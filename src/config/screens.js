import { P } from './permissions';
import { LEVELS } from './roles';

/**
 * Every route in the panel, mapped to its screen code from the Prime Locker UI design.
 *
 *  path    — React Router path
 *  perm    — permission needed to open it (see config/permissions.js)
 *  screens — which design screen to show, per level. Keys:
 *            company | super_distributor | distributor | sub_distributor | partner (= any of the 3)
 *            A level with no entry cannot open the route.
 *
 * Built screens are wired in routes/pageRegistry.js. Anything not built yet renders a
 * placeholder that names the screen, so every link in the sidebar works from day one.
 */
const company = (code, title) => ({ company: { code, title } });
const partner = (code, title) => ({ partner: { code, title } });

export const SCREENS = [
  // ---------- Dashboard (different per level) ----------
  { path: '/dashboard', screens: {
    company: { code: 'A-02', title: 'Dashboard' },
    super_distributor: { code: 'N-09', title: 'Super distributor dashboard' },
    distributor: { code: 'N-10', title: 'My sub distributors' },
    sub_distributor: { code: 'N-11', title: 'Sub distributor dashboard' },
  } },

  // ---------- Network & keys ----------
  { path: '/network', perm: P.NETWORK_VIEW, screens: {
    company: { code: 'N-01', title: 'Network' },
    super_distributor: { code: 'N-09', title: 'My distributors' },
    distributor: { code: 'N-10', title: 'My sub distributors' },
    sub_distributor: { code: 'N-11', title: 'My retailers' },
  } },
  { path: '/partners', perm: P.NETWORK_VIEW, screens: company('N-02', 'Partners') },
  { path: '/partners/new', perm: P.PARTNER_ADD, screens: { company: { code: 'N-03', title: 'Add partner' }, partner: { code: 'N-03', title: 'Add partner' } } },
  { path: '/partners/:partnerId', perm: P.NETWORK_VIEW, screens: { company: { code: 'N-04', title: 'Partner detail' }, partner: { code: 'N-04', title: 'Partner detail' } } },
  { path: '/keys', perm: P.KEYS_GENERATE, screens: company('N-05', 'Enrolment keys') },
  { path: '/keys/send', perm: P.KEYS_SEND, screens: { company: { code: 'N-06', title: 'Send keys' }, partner: { code: 'N-06', title: 'Send keys' } } },
  { path: '/keys/history', perm: P.KEYS_HISTORY, screens: { company: { code: 'N-07', title: 'Key history' }, partner: { code: 'N-07', title: 'Key history' } } },
  { path: '/wallet', perm: P.KEYS_SEND, screens: partner('N-12', 'Key wallet') },
  { path: '/key-requests', perm: P.KEYS_APPROVE, screens: { company: { code: 'N-08', title: 'Key requests' }, partner: { code: 'N-08', title: 'Key requests' } } },
  { path: '/access', perm: P.STAFF_MANAGE, screens: company('N-13', 'Who can do what') },

  // ---------- Retailers & customers ----------
  { path: '/retailers', perm: P.RETAILERS_VIEW, screens: { company: { code: 'A-04', title: 'Retailers' }, partner: { code: 'A-04', title: 'All retailers' } } },
  { path: '/retailers/new', perm: P.RETAILERS_MANAGE, screens: { company: { code: 'A-05', title: 'Add retailer' }, sub_distributor: { code: 'A-05', title: 'Add retailer' } } },
  { path: '/retailers/:retailerId/edit', perm: P.RETAILERS_MANAGE, screens: { company: { code: 'A-05', title: 'Edit retailer' }, sub_distributor: { code: 'A-05', title: 'Edit retailer' } } },
  { path: '/retailers/:retailerId', perm: P.RETAILERS_VIEW, screens: { company: { code: 'A-06', title: 'Retailer detail' }, partner: { code: 'A-06', title: 'Retailer detail' } } },
  { path: '/customers', perm: P.CUSTOMERS_VIEW, screens: company('A-07', 'Customers') },
  { path: '/customers/new', perm: P.CUSTOMERS_MANAGE, screens: company('A-08', 'Add customer') },
  { path: '/customers/:customerId', perm: P.CUSTOMERS_VIEW, screens: company('A-09', 'Customer detail') },

  // ---------- Devices ----------
  { path: '/devices', perm: P.DEVICES_VIEW, screens: { company: { code: 'A-10', title: 'Mobile devices' }, partner: { code: 'A-10', title: 'Devices' } } },
  { path: '/devices/register', perm: P.DEVICES_REGISTER, screens: company('A-11', 'Register device') },
  { path: '/devices/status', perm: P.DEVICES_VIEW, screens: company('A-16', 'Device status board') },
  { path: '/devices/approved-models', perm: P.DEVICES_VIEW, screens: company('TAC', 'Approved phone models') },
  { path: '/devices/:deviceId', perm: P.DEVICES_VIEW, screens: { company: { code: 'A-03', title: 'Device detail' }, partner: { code: 'A-03', title: 'Device detail' } } },
  { path: '/devices/:deviceId/apps', perm: P.DEVICES_CONTROL, screens: company('A-12', 'Manage apps') },
  { path: '/devices/:deviceId/lock', perm: P.DEVICES_CONTROL, screens: company('A-13', 'Lock device') },
  { path: '/devices/:deviceId/offline-code', perm: P.DEVICES_OFFLINE_CODE, screens: company('A-14', 'Offline unlock code') },
  { path: '/devices/:deviceId/location', perm: P.DEVICES_LOCATION, screens: company('A-15', 'Location history') },
  { path: '/tvs', perm: P.DEVICES_VIEW, screens: company('A-17', 'TV devices') },
  { path: '/tvs/:tvId', perm: P.DEVICES_VIEW, screens: { company: { code: 'A-18', title: 'TV detail' }, partner: { code: 'A-18', title: 'TV detail' } } },

  // ---------- EMI & payments ----------
  { path: '/emi-plans', perm: P.EMI_TEMPLATES, screens: company('A-19', 'EMI plans') },
  { path: '/emi/new', perm: P.EMI_CREATE, screens: company('A-20', 'Set up EMI') },
  { path: '/emi/overdue', perm: P.COLLECTIONS_VIEW, screens: company('A-22', 'Overdue EMIs') },
  { path: '/emi/:emiId', perm: P.COLLECTIONS_VIEW, screens: company('A-21', 'EMI schedule') },
  { path: '/payments', perm: P.COLLECTIONS_VIEW, screens: company('A-23', 'Payments') },
  { path: '/payments/new', perm: P.PAYMENTS_RECORD, screens: company('A-24', 'Record payment') },
  { path: '/payments/:paymentId', perm: P.COLLECTIONS_VIEW, screens: company('A-25', 'Payment receipt') },
  { path: '/collections', perm: P.COLLECTIONS_VIEW, screens: partner('A-23', 'EMI collections') },

  // ---------- Engage & insights ----------
  { path: '/whatsapp', perm: P.WHATSAPP_SEND, screens: company('—', 'WhatsApp campaigns') },
  { path: '/banners', perm: P.BANNERS_MANAGE, screens: company('A-46', 'App banners') },
  { path: '/app-versions', perm: P.SETTINGS_MANAGE, screens: company('APPS', 'App downloads & QR') },
  { path: '/offers', perm: P.BANNERS_MANAGE, screens: company('A-47', 'Offers') },
  { path: '/reports', perm: P.REPORTS_VIEW, screens: { company: { code: 'A-32', title: 'Reports' }, partner: { code: 'A-32', title: 'Reports' } } },
  { path: '/reports/retailer-performance', perm: P.REPORTS_VIEW, screens: { company: { code: 'A-33', title: 'Retailer performance' }, partner: { code: 'A-33', title: 'Retailer performance' } } },
  { path: '/audit-logs', perm: P.AUDIT_VIEW, screens: { company: { code: 'A-37', title: 'Audit logs' }, partner: { code: 'A-37', title: 'Audit logs' } } },

  // ---------- Admin ----------
  { path: '/staff', perm: P.STAFF_MANAGE, screens: company('A-34', 'Staff') },
  { path: '/staff/new', perm: P.STAFF_MANAGE, screens: company('A-35', 'Add staff') },
  { path: '/staff/roles', perm: P.STAFF_MANAGE, screens: company('A-36', 'Roles & permissions') },
  { path: '/settings', redirect: '/settings/company' },
  { path: '/settings/company', perm: P.SETTINGS_MANAGE, screens: company('A-38', 'Settings · Company') },
  { path: '/settings/integrations', perm: P.SETTINGS_MANAGE, screens: company('A-39', 'Settings · Integrations') },
  { path: '/settings/lock-screen', perm: P.SETTINGS_MANAGE, screens: company('A-40', 'Settings · Lock-screen messages') },

  // ---------- Account (everyone) ----------
  { path: '/notifications', screens: { company: { code: 'A-41', title: 'Notifications' }, partner: { code: 'A-41', title: 'Notifications' } } },
  { path: '/profile', screens: { company: { code: 'A-42', title: 'My profile & security' }, partner: { code: 'A-42', title: 'My profile & security' } } },
  { path: '/business-profile', perm: P.BUSINESS_PROFILE, screens: partner('BP', 'Business profile') },
];

/** Pick the screen for this user's level, or null when the level can't open the route. */
export function screenFor(route, level) {
  if (!route.screens) return null;
  if (route.screens[level]) return route.screens[level];
  if (level !== LEVELS.COMPANY && route.screens.partner) return route.screens.partner;
  return null;
}