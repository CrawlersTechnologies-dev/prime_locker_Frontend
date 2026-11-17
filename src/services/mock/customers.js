/**
 * Mock customers. The first 8 rows are the ones shown on A-07; the rest are generated so
 * search, filters and paging behave like the real list.
 */
const DESIGN_ROWS = [
  { id: 'c1', name: 'Ravi Kulkarni', phone: '+91 98450 12345', altPhone: '+91 94490 22811', retailerId: 'r1', device: { id: 'dv1', type: 'android', name: 'Samsung Galaxy A15', short: 'Galaxy A15', ref: '…448210', imei: '358829103448210', os: 'Android 14', lastSeen: '4 min ago', status: 'locked' },
    emi: { price: 17999, down: 3299, amount: 1225, months: 12, paid: 5, startMonth: 3, day: 12 }, status: 'overdue', since: '14 Mar 2026', address: 'Ward 3, Talikota', idType: 'Aadhaar', idLast4: '4821', kyc: 'verified' },
  { id: 'c2', name: 'Meena Patil', phone: '+91 99001 22771', retailerId: 'r2', device: { id: 'dv3', type: 'android', name: 'Vivo T3', short: 'Vivo T3', ref: '…110934', imei: '862310045110934', os: 'Android 14', lastSeen: '1 h ago', status: 'locked' },
    emi: { price: 21999, down: 3009, amount: 1899, months: 10, paid: 4, startMonth: 4, day: 18 }, status: 'overdue', since: '18 May 2026', address: 'Near Bus Stand, Muddebihal', idType: 'Aadhaar', idLast4: '1180', kyc: 'verified' },
  { id: 'c3', name: 'Anil Jadhav', phone: '+91 97411 50912', retailerId: 'r1', device: { id: 'dv4', type: 'android', name: 'Redmi Note 13', short: 'Redmi Note 13', ref: '…662017', imei: '869001237662017', os: 'Android 14', lastSeen: 'Just now', status: 'online' },
    emi: { price: 20999, down: 2399, amount: 1550, months: 12, paid: 6, startMonth: 3, day: 2 }, status: 'due_soon', since: '2 Mar 2026', address: 'Ward 9, Talikota', idType: 'Aadhaar', idLast4: '2290', kyc: 'verified' },
  { id: 'c4', name: 'Imran Shaikh', phone: '+91 90080 44120', retailerId: 'r1', device: { id: 'dv2', type: 'iphone', name: 'iPhone 13', short: 'iPhone 13', ref: 'SN …Q7KD', imei: 'F2LQ7KD', os: 'iOS 18', lastSeen: '12 min ago', status: 'online' },
    emi: { price: 49999, down: 8599, amount: 3450, months: 12, paid: 5, startMonth: 3, day: 15 }, status: 'overdue', since: '2 Apr 2026', address: 'Station Road, Talikota', idType: 'PAN', idLast4: '612F', kyc: 'verified' },
  { id: 'c5', name: 'Pooja Angadi', phone: '+91 96860 33018', retailerId: 'r1', device: { id: 'dv6', type: 'android', name: 'Redmi Note 13', short: 'Redmi Note 13', ref: '…902214', imei: '864400902902214', os: 'Android 14', lastSeen: 'Just now', status: 'online' },
    emi: { price: 16949, down: 2999, amount: 1550, months: 9, paid: 0, startMonth: 9, day: 26 }, status: 'on_track', since: '26 Sep 2026', address: 'Ward 7, Near Bus Stand, Talikota 586214', idType: 'Aadhaar', idLast4: '7310', kyc: 'verified' },
  { id: 'c6', name: 'Lakshmi Hosamani', phone: '+91 94481 60027', retailerId: 'r3', device: { id: 'dv7', type: 'android', name: 'Oppo A79', short: 'Oppo A79', ref: '…384120', imei: '861774020384120', os: 'Android 14', lastSeen: '3 days ago', status: 'offline' },
    emi: { price: 22990, down: 3000, amount: 1999, months: 10, paid: 7, startMonth: 2, day: 8 }, status: 'on_track', since: '8 Feb 2026', address: 'Jalnagar, Vijayapura', idType: 'Aadhaar', idLast4: '5512', kyc: 'verified' },
  { id: 'c7', name: 'Kavya Hiremath', phone: '+91 99645 81230', retailerId: 'r3', device: { id: 'tv1', type: 'tv', name: 'Mi TV 43″ 4K', short: 'Mi TV 43″', ref: 'SN …88A2', imei: '30112/88A2', os: 'Android TV 11', lastSeen: '7 days ago', status: 'offline' },
    emi: { price: 17850, down: 3000, amount: 1650, months: 9, paid: 4, startMonth: 4, day: 20 }, status: 'overdue', since: '20 May 2026', address: 'Ibrahimpur, Vijayapura', idType: 'Aadhaar', idLast4: '9034', kyc: 'verified' },
  { id: 'c8', name: 'Shivanand Gouda', phone: '+91 81230 90456', retailerId: 'r4', device: { id: 'dv8', type: 'android', name: 'Samsung Galaxy M34', short: 'Galaxy M34', ref: '…207781', imei: '357702207207781', os: 'Android 14', lastSeen: '1 day ago', status: 'unlocked' },
    emi: { price: 24599, down: 3000, amount: 1800, months: 12, paid: 12, startMonth: -4, day: 5 }, status: 'completed', since: '5 Sep 2025', address: 'Gokul Road, Hubballi', idType: 'Aadhaar', idLast4: '3301', kyc: 'verified' },

  // Extra rows so the device screens (A-10, A-16, A-17, A-18) match their designs.
  { id: 'c101', name: 'Shabana Nadaf', phone: '+91 99012 66340', retailerId: 'r1', device: { id: 'dv9', type: 'android', name: 'Samsung Galaxy M15', short: 'Galaxy M15', ref: '…117406', imei: '357721096117406', os: 'Android 14', lastSeen: '26 min ago', status: 'online' },
    emi: { price: 15499, down: 1111, amount: 1199, months: 12, paid: 0, startMonth: 9, day: 21 }, status: 'on_track', since: '21 Sep 2026', address: 'Ward 5, Talikota', idType: 'Aadhaar', idLast4: '6620', kyc: 'verified' },
  { id: 'c102', name: 'Suresh Biradar', phone: '+91 88840 77211', retailerId: 'r2', device: { id: 'dv5', type: 'android', name: 'Redmi 13C', short: 'Redmi 13C', ref: '…770215', imei: '868120443770215', os: 'Android 13', lastSeen: '8 min ago', status: 'online' },
    emi: { price: 12990, down: 1299, amount: 1299, months: 9, paid: 3, startMonth: 5, day: 22 }, status: 'overdue', since: '22 May 2026', address: 'Muddebihal', idType: 'Aadhaar', idLast4: '2207', kyc: 'verified' },
  { id: 'c103', name: 'Geeta Mathapati', phone: '+91 97400 81122', retailerId: 'r4', device: { id: 'dv10', type: 'android', name: 'Realme Narzo 70', short: 'Narzo 70', ref: '…820947', imei: '866054311820947', os: 'Android 14', lastSeen: '2 min ago', status: 'online' },
    emi: { price: 18999, down: 1599, amount: 1450, months: 12, paid: 2, startMonth: 7, day: 10 }, status: 'on_track', since: '10 Jul 2026', address: 'Vidyanagar, Hubballi', idType: 'Aadhaar', idLast4: '5590', kyc: 'verified' },
  { id: 'c104', name: 'Mallikarjun P.', phone: '+91 90198 44001', retailerId: 'r1', device: { id: 'dv11', type: 'android', name: 'Samsung Galaxy A05', short: 'Galaxy A05', ref: '…590331', imei: '352211070590331', os: 'Android 14', lastSeen: '41 min ago', status: 'online' },
    emi: { price: 9999, down: 1008, amount: 999, months: 9, paid: 1, startMonth: 8, day: 14 }, status: 'on_track', since: '14 Aug 2026', address: 'Ward 2, Talikota', idType: 'Aadhaar', idLast4: '0912', kyc: 'verified' },
  { id: 'c105', name: 'Nagesh Kori', phone: '+91 94483 11902', retailerId: 'r4', device: { id: 'tv2', type: 'tv', name: 'Samsung Crystal 50″', short: 'Samsung 50″', ref: 'SN …3HBW', imei: '0CQK3HBW', os: 'Tizen', lastSeen: '1 h ago', status: 'online' },
    emi: { price: 34990, down: 4990, amount: 2500, months: 12, paid: 4, startMonth: 5, day: 28 }, status: 'on_track', since: '28 May 2026', address: 'Keshwapur, Hubballi', idType: 'Aadhaar', idLast4: '7781', kyc: 'verified' },
  { id: 'c106', name: 'Farida Bagwan', phone: '+91 99863 20145', retailerId: 'r2', device: { id: 'tv3', type: 'tv', name: 'TCL 55″ P7K', short: 'TCL 55″', ref: 'SN …9021', imei: '55P7K9021', os: 'Google TV', lastSeen: '20 min ago', status: 'locked' },
    emi: { price: 38990, down: 7190, amount: 2650, months: 12, paid: 7, startMonth: 1, day: 20 }, status: 'overdue', since: '04 Feb 2026', address: 'Station Road, Muddebihal', idType: 'Aadhaar', idLast4: '3348', kyc: 'verified' },
  { id: 'c107', name: 'Shrikant Desai', phone: '+91 81052 77430', retailerId: 'r6', device: { id: 'tv4', type: 'tv', name: 'OnePlus Y1S 43″', short: 'OnePlus 43″', ref: 'SN …2208', imei: '43Y1S2208', os: 'Android TV 11', lastSeen: '5 min ago', status: 'online' },
    emi: { price: 24999, down: 2999, amount: 2000, months: 11, paid: 5, startMonth: 4, day: 6 }, status: 'on_track', since: '06 May 2026', address: 'Gadag', idType: 'Aadhaar', idLast4: '4409', kyc: 'verified' },
  { id: 'c108', name: 'Vidya Pujari', phone: '+91 96118 50277', retailerId: 'r5', device: { id: 'tv5', type: 'tv', name: 'Acer 43″ Advanced', short: 'Acer 43″', ref: 'SN …2841', imei: 'AR43GR2841', os: 'Google TV', lastSeen: '2 h ago', status: 'online' },
    emi: { price: 22990, down: 2990, amount: 2000, months: 10, paid: 3, startMonth: 6, day: 15 }, status: 'on_track', since: '15 Jun 2026', address: 'Bagalkot', idType: 'Aadhaar', idLast4: '8812', kyc: 'verified' },
  { id: 'c109', name: 'Ramesh Talwar', phone: '+91 94812 30766', retailerId: 'r3', device: { id: 'tv6', type: 'tv', name: 'Vu GloLED 50″', short: 'Vu 50″', ref: 'SN …7712', imei: 'VU50GL7712', os: 'Google TV', lastSeen: '12 min ago', status: 'online' },
    emi: { price: 31990, down: 3990, amount: 2800, months: 10, paid: 2, startMonth: 7, day: 3 }, status: 'on_track', since: '03 Jul 2026', address: 'Vijayapura', idType: 'Aadhaar', idLast4: '1166', kyc: 'verified' },
  { id: 'c110', name: 'Anita Kulkarni', phone: '+91 98443 02281', retailerId: 'r1', device: { id: 'tv7', type: 'tv', name: 'LG 43″ UR75', short: 'LG 43″', ref: 'SN …X019', imei: '43UR75X019', os: 'webOS', lastSeen: '3 h ago', status: 'online' },
    emi: { price: 29990, down: 5990, amount: 2000, months: 12, paid: 6, startMonth: 3, day: 9 }, status: 'on_track', since: '09 Apr 2026', address: 'Talikota', idType: 'Aadhaar', idLast4: '2290', kyc: 'verified' },
];

// ---------- generated rows ----------
const FIRST = ['Ashok', 'Bhavya', 'Chetan', 'Deepa', 'Ganesh', 'Hema', 'Iqbal', 'Jyoti', 'Kiran', 'Latha', 'Manju', 'Nagesh', 'Oviya', 'Prakash', 'Rekha', 'Sangeeta', 'Tukaram', 'Uma', 'Veeresh', 'Yallappa', 'Zubeda', 'Arun', 'Bharati', 'Dinesh', 'Farida', 'Girish', 'Harish', 'Kusuma', 'Mohan', 'Nirmala'];
const LAST = ['Patil', 'Kulkarni', 'Hiremath', 'Naik', 'Mulla', 'Gouda', 'Biradar', 'Kamble', 'Badiger', 'Hosamani', 'Desai', 'Angadi', 'Nadaf', 'Bagwan', 'Joshi'];
const MODELS = [
  ['android', 'Redmi 13C', 'Redmi 13C', 9999, 999], ['android', 'Vivo Y28', 'Vivo Y28', 13999, 1299], ['android', 'Samsung Galaxy M15', 'Galaxy M15', 12999, 1199],
  ['android', 'Realme Narzo 70', 'Narzo 70', 15999, 1450], ['iphone', 'iPhone 15', 'iPhone 15', 69999, 5400], ['tv', 'TCL 55″ P7K', 'TCL 55″', 38990, 2650],
  ['android', 'Oppo A3x', 'Oppo A3x', 11999, 1150], ['tv', 'Samsung 43″ Crystal', 'Samsung 43″', 29990, 2400],
];
const RETAILER_IDS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r9', 'r10', 'r11', 'r12', 'r14', 'r8'];
const STATUSES = ['on_track', 'on_track', 'on_track', 'due_soon', 'overdue', 'on_track', 'completed', 'on_track'];
const DEVICE_STATUS = { on_track: 'online', due_soon: 'online', overdue: 'locked', completed: 'unlocked' };

const GENERATED = Array.from({ length: 34 }, (_, i) => {
  const [type, name, short, price, amount] = MODELS[i % MODELS.length];
  const status = STATUSES[i % STATUSES.length];
  const months = [6, 9, 12][i % 3];
  const paid = status === 'completed' ? months : Math.min(months - 1, (i * 3) % months);
  const imei = String(860000000000000 + (i + 1) * 7919337).slice(0, 15);
  return {
    id: `c${i + 9}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
    phone: `+91 9${String(8000 + i * 37).padStart(4, '0')} ${String(10000 + i * 913).slice(0, 5)}`,
    retailerId: RETAILER_IDS[i % RETAILER_IDS.length],
    device: {
      id: `dvg${i}`, type, name, short,
      ref: type === 'android' ? `…${imei.slice(-6)}` : `SN …${(i * 4567).toString(36).toUpperCase().slice(-4)}`,
      imei, os: type === 'tv' ? 'Google TV' : type === 'iphone' ? 'iOS 17' : 'Android 14',
      lastSeen: `${(i % 9) + 1} min ago`, status: i % 11 === 5 ? 'offline' : DEVICE_STATUS[status],
    },
    // Start the plan so the next installment falls in Sep/Oct 2026, around the mock "today".
    emi: { price, down: Math.round(price * 0.15), amount, months, paid, startMonth: status === 'completed' ? 8 - months : 9 - paid - (i % 4 === 0 ? 1 : 0), day: (i % 27) + 1 },
    status,
    generated: true,
    since: `${(i % 27) + 1} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i % 9]} 2026`,
    address: `Ward ${(i % 12) + 1}`,
    idType: 'Aadhaar', idLast4: String(1000 + i * 271).slice(-4), kyc: i % 13 === 4 ? 'pending' : 'verified',
  };
});

export const CUSTOMERS = [...DESIGN_ROWS, ...GENERATED];

export const CUSTOMER_MESSAGES = {
  c1: [
    { id: 'm1', at: '13 Sep, 09:00', channel: 'WhatsApp', text: 'Payment of ₹1,225 is overdue. Your phone will be locked after the grace period.', status: 'Read' },
    { id: 'm2', at: '12 Sep, 09:00', channel: 'WhatsApp', text: 'Your EMI of ₹1,225 is due today.', status: 'Delivered' },
    { id: 'm3', at: '9 Sep, 09:00', channel: 'WhatsApp', text: 'Reminder: EMI of ₹1,225 is due on 12 Sep.', status: 'Read' },
  ],
};