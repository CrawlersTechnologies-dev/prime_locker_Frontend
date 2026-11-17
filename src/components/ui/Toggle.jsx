import { cx } from '../../utils/format';

export default function Toggle({ checked, onChange, label, danger, disabled }) {
  return (
    <button
      type="button"
      className={cx('toggle', danger && 'is-danger')}
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      <span />
    </button>
  );
}
