import { http, mockDelay, tokenStore, isLive, ApiError } from './http';
import { MOCK_USERS } from './mock/users';
import { LEVELS, STAFF_ROLES } from '../config/roles';
import { initials } from '../utils/format';

const LIVE = isLive('auth');
const MOCK_SESSION_KEY = 'plp.mockUser';
const USER_KEY = 'plp.user';

/** Mock mode only: the signed-in demo user, so mock APIs can scope data like the backend will. */
export function currentMockUser() {
  return MOCK_USERS.find((u) => u.id === localStorage.getItem(MOCK_SESSION_KEY)) ?? null;
}

// Backend role → panel level. Retailers and customers use the mobile apps, not this panel.
const ROLE_TO_LEVEL = {
  SUPER_ADMIN: LEVELS.COMPANY,
  SUPER_DISTRIBUTOR: LEVELS.SUPER_DISTRIBUTOR,
  DISTRIBUTOR: LEVELS.DISTRIBUTOR,
  SUB_DISTRIBUTOR: LEVELS.SUB_DISTRIBUTOR,
  // Prime Locker's own staff (A-34) sign in to the company panel with a narrower role.
  STAFF_OPERATIONS: LEVELS.COMPANY,
  STAFF_COLLECTIONS: LEVELS.COMPANY,
  STAFF_SUPPORT: LEVELS.COMPANY,
  STAFF_VIEWER: LEVELS.COMPANY,
};
const STAFF_ROLE_OF = {
  SUPER_ADMIN: STAFF_ROLES.SUPER_ADMIN,
  STAFF_OPERATIONS: STAFF_ROLES.OPERATIONS,
  STAFF_COLLECTIONS: STAFF_ROLES.COLLECTIONS,
  STAFF_SUPPORT: STAFF_ROLES.SUPPORT,
  STAFF_VIEWER: STAFF_ROLES.VIEWER,
};

// While some screens still run on mock data, they read the matching demo account so they keep working.
// TODO(api): remove once every module is live.
const MOCK_STAND_IN = {
  SUPER_ADMIN: 'u1',
  SUPER_DISTRIBUTOR: 'u5',
  DISTRIBUTOR: 'u6',
  SUB_DISTRIBUTOR: 'u7',
  STAFF_OPERATIONS: 'u1',
  STAFF_COLLECTIONS: 'u1',
  STAFF_SUPPORT: 'u1',
  STAFF_VIEWER: 'u1',
};

/** Live mode: the signed-in user saved at login (null in mock mode). */
export function sessionUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** GET /auth/me/ (or login user + dashboard profile) → the user object the panel uses. */
export function toPanelUser(u, profile) {
  const level = ROLE_TO_LEVEL[u.role];
  const name = u.name || profile?.name || u.username;
  const isCompany = level === LEVELS.COMPANY;
  const perms = u.permissions;
  return {
    id: String(u.id),
    backendId: u.id,
    role: u.role,
    username: u.username,
    name,
    initials: initials(name) || 'PL',
    email: u.email ?? '',
    mobile: u.mobile_number ?? '',
    level,
    staffRole: isCompany ? STAFF_ROLE_OF[u.role] ?? STAFF_ROLES.VIEWER : undefined,
    org: {
      id: String(u.id),
      name: isCompany ? 'Prime Locker' : u.business_name || profile?.business_name || name,
      parentName: u.parent?.business_name || u.parent?.name || profile?.parent_name,
      parentId: u.parent?.id ?? null,
    },
    availableKeys: u.available_keys ?? null,
    childrenCounts: u.children_counts ?? null,
    flags: isCompany ? undefined : {
      addPartners: perms?.can_add_partners ?? true,
      seeDevices: perms?.can_see_devices ?? true,
      seePhones: perms?.can_see_customer_phones ?? false,
    },
  };
}

function saveSession(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const standIn = MOCK_STAND_IN[user.role];
  if (standIn) localStorage.setItem(MOCK_SESSION_KEY, standIn);
}

function clearSession() {
  tokenStore.clear();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(MOCK_SESSION_KEY);
}

export const authApi = {
  /** POST /auth/login/ { username, password, keep_me_signed_in } → { access, refresh, user } */
  async login({ identifier, password, remember = true }) {
    if (!LIVE) {
      const id = identifier.trim().toLowerCase();
      const user = MOCK_USERS.find((u) => u.email === id || u.mobile.replace(/\s/g, '') === id.replace(/\s/g, ''));
      if (!user || password !== 'primelocker') {
        await mockDelay(null, 400);
        throw new ApiError('That email or password doesn’t match an account. Check both and try again.', 401);
      }
      tokenStore.set('mock-token');
      localStorage.setItem(MOCK_SESSION_KEY, user.id);
      return mockDelay({ token: 'mock-token', user });
    }

    let data;
    try {
      // The backend accepts username, email or mobile number in "username".
      data = await http.post('/auth/login/', { username: identifier.trim(), password, keep_me_signed_in: remember }, { auth: false });
    } catch (e) {
      if (e.status === 401) throw new ApiError('That username, email or password doesn’t match an account. Check both and try again.', 401);
      throw e;
    }

    if (!ROLE_TO_LEVEL[data.user?.role]) {
      throw new ApiError('This account is for the Prime Locker mobile app. Sign in on the app instead.', 403);
    }
    tokenStore.setPair({ access: data.access, refresh: data.refresh });

    // Full profile (name, business, parent, permissions) from /auth/me/.
    const meData = await http.get('/auth/me/').catch(() => null);
    const user = toPanelUser(meData ?? data.user, null);
    saveSession(user);
    return { token: data.access, user };
  },

  /** Restores the session on page load. The token is checked (and refreshed) on the first API call. */
  async me() {
    if (!LIVE) {
      if (!tokenStore.get()) return null;
      const user = MOCK_USERS.find((u) => u.id === localStorage.getItem(MOCK_SESSION_KEY));
      return mockDelay(user ?? null, 150);
    }
    if (!tokenStore.getRefresh()) return null;
    try {
      // Fresh profile from the server; a 401 that can't be refreshed signs the user out.
      const u = toPanelUser(await http.get('/auth/me/'), null);
      if (!ROLE_TO_LEVEL[u.role]) { clearSession(); return null; }
      saveSession(u);
      return u;
    } catch (e) {
      if (e.status === 401) { clearSession(); return null; }
      // Offline or server error: keep the saved user so the panel still opens.
      try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
    }
  },

  async logout() {
    // Blacklists the refresh token on the server, then drops it here.
    const refresh = tokenStore.getRefresh();
    if (LIVE && refresh) await http.post('/auth/logout/', { refresh }).catch(() => null);
    clearSession();
  },

  /** POST /auth/change-password/ { old_password, new_password, confirm_password } */
  async changePassword({ current, next, confirm }) {
    if (!LIVE) { await mockDelay(null, 400); return { ok: true }; }
    return http.post('/auth/change-password/', { old_password: current, new_password: next, confirm_password: confirm });
  },

  /** PATCH /auth/me/ — partner business profile. Multipart when a new logo is picked. */
  async updateProfile(v) {
    if (!LIVE) { await mockDelay(null, 400); return { ok: true }; }
    const fields = {
      name: v.name.trim(), business_name: v.businessName.trim(), store_phone: v.storePhone.trim(),
      address: v.address.trim(), city: v.city.trim(), state: v.state.trim(), pincode: v.pincode.trim(),
    };
    if (!v.logo) return http.patch('/auth/me/', fields);
    const body = new FormData();
    Object.entries(fields).forEach(([k, val]) => body.append(k, val));
    body.append('logo', v.logo);
    return http.patch('/auth/me/', body);
  },

  /** GET /auth/me/ — the full profile for My profile (A-42). */
  async profile() {
    if (!LIVE) return mockDelay(currentMockUser());
    return http.get('/auth/me/');
  },
};
