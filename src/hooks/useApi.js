import { useCallback, useEffect, useState } from 'react';

/**
 * Load data from a services/ function.
 *   const { data, loading, error, reload } = useApi(() => dashboardApi.admin(range), [range]);
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
}
