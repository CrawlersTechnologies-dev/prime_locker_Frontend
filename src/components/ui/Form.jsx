import { useId, useRef, useState } from 'react';
import Icon from './Icon';
import { cx } from '../../utils/format';

export function FormSection({ title, subtitle, children }) {
  return (
    <section className="card form-section">
      <div className="card-title">
        <h2 className="h2">{title}</h2>
        {subtitle && <span className="sub">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

export function FormRow({ children }) {
  return <div className="form-row">{children}</div>;
}

/** Native select with the same look as text inputs. options: [{ value, label }] */
export function SelectField({ label, error, hint, options, placeholder = 'Select…', className, ...rest }) {
  const id = useId();
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="select-wrap">
        <select id={id} className={cx('input', error && 'has-error')} aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest}>
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="chevronDown" size={16} />
      </div>
      {error ? <span id={`${id}-err`} className="field-error">{error}</span>
        : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Checkbox({ label, note, error, className, ...rest }) {
  return (
    <div className={cx('check-field', className)}>
      <label className="checkbox">
        <input type="checkbox" {...rest} />
        <span>{label}{note && <span className="muted"> {note}</span>}</span>
      </label>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

/** Dashed upload tile. Shows the picked file name. */
export function UploadBox({ label, accept = 'image/*,application/pdf', file, onFile, error, wide }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className={cx('upload-wrap', wide && 'is-wide')}>
      <button
        type="button"
        className={cx('upload', file && 'has-file', drag && 'is-drag', error && 'has-error')}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      >
        <Icon name={file ? 'check' : 'upload'} />
        <span>{file ? file.name : label}</span>
        {file && <span className="upload-change">Replace</span>}
      </button>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
