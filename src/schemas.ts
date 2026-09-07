import { z } from "zod";

import { DATE_PATTERN, nights, today } from "./dates";
import { toMoney } from "./money";
import {
  CHARGE_DEPARTMENTS,
  PAYMENT_METHODS,
  ROOM_STATUSES,
  ROOM_TYPES,
} from "./types";

// Nobody books a year in a single reservation, and an open-ended stay is a bug.
export const MAX_NIGHTS = 30;
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 4;

// A peso amount as typed at a desk: "450", "450.5", "1,200.50". Normalised to
// the two-decimal string DECIMAL(10,2) takes, never to a number — see money.ts.
// The upper bound is what the column holds: DECIMAL(10,2) tops out at
// 99,999,999.99, and anything above it reaches Postgres only to come back as an
// overflow nobody can read.
const pesoAmount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value) => value.replace(/,/g, ""))
    .refine((value) => /^\d{1,8}(\.\d{1,2})?$/.test(value), {
      message: `${label} has to be an amount like 1200 or 1200.50.`,
    })
    .transform(toMoney);

// "" from an untouched optional field means "not set", not an empty string.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

export const roomBodySchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Give the room a number.")
    .max(10, "That room number is too long."),
  name: z
    .string()
    .trim()
    .min(1, "Give the room a name — it is the heading on the guest card.")
    .max(120, "That name is too long."),
  type: z.enum(ROOM_TYPES),
  capacity: z
    .number()
    .int()
    .min(1, "A room sleeps at least one guest.")
    .max(10, "Split anything larger than 10 into separate rooms."),
  // Stored ex-VAT, which is what the admin form's own label says. VAT is added
  // per stay in pricing.ts, so changing a rate never rewrites the tax on a
  // booking already taken.
  nightlyRate: pesoAmount("Nightly rate"),
  status: z.enum(ROOM_STATUSES),
  amenities: z
    .array(z.string().trim().min(1))
    .max(20, "That is more amenities than a card can show."),
  description: optionalText(400, "Keep the description under 400 characters.")
    .nullable(),
  imageUrl: optionalText(500, "That URL is too long.").nullable(),
  // Taken off the market for maintenance. Stops new bookings; existing ones
  // are untouched, because a guest already in the room is a different problem.
  outOfService: z.boolean().default(false),
});

// Create a wrapper schema for our generic Express middleware
export const createRoomSchema = z.object({
  body: roomBodySchema,
});

export const updateRoomSchema = z.object({
  body: roomBodySchema,
  params: z.object({
    id: z.string().min(1, "Room id is required"),
  }),
});

export type RoomInput = z.infer<typeof roomBodySchema>;

// The fields any stay needs, however it was taken.
//
// The price is deliberately absent: it is recomputed from the room's stored
// rate. A total posted by the client is never trusted.
const stayFields = {
  roomId: z.string().min(1, "Pick a room first."),
  guestName: z
    .string()
    .trim()
    .min(1, "Enter the name the reservation is held under.")
    .max(120, "That name is too long."),
  guestCount: z
    .number()
    .int()
    .min(MIN_GUESTS, "At least one guest.")
    .max(MAX_GUESTS, `We can seat at most ${MAX_GUESTS} guests in a room.`),
  checkIn: z.string().regex(DATE_PATTERN, "Check-in date is missing."),
  checkOut: z.string().regex(DATE_PATTERN, "Check-out date is missing."),
};

// The rules a stay has to satisfy, shared by both ways of taking one.
// YYYY-MM-DD compares correctly as a string, so none of this needs a Date
// object and none of it has timezone behaviour. See dates.ts.
const withStayRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine((value: any) => value.checkOut > value.checkIn, {
      message: "Check-out has to be after check-in.",
      path: ["checkOut"],
    })
    .refine((value: any) => value.checkIn >= today(), {
      message: "That check-in date has already passed.",
      path: ["checkIn"],
    })
    .refine((value: any) => nights(value.checkIn, value.checkOut) <= MAX_NIGHTS, {
      message: `Stays are capped at ${MAX_NIGHTS} nights — call the front desk for longer.`,
      path: ["checkOut"],
    });

export const bookingBodySchema = withStayRules(z.object(stayFields));

export const createBookingSchema = z.object({
  body: bookingBodySchema,
});

// A stay taken at the desk. No hold and no invoice — the guest is standing
// there, so there is nothing to reserve them against and nobody to wait for.
export const walkInBodySchema = withStayRules(
  z.object({
    ...stayFields,
    // A walk-in is checked in on the spot. Unticked, this books a stay for
    // later — someone phoning ahead for next week.
    checkInNow: z.boolean().default(true),
  })
);

export const createWalkInSchema = z.object({
  body: walkInBodySchema,
});

export type WalkInInput = z.infer<typeof walkInBodySchema>;

export type BookingInput = z.infer<typeof bookingBodySchema>;

// An incidental posted at the front desk. Amounts here are VAT-inclusive.
export const chargeBodySchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Say what the charge is for — it prints on the guest's bill.")
    .max(200, "That description is too long."),
  department: z.enum(CHARGE_DEPARTMENTS),
  amount: pesoAmount("Amount"),
  // Initials until a Staff table exists, so a disputed charge can be traced to
  // a person rather than to nobody.
  postedBy: optionalText(8, "Use initials, not a full name.")
    .nullable()
    .transform((value) => value?.toUpperCase() ?? null),
});

export const createChargeSchema = z.object({
  body: chargeBodySchema,
  params: z.object({ id: z.string().min(1) }),
});

export type ChargeInput = z.infer<typeof chargeBodySchema>;

// Money taken at the desk. Gateway payments arrive via the webhook instead.
export const paymentBodySchema = z.object({
  amount: pesoAmount("Amount"),
  method: z.enum(PAYMENT_METHODS),
});

export const createPaymentSchema = z.object({
  body: paymentBodySchema,
  params: z.object({ id: z.string().min(1) }),
});

export type PaymentInput = z.infer<typeof paymentBodySchema>;

// Moving a guest to a different room.
export const moveBodySchema = z.object({
  roomId: z.string().min(1, "Pick a room to move them to."),
});

export const moveReservationSchema = z.object({
  body: moveBodySchema,
  params: z.object({ id: z.string().min(1) }),
});
