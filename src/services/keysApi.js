import { http, mockDelay, USE_MOCK } from './http';

export const keysApi = {
  /** POST /key-requests/:id/approve { amount } */
  approveRequest: (id, amount) =>
    USE_MOCK ? mockDelay({ id, status: 'approved', amount }) : http.post(`/key-requests/${id}/approve`, { amount }),

  /** POST /key-requests/:id/decline */
  declineRequest: (id) =>
    USE_MOCK ? mockDelay({ id, status: 'declined' }) : http.post(`/key-requests/${id}/decline`),
};
