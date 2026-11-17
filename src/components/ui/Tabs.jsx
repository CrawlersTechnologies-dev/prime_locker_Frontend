import { useRef } from 'react';

/** Underlined tabs. tabs: [{ value, label }]. Arrow keys move between tabs. */
export function Tabs({ tabs, value, onChange, label, idPrefix = 'tab' }) {
  const ref = useRef(null);
  const onKey = (e) => {
    const i = tabs.findIndex((t) => t.value === value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next == null) return;
    const t = tabs[(next + tabs.length) % tabs.length];
    onChange(t.value);
    ref.current?.querySelector(`#${idPrefix}-${t.value}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.value}
          id={`${idPrefix}-${t.value}`}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={t.value === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix = 'tab', value, children }) {
  return <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-${value}`}>{children}</div>;
}
