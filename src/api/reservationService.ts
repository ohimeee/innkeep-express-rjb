import type {
  DashboardData,
  Reservation,
  ReservationDetail,
} from "../types";

const API_BASE = 'http://localhost:3000/api';

export const fetchReservations = async (): Promise<Reservation[]> => {
  const response = await fetch(`${API_BASE}/reservations`);
  if (!response.ok) throw new Error('Failed to fetch reservations');
  return response.json();
};

export const fetchDashboard = async (): Promise<DashboardData> => {
  const response = await fetch(`${API_BASE}/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch dashboard');
  return response.json();
};

// Moves the reservation to CHECKED_IN and the room to OCCUPIED, in one
// transaction on the API. Refused unless the booking is CONFIRMED.
export const checkIn = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/reservations/${id}/check-in`, {
    method: 'POST',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to check in');
  }
};

// Refused while a balance is owed — the API says how much, so the message is
// passed through rather than replaced.
export const checkOut = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/reservations/${id}/check-out`, {
    method: 'POST',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to check out');
  }
};

export interface NewBooking {
  roomId: string;
  guestName: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
}

// Holds the room and opens a hosted checkout, returning the URL to send the
// guest to. The reservation is written PENDING before the money moves —
// charging first would let another guest take the room mid-payment. The price
// is recomputed on the API from the stored rate; a total posted from here is
// never trusted.
export const createReservation = async (
  booking: NewBooking
): Promise<{ invoiceUrl: string }> => {
  const response = await fetch(`${API_BASE}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.message ?? body.error ?? 'Failed to create booking');
  }
  return response.json();
};

// Guests have no accounts, so the confirmation code is the only way back.
export const fetchReservationByCode = async (
  code: string
): Promise<ReservationDetail> => {
  const response = await fetch(
    `${API_BASE}/reservations/code/${encodeURIComponent(code)}`
  );
  if (!response.ok) throw new Error('No booking matches that code');
  return response.json();
};

export interface WalkIn extends NewBooking {
  // A walk-in is checked in on the spot. Unticked, this books a stay for
  // later — someone phoning ahead.
  checkInNow: boolean;
}

// Take a stay at the front desk. No hold and no invoice: the guest is standing
// there, so there is nothing to reserve them against and nobody to wait for.
// The room charge lands on the folio and check-out refuses to release anyone
// who still owes, so the money is collected at the right moment either way.
export const createWalkIn = async (walkIn: WalkIn): Promise<Reservation> => {
  const response = await fetch(`${API_BASE}/reservations/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(walkIn),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.message ?? body.error ?? 'Failed to take the booking');
  }
  return response.json();
};
