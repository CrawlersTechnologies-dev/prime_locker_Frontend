import { useId } from 'react';
import { cx } from '../../utils/format';

/** Labelled text input with hint / error, styled per Foundations. */
export default function Field({ label, hint, error, labelAction, className, ...inputProps }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('field', className)}>
      <div className="field-label-row">
        <label htmlFor={id} className="field-label">{label}</label>
        {labelAction}
      </div>
      <input
        id={id}
        className={cx('input', error && 'has-error')}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error ? <span id={`${id}-err`} className="field-error">{error}</span>
        : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
}
