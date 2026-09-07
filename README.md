# InnKeep Express — Frontend

Vite + React 19 + TypeScript UI for **InnKeep Express**, a lightweight hotel reservation and room management system. Group coursework. Frontend half of `innkeep-express-rjb`; the Express API lives on the `hotel-api` branch.

Tailwind v4 for styling, `react-router-dom` for routing, `useReducer` contexts for data.

## The three features from the spec

| # | Feature | Screen |
|---|---|---|
| 1 | **Room catalog & availability search** | `/` — rooms grouped by type, dates and guest count filter to what is actually free |
| 2 | **Reservation & booking** | `/booking/checkout` for guests, the walk-in form on `/admin/reservations` for the desk |
| 3 | **Check-in, check-out & incidental billing** | `/admin/reservations/:code` — the folio, where charges are posted and the bill is settled |

---

## Running it

The API has to be up first — the UI has no data of its own.

```bash
# in hotel-api/
npm run dev          # http://localhost:3000

# here
npm install
npm run dev          # http://localhost:5173
```

The port is fixed with `strictPort`. If 5173 is taken, Vite fails loudly instead of sliding to 5174 — the API's `APP_URL` names 5173 as where Xendit returns a guest after paying, so a silent port change would send them to a dead address.

`API_BASE` is `http://localhost:3000/api`, declared at the top of each file in `src/api/`.

### Scripts

| | |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` then `vite build` |
| `npm run preview` | serve the build |
| `npm run lint` | eslint |

---

## Routes

### Guest

| Path | What |
|---|---|
| `/` | room catalog and availability search |
| `/booking/checkout` | review and pay |
| `/booking/:confirmationCode` | confirmation, live bill, cancel |
| `/find-booking` | look a booking up by its code |

### Front desk

| Path | What |
|---|---|
| `/admin` | today's arrivals, departures, occupancy |
| `/admin/rooms` | room inventory |
| `/admin/reservations` | every booking |
| `/admin/reservations/:code` | the folio — charges, payments, check-in/out, move, cancel |

`/admin` is **not** guarded. Staff auth is not built.

---

## Layout

```
src/
  api/         one service per resource; each throws on a bad response
  components/  flat, no subfolders
  context/     one reducer context per resource
  pages/       one file per route
  types.ts     Room, Reservation, Charge, Payment
  money.ts     peso formatting, centavo arithmetic
  dates.ts     YYYY-MM-DD handling, nights between two dates
  pricing.ts   rate × nights + VAT
  search.ts    the availability query as URL params
```

Services throw and callers use try/catch. Contexts follow one shape: `State`, `Action`, a reducer with `FETCH_START` / `FETCH_SUCCESS` / `FETCH_ERROR`, then `createContext` and a provider.

---

## Two things to know

**Money is a string.** Peso amounts arrive as `"8900.00"` and stay strings. Never `Number()` one — float error in currency produces bills off by a centavo. Format with `formatPeso`, and do arithmetic in integer centavos via `toCentavos`.

**The availability search lives in the URL.** `InfoBar` pushes dates and guest count into the query string rather than into React state, so a search is shareable, survives a reload, and the back button walks through previous searches. `search.ts` parses it.

---

## Repository layout

This repo holds two unrelated codebases on two branches:

| Branch | Folder | What |
|---|---|---|
| `main-frontend` | `hotel-frontend/` | this |
| `hotel-api` | `hotel-api/` | the Express API |

They share no files. **Never merge one into the other** — git will mash both trees together without a single conflict to warn you. `git worktree` keeps each folder pinned to its branch.
