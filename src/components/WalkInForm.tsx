import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createWalkIn } from "../api/reservationService";
import { fetchRooms } from "../api/roomService";
import { addDays, today } from "../dates";
import { formatPeso } from "../money";
import { folioHref, MAX_GUESTS, MIN_GUESTS } from "../search";
import { typeLabel, type Room } from "../types";
import { Spinner } from "./Spinner";

const FIELD_CLASSES =
  "w-full border border-[#201e1d]/40 bg-[#f3f2f2] px-3 py-2.5 text-sm text-[#201e1d]";

const LABEL_CLASSES =
  "text-[11px] font-semibold tracking-wide text-[#201e1d]/60 uppercase";

interface WalkInFormProps {
  // The reservations list refetches once a stay is taken.
  onTaken: () => void;
}

// Take a booking at the desk.
//
// Collapsed behind a button, because most stays arrive through the guest site
// and the list below is what the screen is for. It opens on tonight, one night,
// checking in now — the walk-in case, which is what this is mostly used for.
export const WalkInForm: React.FC<WalkInFormProps> = ({ onTaken }) => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [checkIn, setCheckIn] = useState(today());
  const [checkOut, setCheckOut] = useState(addDays(today(), 1));
  const [checkInNow, setCheckInNow] = useState(true);

  // Only rooms free for the chosen dates. The API does the filtering, so a
  // room somebody else took a moment ago stops appearing here too.
  useEffect(() => {
    if (!open) return;

    const loadRooms = async () => {
      try {
        setRooms(await fetchRooms({ checkIn, checkOut, guests: MIN_GUESTS }));
      } catch {
        setRooms([]);
      }
    };
    loadRooms();
  }, [open, checkIn, checkOut]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setSaving(true);
    setError("");

    try {
      const reservation = await createWalkIn({
        roomId: String(data.get("roomId") ?? ""),
        guestName: String(data.get("guestName") ?? ""),
        guestCount: Number(data.get("guestCount") ?? 1),
        checkIn,
        checkOut,
        checkInNow,
      });

      setOpen(false);
      onTaken();
      // Straight to the folio — a guest who just checked in is about to have
      // things posted to their room.
      navigate(folioHref(reservation.confirmationCode));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-heading mt-6 inline-flex items-center gap-2 bg-[#ec3013] px-4 py-3 text-[13px] font-extrabold text-[#f3f2f2] hover:bg-[#d32a10]"
      >
        Take a booking
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 border border-[#201e1d]/40 bg-[#eae9e9] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
          Take a booking
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] font-semibold text-[#201e1d]/55"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_150px_150px_90px_auto]">
        <div className="flex flex-col gap-2">
          <label htmlFor="walkin-name" className={LABEL_CLASSES}>
            Guest name
          </label>
          <input
            id="walkin-name"
            name="guestName"
            required
            maxLength={120}
            placeholder="Name on the ID presented"
            className={FIELD_CLASSES}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="walkin-in" className={LABEL_CLASSES}>
            Check-in
          </label>
          <input
            id="walkin-in"
            type="date"
            value={checkIn}
            min={today()}
            onChange={(event) => setCheckIn(event.target.value)}
            className={`${FIELD_CLASSES} tabular-nums`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="walkin-out" className={LABEL_CLASSES}>
            Check-out
          </label>
          <input
            id="walkin-out"
            type="date"
            value={checkOut}
            // A stay is at least one night, so the earliest check-out is the
            // day after whatever check-in currently says.
            min={addDays(checkIn, 1)}
            onChange={(event) => setCheckOut(event.target.value)}
            className={`${FIELD_CLASSES} tabular-nums`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="walkin-guests" className={LABEL_CLASSES}>
            Guests
          </label>
          <input
            id="walkin-guests"
            name="guestCount"
            type="number"
            min={MIN_GUESTS}
            max={MAX_GUESTS}
            defaultValue={1}
            className={`${FIELD_CLASSES} tabular-nums`}
          />
        </div>

        <button
          type="submit"
          disabled={saving || rooms.length === 0}
          className={[
            "font-heading flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] font-extrabold text-[#f3f2f2]",
            saving || rooms.length === 0
              ? "cursor-not-allowed bg-[#ec3013]/45"
              : "cursor-pointer bg-[#ec3013]",
          ].join(" ")}
        >
          <span className="flex items-center gap-2">
            {saving && <Spinner />}
            {saving ? "Taking…" : "Take booking"}
          </span>
        </button>
      </div>

      <div className="mt-4 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-2">
          <label htmlFor="walkin-room" className={LABEL_CLASSES}>
            Room
          </label>
          <select
            id="walkin-room"
            name="roomId"
            required
            className={`${FIELD_CLASSES} appearance-none`}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number} · {room.name} · {typeLabel(room.type)} · sleeps{" "}
                {room.capacity} · {formatPeso(room.nightlyRate)}/night
              </option>
            ))}
          </select>
          {rooms.length === 0 ? (
            <p className="text-[11px] text-[#b8250e]">
              Nothing is free for those dates.
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-2 pb-2.5 text-[12.5px] text-[#201e1d]/75">
          <input
            type="checkbox"
            checked={checkInNow}
            onChange={(event) => setCheckInNow(event.target.checked)}
          />
          Checking in now
        </label>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-[#201e1d]/55">
        No payment is taken here. The room charge lands on the folio, and
        check-out will not release the guest until it is settled.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-3 border-l-2 border-[#ec3013] bg-[#ec3013]/[.08] p-2.5 text-[12.5px] leading-snug text-[#b8250e]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
};
