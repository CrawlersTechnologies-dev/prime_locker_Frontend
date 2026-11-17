import { LEVELS, STAFF_ROLES } from '../../config/roles';

/** Demo accounts — one per level and staff role. Password for all: primelocker */
export const MOCK_USERS = [
  { id: 'u1', name: 'Sarojini N.', initials: 'SN', email: 'admin@primelocker.in', mobile: '+91 98860 31277',
    level: LEVELS.COMPANY, staffRole: STAFF_ROLES.SUPER_ADMIN, org: { id: 'pl', name: 'Prime Locker' } },
  { id: 'u2', name: 'Arjun Rao', initials: 'AR', email: 'ops@primelocker.in', mobile: '+91 98860 40011',
    level: LEVELS.COMPANY, staffRole: STAFF_ROLES.OPERATIONS, org: { id: 'pl', name: 'Prime Locker' } },
  { id: 'u3', name: 'Nandini K.', initials: 'NK', email: 'collections@primelocker.in', mobile: '+91 98860 40022',
    level: LEVELS.COMPANY, staffRole: STAFF_ROLES.COLLECTIONS, org: { id: 'pl', name: 'Prime Locker' } },
  { id: 'u4', name: 'Vikram S.', initials: 'VS', email: 'viewer@primelocker.in', mobile: '+91 98860 40033',
    level: LEVELS.COMPANY, staffRole: STAFF_ROLES.VIEWER, org: { id: 'pl', name: 'Prime Locker' } },
  { id: 'u5', name: 'Prakash Hegde', initials: 'PH', email: 'vijaya@partners.in', mobile: '+91 94480 11220',
    level: LEVELS.SUPER_DISTRIBUTOR, org: { id: 'sd1', name: 'Vijaya Telecom', parentName: 'Prime Locker' },
    flags: { addPartners: true, seeDevices: true, seePhones: false } },
  { id: 'u6', name: 'Shivaraj Patil', initials: 'SP', email: 'bijapur@partners.in', mobile: '+91 94481 77520',
    level: LEVELS.DISTRIBUTOR, org: { id: 'd1', name: 'Bijapur Mobile Hub', parentName: 'Vijaya Telecom' },
    flags: { addPartners: true, seeDevices: true, seePhones: false } },
  { id: 'u7', name: 'Basavaraj Nadagouda', initials: 'BN', email: 'talikota@partners.in', mobile: '+91 94482 30090',
    level: LEVELS.SUB_DISTRIBUTOR, org: { id: 's1', name: 'Talikota Traders', parentName: 'Bijapur Mobile Hub' },
    flags: { addPartners: true, seeDevices: true, seePhones: false } },
];