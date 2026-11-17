import Icon from './Icon';

/** Empty / error / loading block. Explains what happened and what to do next. */
export default function StateMessage({ icon = 'file', title, children, action }) {
  return (
    <div className="state">
      <span className="state-icon"><Icon name={icon} size={22} /></span>
      <h2 className="h2">{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }) {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ width: 220, height: 30 }} />
      <div className="grid-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 118, borderRadius: 14 }} />)}
      </div>
      {Array.from({ length: rows - 2 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />)}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }) {
  return (
    <StateMessage
      icon="alert"
      title="This page didn’t load"
      action={onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>}
    >
      {error?.message ?? 'The server didn’t respond.'} Check your connection, then try again.
    </StateMessage>
  );
}
