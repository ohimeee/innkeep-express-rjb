import { Router, Request, Response } from 'express';
import { pool } from './db';
import { validateResource } from './validate';
import { createChargeSchema, createPaymentSchema } from './schemas';
import { nights } from './dates';
import { fromCentavos, toCentavos } from './money';

const router = Router();

const sumCentavos = (amounts: string[]) =>
  amounts.reduce((total, amount) => total + toCentavos(amount), 0);

// GET — the whole bill for one confirmation code, in three reads.
//
// Three round trips rather than one join, deliberately: joining a reservation
// to both its charges and its payments multiplies the rows together, and the
// two sums would then each count the other table's rows.
router.get("/:code", async (req: Request, res: Response) => {
  const { code } = req.params;
  try {
    const found = await pool.query(
      `SELECT res."id", res."confirmationCode", res."guestName", res."guestCount",
              res."checkIn", res."checkOut", res."status",
              res."checkedInAt", res."checkedOutAt",
              res."totalAmount", res."taxAmount",
              r."nightlyRate", r."number" AS "roomNumber",
              r."name" AS "roomName", r."type" AS "roomType"
         FROM "Reservation" res
         JOIN "Room" r ON r."id" = res."roomId"
        WHERE res."confirmationCode" = $1`,
      [code]
    );

    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'No folio for that code' });
    }

    const row = found.rows[0];

    const charges = await pool.query(
      `SELECT "id", "createdAt", "description", "department", "postedBy", "amount"
         FROM "Charge" WHERE "reservationId" = $1 ORDER BY "createdAt" ASC`,
      [row.id]
    );

    const payments = await pool.query(
      `SELECT "id", "paidAt", "amount", "method", "cardLast4"
         FROM "Payment" WHERE "reservationId" = $1 ORDER BY "paidAt" ASC`,
      [row.id]
    );

    // roomTotal is derived rather than stored: totalAmount was written with VAT
    // already in it at booking, so the ex-VAT line is totalAmount - taxAmount.
    // Recomputing from the room's current rate would be wrong — a rate changed
    // after the booking would retroactively alter a bill already paid.
    //
    // Incidentals carry no VAT of their own: they are posted VAT-inclusive,
    // which is how PH hotels bill minibar and laundry, and it keeps taxAmount
    // frozen at the moment of booking.
    const taxCentavos = toCentavos(row.taxAmount);
    const roomCentavos = toCentavos(row.totalAmount) - taxCentavos;
    const incidentalCentavos = sumCentavos(charges.rows.map((c) => c.amount));
    const paidCentavos = sumCentavos(payments.rows.map((p) => p.amount));
    const balanceCentavos =
      roomCentavos + taxCentavos + incidentalCentavos - paidCentavos;

    res.json({
      ...row,
      nights: nights(row.checkIn, row.checkOut),
      charges: charges.rows,
      payments: payments.rows,
      totals: {
        roomTotal: fromCentavos(roomCentavos),
        tax: fromCentavos(taxCentavos),
        incidentals: fromCentavos(incidentalCentavos),
        paid: fromCentavos(paidCentavos),
        balance: fromCentavos(balanceCentavos),
        settled: balanceCentavos <= 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST — post an incidental against a stay.
//
// Only an in-house guest can run up a minibar tab. A departed guest is
// deliberately still chargeable, because a late-posted transfer or a correction
// is a real thing the desk has to do.
router.post("/:id/charges", validateResource(createChargeSchema), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, department, amount, postedBy } = req.body;
  try {
    const reservation = await pool.query(
      `SELECT "status" FROM "Reservation" WHERE "id" = $1`, [id]
    );
    if (reservation.rows.length === 0) {
      return res.status(404).json({ error: 'That reservation no longer exists.' });
    }
    const status = reservation.rows[0].status;
    if (status !== 'CHECKED_IN' && status !== 'CHECKED_OUT') {
      return res.status(409).json({
        error: 'Charges can only be posted once a guest has checked in. This booking has not started.',
      });
    }

    const result = await pool.query(
      `INSERT INTO "Charge" ("reservationId", "description", "department", "amount", "postedBy")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, description, department, amount, postedBy]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST — record money taken at the desk.
//
// providerEventId stays null: that column exists to make a redelivered Xendit
// webhook a no-op, and cash handed over a counter has no event to deduplicate
// against. The unique index is partial precisely so these rows do not all
// collide on NULL.
router.post("/:id/payments", validateResource(createPaymentSchema), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, method, cardLast4 } = req.body;
  try {
    const reservation = await pool.query(
      `SELECT "id" FROM "Reservation" WHERE "id" = $1`, [id]
    );
    if (reservation.rows.length === 0) {
      return res.status(404).json({ error: 'That reservation no longer exists.' });
    }

    const result = await pool.query(
      `INSERT INTO "Payment" ("reservationId", "amount", "method", "paidAt", "cardLast4")
       VALUES ($1, $2, $3, now(), $4)
       RETURNING *`,
      [id, amount, method, cardLast4]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
