import { LEVELS } from '../../config/roles';
import { currentMockUser } from '../authApi';

/**
 * Mock version of the backend's "own network" filter.
 * The real API must do this server-side — never rely on the UI to hide other networks.
 */
export function inMyNetwork(network) {
  const user = currentMockUser();
  if (!user || user.level === LEVELS.COMPANY) return true;
  const key = {
    [LEVELS.SUPER_DISTRIBUTOR]: 'superDistributorId',
    [LEVELS.DISTRIBUTOR]: 'distributorId',
    [LEVELS.SUB_DISTRIBUTOR]: 'subDistributorId',
  }[user.level];
  return network?.[key] === user.org?.id;
}

export function paginate(list, page = 1, pageSize = 8) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  return { items: list.slice((p - 1) * pageSize, p * pageSize), total, page: p, pages, pageSize };
}

export const matches = (q, ...fields) => {
  if (!q) return true;
  const needle = q.trim().toLowerCase().replace(/\s+/g, '');
  return fields.some((f) => String(f ?? '').toLowerCase().replace(/\s+/g, '').includes(needle));
};

/** "Today" for the mock data, so dates line up with the designs (27 Sep 2026). */
export const MOCK_TODAY = new Date(2026, 8, 27);
