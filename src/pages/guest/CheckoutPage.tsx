import { useEffect, useReducer, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchRoom } from "../../api/roomService";
import { createReservation } from "../../api/reservationService";
import { BookingCard } from "../../components/checkout/BookingCard";
import { GuestDetails } from "../../components/checkout/GuestDetails";
import { StayDetails } from "../../components/StayDetails";
import { addDays, nights, today } from "../../utils/dates";
import { quoteStay } from "../../utils/pricing";
import { parseSearch, toSearchParams } from "../../utils/search";
import type { Room } from "../../types";

interface State {
  room: Room | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Room }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  room: null,
  loading: true,
  error: null,
};

const roomReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, room: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

// Review and confirm. Submitting holds the room and opens Xendit's hosted
// checkout — the card is entered on their page and never reaches this app.
export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const roomId = searchParams.get("room") ?? "";

  // The catalog can be browsed without dates, so default to one night starting
  // today. The same dates go into the request, which is why the page and the
  // reservation cannot disagree about the stay.
  const query = parseSearch(searchParams);
  const checkIn = query.checkIn ?? today();
  const checkOut = query.checkOut ?? addDays(checkIn, 1);

  // Back to the catalog with the same search still in the URL, so changing the
  // dates starts from what the guest already picked. The parsed query, not the
  // tonight default above: a guest who browsed without dates goes back to every
  // room, not a search they never ran.
  const backHref = `/?${toSearchParams(query)}`;

  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) {
        dispatch({ type: "FETCH_ERROR", payload: "No room chosen" });
        return;
      }

      dispatch({ type: "FETCH_START" });

      try {
        const data = await fetchRoom(roomId);
        dispatch({ type: "FETCH_SUCCESS", payload: data });
      } catch (caught) {
        dispatch({ type: "FETCH_ERROR", payload: (caught as Error).message });
      }
    };
    loadRoom();
  }, [roomId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    setPending(true);
    setError("");

    try {
      const { invoiceUrl } = await createReservation({
        roomId,
        guestName: String(data.get("guestName") ?? ""),
        guestCount: query.guests,
        checkIn,
        checkOut,
      });

      // Off to Xendit's hosted page. A full navigation rather than a router
      // push, since it is a different origin. assign() rather than setting
      // location.href — the same thing, but a call instead of writing to a
      // binding React's immutability rule guards.
      window.location.assign(invoiceUrl);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  };

  if (state.loading)
    return <p className="py-10 text-gray-500">Loading room...</p>;

  if (state.error || !state.room)
    return (
      <p role="alert" className="py-10 text-orange-700">
        {state.error ?? "That room is no longer listed."}
      </p>
    );

  const room = state.room;

  // Display only. The API recomputes this from the stored rate before it writes
  // anything or asks Xendit for an amount.
  const quote = quoteStay(room.nightlyRate, nights(checkIn, checkOut));

  return (
    <div className="flex-col">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 py-5">
        <div>
          <p className="text-xs font-medium text-orange-500">
            RESERVATION CHECKOUT
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">Review &amp; confirm</h1>
        </div>
        <Link
          to={backHref}
          className="font-bold tracking-tighter text-orange-500 hover:text-orange-300"
        >
          {"<"} Back to rooms
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex-2 flex-col">
            <StayDetails
              checkIn={checkIn}
              checkOut={checkOut}
              nights={quote.nights}
              guests={query.guests}
              changeHref={`${backHref}#stay-search`}
            />
            <GuestDetails />
          </div>
          <div className="flex-1 lg:sticky lg:top-4">
            <BookingCard room={room} quote={quote} pending={pending} />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-8 border-2 border-orange-500 bg-orange-50 p-3 text-sm text-orange-700"
          >
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
};
