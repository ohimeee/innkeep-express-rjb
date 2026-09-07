import { Router, Request, Response } from 'express';
import { pool } from './db';
import { validateResource } from './validate';
import { createRoomSchema, updateRoomSchema } from './schemas';

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
      // availableTonight answers the catalog's question when the guest has not
      // picked dates yet: the page shows every room so the property is on
      // display, and this says which of them can actually be booked right now.
      // Without it a card offers "Book Now" on a room that will be refused.
      //
      // Room.status is not that answer. It is housekeeping's "is somebody in
      // there this minute", which says nothing about tonight — a room reading
      // OCCUPIED whose guest leaves today is free tonight.
      `SELECT "id", "number", "name", "type", "capacity", "amenities",
              "description", "imageUrl", "status", "nightlyRate", "outOfService",
              NOT EXISTS (
                SELECT 1
                  FROM "Reservation" res
                 WHERE res."roomId" = r."id"
                   AND res."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
                   AND res."checkIn"  < CURRENT_DATE + 1
                   AND res."checkOut" > CURRENT_DATE
              ) AND NOT r."outOfService" AS "availableTonight",
              -- When the stay covering tonight ends. Only one reservation can
              -- cover a given night — the exclusion constraint guarantees it —
              -- so this is that stay's check-out, not a guess.
              --
              -- It says when the room frees *from this booking*, which is not a
              -- promise that it is free after: the next guest may already have
              -- it. Stating the fact beats "Booked tonight", which reads like
              -- "try tomorrow" on a room somebody has for a week.
              (
                SELECT res."checkOut"
                  FROM "Reservation" res
                 WHERE res."roomId" = r."id"
                   AND res."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
                   AND res."checkIn"  < CURRENT_DATE + 1
                   AND res."checkOut" > CURRENT_DATE
                 LIMIT 1
              ) AS "bookedUntil"
         FROM "Room" r
        WHERE r."capacity" >= $1
          -- Out of service rooms stay in the catalog so staff can still see and
          -- edit them, but they are never offered: availableTonight is forced
          -- false below, and a dated search drops them entirely.
          AND ($2::date IS NULL OR NOT r."outOfService")
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
              "description", "imageUrl", "status", "nightlyRate", "outOfService"
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

// POST
router.post("/", validateResource(createRoomSchema), async (req: Request, res: Response) => {
  const { number, name, type, capacity, nightlyRate, status, amenities, description, imageUrl, outOfService } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO "Room" ("number", "name", "type", "capacity", "nightlyRate",
                           "status", "amenities", "description", "imageUrl",
                           "outOfService")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [number, name, type, capacity, nightlyRate, status, amenities, description, imageUrl, outOfService ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // The form warns about a clash as it is typed, but that read is stale the
    // moment it returns. The unique index on "number" is the real guard.
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'That room number is already in use.' });
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT
router.put("/:id", validateResource(updateRoomSchema), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { number, name, type, capacity, nightlyRate, status, amenities, description, imageUrl, outOfService } = req.body;
  try {
    const result = await pool.query(
      `UPDATE "Room"
          SET "number" = $2, "name" = $3, "type" = $4, "capacity" = $5,
              "nightlyRate" = $6, "status" = $7, "amenities" = $8,
              "description" = $9, "imageUrl" = $10, "outOfService" = $11
        WHERE "id" = $1
       RETURNING *`,
      [id, number, name, type, capacity, nightlyRate, status, amenities, description, imageUrl, outOfService ?? false]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'That room number is already in use.' });
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
