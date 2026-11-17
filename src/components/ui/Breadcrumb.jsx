import { Link } from 'react-router-dom';
import Icon from './Icon';

/** items: [{ label, to }] — the last item is the current page. */
export default function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      {items.map((it, i) => (
        i < items.length - 1
          ? <span key={i} className="crumb"><Link to={it.to}>{it.label}</Link><Icon name="chevronRight" size={14} /></span>
          : <span key={i} aria-current="page" className="crumb-current">{it.label}</span>
      ))}
    </nav>
  );
}
