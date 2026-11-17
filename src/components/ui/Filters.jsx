import { useEffect, useState } from 'react';
import Icon from './Icon';
import { num } from '../../utils/format';

/** Toolbar row above lists: search, filter chips, dropdowns. */
export function FilterBar({ children }) {
  return <div className="filterbar">{children}</div>;
}

/** Search box that waits until typing pauses before calling onChange. */
export function SearchInput({ value, onChange, placeholder, label, delay = 300 }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  useEffect(() => {
    if (text === (value ?? '')) return undefined;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="filter-search">
      <Icon name="search" size={16} />
      <input type="search" placeholder={placeholder} aria-label={label ?? placeholder} value={text} onChange={(e) => setText(e.target.value)} />
    </label>
  );
}

/** Pill filters with counts. options: [{ value, label, count }] — count omitted for "All" in some designs. */
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && ` ${num(o.count)}`}
        </button>
      ))}
    </div>
  );
}

/** Compact dropdown styled like the "District: All" buttons. options: [{ value, label }] */
export function SelectFilter({ label, value, onChange, options, allLabel = 'All' }) {
  const current = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <label className="select-filter">
      <span aria-hidden="true">{label}: {current}</span>
      <Icon name="chevronDown" size={16} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage, noun = '' }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pager">
      <span className="sub">Showing {num(from)}–{num(to)} of {num(total)}{noun && ` ${noun}`}</span>
      <div className="pager-btns">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
