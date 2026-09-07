import { useEffect, useState } from "react";

import { moveReservation } from "../api/reservationService";
import { fetchRooms } from "../api/roomService";
import { formatPeso, toCentavos } from "../money";
import { typeLabel, type Room } from "../types";
import { Spinner } from "./Spinner";

const FIELD_CLASSES =
  "w-full border border-[#201e1d]/40 bg-[#f3f2f2] px-3 py-2.5 text-sm text-[#201e1d]";

const LABEL_CLASSES =
  "text-[11px] font-semibold tracking-wide text-[#201e1d]/60 uppercase";

interface MoveFormProps {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  // What the stay currently costs, so the form can say whether moving changes it.
  totalAmount: string;
  onMoved: () => void;
}

// Move a guest to a different room.
//
// The room a stay sits in is fixed at booking, except for the case that keeps
// happening: a room goes out of service with somebody in it, or a guest asks to
// change. Only rooms free for these exact dates are offered — the list comes
// from the same availability query the guest catalog uses, so a room taken a
// moment ago stops appearing here too.
export const MoveForm: React.FC<MoveFormProps> = ({
  reservationId,
  checkIn,
  checkOut,
  guestCount,
  totalAmount,
  onMoved,
}) => {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [choice, setChoice] = useState("");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const loadRooms = async () => {
      try {
        const free = await fetchRooms({ checkIn, checkOut, guests: guestCount });
        setRooms(free);
        setChoice(free[0]?.id ?? "");
      } catch {
        setRooms([]);
      }
    };
    loadRooms();
  }, [open, checkIn, checkOut, guestCount]);

  const target = rooms.find((room) => room.id === choice);

  // Mirrors what the API will charge, so the form can say it before you commit.
  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${checkOut}T00:00:00Z`).getTime() -
        new Date(`${checkIn}T00:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
  const targetTotal = target
    ? Math.round(toCentavos(target.nightlyRate) * nights * 1.12)
    : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!choice) return;

    setMoving(true);
    setError("");

    try {
      await moveReservation(reservationId, choice);
      setOpen(false);
      onMoved();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setMoving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between border border-[#201e1d]/40 px-4 py-3 text-[13px] font-semibold text-[#201e1d] hover:bg-[#ec3013]/10 hover:text-[#b8250e]"
      >
        Move room
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border border-[#201e1d]/40 bg-[#f3f2f2] p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
          Move room
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] font-semibold text-[#201e1d]/55"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="move-room" className={LABEL_CLASSES}>
          Free for these dates
        </label>
        <select
          id="move-room"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className={`${FIELD_CLASSES} appearance-none`}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.number} · {room.name} · {typeLabel(room.type)} ·{" "}
              {formatPeso(room.nightlyRate)}/night
            </option>
          ))}
        </select>
        {rooms.length === 0 ? (
          <p className="text-[11px] text-[#b8250e]">
            Nothing else sleeps {guestCount} across these dates.
          </p>
        ) : null}
      </div>

      {target ? (
        <p className="text-[11px] leading-snug text-[#201e1d]/55">
          {targetTotal === toCentavos(totalAmount)
            ? `The bill stays at ${formatPeso(totalAmount)}.`
            : `The bill becomes ${formatPeso(String(targetTotal / 100))}, from ${formatPeso(totalAmount)}. Anything already paid above that shows as a refund due.`}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={moving || rooms.length === 0}
        className={[
          "font-heading flex w-full items-center justify-between px-4 py-3 text-sm font-extrabold text-[#f3f2f2]",
          moving || rooms.length === 0
            ? "cursor-not-allowed bg-[#ec3013]/45"
            : "cursor-pointer bg-[#ec3013]",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          {moving && <Spinner />}
          {moving ? "Moving…" : "Move guest"}
        </span>
      </button>

      {error ? (
        <p
          role="alert"
          className="border-l-2 border-[#ec3013] bg-[#ec3013]/[.08] p-2.5 text-[12.5px] leading-snug text-[#b8250e]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
};
