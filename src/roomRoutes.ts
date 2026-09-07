import { Router, Request, Response } from 'express';
import { pool } from './db';

const router = Router();

// GET /api/rooms
//
// The catalog, and the availability search when checkIn and checkOut are
// both given. Overlap is half-open: an existing stay collides when it starts
// before the requested check-out AND ends after the requested check-in, so a
// guest departing on the 11th does not block an arrival on the 11th.
//
// PENDING counts as live — it is a room held while a guest is at the payment
// gateway, and leaving it out would let two guests hold the same room.
//
// Room.status is deliberately not consulted. That is housekeeping's "is
// someone in there right now", not a statement about future availability.
router.get('/', async (req: Request, res: Response) => {
  const { checkIn, checkOut, guests } = req.query;
  const capacity = Number(guests) || 1;
  const hasRange = Boolean(checkIn && checkOut);

  try {
    const result = await pool.query(
      `SELECT "id", "number", "name", "type", "capacity", "amenities",
              "description", "imageUrl", "status", "nightlyRate"
         FROM "Room" r
        WHERE r."capacity" >= $1
          AND (
            $2::date IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM "Reservation" res
               WHERE res."roomId" = r."id"
                 AND res."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
                 AND res."checkIn" < $3::date
                 AND res."checkOut" > $2::date
            )
          )
        ORDER BY r."type" ASC, r."number" ASC`,
      [capacity, hasRange ? checkIn : null, hasRange ? checkOut : null]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/rooms/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT "id", "number", "name", "type", "capacity", "amenities",
              "description", "imageUrl", "status", "nightlyRate"
         FROM "Room" WHERE "id" = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
