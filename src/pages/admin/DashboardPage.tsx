import { useCallback, useEffect, useReducer } from "react";
import { Link } from "react-router-dom";

import { fetchDashboard } from "../../api/reservationService";
import { FrontDeskButton } from "../../components/FrontDeskButton";
import { formatStamp, formatToday } from "../../utils/dates";
import { formatPeso } from "../../utils/money";
import { folioHref } from "../../utils/search";
import type { DashboardData, Reservation } from "../../types";

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// "104 · Harbor Standard · 1 night · 2 guests · IKX-4823"
const stayLine = (stay: Reservation): string =>
  [
    stay.roomLabel,
    plural(stay.nights, "night"),
    plural(stay.guestCount, "guest"),
    stay.confirmationCode,
  ].join(" · ");

interface State {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: DashboardData }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  data: null,
  loading: true,
  error: null,
};

const dashboardReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, data: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

export const DashboardPage: React.FC = () => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // A useCallback rather than an inline function, because the check-in and
  // check-out buttons call it again once a transition lands.
  const loadDashboard = useCallback(async () => {
    dispatch({ type: "FETCH_START" });

    try {
      const data = await fetchDashboard();
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (state.loading)
    return <p className="py-10 text-[#201e1d]/55">Loading dashboard...</p>;

  if (state.error || !state.data)
    return (
      <p role="alert" className="py-10 text-[#b8250e]">
        Error: {state.error ?? "No dashboard data"}
      </p>
    );

  const {
    arrivals,
    departures,
    inHouseGuests,
    occupiedRooms,
    totalRooms,
    occupancyPercent,
    arrivedCount,
    balancesToSettle,
  } = state.data;

  const stats = [
    {
      label: "Arrivals today",
      value: String(arrivals.length),
      note:
        arrivedCount > 0
          ? `${arrivedCount} already checked in`
          : "none checked in yet",
    },
    {
      label: "Departures due",
      value: String(departures.length),
      note:
        balancesToSettle > 0
          ? `${plural(balancesToSettle, "balance")} to settle`
          : "nothing outstanding",
    },
    {
      label: "In house",
      value: String(inHouseGuests),
      note: `across ${plural(occupiedRooms, "room")}`,
    },
    {
      label: "Occupancy",
      value: `${occupancyPercent}%`,
      note: `${occupiedRooms} of ${totalRooms} rooms`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-bold tracking-[.14em] text-orange-500 uppercase">
          Today at a glance
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage today's arrivals, departures, and room activity.
            </p>
          </div>
          <div className="text-sm font-medium">
            {formatToday()} · Iloilo City
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-sm border border-gray-300 bg-white p-5 transition-shadow hover:shadow-sm"
          >
            <div className="text-xs font-bold tracking-wider text-orange-500 uppercase">
              {stat.label}
            </div>
            <div className="mt-3 text-4xl font-bold tracking-tight">
              {stat.value}
            </div>
            <div className="mt-2 text-xs text-gray-500">{stat.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Check-ins */}
        <section className="rounded-sm border border-gray-300 bg-white">
          <div className="flex flex-col gap-2 border-b border-gray-300 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold tracking-tight">
              Expected check-ins
            </h2>
            <p className="text-xs mt-1 text-gray-500">
              Standard check-in from 3:00 PM
            </p>
          </div>

          {arrivals.length > 0 ? (
            <div>
              {arrivals.map((stay, i) => {
                const arrived = stay.status === "CHECKED_IN";

                return (
                  <div
                    key={stay.id}
                    className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${
                      i > 0 ? "border-t border-black" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{stay.guestName}</span>
                        <span
                          className={`px-2 py-1 text-[9px] font-bold tracking-wider uppercase ${
                            arrived
                              ? "bg-orange-500 text-gray-300"
                              : "bg-orange-600 text-white"
                          }`}
                        >
                          {arrived ? "Checked in" : "Confirmed"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs">{stayLine(stay)}</div>
                      {arrived && stay.checkedInAt ? (
                        <div className="mt-1 text-[11px]">
                          Checked in {formatStamp(new Date(stay.checkedInAt))}
                        </div>
                      ) : null}
                    </div>

                    {arrived ? (
                      <Link
                        to={folioHref(stay.confirmationCode)}
                        className="inline-flex items-center justify-center border border-[#2B355A] px-4 py-2.5 text-xs font-bold transition-colors hover:bg-blue-950 hover:text-white"
                      >
                        View folio
                      </Link>
                    ) : (
                      <FrontDeskButton
                        reservationId={stay.id}
                        transition="IN"
                        label="Check in"
                        pendingLabel="Checking in…"
                        onDone={loadDashboard}
                        className="bg-orange-500 text-white hover:bg-orange-400"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5">
              <div className="font-bold">No arrivals today</div>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-gray-500">
                Nobody is due to check in. Confirmed reservations for later
                dates appear here on the morning of arrival.
              </p>
            </div>
          )}
        </section>

        {/* Check-outs */}
        <section className="rounded-sm border border-gray-300 bg-white">
          <div className="flex flex-col gap-2 border-b border-gray-300 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold tracking-tight">
              Expected check-outs
            </h2>
            <span className="text-xs mt-1 text-gray-500">
              Standard check-out by 11:00 AM
            </span>
          </div>

          {departures.length > 0 ? (
            <div>
              {departures.map((stay, i) => {
                return (
                  <div
                    key={stay.id}
                    className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${
                      i > 0 ? "border-t-2 border-black" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className=" font-bold">{stay.guestName}</div>
                      <div className="mt-1 text-xs">
                        {stay.roomLabel} · {stay.confirmationCode}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div
                        className={`font-bold ${
                          stay.owing ? "text-orange-500" : "text-black"
                        }`}
                      >
                        {formatPeso(stay.balance)}
                      </div>
                      <Link
                        to={folioHref(stay.confirmationCode)}
                        className="text-[11px] text-black hover:text-orange-500"
                      >
                        {stay.owing
                          ? "Balance due · open folio"
                          : "Settled · folio"}
                      </Link>
                    </div>

                    <FrontDeskButton
                      reservationId={stay.id}
                      transition="OUT"
                      label="Check out"
                      pendingLabel="Checking out…"
                      onDone={loadDashboard}
                      className="border border-[#201e1d]/40 text-[#201e1d]"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5">
              <div className="font-bold">No departures due</div>
              <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-gray-500">
                No in-house guest is due to leave. Balances to settle will
                appear here on the morning of departure.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
