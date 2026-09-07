import { Router, Request, Response } from 'express';
import { pool } from './db';
import { validateResource } from './validate';
import { createBookingSchema, createWalkInSchema } from './schemas';
import { nights } from './dates';
import { toCentavos, toMoney } from './money';
import { quoteStay } from './pricing';
import { createInvoice } from './payments';
import { readLedger } from './folioRoutes';

const router = Router();

// Codes are `IKX-` plus four digits — short enough to read off a phone. 10,000
// is a small space, so a collision is a matter of when; the unique index is
// what actually prevents a duplicate, and this is how many rerolls we allow.
const CODE_ATTEMPTS = 10;

const generateCode = () =>
  'IKX-' + String(Math.floor(Math.random() * 10_000)).padStart(4, '0');

// How long a room stays held while the guest is on Xendit's payment page. Long
// enough to finish a GCash payment, short enough that an abandoned checkout
// does not block a sellable room all day.
const HOLD_MINUTES = 15;

// Release holds nobody came back for. A guest who closes the tab mid-payment
// would otherwise block that room until someone noticed. Cancelling rather than
// deleting keeps the row, and a CANCELLED row is outside the no-double-booking
// predicate, so the room is free the moment this runs.
//
// Called at the top of every read path — cheap, since the WHERE matches nothing
// on almost every call, and it means no cron job has to exist.
const releaseExpiredHolds = async () => {
  await pool.query(
    `UPDATE "Reservation"
        SET "status" = 'CANCELLED', "holdExpiresAt" = NULL
      WHERE "status" = 'PENDING'
        AND "holdExpiresAt" IS NOT NULL
        AND "holdExpiresAt" < now()`
  );
};

// What the admin list and dashboard print. roomLabel and nights are derived
// here so every screen shows them the same way.
const LIST_COLUMNS = `
  res."id",
  res."confirmationCode",
  res."guestName",
  res."guestCount",
  res."checkIn",
  res."checkOut",
  res."status",
  res."totalAmount",
  res."holdExpiresAt",
  res."checkedInAt",
  res."checkedOutAt",
  r."number" AS "roomNumber",
  r."name"   AS "roomName",
  r."type"   AS "roomType",
  r."number" || ' · ' || r."name" AS "roomLabel"
`;

// The balance still owed on a stay, as a SQL expression over `res`.
export const BALANCE_EXPRESSION = `
  res."totalAmount"
  + COALESCE((SELECT SUM(c."amount") FROM "Charge"  c WHERE c."reservationId" = res."id"), 0)
  - COALESCE((SELECT SUM(p."amount") FROM "Payment" p WHERE p."reservationId" = res."id"), 0)
`;

const withNights = (row: any) => ({
  ...row,
  nights: nights(row.checkIn, row.checkOut),
});

// GET — every reservation, newest first. The status filter and the search stay
// in the client; at this property's size the whole table is a few hundred rows.
router.get("/", async (_req: Request, res: Response) => {
  try {
    await releaseExpiredHolds();
    const result = await pool.query(
      `SELECT ${LIST_COLUMNS}
         FROM "Reservation" res
         JOIN "Room" r ON r."id" = res."roomId"
        ORDER BY res."createdAt" DESC`
    );
    res.json(result.rows.map(withNights));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET — look a booking up by the code on the guest's confirmation.
//
// Guests have no accounts, so this is the only way back to a reservation. It
// returns the live ledger, not the booking snapshot: a guest who settles an
// incidental balance lands back here, and a page still showing only what they
// agreed to at booking would be telling them the wrong number.
router.get("/code/:code", async (req: Request, res: Response) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      `SELECT res."id", res."confirmationCode", res."guestName", res."guestCount",
              res."checkIn", res."checkOut", res."status", res."totalAmount",
              res."taxAmount",
              r."name" AS "roomName", r."number" AS "roomNumber",
              r."type" AS "roomType", r."nightlyRate"
         FROM "Reservation" res
         JOIN "Room" r ON r."id" = res."roomId"
        WHERE res."confirmationCode" = $1`,
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const row = result.rows[0];
    const ledger = await readLedger(row.id, row.totalAmount, row.taxAmount);

    // postedBy is stripped. It names the staff member who put a line on the
    // bill, which the front desk needs for a disputed charge and the guest has
    // no business seeing.
    res.json({
      ...row,
      nights: nights(row.checkIn, row.checkOut),
      charges: ledger.charges.map(({ postedBy, ...charge }) => charge),
      payments: ledger.payments,
      totals: ledger.totals,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST — hold a room and open a hosted checkout.
//
// The reservation exists *before* the money moves. Charging first would let
// another guest take the room mid-payment, leaving somebody who has paid for a
// room that is gone. So the row goes in as PENDING, which blocks availability,
// and the webhook promotes it once Xendit confirms.
//
// The total is computed here from the rate in the database. A price posted by
// the client is never trusted.
router.post("/", validateResource(createBookingSchema), async (req: Request, res: Response) => {
  const { roomId, guestName, guestCount, checkIn, checkOut } = req.body;
  try {
    await releaseExpiredHolds();

    const room = await pool.query(
      `SELECT "nightlyRate", "capacity", "name", "number", "type"
         FROM "Room" WHERE "id" = $1`,
      [roomId]
    );
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'That room is no longer listed.' });
    }
    if (guestCount > room.rows[0].capacity) {
      return res.status(400).json({ error: 'That room does not sleep that many guests.' });
    }

    const quote = quoteStay(room.rows[0].nightlyRate, nights(checkIn, checkOut));

    // No explicit transaction. The insert is a single statement, and the
    // check-then-insert race is already closed by the exclusion constraint —
    // the database refuses an overlapping row outright, and 23P01 is that
    // refusal.
    let reservation;
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      try {
        const inserted = await pool.query(
          `INSERT INTO "Reservation" ("roomId", "confirmationCode", "guestName",
                                      "guestCount", "checkIn", "checkOut", "status",
                                      "totalAmount", "taxAmount", "holdExpiresAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, now() + ($9 || ' minutes')::interval)
           RETURNING *`,
          [roomId, generateCode(), guestName, guestCount, checkIn, checkOut,
           quote.total, quote.tax, String(HOLD_MINUTES)]
        );
        reservation = inserted.rows[0];
        break;
      } catch (error) {
        const code = (error as { code?: string }).code;
        // Someone else holds or occupies this room for an overlapping range.
        if (code === '23P01') {
          return res.status(409).json({
            error: 'Someone booked that room while you were deciding. Try different dates, or pick another room.',
          });
        }
        // Code collision — reroll. Any other unique violation is a real bug.
        if (code === '23505' &&
            (error as { constraint?: string }).constraint === 'Reservation_confirmationCode_key') {
          continue;
        }
        throw error;
      }
    }

    if (!reservation) {
      return res.status(500).json({ error: 'Could not generate a confirmation code.' });
    }

    try {
      const invoiceUrl = await createInvoice({
        reservationId: reservation.id,
        confirmationCode: reservation.confirmationCode,
        amount: reservation.totalAmount,
        description: `${room.rows[0].name} (Room ${room.rows[0].number}) — ${quote.nights} ${quote.nights === 1 ? 'night' : 'nights'}`,
      });
      res.status(201).json({ invoiceUrl, confirmationCode: reservation.confirmationCode });
    } catch (error) {
      // The hold is already written. Leaving it would block the room for the
      // full window over a failure the guest had no part in, so release it now
      // rather than waiting for the sweep.
      await pool.query(
        `UPDATE "Reservation" SET "status" = 'CANCELLED', "holdExpiresAt" = NULL
          WHERE "id" = $1 AND "status" = 'PENDING'`,
        [reservation.id]
      );
      res.status(502).json({ error: 'We could not reach the payment provider. Please try again.' });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST — take a stay at the front desk.
//
// A walk-in has no hold and no invoice. A hold exists to keep a room while a
// guest is away at a payment page; this guest is standing at the counter, so
// there is nothing to reserve them against and nobody to wait for. The row goes
// straight in as CONFIRMED.
//
// Payment is not collected here either. The room charge lands on the folio and
// the check-out guard already refuses to release a guest who still owes money —
// so the money is taken at exactly the right moment, by cash or by a payment
// link, without this endpoint knowing anything about either.
//
// checkInNow puts them in the room in the same transaction. That matters: two
// separate calls can half-fail and leave a CONFIRMED booking beside a room
// still reading AVAILABLE with somebody's luggage in it. Unticked, this books a
// stay for later — someone phoning ahead.
router.post("/walk-in", validateResource(createWalkInSchema), async (req: Request, res: Response) => {
  const { roomId, guestName, guestCount, checkIn, checkOut, checkInNow } = req.body;
  try {
    await releaseExpiredHolds();

    const room = await pool.query(
      `SELECT "capacity", "nightlyRate" FROM "Room" WHERE "id" = $1`,
      [roomId]
    );
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'That room is no longer listed.' });
    }
    if (guestCount > room.rows[0].capacity) {
      return res.status(400).json({ error: 'That room does not sleep that many guests.' });
    }

    const quote = quoteStay(room.rows[0].nightlyRate, nights(checkIn, checkOut));

    // Each attempt is its own transaction. A confirmation-code collision aborts
    // the transaction it happens in, so the retry has to start a fresh one
    // rather than carry on inside a broken transaction.
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // checkedInAt comes from SQL now(), not a JS Date. node-postgres
        // serialises a Date in this machine's timezone, and TIMESTAMP carries
        // no zone to correct it with — the column would end up holding Manila
        // wall clocks beside the UTC that now() writes everywhere else.
        const inserted = await client.query(
          `INSERT INTO "Reservation" ("roomId", "confirmationCode", "guestName",
                                      "guestCount", "checkIn", "checkOut", "status",
                                      "totalAmount", "taxAmount",
                                      "checkedInAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                   CASE WHEN $10 THEN now() ELSE NULL END)
           RETURNING *`,
          [roomId, generateCode(), guestName, guestCount, checkIn, checkOut,
           checkInNow ? 'CHECKED_IN' : 'CONFIRMED',
           quote.total, quote.tax,
           checkInNow]
        );

        if (checkInNow) {
          await client.query(
            `UPDATE "Room" SET "status" = 'OCCUPIED' WHERE "id" = $1`,
            [roomId]
          );
        }

        await client.query('COMMIT');
        return res.status(201).json(inserted.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        const code = (error as { code?: string }).code;

        // Someone already holds or occupies this room across these dates.
        if (code === '23P01') {
          return res.status(409).json({
            error: 'That room is already taken for those dates.',
          });
        }
        // Code collision — reroll. Any other unique violation is a real bug.
        if (code === '23505' &&
            (error as { constraint?: string }).constraint === 'Reservation_confirmationCode_key') {
          continue;
        }
        throw error;
      } finally {
        client.release();
      }
    }

    res.status(500).json({ error: 'Could not generate a confirmation code.' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST — mark a guest arrived.
//
// Two rows move together, the reservation's status and the room's housekeeping
// flag, so this runs in one transaction. A crash between them would leave a
// room reading AVAILABLE with somebody's luggage in it. The UPDATE is guarded
// on CONFIRMED rather than checked beforehand, which makes a double-click a
// no-op instead of a second check-in with a later timestamp.
router.post("/:id/check-in", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE "Reservation"
          SET "status" = 'CHECKED_IN', "checkedInAt" = now()
        WHERE "id" = $1 AND "status" = 'CONFIRMED'
       RETURNING "roomId"`,
      [id]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Only a confirmed booking can be checked in. This one is on hold, cancelled, or already arrived.',
      });
    }

    await client.query(`UPDATE "Room" SET "status" = 'OCCUPIED' WHERE "id" = $1`,
      [updated.rows[0].roomId]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
});

// POST — mark a guest departed and free the room.
//
// Refused while anything is still owed. The balance is read inside the same
// transaction as the update, so a charge posted a moment ago cannot slip past
// the check, and the amount comes back with the error so the front desk sees
// what to collect rather than a bare refusal.
router.post("/:id/check-out", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT res."status", (${BALANCE_EXPRESSION}) AS "balance"
         FROM "Reservation" res WHERE res."id" = $1`,
      [id]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'That reservation no longer exists.' });
    }
    if (found.rows[0].status !== 'CHECKED_IN') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That guest is not currently checked in.' });
    }

    // Compared in centavos, not as a float: a balance landing on 0.004 is not
    // zero, and a guest should not walk out owing a centavo nobody can see.
    if (toCentavos(found.rows[0].balance) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `₱${toMoney(found.rows[0].balance)} is still owed. Take payment on the folio before checking this guest out.`,
      });
    }

    const updated = await client.query(
      `UPDATE "Reservation"
          SET "status" = 'CHECKED_OUT', "checkedOutAt" = now()
        WHERE "id" = $1 AND "status" = 'CHECKED_IN'
       RETURNING "roomId"`,
      [id]
    );

    await client.query(`UPDATE "Room" SET "status" = 'AVAILABLE' WHERE "id" = $1`,
      [updated.rows[0].roomId]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
});

export { releaseExpiredHolds, LIST_COLUMNS, withNights };
export default router;
