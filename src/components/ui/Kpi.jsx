import Icon from './Icon';
import { cx } from '../../utils/format';

/** KPI tile from the dashboards. `footTone` = ok | bad | undefined. `progress` = 0–100. */
export default function Kpi({ label, value, icon, iconTone, foot, footTone, progress, dark }) {
  return (
    <div className={cx('card kpi', dark && 'kpi-dark')}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className={cx('kpi-icon', iconTone === 'bad' && 'is-bad')}><Icon name={icon} /></span>}
      </div>
      <span className="kpi-value">{value}</span>
      {progress != null ? (
        <div className="progress-row">
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="kpi-foot">{foot}</span>
        </div>
      ) : (
        foot && <span className={cx('kpi-foot', footTone && `is-${footTone}`)}>{foot}</span>
      )}
    </div>
  );
}
