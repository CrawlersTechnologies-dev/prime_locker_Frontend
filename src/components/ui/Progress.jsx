/** Inline progress bar with a label, as used in table cells. */
export default function Progress({ value, label, labelWidth }) {
  return (
    <div className="progress-row">
      <div className="progress" role="progressbar" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div style={{ width: `${Math.max(0, Math.min(value ?? 0, 100))}%` }} />
      </div>
      <span className="progress-label" style={{ width: labelWidth }}>{label}</span>
    </div>
  );
}
