import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { dashboardApi } from '../../services/dashboardApi';

/** Shared state for the partner dashboards (N-09, N-10, N-11): data + which dialog is open. */
export function usePartnerDashboard() {
  const api = useApi(() => dashboardApi.partner(), []);
  const [dialog, setDialog] = useState(null); // { kind: 'send' | 'request' | 'decline', toId?, request? }
  return { ...api, dialog, setDialog, close: () => setDialog(null), done: () => { setDialog(null); api.reload(); } };
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}