import { useCallback, useEffect, useReducer, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { cancelByCode, fetchReservationByCode } from "../api/reservationService";
import { Eye, EyeOff } from "lucide-react";
import { StayDetails } from "../components/StayDetails";
import { nights } from "../dates";
import { formatPeso } from "../money";
import { quoteStay } from "../pricing";
import { typeLabel, type ReservationDetail } from "../types";

interface State {
  reservation: ReservationDetail | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: ReservationDetail }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  reservation: null,
  loading: true,
  error: null,
};

const reservationReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, reservation: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

// Where Xendit sends the guest after payment, and the only way back into a
// booking — guests have no accounts, so the code on this page is their receipt.
//
// Landing here is *not* what confirms anything. This URL is guessable and
// shareable, so it only ever reports the status the webhook already wrote. A
// booking that still reads PENDING here is one Xendit has not told the API
// about yet, which in development usually means the tunnel is not running.
export const ConfirmationPage: React.FC = () => {
  const { confirmationCode } = useParams<{ confirmationCode: string }>();
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(reservationReducer, initialState);
  // The code is hidden until asked for. It is the only key to this booking, so
  // it should not sit readable in a screenshot or over a shoulder.
  const [revealed, setRevealed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const loadReservation = useCallback(async () => {
    if (!confirmationCode) return;

    dispatch({ type: "FETCH_START" });

    try {
      const data = await fetchReservationByCode(confirmationCode);
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
    }
  }, [confirmationCode]);

  useEffect(() => {
    loadReservation();
  }, [loadReservation]);

  if (state.loading)
    return <p className="py-10 text-gray-500">Loading booking...</p>;

  if (state.error || !state.reservation)
    return (
      <p role="alert" className="py-10 text-orange-700">
        {state.error ?? "No booking matches that code."}
      </p>
    );

  const reservation = state.reservation;
  const failed = searchParams.get("payment") === "failed";
  const { totals, charges } = reservation;
  const settled = totals.settled;
  const stayNights = nights(reservation.checkIn, reservation.checkOut);
  const quote = quoteStay(reservation.nightlyRate, stayNights);

  const cancellable =
    reservation.status === "PENDING" || reservation.status === "CONFIRMED";

  const cancel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(
      new FormData(event.currentTarget).get("guestName") ?? ""
    );

    setCancelling(true);
    setCancelError("");

    try {
      await cancelByCode(reservation.confirmationCode, name);
      loadReservation();
    } catch (caught) {
      setCancelError((caught as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const banner = failed
    ? {
        label: "PAYMENT NOT COMPLETED",
        heading: "We could not take that payment",
        body: "Nothing has been charged. The room is held for a few more minutes — start the booking again to retry.",
      }
    : reservation.status === "PENDING"
      ? {
          label: "AWAITING PAYMENT",
          heading: "Your room is held",
          body: "We are waiting for the payment to clear. This page updates once it does — refresh in a moment.",
        }
      : reservation.status === "CANCELLED"
        ? {
            label: "CANCELLED",
            heading: "This reservation was cancelled",
            body: "If you believe this is wrong, quote the code below to the front desk.",
          }
        : reservation.status === "CHECKED_IN"
          ? {
              label: "CHECKED IN",
              heading: "You are checked in",
              body: settled
                ? "Nothing is outstanding. Anything you add to the room appears below."
                : "Anything added to the room appears below. Settle the balance at the front desk or on your phone.",
            }
          : reservation.status === "CHECKED_OUT"
            ? {
                label: "CHECKED OUT",
                heading: "Thanks for staying",
                body: "Your final bill is below. Quote the code if you need a copy from the front desk.",
              }
            : {
                label: "RESERVATION CONFIRMED",
                heading: "You are booked",
                body: "Keep the confirmation code below — it is what the front desk asks for at check-in.",
              };

  return (
    <div className="flex-col">
      <div className="relative border-b-2 py-5">
        <p className="text-xs font-medium text-orange-500">{banner.label}</p>
        <h1 className="text-4xl font-bold">{banner.heading}</h1>
        <Link
          to="/"
          className="absolute right-0 bottom-0 mb-5 font-bold tracking-tighter text-orange-500 hover:text-orange-300"
        >
          {"<"} Back to rooms
        </Link>
      </div>

      <p className="my-5 w-2/3 text-sm text-gray-500">{banner.body}</p>

      <div className="flex gap-8">
        <div className="flex-2 flex-col">
          <StayDetails
            checkIn={reservation.checkIn}
            checkOut={reservation.checkOut}
            nights={stayNights}
          />

          <div className="mt-5 flex-col">
            <p className="text-xl font-bold">Guest details</p>
            <div className="mt-3 flex-col divide-y-2 divide-gray-400 border-2 border-gray-400">
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500">Name</span>
                <span className="text-sm font-bold">
                  {reservation.guestName}
                </span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500">Guests</span>
                <span className="text-sm font-bold">
                  {reservation.guestCount}
                </span>
              </div>
            </div>
          </div>

          {cancellable ? (
            <div className="mt-5 flex-col border-t-2 pt-5">
              <p className="text-xl font-bold">Cancel this booking</p>
              <p className="my-2 max-w-lg text-xs text-gray-500">
                Confirm the name the booking is under. The room is released
                straight away. Anything already paid is refunded by the front
                desk — quote the code below.
              </p>
              <form onSubmit={cancel} className="mt-2 flex w-full max-w-md">
                <input
                  name="guestName"
                  required
                  placeholder="Full name on the reservation"
                  className="flex-1 border-2 border-gray-400 bg-gray-200 p-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={cancelling}
                  className="bg-gray-700 px-5 text-sm font-bold tracking-wider text-white disabled:bg-gray-400"
                >
                  {cancelling ? "Cancelling..." : "Cancel"}
                </button>
              </form>
              {cancelError ? (
                <p role="alert" className="mt-2 text-sm text-orange-700">
                  {cancelError}
                </p>
              ) : null}
            </div>
          ) : null}

          {charges.length > 0 ? (
            <div className="mt-5 flex-col">
              <p className="text-xl font-bold">Extras on your room</p>
              <div className="mt-3 flex-col divide-y-2 divide-gray-400 border-2 border-gray-400">
                {charges.map((charge) => (
                  <div
                    key={charge.id}
                    className="flex justify-between p-3"
                  >
                    <span className="text-xs text-gray-500">
                      {charge.description}
                    </span>
                    <span className="text-sm font-bold">
                      {formatPeso(charge.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1">
          <div className="mt-5 flex-col divide-y-2 divide-black bg-gray-200 p-3">
            <div className="flex flex-col pb-5">
              <p className="text-xs font-semibold tracking-widest text-orange-500">
                CONFIRMATION CODE
              </p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold tracking-tight">
                  {revealed
                    ? reservation.confirmationCode
                    : `${reservation.confirmationCode.slice(0, 4)}••••`}
                </p>
                <button
                  type="button"
                  onClick={() => setRevealed((shown) => !shown)}
                  aria-label={revealed ? "Hide the code" : "Show the code"}
                  className="text-gray-500 hover:text-orange-500"
                >
                  {revealed ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col py-5">
              <p className="text-xs font-semibold text-orange-500">
                {typeLabel(reservation.roomType).toUpperCase()} | ROOM{" "}
                {reservation.roomNumber}
              </p>
              <p className="text-2xl font-bold">{reservation.roomName}</p>
              <p className="text-xs text-gray-500">
                {quote.nightlyRateLabel} x {stayNights}{" "}
                {stayNights === 1 ? "night" : "nights"}
              </p>
            </div>

            <div className="flex flex-col py-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm">Room &amp; taxes</span>
                <span className="text-sm font-bold">
                  {formatPeso(reservation.totalAmount)}
                </span>
              </div>
              {cancellable ? (
            <div className="mt-5 flex-col border-t-2 pt-5">
              <p className="text-xl font-bold">Cancel this booking</p>
              <p className="my-2 max-w-lg text-xs text-gray-500">
                Confirm the name the booking is under. The room is released
                straight away. Anything already paid is refunded by the front
                desk — quote the code below.
              </p>
              <form onSubmit={cancel} className="mt-2 flex w-full max-w-md">
                <input
                  name="guestName"
                  required
                  placeholder="Full name on the reservation"
                  className="flex-1 border-2 border-gray-400 bg-gray-200 p-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={cancelling}
                  className="bg-gray-700 px-5 text-sm font-bold tracking-wider text-white disabled:bg-gray-400"
                >
                  {cancelling ? "Cancelling..." : "Cancel"}
                </button>
              </form>
              {cancelError ? (
                <p role="alert" className="mt-2 text-sm text-orange-700">
                  {cancelError}
                </p>
              ) : null}
            </div>
          ) : null}

          {charges.length > 0 ? (
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">Extras</span>
                  <span className="text-sm font-bold">
                    {formatPeso(totals.incidentals)}
                  </span>
                </div>
              ) : null}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm">Paid</span>
                <span className="text-sm font-bold text-gray-500">
                  &minus;{formatPeso(totals.paid)}
                </span>
              </div>
              <p className="text-xl font-bold">
                {settled ? "Total paid" : "Balance due"}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Incl. taxes &amp; fees | PHP
                </span>
                <span className="text-3xl font-bold text-orange-500">
                  {settled
                    ? formatPeso(totals.paid)
                    : formatPeso(totals.balance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
