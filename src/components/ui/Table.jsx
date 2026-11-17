import { cx } from '../../utils/format';

/**
 * Grid-based table matching the designs (header row on a tinted strip, 56px rows).
 *
 * columns: [{ key, header, width: '1.5fr', align: 'right', render: (row) => node }]
 * onRowClick: optional — makes rows clickable (keyboard accessible too).
 */
export default function Table({ columns, rows, rowKey = 'id', onRowClick, empty = 'Nothing to show yet.', minWidth = 760 }) {
  const template = columns.map((c) => c.width ?? '1fr').join(' ');
  const style = { gridTemplateColumns: template, minWidth };

  return (
    <div className="table" role="table">
      <div className="trow thead" style={style} role="row">
        {columns.map((c) => (
          <span key={c.key} role="columnheader" style={{ textAlign: c.align }}>{c.header}</span>
        ))}
      </div>
      {rows.length === 0 && <div className="table-empty">{empty}</div>}
      {rows.map((row) => (
        <div
          key={row[rowKey]}
          role="row"
          className={cx('trow tbody-row', onRowClick && 'is-link')}
          style={style}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
        >
          {columns.map((c) => (
            <div key={c.key} role="cell" style={{ textAlign: c.align, minWidth: 0 }}>
              {c.render ? c.render(row) : row[c.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
