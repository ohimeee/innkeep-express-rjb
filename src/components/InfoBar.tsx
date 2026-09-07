import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";

import { addDays, today } from "../dates";
import {
  MAX_GUESTS,
  MIN_GUESTS,
  parseSearch,
  toSearchParams,
  type RoomQuery,
} from "../search";

const FIELD_CLASSES =
  "w-full bg-transparent font-bold outline-none focus:text-orange-600";

// The availability search.
//
// Submitting pushes the dates into the URL rather than lifting them into state.
// The catalog reads its query from the address bar, so a search is shareable,
// bookmarkable and survives a reload — and the back button walks through
// previous searches. See search.ts.
//
// Dates are compared as YYYY-MM-DD strings, which sort lexically, so the
// "check-out must be after check-in" rule needs no Date objects and therefore
// has no timezone behaviour. <input type="date"> speaks that format natively.
export const InfoBar: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const current = parseSearch(searchParams);

  const [checkIn, setCheckIn] = useState(current.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(current.checkOut ?? "");
  const [guests, setGuests] = useState(current.guests);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    // One date on its own cannot filter a range. Saying so beats silently
    // ignoring the field the guest just filled in, which reads as the search
    // being broken.
    if (Boolean(checkIn) !== Boolean(checkOut)) {
      setError("Enter both dates, or neither to see every room.");
      return;
    }

    if (checkIn && checkOut && checkOut <= checkIn) {
      setError("Check-out has to be after check-in.");
      return;
    }

    setError("");

    const next: RoomQuery =
      checkIn && checkOut ? { checkIn, checkOut, guests } : { guests };

    navigate(`/?${toSearchParams(next)}`);
  };

  const clear = () => {
    setCheckIn("");
    setCheckOut("");
    setError("");
    navigate(`/?${toSearchParams({ guests })}`);
  };

  return (
    // The id is what the "Other dates" link on a booked room jumps to.
    <form id="stay-search" onSubmit={submit} className="my-5 scroll-mt-4">
      <div className="flex flex-col divide-y-2 divide-gray-400 border-2 border-gray-400 sm:flex-row sm:divide-x-2 sm:divide-y-0">
        <div className="flex-3 p-3">
          <label htmlFor="checkIn" className="text-xs">
            Check-in
          </label>
          <input
            id="checkIn"
            type="date"
            value={checkIn}
            min={today()}
            onChange={(event) => setCheckIn(event.target.value)}
            className={FIELD_CLASSES}
          />
        </div>

        <div className="flex-3 p-3">
          <label htmlFor="checkOut" className="text-xs">
            Check-out
          </label>
          <input
            id="checkOut"
            type="date"
            value={checkOut}
            // A stay is at least one night, so the earliest check-out is the
            // day after whatever check-in currently says.
            min={checkIn ? addDays(checkIn, 1) : addDays(today(), 1)}
            onChange={(event) => setCheckOut(event.target.value)}
            className={FIELD_CLASSES}
          />
        </div>

        <div className="flex-3 p-3">
          <label htmlFor="guests" className="text-xs">
            Guests
          </label>
          <select
            id="guests"
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value))}
            className={`${FIELD_CLASSES} appearance-none`}
          >
            {Array.from(
              { length: MAX_GUESTS - MIN_GUESTS + 1 },
              (_, i) => i + MIN_GUESTS,
            ).map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="flex flex-1 cursor-pointer items-center justify-center gap-1 bg-orange-500 px-2 py-5 text-sm font-bold tracking-wider text-white hover:bg-orange-600"
        >
          Search
          <Search className="size-3.5" />
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-orange-700">
          {error}
        </p>
      ) : null}

      {current.checkIn && current.checkOut ? (
        <p className="mt-2 text-xs text-gray-500">
          Showing rooms free for these dates.{" "}
          <button
            type="button"
            onClick={clear}
            className="font-semibold text-orange-500 hover:text-orange-700"
          >
            See every room
          </button>
        </p>
      ) : null}
    </form>
  );
};
