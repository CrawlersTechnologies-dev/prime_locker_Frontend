/** EMI plan templates (A-19). Retailers pick one when they sell a device. */
export const EMI_PLANS = [
  { id: 'p1', name: 'Standard phone', description: 'Most Android phones', months: 12, minDownPct: 20, fee: 499, graceDays: 3, deviceTypes: ['android'], status: 'active' },
  { id: 'p2', name: 'Short term', description: 'Budget phones under ₹10,000', months: 6, minDownPct: 15, fee: 299, graceDays: 3, deviceTypes: ['android'], status: 'active' },
  { id: 'p3', name: 'Festive offer', description: 'Zero processing fee till 31 Oct', months: 9, minDownPct: 15, fee: 0, graceDays: 5, deviceTypes: ['android', 'iphone'], status: 'active' },
  { id: 'p4', name: 'Smart TV', description: 'Android TV and Google TV', months: 12, minDownPct: 20, fee: 599, graceDays: 5, deviceTypes: ['tv'], status: 'active' },
  { id: 'p5', name: 'Premium phone', description: 'iPhones and phones over ₹40,000', months: 18, minDownPct: 25, fee: 999, graceDays: 3, deviceTypes: ['iphone', 'android'], status: 'active' },
  { id: 'p6', name: 'Low down payment', description: 'Pilot for repeat customers', months: 10, minDownPct: 10, fee: 499, graceDays: 2, deviceTypes: ['android'], status: 'draft' },
];

/** Which template an existing (seeded) EMI belongs to. */
export function planFor(c) {
  if (!c.emi) return null;
  if (c.emi.planId) return c.emi.planId;
  if (c.device?.type === 'tv') return 'p4';
  if (c.device?.type === 'iphone') return c.emi.months >= 12 ? 'p5' : 'p3';
  return { 6: 'p2', 9: 'p3', 12: 'p1' }[c.emi.months] ?? 'p1';
}