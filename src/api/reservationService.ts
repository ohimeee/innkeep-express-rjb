import type { DashboardData, Reservation } from "../types";

const API_BASE = 'http://localhost:4000/api';

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
