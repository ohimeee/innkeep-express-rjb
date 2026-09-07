import { useCallback, useEffect, useReducer } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchFolio } from "../api/folioService";
import { ChargeForm } from "../components/ChargeForm";
import { FrontDeskButton } from "../components/FrontDeskButton";
import { PaymentForm } from "../components/PaymentForm";
import { formatLongDate, formatStamp } from "../dates";
import { formatPesoExact } from "../money";
import {
  DEPARTMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  typeLabel,
  type Folio,
  type ReservationStatus,
} from "../types";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "ON HOLD",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED IN",
  CHECKED_OUT: "CHECKED OUT",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO SHOW",
};

const STATUS_CLASSES: Record<ReservationStatus, string> = {
  PENDING: "border border-[#ec3013] bg-[#ec3013]/10 text-[#b8250e]",
  CONFIRMED: "bg-[#ec3013] text-[#f3f2f2]",
  CHECKED_IN: "bg-[#e15b47] text-[#f3f2f2]",
  CHECKED_OUT: "bg-[#eae9e9] text-[#201e1d]/70",
  CANCELLED: "border border-[#201e1d]/40 text-[#201e1d]/45",
  NO_SHOW: "border border-[#201e1d]/40 bg-[#201e1d]/10 text-[#201e1d]/60",
};

const BackLink: React.FC = () => (
  <Link
    to="/admin/reservations"
    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#ec3013] hover:text-[#b8250e]"
  >
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
    All reservations
  </Link>
);

// One guest's bill, keyed on the confirmation code in the route — the thing the
// guest reads off their phone and what the front desk types.
interface State {
  folio: Folio | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Folio }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  folio: null,
  loading: true,
  error: null,
};

const folioReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, folio: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

export const FolioPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [state, dispatch] = useReducer(folioReducer, initialState);

  // A useCallback rather than an inline function, because posting a charge,
  // recording a payment and checking out all call it again afterwards.
  const loadFolio = useCallback(async () => {
    if (!code) return;

    dispatch({ type: "FETCH_START" });

    try {
      const data = await fetchFolio(code);
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
    }
  }, [code]);

  useEffect(() => {
    loadFolio();
  }, [loadFolio]);

  // Refetch whenever this tab comes back to the front.
  //
  // A gateway settlement is paid in another tab, and the money lands here via
  // Xendit's webhook seconds or minutes later — there is no moment in this
  // component's lifecycle to hang a refetch on. Switching back from the payment
  // page is exactly when the balance needs to be right, so that is the signal.
  //
  // It also covers the ordinary case of two people at the desk: a charge posted
  // on the other terminal shows up as soon as this one is looked at again.
  useEffect(() => {
    const refetchWhenVisible = () => {
      if (document.visibilityState === "visible") loadFolio();
    };

    document.addEventListener("visibilitychange", refetchWhenVisible);
    window.addEventListener("focus", loadFolio);

    return () => {
      document.removeEventListener("visibilitychange", refetchWhenVisible);
      window.removeEventListener("focus", loadFolio);
    };
  }, [loadFolio]);

  if (state.loading)
    return <p className="py-10 text-[#201e1d]/55">Loading folio...</p>;

  if (state.error || !state.folio)
    return (
      <div>
        <BackLink />
        <p role="alert" className="py-10 text-[#b8250e]">
          Error: {state.error ?? "No folio for that code"}
        </p>
      </div>
    );

  const folio = state.folio;
  const { totals } = folio;

  const stay = [
    {
      label: "Check-in",
      value: formatLongDate(folio.checkIn),
      note: "From 3:00 PM",
    },
    {
      label: "Check-out",
      value: formatLongDate(folio.checkOut),
      note: "Until 11:00 AM",
    },
    {
      label: "Room",
      value: folio.roomName,
      note: `No. ${folio.roomNumber} · ${typeLabel(folio.roomType)}`,
    },
    {
      label: "Guests",
      value: `${folio.guestCount} ${folio.guestCount === 1 ? "guest" : "guests"}`,
      note: `${formatPesoExact(folio.nightlyRate)}/night`,
    },
  ];

  return (
    <div>
      <BackLink />

      <div className="mt-4 text-[11px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
        Folio · {folio.confirmationCode}
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-heading m-0 text-[42px] leading-none font-extrabold tracking-tight">
          {folio.guestName}
        </h1>
        <span
          className={`inline-flex px-3 py-1.5 text-[10px] font-extrabold tracking-widest ${
            STATUS_CLASSES[folio.status]
          }`}
        >
          {STATUS_LABEL[folio.status]}
        </span>
      </div>
      <hr className="mt-6 h-0.5 border-0 bg-[#201e1d]/40" />

      <div className="mt-8 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-8">
          {/* Stay summary */}
          <section>
            <h2 className="m-0 text-xl font-extrabold tracking-tight">
              Stay summary
            </h2>
            <div className="mt-4 grid grid-cols-2 border border-[#201e1d]/40 md:grid-cols-4">
              {stay.map((cell, i) => (
                <div
                  key={cell.label}
                  className={[
                    "p-4",
                    i % 2 !== 0 ? "border-l-2 border-[#201e1d]/40" : "",
                    i >= 2
                      ? "border-t-2 border-[#201e1d]/40 md:border-t-0"
                      : "",
                    i % 4 !== 0
                      ? "md:border-l-2 md:border-[#201e1d]/40"
                      : "md:border-l-0",
                  ].join(" ")}
                >
                  <div className="text-[10px] font-semibold tracking-wide text-[#ec3013] uppercase">
                    {cell.label}
                  </div>
                  <div className="mt-2 text-[15px] font-extrabold">
                    {cell.value}
                  </div>
                  <div className="mt-1 text-[11px] text-[#201e1d]/55">
                    {cell.note}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Incidental charges */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="m-0 text-xl font-extrabold tracking-tight">
                Incidental charges
              </h2>
              <span className="text-[13px] text-[#201e1d]/55">
                {folio.charges.length
                  ? `${folio.charges.length} posted`
                  : "None posted"}
              </span>
            </div>

            {folio.charges.length > 0 ? (
              <>
                {/* Table (desktop) */}
                <div className="mt-4 hidden overflow-x-auto border border-[#201e1d]/40 md:block">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#201e1d]/40 bg-[#eae9e9]">
                        {[
                          "Date",
                          "Description",
                          "Department",
                          "Posted by",
                          "Amount",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className={`px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-[#201e1d]/60 uppercase ${
                              heading === "Amount" ? "text-right" : ""
                            }`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {folio.charges.map((charge) => (
                        <tr
                          key={charge.id}
                          className="border-b border-[#201e1d]/20 last:border-0"
                        >
                          <td className="px-4 py-3 text-[13px] text-[#201e1d]/70 tabular-nums">
                            {formatStamp(new Date(charge.createdAt))}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">
                            {charge.description}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-[#201e1d]/70">
                            {DEPARTMENT_LABELS[charge.department]}
                          </td>
                          <td className="px-4 py-3 text-[13px] font-semibold text-[#201e1d]/70">
                            {charge.postedBy ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums">
                            {formatPesoExact(charge.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards (mobile) */}
                <div className="mt-4 flex flex-col gap-4 md:hidden">
                  {folio.charges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-start justify-between gap-3 border border-[#201e1d]/40 p-4"
                    >
                      <div>
                        <div className="text-sm font-extrabold">
                          {charge.description}
                        </div>
                        <div className="mt-1 text-[11px] text-[#201e1d]/55 tabular-nums">
                          {formatStamp(new Date(charge.createdAt))} ·{" "}
                          {DEPARTMENT_LABELS[charge.department]}
                          {charge.postedBy ? ` · ${charge.postedBy}` : ""}
                        </div>
                      </div>
                      <div className="text-[15px] font-extrabold tabular-nums">
                        {formatPesoExact(charge.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 border border-[#201e1d]/40 p-8">
                <div className="text-[17px] font-extrabold tracking-tight">
                  Nothing posted yet
                </div>
                <p className="mt-1.5 max-w-[48ch] text-[12.5px] leading-relaxed text-[#201e1d]/60">
                  This stay has no incidental charges. The balance to the right
                  is room and VAT only — post minibar, laundry or transport
                  below as they happen.
                </p>
              </div>
            )}

            <ChargeForm reservationId={folio.id} onPosted={loadFolio} />
          </section>
        </div>

        {/* Balance panel */}
        <aside className="border border-[#201e1d]/40 bg-[#eae9e9] md:sticky md:top-6">
          <div className="border-b-2 border-[#201e1d]/40 p-4">
            <div className="text-[10px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
              Running balance
            </div>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Folio total
            </h2>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-sm">Room</div>
                <div className="mt-0.5 text-[11px] text-[#201e1d]/55 tabular-nums">
                  {formatPesoExact(folio.nightlyRate)} × {folio.nights}{" "}
                  {folio.nights === 1 ? "night" : "nights"}
                </div>
              </div>
              <span className="text-sm font-extrabold tabular-nums">
                {formatPesoExact(totals.roomTotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">VAT (12%)</span>
              <span className="text-sm font-extrabold tabular-nums">
                {formatPesoExact(totals.tax)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">Incidentals</span>
              <span className="text-sm font-extrabold tabular-nums">
                {formatPesoExact(totals.incidentals)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-sm">Payments</div>
                {folio.payments.length > 0 ? (
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {folio.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="text-[11px] text-[#201e1d]/55 tabular-nums"
                      >
                        {PAYMENT_METHOD_LABELS[payment.method]}{" "}
                        · {formatStamp(new Date(payment.paidAt))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[11px] text-[#201e1d]/55">
                    Nothing received yet
                  </div>
                )}
              </div>
              <span className="text-sm font-extrabold text-[#201e1d]/55 tabular-nums">
                −{formatPesoExact(totals.paid)}
              </span>
            </div>
          </div>

          <div className="bg-[#ec3013] p-4 text-[#f3f2f2]">
            <div className="text-[10px] font-semibold tracking-[.14em] uppercase opacity-85">
              Balance due
            </div>
            <div className="font-heading mt-2 text-[38px] leading-[.92] font-extrabold tracking-tight tabular-nums">
              {formatPesoExact(totals.balance)}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t-2 border-[#201e1d]/40 p-4">
            {folio.status === "CONFIRMED" ? (
              <FrontDeskButton
                reservationId={folio.id}
                transition="IN"
                label="Check in"
                pendingLabel="Checking in…"
                onDone={loadFolio}
                className="w-full justify-center bg-[#ec3013] text-[#f3f2f2] hover:bg-[#d32a10]"
              />
            ) : (
              <>
                <div className="flex w-full items-center justify-between border border-[#201e1d]/40 px-4 py-3 text-[13px] font-semibold text-[#201e1d]/45">
                  Check in
                  <span className="text-[10px] tracking-wide">
                    {folio.checkedInAt ? "DONE" : "NOT YET"}
                  </span>
                </div>
                {folio.checkedInAt ? (
                  <div className="-mt-2 text-[11px] text-[#201e1d]/55 tabular-nums">
                    Checked in {formatStamp(new Date(folio.checkedInAt))}
                  </div>
                ) : null}
              </>
            )}

            {folio.status === "CHECKED_IN" ? (
              <FrontDeskButton
                reservationId={folio.id}
                transition="OUT"
                label="Check out"
                pendingLabel="Checking out…"
                onDone={loadFolio}
                className="font-heading w-full justify-center bg-[#ec3013] py-3 text-sm font-extrabold text-[#f3f2f2] hover:bg-[#d32a10]"
              />
            ) : (
              <>
                <div className="flex w-full items-center justify-between border border-[#201e1d]/40 px-4 py-3 text-[13px] font-semibold text-[#201e1d]/45">
                  Check out
                  <span className="text-[10px] tracking-wide">
                    {folio.checkedOutAt ? "DONE" : "NOT YET"}
                  </span>
                </div>
                {folio.checkedOutAt ? (
                  <div className="-mt-2 text-[11px] text-[#201e1d]/55 tabular-nums">
                    Checked out {formatStamp(new Date(folio.checkedOutAt))}
                  </div>
                ) : null}
              </>
            )}

            {/* Check-out is refused while anything is owed, so this is the only
                way to clear a balance run up during the stay. */}
            {totals.settled ? (
              <div className="text-[11px] text-[#201e1d]/55">
                Nothing outstanding on this folio.
              </div>
            ) : (
              <PaymentForm
                reservationId={folio.id}
                balance={totals.balance}
                onRecorded={loadFolio}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
