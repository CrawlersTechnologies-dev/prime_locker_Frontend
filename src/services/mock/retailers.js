/**
 * Mock retailers. `network` is the chain above the store (ids from mock/users.js orgs and
 * the N-01 tree), so partner accounts can be scoped to "own network".
 */
const NET_TALIKOTA = { superDistributorId: 'sd1', distributorId: 'd1', subDistributorId: 's1', subDistributorName: 'Talikota Traders' };
const NET_MUDDEBIHAL = { superDistributorId: 'sd1', distributorId: 'd1', subDistributorId: 's2', subDistributorName: 'Muddebihal Agency' };
const NET_VIJAYAPURA = { superDistributorId: 'sd1', distributorId: 'd1', subDistributorId: 's3', subDistributorName: 'Vijayapura City Links' };
const NET_HUBBALLI = { superDistributorId: 'sd1', distributorId: 'd3', subDistributorId: 's4', subDistributorName: 'Hubballi Mobile Links' };
const NET_GADAG = { superDistributorId: 'sd1', distributorId: 'd2', subDistributorId: 's5', subDistributorName: 'Gadag Telecom Agency' };
const NET_BELAGAVI = { superDistributorId: 'sd1', distributorId: 'd4', subDistributorId: 's6', subDistributorName: 'Belagavi Retail Links' };
const NET_BAGALKOT = { superDistributorId: 'sd2', distributorId: 'd5', subDistributorId: 's7', subDistributorName: 'Bagalkot Traders' };
const NET_HAVERI = { superDistributorId: 'sd3', distributorId: 'd6', subDistributorId: 's8', subDistributorName: 'Haveri Mobile Point' };

export const SUB_DISTRIBUTORS = [NET_TALIKOTA, NET_MUDDEBIHAL, NET_VIJAYAPURA, NET_HUBBALLI, NET_GADAG, NET_BELAGAVI, NET_BAGALKOT, NET_HAVERI]
  .map((n) => ({ id: n.subDistributorId, name: n.subDistributorName, network: n }));

const base = (r) => ({
  gstin: null, email: null, storePhone: null, idProof: null,
  allowedDevices: { android: true, iphone: true, tv: false },
  gracePeriodDays: 3, maxDevicesOnEmi: 500,
  stats: { devices: 0, lockedNow: 0, activeEmis: 0, fullyPaid: 0, overdue: 0, overdueAmount: 0, collected: 0, due: 0 },
  ...r,
});

export const RETAILERS = [
  base({ id: 'r1', store: 'Sri Mobiles', owner: 'Mahesh Patil', ownerMobile: '+91 94481 20334', address: 'Main Road', city: 'Talikota', district: 'Vijayapura', pin: '586214', gstin: '29AQJPP4821K1Z3', status: 'active', since: 'March 2026', network: NET_TALIKOTA,
    stats: { devices: 214, lockedNow: 6, activeEmis: 198, fullyPaid: 16, overdue: 9, overdueAmount: 14860, collected: 320000, due: 360000 } }),
  base({ id: 'r2', store: 'Galaxy Point', owner: 'Irfan Mulla', ownerMobile: '+91 99860 41275', address: 'Station Road', city: 'Muddebihal', district: 'Vijayapura', pin: '586212', status: 'active', since: 'March 2026', network: NET_MUDDEBIHAL, allowedDevices: { android: true, iphone: false, tv: true },
    stats: { devices: 176, lockedNow: 9, activeEmis: 160, fullyPaid: 16, overdue: 14, overdueAmount: 23400, collected: 251000, due: 299000 } }),
  base({ id: 'r3', store: 'Vijay Electronics', owner: 'Vijay Hosamani', ownerMobile: '+91 97420 11873', address: 'Gandhi Chowk', city: 'Vijayapura', district: 'Vijayapura', pin: '586101', status: 'active', since: 'April 2026', network: NET_VIJAYAPURA, allowedDevices: { android: true, iphone: true, tv: true },
    stats: { devices: 162, lockedNow: 5, activeEmis: 151, fullyPaid: 11, overdue: 11, overdueAmount: 19800, collected: 262000, due: 305000 } }),
  base({ id: 'r4', store: 'Krishna Mobile World', owner: 'Ramesh Naik', ownerMobile: '+91 98455 30092', address: 'Koppikar Road', city: 'Hubballi', district: 'Dharwad', pin: '580020', status: 'active', since: 'April 2026', network: NET_HUBBALLI,
    stats: { devices: 148, lockedNow: 3, activeEmis: 139, fullyPaid: 9, overdue: 6, overdueAmount: 9900, collected: 231000, due: 248000 } }),
  base({ id: 'r5', store: 'New Balaji Mobiles', owner: 'Santosh Kamble', ownerMobile: '+91 90363 72810', address: 'Market Road', city: 'Bagalkot', district: 'Bagalkot', pin: '587101', status: 'active', since: 'May 2026', network: NET_BAGALKOT,
    stats: { devices: 121, lockedNow: 4, activeEmis: 110, fullyPaid: 11, overdue: 8, overdueAmount: 12700, collected: 172000, due: 195000 } }),
  base({ id: 'r6', store: 'Sai Telecom', owner: 'Prakash Gouda', ownerMobile: '+91 94480 66120', address: 'Mulgund Naka', city: 'Gadag', district: 'Gadag', pin: '582101', status: 'active', since: 'May 2026', network: NET_GADAG,
    stats: { devices: 96, lockedNow: 2, activeEmis: 90, fullyPaid: 6, overdue: 4, overdueAmount: 6200, collected: 148000, due: 156000 } }),
  base({ id: 'r7', store: 'Metro Digital', owner: 'Arif Shaikh', ownerMobile: '+91 97310 55420', address: 'Shop 12, Khade Bazar', city: 'Belagavi', district: 'Belagavi', pin: '590002', storePhone: '+91 831 245 6789', status: 'pending', since: 'September 2026', network: NET_BELAGAVI }),
  base({ id: 'r8', store: 'Star Mobiles', owner: 'Nagaraj Badiger', ownerMobile: '+91 99644 28173', address: 'PB Road', city: 'Haveri', district: 'Haveri', pin: '581110', status: 'suspended', since: 'March 2026', network: NET_HAVERI,
    stats: { devices: 58, lockedNow: 7, activeEmis: 49, fullyPaid: 9, overdue: 12, overdueAmount: 18400, collected: 61000, due: 86000 } }),
  base({ id: 'r9', store: 'Basava Mobiles', owner: 'Basavaraj Hadimani', ownerMobile: '+91 96200 18833', address: 'Bus Stand Road', city: 'Talikota', district: 'Vijayapura', pin: '586214', status: 'active', since: 'June 2026', network: NET_TALIKOTA,
    stats: { devices: 30, lockedNow: 1, activeEmis: 29, fullyPaid: 1, overdue: 2, overdueAmount: 3100, collected: 46000, due: 50000 } }),
  base({ id: 'r10', store: 'Shree Cell Care', owner: 'Mallikarjun Biradar', ownerMobile: '+91 90080 77314', address: 'Vidyagiri', city: 'Bagalkot', district: 'Bagalkot', pin: '587102', status: 'active', since: 'June 2026', network: NET_BAGALKOT,
    stats: { devices: 64, lockedNow: 2, activeEmis: 60, fullyPaid: 4, overdue: 3, overdueAmount: 4500, collected: 98000, due: 108000 } }),
  base({ id: 'r11', store: 'Dharwad Digital Hub', owner: 'Sachin Kulkarni', ownerMobile: '+91 99012 44810', address: 'Subhash Road', city: 'Dharwad', district: 'Dharwad', pin: '580001', status: 'active', since: 'July 2026', network: NET_HUBBALLI,
    stats: { devices: 52, lockedNow: 1, activeEmis: 50, fullyPaid: 2, overdue: 2, overdueAmount: 2900, collected: 83000, due: 89000 } }),
  base({ id: 'r12', store: 'Mobile Mantra', owner: 'Yusuf Bagwan', ownerMobile: '+91 97418 26650', address: 'Tilakwadi', city: 'Belagavi', district: 'Belagavi', pin: '590006', status: 'active', since: 'July 2026', network: NET_BELAGAVI,
    stats: { devices: 41, lockedNow: 1, activeEmis: 40, fullyPaid: 1, overdue: 1, overdueAmount: 1600, collected: 64000, due: 67000 } }),
  base({ id: 'r13', store: 'Ganesh Telecom', owner: 'Ganesh Pattar', ownerMobile: '+91 81970 33021', address: 'Bettageri', city: 'Gadag', district: 'Gadag', pin: '582102', status: 'pending', since: 'September 2026', network: NET_GADAG }),
  base({ id: 'r14', store: 'Muddebihal Mobiles', owner: 'Shankar Ronad', ownerMobile: '+91 94486 99012', address: 'Taluk Office Road', city: 'Muddebihal', district: 'Vijayapura', pin: '586212', status: 'active', since: 'August 2026', network: NET_MUDDEBIHAL,
    stats: { devices: 22, lockedNow: 0, activeEmis: 22, fullyPaid: 0, overdue: 0, overdueAmount: 0, collected: 35000, due: 35000 } }),
];

export const STORE_STAFF = {
  r1: [
    { id: 'st1', name: 'Mahesh Patil', role: 'Owner', mobile: '+91 94481 20334', lastActive: 'Today, 10:42' },
    { id: 'st2', name: 'Kiran Patil', role: 'Sales', mobile: '+91 94481 20877', lastActive: 'Today, 09:15' },
    { id: 'st3', name: 'Sunil Hiremath', role: 'Sales', mobile: '+91 99018 33410', lastActive: 'Yesterday' },
  ],
};
