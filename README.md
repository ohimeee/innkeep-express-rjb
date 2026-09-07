# InnKeep Express — API

Express 5 + TypeScript REST API for **InnKeep Express**, a lightweight hotel reservation and room management system. Group coursework. Backend half of `innkeep-express-rjb`; the React UI lives on the `main-frontend` branch.

PostgreSQL through `pg` with hand-written SQL — no ORM, per the course requirement.

## The three features from the spec

| # | Feature | Where it lives |
|---|---|---|
| 1 | **Room catalog & availability search** — rooms by type with capacity, amenities and rate; filter by check-in/check-out; rooms with an overlapping booking are excluded | `roomRoutes.ts`, `GET /api/rooms` |
| 2 | **Reservation & booking** — guest or front desk books a free room for a date range, price is rate × nights + VAT, status runs `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`, or `CANCELLED` / `NO_SHOW` | `reservationRoutes.ts`, `pricing.ts` |
| 3 | **Check-in, check-out & incidental billing** — staff flip status and `Room.status` together, post charges during the stay, and settle a consolidated folio at departure | `reservationRoutes.ts`, `folioRoutes.ts` |

Everything else — Xendit payments, walk-ins, room moves, no-shows, out-of-service rooms — was added on top of those three.

---

## Running it

```bash
npm install
npm run db:setup     # create tables, enums, constraints
npm run db:seed      # 8 sample rooms
npm run dev          # http://localhost:3000
```

`npm run db:setup` is safe to re-run — the schema is idempotent, so it will not destroy data that is already there. `npm run db:seed` is too; it updates the rooms it already created and never touches `Room.status`.

The database is shared, so it usually already has bookings in it. Book a room through the UI if it does not.

### Environment

Copy `.env.example` to `.env` and fill it in:

| Key | What it is |
|---|---|
| `DATABASE_URL` | Supabase connection string |
| `PORT` | `3000` |
| `XENDIT_SECRET_KEY` | from the Xendit dashboard |
| `XENDIT_CALLBACK_TOKEN` | from Xendit → Settings → Webhooks |
| `APP_URL` | `http://localhost:5173`, where Xendit returns the guest |

**`.env` is gitignored and it holds passwords.** Ask a teammate to send it in a direct message — never a group chat, never a screenshot, never a commit.

### Scripts

| | |
|---|---|
| `npm run dev` | `tsx watch src/index.ts` |
| `npm run build` | `tsc` to `dist/` |
| `npm start` | run the build |
| `npm run db:setup` | apply `db/schema.sql` |
| `npm run db:seed` | apply `db/seed.sql` |
| `npm run lint` | eslint |

`scripts/db.mjs` runs the `.sql` files through `pg` because `psql` is not on PATH on a plain Node/Windows setup.

---

## Endpoints

Everything is under `/api`. Guest routes are open — guests have no accounts, and the confirmation code is the only key to a booking.

### Rooms

| Method | Path | Purpose |
|---|---|---|
| GET | `/rooms` | catalog; `?checkIn&checkOut&guests` filters to what is free, `?all=true` includes rooms out of service |
| GET | `/rooms/:id` | one room |
| POST | `/rooms` | create |
| PUT | `/rooms/:id` | update |

### Reservations

| Method | Path | Purpose |
|---|---|---|
| GET | `/reservations` | admin list |
| GET | `/reservations/code/:code` | guest lookup by confirmation code |
| POST | `/reservations` | hold a room, returns a Xendit `invoice_url` |
| POST | `/reservations/walk-in` | book a guest standing at the desk, optionally checking them straight in |
| POST | `/reservations/:id/move` | move a guest to another room; the bill follows the room |
| POST | `/reservations/:id/cancel` | front desk cancels |
| POST | `/reservations/code/:code/cancel` | the guest cancels their own booking |
| POST | `/reservations/:id/no-show` | they never arrived; the room frees, what was paid stays |
| POST | `/reservations/:id/check-in` | |
| POST | `/reservations/:id/check-out` | refused while a balance is owed |

### Folio

| Method | Path | Purpose |
|---|---|---|
| GET | `/folio/:code` | the bill: room, VAT, charges, payments, balance |
| POST | `/folio/:id/charges` | post an incidental; only while the guest is checked in |
| POST | `/folio/:id/payments` | cash taken at the desk |
| POST | `/folio/:id/settle` | open a Xendit invoice for whatever is outstanding |

### Other

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | arrivals, departures, occupancy |
| POST | `/webhooks/xendit` | the only path to `CONFIRMED` |

---

## Payments

A booking starts `PENDING` with a 15-minute hold and a Xendit hosted-checkout URL. It becomes `CONFIRMED` **only** when Xendit calls the webhook — the browser redirect back from the payment page proves nothing, since anyone can type that URL.

`x-callback-token` is compared before a single field of the body is read.

Xendit cannot reach `localhost`, so in development the webhook needs a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Paste the printed `https://….trycloudflare.com/api/webhooks/xendit` into Xendit → Settings → Webhooks → Invoices paid. The URL changes every time the tunnel restarts.

---

## Things to know before changing anything

**Money is a string.** `pg` returns `NUMERIC` as a string and it stays one all the way to the response. `Number("8900.00")` reintroduces float error, and a bill off by a centavo is one the front desk has to explain. Arithmetic goes through integer centavos in `money.ts`.

**Two `pg` type parsers in `db.ts` do real work.** OID 1082 keeps `DATE` as a `YYYY-MM-DD` string; OID 1114 reads `TIMESTAMP` as UTC. Without them a booking shifts by a day and a check-in stamp is hours off in Manila.

**Double-booking is prevented by the database, not the code.** `db/schema.sql` has an `EXCLUDE USING gist` constraint over `(roomId, daterange(checkIn, checkOut, '[)'))` for live bookings. An overlapping insert is refused with SQLSTATE `23P01` no matter which code path attempts it — an application-level check alone is not atomic. The range is half-open, so one guest checking out on the 5th and another checking in on the 5th is allowed.

**`db/seed.sql` must never write `Room.status`.** That column is runtime state owned by check-in and check-out; seeding it invents guests.

**Every value goes into SQL as a `$1` parameter.** Nothing is interpolated into a query string.

---

## Repository layout

This repo holds two unrelated codebases on two branches:

| Branch | Folder | What |
|---|---|---|
| `hotel-api` | `hotel-api/` | this |
| `main-frontend` | `hotel-frontend/` | the React UI |

They share no files. **Never merge one into the other** — git will mash both trees together without a single conflict to warn you. `git worktree` keeps each folder pinned to its branch.

---

## Not built yet

- **Staff auth.** `/api/*` is open. Anyone who can reach the server can check a guest in.
- **Refunds are reported, not executed.** A cancelled paid booking shows a refund due; no money moves through Xendit.
- **`Charge.postedBy`** is free text typed at the desk, not an identity.
- **No automatic overstay billing.** A guest past their check-out date shows on the dashboard, and the extra night is posted by hand.
