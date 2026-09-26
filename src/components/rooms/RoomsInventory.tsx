import { useState } from "react";

import {
  createRoom,
  updateRoom,
  type RoomInput,
} from "../../api/roomService";
import { formatPeso } from "../../utils/money";
import { ROOM_TYPES, typeLabel } from "../../types";
import type { Room, RoomStatus, RoomType } from "../../types";
import { Spinner } from "../Spinner";

const inputClass =
  "w-full border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500";

const statusClass: Record<RoomStatus, string> = {
  AVAILABLE: "bg-gray-300",
  OCCUPIED: "bg-gray-700 text-white",
};

interface Draft {
  id: string;
  number: string;
  name: string;
  type: RoomType;
  capacity: string;
  nightlyRate: string;
  status: RoomStatus;
  amenities: string[];
  amenityDraft: string;
  description: string;
  imageUrl: string;
  outOfService: boolean;
}

const emptyDraft = (): Draft => ({
  id: "",
  number: "",
  name: "",
  type: "DELUXE",
  capacity: "2",
  nightlyRate: "",
  status: "AVAILABLE",
  amenities: [],
  amenityDraft: "",
  description: "",
  imageUrl: "",
  outOfService: false,
});

const roomToDraft = (room: Room): Draft => ({
  id: room.id,
  number: room.number,
  name: room.name,
  type: room.type,
  capacity: String(room.capacity),
  nightlyRate: room.nightlyRate,
  status: room.status,
  amenities: [...room.amenities],
  amenityDraft: "",
  description: room.description ?? "",
  imageUrl: room.imageUrl ?? "",
  outOfService: room.outOfService,
});

interface RoomsInventoryProps {
  rooms: Room[];
  onSaved: () => void;
}

export const RoomsInventory: React.FC<RoomsInventoryProps> = ({
  rooms,
  onSaved,
}) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = Boolean(draft.id);

  const available = rooms.filter(
    (r) => r.status === "AVAILABLE" && !r.outOfService,
  ).length;

  const occupied = rooms.filter(
    (r) => r.status === "OCCUPIED" && !r.outOfService,
  ).length;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addAmenity = () => {
    const value = draft.amenityDraft.trim();

    if (!value) return;

    setDraft((d) => ({
      ...d,
      amenities: [...d.amenities, value],
      amenityDraft: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const duplicate = rooms.some(
      (room) =>
        room.number === draft.number.trim() && room.id !== draft.id,
    );

    if (duplicate) {
      setError("That room number already exists.");
      return;
    }

    setSaving(true);
    setError("");

    const input: RoomInput = {
      number: draft.number.trim(),
      name: draft.name.trim(),
      type: draft.type,
      capacity: Number(draft.capacity) || 1,
      nightlyRate: draft.nightlyRate.trim(),
      status: draft.status,
      amenities: draft.amenities,
      description: draft.description.trim() || null,
      imageUrl: draft.imageUrl.trim() || null,
      outOfService: draft.outOfService,
    };

    try {
      if (editing) {
        await updateRoom(draft.id, input);
      } else {
        await createRoom(input);
      }

      setDraft(emptyDraft());
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-widest text-orange-500 uppercase">
          Property
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          Rooms
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage your rooms, prices, and availability.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-300 bg-white p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="mt-1 text-2xl font-bold">
            {rooms.length}
          </p>
        </div>

        <div className="border border-gray-300 bg-white p-4">
          <p className="text-xs text-gray-500">Available</p>
          <p className="mt-1 text-2xl font-bold text-orange-500">
            {available}
          </p>
        </div>

        <div className="border border-gray-300 bg-white p-4">
          <p className="text-xs text-gray-500">Occupied</p>
          <p className="mt-1 text-2xl font-bold">
            {occupied}
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Room list */}
        <div className="border border-gray-300 bg-white">
          <div className="border-b border-gray-300 bg-gray-200 px-5 py-4">
            <h2 className="font-bold">
              Room inventory
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-left text-xs text-gray-500">
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Rate</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>

              <tbody>
                {rooms.map((room) => (
                  <tr
                    key={room.id}
                    className="border-b border-gray-300 last:border-0"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold">
                        {room.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Room {room.number}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-gray-500">
                      {typeLabel(room.type)}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      {formatPeso(room.nightlyRate)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 text-[10px] font-bold uppercase ${
                          room.outOfService
                            ? "bg-gray-500 text-white"
                            : statusClass[room.status]
                        }`}
                      >
                        {room.outOfService
                          ? "Out of service"
                          : room.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDraft(roomToDraft(room))}
                        className="text-xs font-bold hover:text-orange-500"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rooms.length === 0 && (
              <p className="p-6 text-sm text-gray-500">
                No rooms have been added yet.
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="border border-gray-300 bg-white"
        >
          <div className="border-b border-gray-300 bg-gray-200 px-5 py-4">
            <h2 className="font-bold">
              {editing ? "Edit room" : "Add room"}
            </h2>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Room number"
                value={draft.number}
                onChange={(e) => set("number", e.target.value)}
                className={inputClass}
              />

              <input
                placeholder="Capacity"
                type="number"
                min="1"
                value={draft.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                className={inputClass}
              />
            </div>

            <input
              placeholder="Room name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />

            <select
              value={draft.type}
              onChange={(e) =>
                set("type", e.target.value as RoomType)
              }
              className={inputClass}
            >
              {ROOM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>

            <input
              placeholder="Nightly rate"
              value={draft.nightlyRate}
              onChange={(e) => set("nightlyRate", e.target.value)}
              className={inputClass}
            />

            <textarea
              placeholder="Description"
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputClass}
            />

            <input
              placeholder="Image URL"
              value={draft.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              className={inputClass}
            />

            {/* Amenities */}
            <div>
              <p className="mb-2 text-xs font-bold text-gray-500">
                Amenities
              </p>

              <div className="flex gap-2">
                <input
                  placeholder="e.g. Wi-Fi"
                  value={draft.amenityDraft}
                  onChange={(e) =>
                    set("amenityDraft", e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAmenity();
                    }
                  }}
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={addAmenity}
                  className="border border-gray-300 px-3 text-xs font-bold"
                >
                  Add
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {draft.amenities.map((amenity, index) => (
                  <button
                    key={`${amenity}-${index}`}
                    type="button"
                    onClick={() =>
                      set(
                        "amenities",
                        draft.amenities.filter(
                          (_, i) => i !== index,
                        ),
                      )
                    }
                    className="bg-gray-200 px-2 py-1 text-xs"
                  >
                    {amenity} ×
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-2 gap-2">
              {(["AVAILABLE", "OCCUPIED"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => set("status", status)}
                  className={`border px-3 py-2 text-xs font-bold ${
                    draft.status === status
                      ? "border-gray-700 bg-gray-700 text-white"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <label className="flex gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={draft.outOfService}
                onChange={(e) =>
                  set("outOfService", e.target.checked)
                }
              />
              Out of service
            </label>

            {error && (
              <p className="text-xs text-orange-500">{error}</p>
            )}

            <div className="flex gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => setDraft(emptyDraft())}
                  className="flex-1 border border-gray-300 py-3 text-sm font-bold"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600"
              >
                {saving ? (
                  <Spinner />
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Add room"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};