// The database enums, mirrored here. The API's db/schema.sql is the source of
// truth; these exist so a component can name a room type without a generated
// client, and so a <select> can list the options.

export const ROOM_TYPES = ["STANDARD", "DELUXE", "SUITE"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_STATUSES = ["AVAILABLE", "OCCUPIED"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

// PENDING is a room held while the guest is at the payment gateway. It blocks
// availability exactly like a confirmed stay until the webhook promotes it or
// the hold expires.
export const RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "GCASH",
  "MAYA",
  "GRABPAY",
  "TRANSFER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Which department an incidental charge came from. The front desk posts most
// of them, so it is the fallback rather than a separate "unknown".
export const CHARGE_DEPARTMENTS = [
  "FNB",
  "HOUSEKEEPING",
  "TRANSPORT",
  "FRONT_DESK",
  "OTHER",
] as const;
export type ChargeDepartment = (typeof CHARGE_DEPARTMENTS)[number];

// SUITE -> Suite
export const typeLabel = (type: RoomType): string =>
  type.charAt(0) + type.slice(1).toLowerCase();

// "FNB" is not a word.
export const DEPARTMENT_LABELS: Record<ChargeDepartment, string> = {
  FNB: "F&B",
  HOUSEKEEPING: "Housekeeping",
  TRANSPORT: "Transport",
  FRONT_DESK: "Front desk",
  OTHER: "Other",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  GCASH: "GCash",
  MAYA: "Maya",
  GRABPAY: "GrabPay",
  TRANSFER: "Bank transfer",
};

// nightlyRate is a string, not a number. Postgres hands NUMERIC back as a
// string and the API keeps it that way — see money.ts for why.
export interface Room {
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
}

// Dates arrive as YYYY-MM-DD strings; timestamps arrive as ISO strings and
// become Date objects only at the point of display.
export interface Reservation {
  id: string;
  confirmationCode: string;
  guestName: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: ReservationStatus;
  totalAmount: string;
  holdExpiresAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  roomNumber: string;
  roomName: string;
  roomType: RoomType;
  // "201 · Courtyard Deluxe", the one-line room label the tables use.
  roomLabel: string;
}

// A departure carries what is still owed — the number the desk actually needs.
export interface Departure extends Reservation {
  balance: string;
  owing: boolean;
}

export interface DashboardData {
  arrivals: Reservation[];
  departures: Departure[];
  inHouseGuests: number;
  occupiedRooms: number;
  totalRooms: number;
  occupancyPercent: number;
  arrivedCount: number;
  balancesToSettle: number;
}

export interface FolioCharge {
  id: string;
  createdAt: string;
  description: string;
  department: ChargeDepartment;
  postedBy: string | null;
  amount: string;
}

export interface FolioPayment {
  id: string;
  paidAt: string;
  amount: string;
  method: PaymentMethod;
}

// roomTotal is the stay ex-VAT and tax is what was frozen at booking. Neither
// is recomputed from the room's current rate — a rate changed later must not
// rewrite a bill somebody has already paid. Incidentals carry no VAT of their
// own; they are posted VAT-inclusive.
export interface FolioTotals {
  roomTotal: string;
  tax: string;
  incidentals: string;
  paid: string;
  balance: string;
  // True when nothing is owed, which is what unlocks check-out.
  settled: boolean;
}

export interface Folio {
  id: string;
  confirmationCode: string;
  guestName: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: ReservationStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  nightlyRate: string;
  roomNumber: string;
  roomName: string;
  roomType: RoomType;
  charges: FolioCharge[];
  payments: FolioPayment[];
  totals: FolioTotals;
}

// What a guest sees on their own charges. Same as FolioCharge without
// postedBy — who put a line on the bill is the front desk's business.
export type GuestCharge = Omit<FolioCharge, "postedBy">;

// A reservation joined to its room, for the confirmation page.
//
// It carries the live ledger, not just the booking snapshot: a guest who
// settles an incidental balance lands back on this page, and showing only what
// they agreed to at booking would be the wrong number.
export interface ReservationDetail {
  id: string;
  confirmationCode: string;
  guestName: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  totalAmount: string;
  taxAmount: string;
  roomName: string;
  roomNumber: string;
  roomType: RoomType;
  nightlyRate: string;
  nights: number;
  charges: GuestCharge[];
  payments: FolioPayment[];
  totals: FolioTotals;
}
