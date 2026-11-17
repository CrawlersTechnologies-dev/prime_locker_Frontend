import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List filters kept in the URL (?q=&status=&page=), so Back, refresh and shared links
 * keep the same view. Changing any filter other than `page` sends you back to page 1.
 *   const [filters, setFilters] = useQueryState({ q: '', status: 'all', page: 1 });
 */
export function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const out = {};
    Object.entries(defaults).forEach(([k, d]) => {
      const v = params.get(k);
      out[k] = v == null ? d : typeof d === 'number' ? Number(v) || d : v;
    });
    return out;
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((patch) => {
    const next = { ...state, ...patch };
    if (!('page' in patch) && 'page' in defaults) next.page = 1;
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v !== '' && v != null && v !== defaults[k]) sp.set(k, String(v));
    });
    setParams(sp, { replace: true });
  }, [state, setParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return [state, update];
}
