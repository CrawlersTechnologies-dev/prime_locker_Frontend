const nf = new Intl.NumberFormat('en-IN');

/** 1284 → "1,284" (Indian grouping: 1,23,456) */
export const num = (n) => (n == null ? '—' : nf.format(n));

/** 1225 → "₹1,225" */
export const inr = (n) => (n == null ? '—' : `₹${nf.format(n)}`);

export const pct = (n) => (n == null ? '—' : `${n}%`);

export const cx = (...classes) => classes.filter(Boolean).join(' ');

/** Compact rupees: 320000 → "₹3.2L", 14860 → "₹14,860" */
export const inrShort = (n) => {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  return inr(n);
};

/** Download rows as a CSV file. columns: [{ key, header, value?: (row) => any }] */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(',')]
    .concat(rows.map((r) => columns.map((c) => esc(c.value ? c.value(r) : r[c.key])).join(',')));
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Indian mobile: accepts "+91 98450 12345", "9845012345" … → true if 10 digits starting 6–9 */
export const isIndianMobile = (v = '') => /^(?:\+?91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));
