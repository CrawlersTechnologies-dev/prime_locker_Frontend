# Prime Locker Pro — Web panel (React)

One web app for every level of the network, built from the **Prime Locker UI** designs.
Prime Locker staff (Super admin, Operations, Collections, Viewer) and partners
(Super distributor, Distributor, Sub distributor) sign in on the same page; the sidebar,
routes and buttons are filtered by their level and role.

Front-end only for now. Every screen reads from `src/services/`, which returns mock data
until the backend is ready.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

In mock mode the login page shows a button for each demo account (password `primelocker`),
so you can check every panel quickly.

## Folder structure

```
src/
  config/
    roles.js         Levels (company → super dist → dist → sub dist → retailer) and staff roles
    permissions.js   Permission keys + the two access matrices (A-36 staff, N-13 levels)
    screens.js       Every route → design screen code, per level
    navigation.js    Admin sidebar and partner sidebar
  context/AuthContext.jsx   Signed-in user, login/logout, can(permission)
  services/
    http.js          fetch wrapper (token, base URL, 401 handling)
    *Api.js          One file per area. Each function: mock now, real endpoint later
    mock/            Mock data copied from the designs
  routes/
    guards.jsx       RequireAuth / GuestOnly
    ScreenRoute.jsx  Permission check → pick screen for the level → render
    pageRegistry.js  Screen code → page component (add a line per built screen)
  components/
    ui/              Button, Badge, Card, Kpi, Table, Field, Toggle, Segmented, PageHeader, StateMessage, Icon
    layout/          AppShell, Sidebar, Topbar
  pages/
    auth/ admin/ partner/ shared/ system/
  styles/            tokens.css (Foundations colours/type), base, components, layout, auth
```

## How permissions work

Screens never check role names. They check a permission key:

```jsx
const { can } = useAuth();
{can(P.DEVICES_CONTROL) && <Button variant="danger">Lock device</Button>}
```

`config/permissions.js` resolves the key for the user:

- **Prime Locker staff** → `STAFF_MATRIX` (from screen A-36)
- **Partners** → `LEVEL_MATRIX` (from screen N-13). Value `'own'` means "only inside their own
  network" — the UI allows it, and **the backend must filter by network**.

When the backend is ready it can return a resolved `permissions` object on the user at login,
and that will override the local matrices without any screen changes.

Rows marked `ASSUMED` in `permissions.js` aren't covered by A-36 / N-13 and need the client's confirmation.

## Adding a screen

1. Create the page in `src/pages/...`.
2. Add one line to `src/routes/pageRegistry.js`: `'A-04': Retailers`.
3. The route, sidebar link and permission check already exist in `config/screens.js`.

Until step 2 is done the route shows a placeholder with the screen code, so all links work.

## Endpoints the screens expect so far

| Screen | Calls |
|---|---|
| A-04 | `GET /retailers?q&status&district&page` → `{ items, total, page, pages, pageSize, counts, totals, districts }`, `GET /retailers/export` |
| A-05 | `POST /retailers`, `PUT /retailers/:id`, `GET /partners/options?level=sub_distributor` |
| A-06 | `GET /retailers/:id`, `GET /retailers/:id/customers`, `GET /retailers/:id/staff`, `POST /retailers/:id/status` |
| A-07 | `GET /customers?q&status&retailerId&deviceType&page`, `GET /customers/export` |
| A-08 | `GET /retailers/options`, `POST /customers` (multipart, `draft` flag) |
| A-09 | `GET /customers/:id`, `POST /customers/:id/reminders` |

The exact response shapes are in the mock functions in `src/services/*Api.js`.
List filters live in the URL (`?status=overdue&page=2`), so Back and shared links keep the view.

## API integration (later)

1. Set `VITE_USE_MOCK=false` and `VITE_API_BASE_URL` in `.env`.
2. In each `services/*Api.js` file, the real call is already written next to the mock
   (e.g. `http.get('/dashboard/admin', { params: { range } })`). Match the paths to the backend.
3. Search for `TODO(api)` for the remaining spots.

## Build status

| Done | Screen |
|---|---|
| ✅ | A-01 Login · A-02 Admin dashboard · N-09 Super distributor dashboard · N-13 Who can do what · A-45 Not found |
| ✅ | A-04 Retailers · A-05 Add / edit retailer · A-06 Retailer detail · A-07 Customers · A-08 Add customer · A-09 Customer detail |
| ✅ | Shell, both sidebars, top bar, permissions, routing for all 60+ routes, mock API layer |
| ⏳ | Everything else (placeholder screens wired and permission-checked) |
