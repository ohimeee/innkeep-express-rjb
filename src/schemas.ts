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

// The price is deliberately absent: it is recomputed from the room's stored
// rate. A total posted by the client is never trusted.
export const bookingBodySchema = z
  .object({
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
  })
  .refine((value) => value.checkOut > value.checkIn, {
    message: "Check-out has to be after check-in.",
    path: ["checkOut"],
  })
  // YYYY-MM-DD compares correctly as a string, so this needs no Date object and
  // therefore has no timezone behaviour. See dates.ts.
  .refine((value) => value.checkIn >= today(), {
    message: "That check-in date has already passed.",
    path: ["checkIn"],
  })
  .refine((value) => nights(value.checkIn, value.checkOut) <= MAX_NIGHTS, {
    message: `Stays are capped at ${MAX_NIGHTS} nights — call the front desk for longer.`,
    path: ["checkOut"],
  });

export const createBookingSchema = z.object({
  body: bookingBodySchema,
});

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
  cardLast4: z
    .string()
    .trim()
    .nullable()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || /^\d{4}$/.test(value), {
      message: "Last four digits only — four numbers, nothing else.",
    }),
});

export const createPaymentSchema = z.object({
  body: paymentBodySchema,
  params: z.object({ id: z.string().min(1) }),
});

export type PaymentInput = z.infer<typeof paymentBodySchema>;
