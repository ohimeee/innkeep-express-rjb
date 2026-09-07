import { Router, Request, Response } from 'express';
import { pool } from './db';
import { toCentavos, toMoney } from './money';
import {
  BALANCE_EXPRESSION,
  LIST_COLUMNS,
  releaseExpiredHolds,
  withNights,
} from './reservationRoutes';

const router = Router();

// GET — everything the dashboard renders, in three reads.
//
// "Today" is the database's date, not the browser's. A front desk in Manila and
// a dev machine left on UTC would otherwise disagree about whose arrivals these
// are, and the guest standing at the counter is the one who is right.
router.get("/", async (_req: Request, res: Response) => {
  try {
    await releaseExpiredHolds();

    const arrivals = await pool.query(
      `SELECT ${LIST_COLUMNS}
         FROM "Reservation" res
         JOIN "Room" r ON r."id" = res."roomId"
        WHERE res."checkIn" = CURRENT_DATE
          AND res."status" IN ('CONFIRMED', 'CHECKED_IN')
        ORDER BY r."number" ASC`
    );

    // Anyone still CHECKED_IN past their date is included on purpose. An
    // overstay is the row the desk most needs to see, and dropping it the
    // morning after would hide the one stay nobody has closed.
    const departures = await pool.query(
      `SELECT ${LIST_COLUMNS}, (${BALANCE_EXPRESSION}) AS "balance"
         FROM "Reservation" res
         JOIN "Room" r ON r."id" = res."roomId"
        WHERE res."status" = 'CHECKED_IN'
          AND res."checkOut" <= CURRENT_DATE
        ORDER BY res."checkOut" ASC, r."number" ASC`
    );

    const totals = await pool.query(
      `SELECT
         COALESCE((SELECT SUM("guestCount") FROM "Reservation"
                    WHERE "status" = 'CHECKED_IN'), 0)::int      AS "inHouseGuests",
         (SELECT count(*) FROM "Room" WHERE "status" = 'OCCUPIED')::int AS "occupiedRooms",
         (SELECT count(*) FROM "Room")::int                      AS "totalRooms"`
    );

    const { inHouseGuests, occupiedRooms, totalRooms } = totals.rows[0];

    const departureRows = departures.rows.map((row) => ({
      ...withNights(row),
      balance: toMoney(row.balance),
      // Decided here, in centavos, rather than by a component comparing the
      // string to "0.00" — an overpaid folio is a negative balance, and that
      // test would call it outstanding.
      owing: toCentavos(row.balance) > 0,
    }));

    res.json({
      arrivals: arrivals.rows.map(withNights),
      departures: departureRows,
      inHouseGuests,
      occupiedRooms,
      totalRooms,
      // Guarded: an empty property is a fresh database, not 0% occupancy via a
      // division by zero.
      occupancyPercent:
        totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100),
      arrivedCount: arrivals.rows.filter((row) => row.status === 'CHECKED_IN').length,
      balancesToSettle: departureRows.filter((row) => row.owing).length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
