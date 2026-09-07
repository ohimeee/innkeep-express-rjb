import { Router, Request, Response } from 'express';
import { pool } from './db';
import { toPaymentMethod, verifyCallbackToken, XenditInvoiceEvent } from './payments';

const router = Router();

// POST — the only place a booking becomes CONFIRMED.
//
// The guest's browser arriving at success_redirect_url proves nothing — it is a
// URL anyone can type, bookmark or share. Confirming from the redirect would
// mean anybody could navigate straight to it and walk away with a real
// reservation, a blocked room and no payment. So confirmation happens here, on
// a request that came from Xendit, and nowhere else.
//
// This endpoint is public. Every request is authenticated before a single field
// of the body is read.
router.post("/xendit", async (req: Request, res: Response) => {
  if (!verifyCallbackToken(req.header('x-callback-token') ?? null)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const event = req.body as XenditInvoiceEvent;

  // "PAID" — not COMPLETED, not SUCCEEDED. Anything else (EXPIRED, PENDING) is
  // acknowledged so Xendit stops retrying, but changes nothing.
  if (event.status !== 'PAID') {
    return res.json({ received: true, ignored: event.status ?? null });
  }

  const reservationId = event.external_id;

  if (!reservationId) {
    return res.status(400).json({ error: 'missing external_id' });
  }

  try {
    const found = await pool.query(
      `SELECT "id", "status", "confirmationCode", "totalAmount"
         FROM "Reservation" WHERE "id" = $1`,
      [reservationId]
    );

    // The id is not one of ours. Take the 200 — retrying cannot make this
    // succeed, and the payment cannot be recorded either since Payment hangs
    // off a reservation. It should never fire.
    if (found.rows.length === 0) {
      console.error(`[xendit] paid invoice for unknown reservation ${reservationId}`);
      return res.json({ received: true, matched: false });
    }

    const reservation = found.rows[0];

    // The invoice callback carries no separate event id, so the invoice id is
    // the dedupe key — one invoice is paid once, and a redelivery repeats it.
    // The unique index on providerEventId is what makes that safe, and
    // ON CONFLICT DO NOTHING is how it shows up here.
    const recorded = await pool.query(
      `INSERT INTO "Payment" ("reservationId", "amount", "method", "paidAt",
                              "providerInvoiceId", "providerEventId")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("providerEventId") WHERE "providerEventId" IS NOT NULL
         DO NOTHING
       RETURNING "id"`,
      [
        reservation.id,
        reservation.totalAmount,
        toPaymentMethod(event),
        // From the payload, not now(): a webhook redelivered an hour later
        // would otherwise stamp the wrong time on the folio.
        event.paid_at ? new Date(event.paid_at) : new Date(),
        event.id ?? null,
        event.id ?? null,
      ]
    );

    // Only promotes a PENDING row, so a duplicate delivery leaves an already
    // confirmed booking exactly as it is.
    const confirmed = await pool.query(
      `UPDATE "Reservation"
          SET "status" = 'CONFIRMED', "holdExpiresAt" = NULL
        WHERE "id" = $1 AND "status" = 'PENDING'
       RETURNING "id"`,
      [reservation.id]
    );

    if (confirmed.rows.length === 0 && reservation.status !== 'CONFIRMED') {
      // Paid, but the hold had already been released and the room may have been
      // resold. Nothing to do automatically — this needs a human and possibly a
      // refund, so make it loud.
      console.error(
        `[xendit] payment for ${reservation.confirmationCode} arrived with status ${reservation.status}`
      );
    }

    res.json({
      received: true,
      duplicate: recorded.rows.length === 0,
      confirmed: confirmed.rows.length > 0,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
