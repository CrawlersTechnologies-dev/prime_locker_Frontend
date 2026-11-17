import { useEffect, useId, useRef } from 'react';
import Icon from './Icon';

/**
 * Modal dialog. Focus moves into it, Esc closes, focus returns afterwards.
 * width: px · icon: optional icon name shown in a tinted circle (tone: bad | info) · flush: no body padding
 */
export default function Dialog({ open, title, subtitle, children, onClose, actions, width = 440, icon, tone = 'bad', flush, role = 'dialog', footerNote }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.querySelector('[data-autofocus], textarea, input, button:not([data-close])')?.focus();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${flush ? ' is-flush' : ''}`} role={role} aria-modal="true" aria-labelledby={id} ref={ref} style={{ width }}>
        {icon && <span className={`dialog-icon tone-${tone}`}><Icon name={icon} size={22} /></span>}
        <div className="dialog-head">
          <div className="dialog-title">
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {!icon && <button type="button" className="dialog-close" aria-label="Close" data-close onClick={onClose}><Icon name="close" /></button>}
        </div>
        <div className="dialog-body">{children}</div>
        {(actions || footerNote) && (
          <div className="dialog-actions">
            {footerNote && <span className="dialog-note">{footerNote}</span>}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}