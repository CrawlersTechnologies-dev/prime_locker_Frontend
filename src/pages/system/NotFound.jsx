import Button from '../../components/ui/Button';

/** A-45 · Page not found */
export default function NotFound() {
  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', textAlign: 'center' }}>
      <span className="mono" style={{ fontSize: 15, fontWeight: 500, color: 'var(--muted)' }}>404</span>
      <h1 className="h1">This page doesn’t exist</h1>
      <p className="muted" style={{ maxWidth: 440, lineHeight: '22px', fontSize: 15 }}>
        The link may be old, or the customer or device may have been removed. Check the address, or go back to the dashboard.
      </p>
      <div className="page-actions" style={{ justifyContent: 'center' }}>
        <Button to="/dashboard">Go to dashboard</Button>
        <Button variant="secondary" to="/notifications">Contact support</Button>
      </div>
    </div>
  );
}
