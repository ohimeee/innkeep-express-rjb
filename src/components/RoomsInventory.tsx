import { useState } from "react";

import { createRoom, updateRoom, type RoomInput } from "../api/roomService";
import { formatPeso } from "../money";
import { ROOM_TYPES, typeLabel } from "../types";
import type { Room, RoomStatus, RoomType } from "../types";
import { Spinner } from "./Spinner";

const STATUS_CLASSES: Record<RoomStatus, string> = {
  AVAILABLE: "bg-[#ec3013] text-[#f3f2f2]",
  OCCUPIED: "bg-[#eae9e9] text-[#201e1d]/70",
};

// The form's own state. Everything else is read back off the API.
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
});

const draftFrom = (room: Room): Draft => ({
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
});

const FIELD_CLASSES =
  "w-full border border-[#201e1d]/40 bg-[#f3f2f2] px-3 py-2.5 text-sm text-[#201e1d]";

const LABEL_CLASSES =
  "text-[11px] font-semibold tracking-wide text-[#201e1d]/60 uppercase";

interface RoomsInventoryProps {
  rooms: Room[];
  // The page refetches after a save, so the table redraws with the new row.
  onSaved: () => void;
}

// The inventory table and the add/edit panel beside it.
//
// The rooms come in as a prop from the page that fetched them; this holds only
// the draft being edited. After a save the page refetches, so there is no local
// copy of the list to fall out of step with the database.
export const RoomsInventory: React.FC<RoomsInventoryProps> = ({
  rooms,
  onSaved,
}) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const editing = draft.id !== "";
  const available = rooms.filter((room) => room.status === "AVAILABLE").length;

  // The duplicate-number warning is a courtesy, not the guard. It reads rows
  // fetched a moment ago; the unique index on "number" is what actually refuses
  // a clash, and the API surfaces that too.
  const clash = rooms.find(
    (room) => room.number === draft.number.trim() && room.id !== draft.id,
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const addAmenity = () => {
    const amenity = draft.amenityDraft.trim();

    if (!amenity) return;

    setDraft((current) => ({
      ...current,
      amenities: [...current.amenities, amenity],
      amenityDraft: "",
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (clash) return;

    setSaving(true);
    setError("");
    setSaved("");

    const input: RoomInput = {
      number: draft.number.trim(),
      name: draft.name.trim(),
      type: draft.type,
      capacity: Number(draft.capacity) || 1,
      nightlyRate: draft.nightlyRate.trim(),
      status: draft.status,
      amenities: draft.amenities,
      description: draft.description.trim() === "" ? null : draft.description.trim(),
      imageUrl: draft.imageUrl.trim() === "" ? null : draft.imageUrl.trim(),
    };

    try {
      if (draft.id) {
        await updateRoom(draft.id, input);
      } else {
        await createRoom(input);
      }
      setSaved(draft.id ? "Changes saved" : "Room added");
      setDraft(emptyDraft());
      onSaved();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
        Inventory
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-heading m-0 text-[42px] leading-none font-extrabold tracking-tight">
          Rooms
        </h1>
        <div className="text-[13px] text-[#201e1d]/55 tabular-nums">
          {rooms.length
            ? `${rooms.length} rooms · ${available} free right now`
            : "No rooms configured"}
        </div>
      </div>
      <hr className="mt-6 h-0.5 border-0 bg-[#201e1d]/40" />

      <div className="mt-8 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* Room list */}
        <div>
          {rooms.length > 0 ? (
            <>
              {/* Table (desktop) */}
              <div className="hidden overflow-x-auto border border-[#201e1d]/40 md:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#201e1d]/40 bg-[#eae9e9]">
                      {[
                        "Room",
                        "Type",
                        "Sleeps",
                        "Nightly rate",
                        "Status",
                        "",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-[#201e1d]/60 uppercase ${
                            heading === "Nightly rate" ? "text-right" : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr
                        key={room.id}
                        className={`border-b border-[#201e1d]/20 last:border-0 ${
                          draft.id === room.id ? "bg-[#ec3013]/[.07]" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-extrabold">
                            {room.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#201e1d]/55 tabular-nums">
                            No. {room.number}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px]">
                          {typeLabel(room.type)}
                        </td>
                        <td className="px-4 py-3 text-[13px] tabular-nums">
                          {room.capacity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums">
                          {formatPeso(room.nightlyRate)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 text-[9px] font-extrabold tracking-widest ${
                              STATUS_CLASSES[room.status]
                            }`}
                          >
                            {room.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDraft(draftFrom(room))}
                            className={`text-xs text-[#ec3013] ${
                              draft.id === room.id
                                ? "font-extrabold"
                                : "font-semibold"
                            }`}
                          >
                            {draft.id === room.id ? "Editing" : "Edit"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="flex flex-col gap-4 md:hidden">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`border border-[#201e1d]/40 ${
                      draft.id === room.id
                        ? "outline outline-2 -outline-offset-2 outline-[#ec3013]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b-2 border-[#201e1d]/40 p-4">
                      <div>
                        <div className="text-[15px] font-extrabold">
                          {room.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#201e1d]/55 tabular-nums">
                          No. {room.number} · {typeLabel(room.type)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 text-[9px] font-extrabold tracking-widest ${
                          STATUS_CLASSES[room.status]
                        }`}
                      >
                        {room.status}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-3 p-4">
                      <div className="text-xs text-[#201e1d]/60">
                        Sleeps {room.capacity}
                      </div>
                      <div className="flex items-end gap-4">
                        <div className="text-base font-extrabold tabular-nums">
                          {formatPeso(room.nightlyRate)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraft(draftFrom(room))}
                          className="border border-[#201e1d]/40 px-3 py-2 text-xs font-semibold text-[#201e1d]"
                        >
                          {draft.id === room.id ? "Editing" : "Edit"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="border border-[#201e1d]/40 p-10">
              <div className="text-2xl font-extrabold tracking-tight">
                No rooms yet
              </div>
              <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-[#201e1d]/60">
                Add your first room using the form to the right. Rooms must
                exist before the guest site can take reservations against them.
              </p>
            </div>
          )}
        </div>

        {/* Add / edit form */}
        <aside className="border border-[#201e1d]/40 bg-[#eae9e9] md:sticky md:top-6">
          <form onSubmit={handleSubmit}>

            <div className="flex items-start justify-between gap-3 border-b-2 border-[#201e1d]/40 p-4">
              <div>
                <div className="text-[10px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
                  {editing ? `Editing room ${draft.number}` : "Inventory"}
                </div>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  {editing ? draft.name || "Edit room" : "Add a room"}
                </h2>
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={() => setDraft(emptyDraft())}
                  className="flex-none border border-[#201e1d]/40 px-2.5 py-1.5 text-[11px] font-semibold text-[#201e1d]"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="room-name" className={LABEL_CLASSES}>
                  Room name
                </label>
                <input
                  id="room-name"
                  name="name"
                  value={draft.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="e.g. Courtyard Deluxe"
                  className={FIELD_CLASSES}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="room-number" className={LABEL_CLASSES}>
                    Number
                  </label>
                  <input
                    id="room-number"
                    name="number"
                    value={draft.number}
                    onChange={(event) => set("number", event.target.value)}
                    placeholder="203"
                    className={`w-full border px-3 py-2.5 text-sm text-[#201e1d] tabular-nums ${
                      clash
                        ? "border-[#ec3013] bg-[#ec3013]/[.06]"
                        : "border-[#201e1d]/40 bg-[#f3f2f2]"
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="room-capacity" className={LABEL_CLASSES}>
                    Sleeps
                  </label>
                  <input
                    id="room-capacity"
                    name="capacity"
                    type="number"
                    min={1}
                    max={10}
                    value={draft.capacity}
                    onChange={(event) => set("capacity", event.target.value)}
                    className={`${FIELD_CLASSES} tabular-nums`}
                  />
                </div>
              </div>

              {clash && (
                <div className="-mt-2 flex items-start gap-2 border-l-2 border-[#ec3013] bg-[#ec3013]/[.08] p-2.5">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#b8250e"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-px flex-none"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <div>
                    <div className="text-[12.5px] font-extrabold text-[#b8250e]">
                      Room number {draft.number} is already taken
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-[#201e1d]/65">
                      {clash.name} already uses this number. Room numbers must
                      be unique across the property.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="room-type" className={LABEL_CLASSES}>
                  Type
                </label>
                <select
                  id="room-type"
                  name="type"
                  value={draft.type}
                  onChange={(event) =>
                    set("type", event.target.value as RoomType)
                  }
                  className={`${FIELD_CLASSES} appearance-none`}
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="room-rate" className={LABEL_CLASSES}>
                  Nightly rate (₱, before VAT)
                </label>
                <input
                  id="room-rate"
                  name="nightlyRate"
                  value={draft.nightlyRate}
                  onChange={(event) => set("nightlyRate", event.target.value)}
                  placeholder="6400"
                  className={`${FIELD_CLASSES} tabular-nums`}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className={LABEL_CLASSES}>Amenities</span>
                {draft.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.amenities.map((amenity, i) => (
                      <span
                        key={amenity + i}
                        className="inline-flex items-center gap-1.5 border border-[#201e1d]/40 bg-[#f3f2f2] px-2 py-1 text-[11.5px] font-semibold"
                      >
                        {amenity}
                        <button
                          type="button"
                          aria-label={`Remove ${amenity}`}
                          onClick={() =>
                            set(
                              "amenities",
                              draft.amenities.filter((_, j) => j !== i),
                            )
                          }
                          className="flex text-[#201e1d]/55"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={draft.amenityDraft}
                    onChange={(event) =>
                      set("amenityDraft", event.target.value)
                    }
                    onKeyDown={(event) => {
                      // Enter adds a chip. Without this it would submit the
                      // whole form and save a room with the amenity missing.
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addAmenity();
                    }}
                    placeholder="e.g. King bed"
                    className="min-w-0 flex-1 border border-[#201e1d]/40 bg-[#f3f2f2] px-3 py-2.5 text-sm text-[#201e1d]"
                  />
                  <button
                    type="button"
                    onClick={addAmenity}
                    className="flex flex-none items-center gap-1.5 border border-[#201e1d]/40 px-3 text-xs font-semibold text-[#201e1d] hover:bg-[#ec3013]/10 hover:text-[#b8250e]"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                    Add
                  </button>
                </div>
                <div className="text-[11px] text-[#201e1d]/50">
                  Short phrases. These become the chips on the guest-facing room
                  card.
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="room-description" className={LABEL_CLASSES}>
                  Description
                </label>
                <textarea
                  id="room-description"
                  name="description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="One or two sentences shown on the room's catalog card."
                  className={`${FIELD_CLASSES} resize-y leading-relaxed`}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="room-image" className={LABEL_CLASSES}>
                  Image URL
                </label>
                <input
                  id="room-image"
                  name="imageUrl"
                  value={draft.imageUrl}
                  onChange={(event) => set("imageUrl", event.target.value)}
                  placeholder="https://…/room-402.jpg"
                  className={FIELD_CLASSES}
                />
                <div className="text-[11px] text-[#201e1d]/50">
                  Printed in black and white on the guest catalog.
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className={LABEL_CLASSES}>Physical status</span>
                {/* Housekeeping's "is someone in there now", not a statement
                    about future availability — the catalog never reads it. */}
                <div className="grid grid-cols-2 border border-[#201e1d]/40">
                  {(["AVAILABLE", "OCCUPIED"] as const).map((status, i) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => set("status", status)}
                      className={`py-2.5 text-xs ${
                        i === 0 ? "border-r-2 border-[#201e1d]/40" : ""
                      } ${
                        draft.status === status
                          ? "bg-[#ec3013] font-extrabold text-[#f3f2f2]"
                          : "font-semibold text-[#201e1d]/70"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className={[
                  "font-heading mt-2 flex w-full items-center justify-between px-4 py-3 text-sm font-extrabold",
                  saving
                    ? "cursor-progress bg-[#ec3013]/45 text-[#f3f2f2]"
                    : "cursor-pointer bg-[#ec3013] text-[#f3f2f2]",
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  {saving && <Spinner />}
                  {saving
                    ? editing
                      ? "Saving changes…"
                      : "Saving room…"
                    : editing
                      ? "Save changes"
                      : "Save room"}
                </span>
                {!saving && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                )}
              </button>

              {error ? (
                <p
                  role="alert"
                  className="-mt-2 border-l-2 border-[#ec3013] bg-[#ec3013]/[.08] p-2.5 text-[12.5px] leading-snug text-[#b8250e]"
                >
                  {error}
                </p>
              ) : null}

              {saved ? (
                <div className="-mt-2 flex items-center gap-2 text-xs font-semibold text-[#b8250e]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {saved}
                </div>
              ) : null}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};
