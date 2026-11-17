import { Link } from 'react-router-dom';
import Icon from './Icon';
import { cx } from '../../utils/format';

/**
 * <Button variant="primary|secondary|text|danger" size="sm|md|lg" icon="plus" to="/path">
 * Pass `to` to render a router link styled as a button.
 */
export default function Button({
  variant = 'primary', size = 'md', icon, block, to, className, children, type = 'button', ...rest
}) {
  const cls = cx(
    'btn', `btn-${variant}`,
    size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg',
    block && 'btn-block', className,
  );
  const content = <>{icon && <Icon name={icon} />}{children}</>;
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  return <button type={type} className={cls} {...rest}>{content}</button>;
}
