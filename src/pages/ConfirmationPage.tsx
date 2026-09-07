import { useEffect, useReducer } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { fetchReservationByCode } from "../api/reservationService";
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

  useEffect(() => {
    const loadReservation = async () => {
      if (!confirmationCode) return;

      dispatch({ type: "FETCH_START" });

      try {
        const data = await fetchReservationByCode(confirmationCode);
        dispatch({ type: "FETCH_SUCCESS", payload: data });
      } catch (error) {
        dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
      }
    };
    loadReservation();
  }, [confirmationCode]);

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
  const stayNights = nights(reservation.checkIn, reservation.checkOut);
  const quote = quoteStay(reservation.nightlyRate, stayNights);

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
        </div>

        <div className="flex-1">
          <div className="mt-5 flex-col divide-y-2 divide-black bg-gray-200 p-3">
            <div className="flex flex-col pb-5">
              <p className="text-xs font-semibold tracking-widest text-orange-500">
                CONFIRMATION CODE
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {reservation.confirmationCode}
              </p>
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
                <span className="text-sm">Taxes &amp; fees</span>
                <span className="text-sm font-bold">
                  {formatPeso(reservation.taxAmount)}
                </span>
              </div>
              <p className="text-xl font-bold">Total</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Incl. taxes &amp; fees | PHP
                </span>
                <span className="text-3xl font-bold text-orange-500">
                  {formatPeso(reservation.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
