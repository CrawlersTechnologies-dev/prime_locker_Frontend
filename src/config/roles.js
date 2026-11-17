/**
 * Two separate ideas, kept apart on purpose:
 *
 * 1. LEVEL — where the account sits in the business network.
 *    Prime Locker (company) → Super distributor → Distributor → Sub distributor → Retailer.
 *    Keys move one level down at a time. Retailers use the mobile app, not this panel.
 *
 * 2. STAFF ROLE — only for Prime Locker's own employees (level = company).
 *    Super admin, Operations, Collections, Viewer (screens A-34 to A-36).
 */

export const LEVELS = {
  COMPANY: 'company',
  SUPER_DISTRIBUTOR: 'super_distributor',
  DISTRIBUTOR: 'distributor',
  SUB_DISTRIBUTOR: 'sub_distributor',
  RETAILER: 'retailer', // mobile app — listed here so permissions stay in one place
};

export const LEVEL_ORDER = [
  LEVELS.COMPANY,
  LEVELS.SUPER_DISTRIBUTOR,
  LEVELS.DISTRIBUTOR,
  LEVELS.SUB_DISTRIBUTOR,
  LEVELS.RETAILER,
];

export const LEVEL_META = {
  [LEVELS.COMPANY]: { label: 'Prime Locker', short: 'SA', chipBg: '#172B52', chipFg: '#FFFFFF' },
  [LEVELS.SUPER_DISTRIBUTOR]: { label: 'Super distributor', short: 'SD', chipBg: '#1F3D7A', chipFg: '#FFFFFF', downline: 'My distributors' },
  [LEVELS.DISTRIBUTOR]: { label: 'Distributor', short: 'D', chipBg: '#3D5A94', chipFg: '#FFFFFF', downline: 'My sub distributors' },
  [LEVELS.SUB_DISTRIBUTOR]: { label: 'Sub distributor', short: 'SB', chipBg: '#DCE3F2', chipFg: '#1F3D7A', downline: 'My retailers' },
  [LEVELS.RETAILER]: { label: 'Retailer', short: 'R', chipBg: '#EEF2FA', chipFg: '#1F3D7A' },
};

/** The level directly below — the only level an account can add partners to or send keys to. */
export function levelBelow(level) {
  const i = LEVEL_ORDER.indexOf(level);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}

/** The level directly above — where key requests go. */
export function levelAbove(level) {
  const i = LEVEL_ORDER.indexOf(level);
  return i > 0 ? LEVEL_ORDER[i - 1] : null;
}

export const STAFF_ROLES = {
  SUPER_ADMIN: 'super_admin',
  OPERATIONS: 'operations',
  COLLECTIONS: 'collections',
  SUPPORT: 'support',
  VIEWER: 'viewer',
};

export const STAFF_ROLE_META = {
  [STAFF_ROLES.SUPER_ADMIN]: { label: 'Super admin', description: 'Everything, including staff and settings' },
  [STAFF_ROLES.OPERATIONS]: { label: 'Operations', description: 'Retailers, customers, devices and EMIs' },
  [STAFF_ROLES.COLLECTIONS]: { label: 'Collections', description: 'Payments, reminders, lock and unlock' },
  [STAFF_ROLES.SUPPORT]: { label: 'Technical support', description: 'Devices, lock and unlock, offline codes, customers (read)' },
  [STAFF_ROLES.VIEWER]: { label: 'Viewer', description: 'Read-only access to reports' },
};

export function isPartner(level) {
  return [LEVELS.SUPER_DISTRIBUTOR, LEVELS.DISTRIBUTOR, LEVELS.SUB_DISTRIBUTOR].includes(level);
}

/** Label shown under the user's name in the top bar. */
export function roleLabel(user) {
  if (!user) return '';
  if (user.level === LEVELS.COMPANY) return STAFF_ROLE_META[user.staffRole]?.label ?? 'Staff';
  return LEVEL_META[user.level]?.label ?? '';
}
