import { cx } from '../../utils/format';

export function Card({ as: Tag = 'section', flush, pad, className, children, ...rest }) {
  return <Tag className={cx('card', flush && 'card-flush', pad && 'card-pad', className)} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="card-head">
      <div className="card-title">
        <h2 className="h2">{title}</h2>
        {subtitle && <span className="sub">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}
