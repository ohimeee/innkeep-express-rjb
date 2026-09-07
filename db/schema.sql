-- Full schema for rjb_hotel. Safe to re-run: every object is created only if
-- it is missing, so this doubles as the setup script and the reference copy of
-- the data model.
--
-- Apply with:  npm run db:setup
--
-- A `-- @separate` line splits the file into chunks that each run as their own
-- transaction. See scripts/db.mjs — Postgres will not let the exclusion
-- constraint name an enum label that was added in the same transaction.

-- gen_random_uuid() lives in core Postgres from 13 onwards. Ids stay TEXT so
-- they read the same in URLs as they did before, and so the app never has to
-- generate one.

DO $$ BEGIN
  CREATE TYPE "RoomType" AS ENUM ('STANDARD', 'DELUXE', 'SUITE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 'PENDING' is a room held while the guest is on Xendit's payment page. It
-- blocks availability exactly like a confirmed stay; the webhook promotes it,
-- or the hold expires and releases it. See lib/reservations.ts.
DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM
    ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM
    ('CASH', 'CARD', 'GCASH', 'MAYA', 'GRABPAY', 'TRANSFER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Which department an incidental charge came from. The front desk posts most
-- of them, so it is the fallback rather than a separate "unknown".
DO $$ BEGIN
  CREATE TYPE "ChargeDepartment" AS ENUM
    ('FNB', 'HOUSEKEEPING', 'TRANSPORT', 'FRONT_DESK', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keeps "updatedAt" honest without every UPDATE having to remember it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- @separate

-- For a database created before PENDING existed. A no-op on a fresh one, where
-- the CREATE TYPE above already listed it. This has to stand alone: Postgres
-- rejects any use of a new enum label inside the transaction that added it,
-- and the exclusion constraint below names PENDING in its predicate.
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'CONFIRMED';

-- @separate

CREATE TABLE IF NOT EXISTS "Room" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "number"      TEXT NOT NULL UNIQUE,
  "name"        TEXT NOT NULL,
  "type"        "RoomType" NOT NULL,
  "capacity"    INTEGER NOT NULL,
  "amenities"   TEXT[] NOT NULL DEFAULT '{}',
  "description" TEXT,
  "imageUrl"    TEXT,
  "nightlyRate" DECIMAL(10,2) NOT NULL,
  "status"      "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Reservation" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "roomId"           TEXT NOT NULL REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "confirmationCode" TEXT NOT NULL,
  "guestName"        TEXT NOT NULL,
  "guestCount"       INTEGER NOT NULL,
  "checkIn"          DATE NOT NULL,
  "checkOut"         DATE NOT NULL,
  "status"           "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "totalAmount"      DECIMAL(10,2) NOT NULL,
  "taxAmount"        DECIMAL(10,2) NOT NULL,
  -- Set while the guest is at the gateway; NULL once the stay is confirmed.
  "holdExpiresAt"    TIMESTAMP(3),
  -- When the guest actually arrived and left, as opposed to the dates they
  -- booked. A late check-out is the gap between "checkOut" and "checkedOutAt",
  -- and that gap is what a late fee is argued over.
  "checkedInAt"      TIMESTAMP(3),
  "checkedOutAt"     TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT now(),

  -- A stay must end after it starts. Cheap guard, and it makes the half-open
  -- overlap check in lib/rooms.ts safe to reason about.
  CONSTRAINT "Reservation_dates_check" CHECK ("checkOut" > "checkIn")
);

-- Incidentals posted against a stay: minibar, laundry, an airport transfer.
--
-- Amounts here are treated as VAT-inclusive, unlike the room charge which has
-- VAT added on top. See IMPLEMENTATION.md, Section 13.
CREATE TABLE IF NOT EXISTS "Charge" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "reservationId" TEXT NOT NULL REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "description"   TEXT NOT NULL,
  "department"    "ChargeDepartment" NOT NULL DEFAULT 'OTHER',
  -- Who put this on the bill. Free text until staff accounts exist; it becomes
  -- a reference to that table once they do, so a disputed charge can be traced
  -- to a person rather than a pair of initials somebody typed.
  "postedBy"      TEXT,
  "amount"        DECIMAL(10,2) NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Many payments per reservation, so a deposit plus a balance needs no schema
-- change later. The gateway columns are NULL for cash taken at the front desk.
CREATE TABLE IF NOT EXISTS "Payment" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "reservationId"     TEXT NOT NULL REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount"            DECIMAL(10,2) NOT NULL,
  "method"            "PaymentMethod" NOT NULL,
  "paidAt"            TIMESTAMP(3) NOT NULL DEFAULT now(),
  "providerInvoiceId" TEXT,
  "providerEventId"   TEXT,
  -- Last four digits only, for the line the folio prints. Never the full
  -- number: the card is entered on Xendit's page and never reaches this server.
  "cardLast4"         TEXT
);

-- Bring an already-created database up to the definitions above. The CREATE
-- statements are skipped once the tables exist, so the defaults that used to
-- be the ORM's job — ids, timestamps — have to be set explicitly here, and the
-- columns added since the first version have to be added by hand. All of this
-- is idempotent, and it has to come before the indexes and constraints below,
-- which are built *on* these columns.

ALTER TABLE "Room"        ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Reservation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Charge"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Payment"     ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE "Room"        ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Reservation" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Room"        ALTER COLUMN "amenities" SET DEFAULT '{}';

-- The booking columns, for a Reservation table that predates them. They go on
-- nullable and are then filled and tightened, so this runs cleanly whether or
-- not the table holds rows. Nothing could have written a reservation before now
-- — there was no write path — so the filled values are placeholders that no
-- real booking will ever see.
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "confirmationCode" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestCount"       INTEGER;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "taxAmount"        DECIMAL(10,2);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "holdExpiresAt"    TIMESTAMP(3);

UPDATE "Reservation"
   SET "confirmationCode" = 'IKX-' || lpad((floor(random() * 10000))::int::text, 4, '0')
 WHERE "confirmationCode" IS NULL;

UPDATE "Reservation" SET "guestCount" = 1 WHERE "guestCount" IS NULL;
UPDATE "Reservation" SET "taxAmount"  = 0 WHERE "taxAmount"  IS NULL;

ALTER TABLE "Reservation" ALTER COLUMN "confirmationCode" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "guestCount"       SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "taxAmount"        SET NOT NULL;

ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- The folio columns, for tables that predate them. All nullable or defaulted,
-- so this runs cleanly whether or not the tables hold rows.
ALTER TABLE "Charge"      ADD COLUMN IF NOT EXISTS "department" "ChargeDepartment" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Charge"      ADD COLUMN IF NOT EXISTS "postedBy"     TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "checkedInAt"  TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);
ALTER TABLE "Payment"     ADD COLUMN IF NOT EXISTS "cardLast4"    TEXT;

-- A folio reads every charge on one reservation, so that is the lookup to
-- support. Ordered by time, because a bill is read in the order it was run up.
CREATE INDEX IF NOT EXISTS "Charge_reservationId_createdAt_idx"
  ON "Charge" ("reservationId", "createdAt");

-- Availability search filters by room and date range, in that order.
CREATE INDEX IF NOT EXISTS "Reservation_roomId_checkIn_checkOut_idx"
  ON "Reservation" ("roomId", "checkIn", "checkOut");

CREATE INDEX IF NOT EXISTS "Payment_reservationId_idx"
  ON "Payment" ("reservationId");

-- A guest has no account, so the code is their only way back to the booking.
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_confirmationCode_key"
  ON "Reservation" ("confirmationCode");

-- Xendit retries a failed webhook with exponential backoff, so the same event
-- will eventually arrive twice. This turns the duplicate into a no-op instead
-- of a second Payment row. Partial, because front-desk cash has no event id and
-- every such row would otherwise collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerEventId_key"
  ON "Payment" ("providerEventId") WHERE "providerEventId" IS NOT NULL;

DROP TRIGGER IF EXISTS "Room_set_updated_at" ON "Room";
CREATE TRIGGER "Room_set_updated_at" BEFORE UPDATE ON "Room"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS "Reservation_set_updated_at" ON "Reservation";
CREATE TRIGGER "Reservation_set_updated_at" BEFORE UPDATE ON "Reservation"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$ BEGIN
  ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_dates_check" CHECK ("checkOut" > "checkIn");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Double-booking, made structurally impossible.
--
-- The application already checks for an overlap before inserting, but
-- check-then-insert is not atomic: two guests booking the last room in the same
-- second both pass the check. This constraint means the database refuses the
-- second row no matter what the application does.
--
-- PENDING is in the predicate deliberately. A held room has to be unsellable —
-- if only CONFIRMED and CHECKED_IN were covered, two guests could hold the same
-- room, both pay, and the second promotion would fail *after* taking money.
--
-- '[)' is the same half-open range the availability query uses: a checkout on
-- the 11th does not collide with a check-in on the 11th.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Guarded on a catalog lookup rather than an EXCEPTION block. An EXCLUDE
-- constraint also creates an index of the same name, so a second run raises
-- duplicate_table ("relation already exists"), which WHEN duplicate_object
-- does not catch.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_no_double_booking'
  ) THEN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_double_booking"
      EXCLUDE USING gist (
        "roomId" WITH =,
        daterange("checkIn", "checkOut", '[)') WITH &&
      ) WHERE ("status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));
  END IF;
END $$;
