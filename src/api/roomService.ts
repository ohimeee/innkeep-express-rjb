import type { Room, RoomStatus, RoomType } from "../types";
import { toSearchParams, type RoomQuery } from "../search";

const API_BASE = 'http://localhost:3000/api';

// GET — the catalog, filtered by dates and guest count when they are given.
export const fetchRooms = async (query: RoomQuery): Promise<Room[]> => {
  const response = await fetch(`${API_BASE}/rooms?${toSearchParams(query)}`);
  if (!response.ok) throw new Error('Failed to fetch rooms');
  return response.json();
};

export const fetchRoom = async (id: string): Promise<Room> => {
  const response = await fetch(`${API_BASE}/rooms/${id}`);
  if (!response.ok) throw new Error('Failed to fetch room');
  return response.json();
};

// What the inventory form submits. nightlyRate is ex-VAT, as its label says.
export interface RoomInput {
  number: string;
  name: string;
  type: RoomType;
  capacity: number;
  nightlyRate: string;
  status: RoomStatus;
  amenities: string[];
  description: string | null;
  imageUrl: string | null;
  outOfService: boolean;
}

export const createRoom = async (input: RoomInput): Promise<Room> => {
  const response = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create room');
  return response.json();
};

export const updateRoom = async (id: string, input: RoomInput): Promise<Room> => {
  const response = await fetch(`${API_BASE}/rooms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update room');
  return response.json();
};
