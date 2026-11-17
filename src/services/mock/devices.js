/**
 * Mock device store. Each device object is the same object as `customer.device` in
 * mock/customers.js, extended with the fields the device screens need — so a lock done
 * on the device page shows up on the customer page too.
 */
import { CUSTOMERS } from './customers';

const BRANDS = { Samsung: 'Samsung', Redmi: 'Xiaomi', Mi: 'Xiaomi', Vivo: 'Vivo', Oppo: 'Oppo', Realme: 'Realme', iPhone: 'Apple', TCL: 'TCL', OnePlus: 'OnePlus', Acer: 'Acer', Vu: 'Vu', LG: 'LG' };

/** Which remote controls a TV supports depends on its platform (A-17 "Controls" column). */
export const TV_CONTROLS = ['screenLock', 'message', 'blockApps', 'audioReminder', 'resetProtection'];
const TV_SUPPORT = {
  'Google TV': TV_CONTROLS,
  'Android TV 11': TV_CONTROLS,
  Tizen: ['screenLock', 'message'],
  webOS: ['message'],
};

export const PHONE_CAPABILITIES = [
  ['screenLock', 'Screen lock & payment screen'],
  ['camera', 'Camera block'],
  ['apps', 'App lock and hide apps'],
  ['location', 'Live location'],
  ['protection', 'Uninstall & factory-reset protection'],
  ['media', 'Wallpaper, audio & messages'],
  ['offlineCode', 'Offline unlock code'],
];

export const LOCK_MESSAGES = [
  { key: 'payment_reminder', label: 'Payment reminder' },
  { key: 'due_soon', label: 'Payment due soon' },
  { key: 'final_notice', label: 'Final notice' },
  { key: 'none', label: 'No wallpaper' },
];

const BASE_APPS = [
  { pkg: 'com.whatsapp', name: 'WhatsApp', tone: 'ok' },
  { pkg: 'com.instagram.android', name: 'Instagram', tone: 'bad' },
  { pkg: 'com.google.android.youtube', name: 'YouTube', tone: 'bad' },
  { pkg: 'com.dts.freefireth', name: 'Free Fire', tone: 'warn' },
  { pkg: 'com.snapchat.android', name: 'Snapchat', tone: 'warn' },
  { pkg: 'com.phonepe.app', name: 'PhonePe', tone: 'info' },
  { pkg: 'com.android.chrome', name: 'Chrome', tone: 'mute' },
  { pkg: 'com.facebook.katana', name: 'Facebook', tone: 'info' },
  { pkg: 'in.mohalla.sharechat', name: 'ShareChat', tone: 'warn' },
  { pkg: 'com.google.android.apps.maps', name: 'Maps', tone: 'ok' },
  { pkg: 'com.android.dialer', name: 'Phone', tone: 'mute', system: true },
  { pkg: 'com.android.settings', name: 'Settings', tone: 'mute', system: true },
];

const ALERTS = {
  dv9: { kind: 'sim_changed', label: 'SIM changed', title: 'SIM card changed', at: '26 min ago' },
  dv11: { kind: 'tamper', label: 'Tamper attempt', title: 'Tried to remove agent', at: '41 min ago' },
};

function brandOf(name) {
  const first = name.split(' ')[0];
  return BRANDS[first] ?? first;
}

let seq = 0;
function extend(customer) {
  const d = customer.device;
  if (!d || d.customerId) return d;
  const i = seq++;
  const locked = d.status === 'locked';
  if (d.status === 'offline' && /min ago|Just now/.test(d.lastSeen)) d.lastSeen = `${(i % 4) + 2} days ago`;
  Object.assign(d, {
    customerId: customer.id,
    retailerId: customer.retailerId,
    brand: brandOf(d.name),
    connection: d.status === 'offline' ? 'offline' : 'online',
    locked,
    alert: ALERTS[d.id] ?? null,
    enrolled: customer.since,
    battery: d.status === 'offline' ? null : 20 + ((i * 37) % 78),
    agentVersion: d.type === 'tv' ? '2.4.1' : '3.1.0',
    network: d.type === 'tv' ? 'Wi-Fi · Airtel Xstream' : 'Jio 4G',
    controls: {
      screenLock: locked,
      camera: d.id === 'dv1',
      protection: true,
      audioReminder: false,
      resetProtection: true,
      blockApps: d.id === 'tv3',
    },
    wallpaper: locked ? 'payment_reminder' : 'none',
    lockedAt: locked ? '13 Sep, 00:05' : null,
    lockedBy: locked ? 'auto' : null,
    apps: BASE_APPS.map((a) => ({
      ...a,
      locked: d.id === 'dv1' && ['com.whatsapp', 'com.instagram.android'].includes(a.pkg),
      hidden: d.id === 'dv1' && ['com.google.android.youtube', 'com.dts.freefireth', 'com.snapchat.android'].includes(a.pkg),
    })),
    appCount: BASE_APPS.length, // the real API returns every installed app
    supported: d.type === 'tv'
      ? (d.id === 'tv1' ? TV_CONTROLS.filter((k) => k !== 'audioReminder') : TV_SUPPORT[d.os] ?? ['message']) // Mi TV: 4 of 5, as in A-17
      : PHONE_CAPABILITIES.map(([k]) => k),
    location: d.type === 'tv' ? null : { place: customer.address?.split(',').slice(-1)[0]?.trim() || 'Talikota', area: 'Vijayapura, Karnataka', accuracy: 18, at: d.lastSeen },
    offlineCode: d.id === 'dv1' ? { code: '482915', issuedAt: '25 Sep, 10:42', used: false } : null,
    activity: [
      ...(locked ? [{ id: 'a1', tone: 'bad', text: 'Locked automatically — EMI overdue', at: '13 Sep, 00:05', by: 'System' }] : []),
      ...(d.id === 'dv1' ? [
        { id: 'a2', tone: 'info', text: 'Due-date reminder sent on WhatsApp', at: '12 Sep, 09:00', by: 'System' },
        { id: 'a3', tone: 'info', text: 'Camera blocked', at: '10 Sep, 16:22', by: 'Sarojini N.' },
      ] : []),
      ...(ALERTS[d.id] ? [{ id: 'a4', tone: 'warn', text: ALERTS[d.id].title, at: ALERTS[d.id].at, by: 'Device' }] : []),
      { id: 'a5', tone: 'ok', text: 'Device enrolled', at: customer.since, by: 'Retailer' },
    ],
  });
  return d;
}

export function allDevices() {
  return CUSTOMERS.filter((c) => c.device).map(extend);
}

/** Keeps the short status the customer screens use in line with lock + connection. */
export function syncStatus(d) {
  d.status = d.locked ? 'locked' : d.connection;
}

/** Location trail for A-15. Design values for Ravi's phone, generated for others. */
export function locationTrail(device, range) {
  const day = [
    { n: 1, place: 'Ward 3 (home)', time: '07:15', accuracy: 15, x: 0.15, y: 0.8 },
    { n: 2, place: 'Government School Road', time: '10:30', accuracy: 30, x: 0.38, y: 0.74 },
    { n: 3, place: 'Bus Stand Circle', time: '14:05', accuracy: 22, x: 0.38, y: 0.43 },
    { n: 4, place: 'APMC Yard, Talikota', time: '18:40', accuracy: 25, x: 0.55, y: 0.43 },
    { n: 5, place: 'Main Road, Talikota', time: '21:10', accuracy: 18, x: 0.7, y: 0.28 },
  ];
  const days = range === 'today' ? 1 : range === 'week' ? 7 : 30;
  const groups = Array.from({ length: Math.min(days, 7) }, (_, g) => ({
    label: g === 0 ? 'Sunday, 27 September' : `${['Saturday', 'Friday', 'Thursday', 'Wednesday', 'Tuesday', 'Monday'][g - 1]}, ${27 - g} September`,
    points: (g === 0 ? day : day.slice(0, 3 + (g % 3)).map((p) => ({ ...p, x: Math.min(0.9, p.x + g * 0.02), y: Math.max(0.1, p.y - g * 0.03) })))
      .slice().reverse(),
  }));
  return {
    groups,
    distanceKm: (6.4 * Math.min(days, 7) * (device.id === 'dv1' ? 1 : 0.7)).toFixed(1),
    flags: device.id === 'dv1' ? [{ title: 'Left usual area on 22 Sep', detail: 'Seen in Vijayapura for 5 hours, then returned' }] : [],
    intervalMinutes: 30,
  };
}