// The database enums, mirrored in TypeScript. The API's `db/schema.sql` is the
// source of truth; these exist so a component can name a room type without a
// generated client.

export const ROOM_TYPES = ["STANDARD", "DELUXE", "SUITE"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_STATUSES = ["AVAILABLE", "OCCUPIED"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const RESERVATION_STATUSES = [
  // A room held while the guest is at the payment gateway. Blocks availability
  // exactly like a confirmed stay until the webhook promotes it or it expires.
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** SUITE -> Suite */
export const typeLabel = (type: RoomType): string =>
  type.charAt(0) + type.slice(1).toLowerCase();

/**
 * A room as `GET /api/rooms` returns it.
 *
 * `nightlyRate` is a string, not a number. Postgres hands `NUMERIC` back as a
 * string and the API keeps it that way — see money.ts for why.
 */
export type Room = {
  id: string;
  number: string;
  name: string;
  type: RoomType;
  capacity: number;
  amenities: string[];
  description: string | null;
  imageUrl: string | null;
  status: RoomStatus;
  nightlyRate: string;
};
