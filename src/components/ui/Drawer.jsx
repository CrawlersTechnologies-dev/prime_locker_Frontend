import { useEffect, useId, useRef } from 'react';
import Icon from './Icon';

/** Right-side sheet (A-24 "Record payment"). Esc closes; focus moves in and back. */
export default function Drawer({ open, title, onClose, children, footer, width = 460 }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.querySelector('[data-autofocus], input, select, textarea')?.focus();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} style={{ width }}>
        <div className="drawer-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
}