export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div className="page-title">
        <h1 className="h1">{title}</h1>
        {subtitle && <span className="sub" style={{ fontSize: 14 }}>{subtitle}</span>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
