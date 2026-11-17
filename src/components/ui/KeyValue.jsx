/** Label / value rows used in "Store information" and "Profile" cards. items: [[label, value], …] */
export default function KeyValue({ items }) {
  return (
    <dl className="kv-list">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="kv-row"><dt>{k}</dt><dd>{v ?? '—'}</dd></div>
      ))}
    </dl>
  );
}
