import type { Room } from "../types";
import { toSearchParams, type RoomQuery } from "../search";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

/**
 * Rooms that sleep at least `guests`, minus anything booked across the range.
 *
 * With no dates this is the plain catalog — a first-time visitor should see
 * rooms, not an empty page demanding dates. The filtering itself happens in
 * SQL on the API; this only carries the query across.
 */
export const fetchRooms = async (query: RoomQuery): Promise<Room[]> => {
  const response = await fetch(`${API_BASE}/rooms?${toSearchParams(query)}`);

  if (!response.ok) throw new Error("Could not load rooms");

  return response.json();
};

export const fetchRoom = async (id: string): Promise<Room> => {
  const response = await fetch(`${API_BASE}/rooms/${id}`);

  if (!response.ok) throw new Error("Could not load that room");

  return response.json();
};
