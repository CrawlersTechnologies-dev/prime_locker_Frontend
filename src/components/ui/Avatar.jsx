import { cx } from '../../utils/format';

/** Initials avatar. shape: round (people) | square (stores). size: sm 36 | lg 56. tone: plain | brand | warn */
export default function Avatar({ text, shape = 'round', size = 'sm', tone = 'plain' }) {
  return <span className={cx('avatar-i', `is-${shape}`, `is-${size}`, `tone-${tone}`)} aria-hidden="true">{text}</span>;
}
