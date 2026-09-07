import type { ChargeDepartment, Folio, PaymentMethod } from "../types";

const API_BASE = 'http://localhost:3000/api';

// Keyed on the confirmation code — what the guest reads off their phone and
// what the front desk types, so a folio URL is something a person can reach.
export const fetchFolio = async (code: string): Promise<Folio> => {
  const response = await fetch(`${API_BASE}/folio/${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error('Failed to fetch folio');
  return response.json();
};

export interface NewCharge {
  description: string;
  department: ChargeDepartment;
  amount: string;
  // Initials of whoever posted it. Free text until staff accounts exist.
  postedBy: string | null;
}

export const postCharge = async (
  reservationId: string,
  charge: NewCharge
): Promise<void> => {
  const response = await fetch(`${API_BASE}/folio/${reservationId}/charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(charge),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.message ?? body.error ?? 'Failed to post charge');
  }
};

export interface NewPayment {
  amount: string;
  method: PaymentMethod;
}

export const recordPayment = async (
  reservationId: string,
  payment: NewPayment
): Promise<void> => {
  const response = await fetch(`${API_BASE}/folio/${reservationId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.message ?? body.error ?? 'Failed to record payment');
  }
};
