import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

import { HoldTimer } from "./HoldTimer";
import { LifecycleButton } from "./LifecycleButton";
import { folioHref } from "../../utils/search";
import { formatStayDate } from "../../utils/dates";
import { formatPeso } from "../../utils/money";

import {
  RESERVATION_STATUSES,
  type Reservation,
  type ReservationStatus,
} from "../../types";

type Filter = "ALL" | ReservationStatus;

const FILTERS: Filter[] = ["ALL", ...RESERVATION_STATUSES];

const STATUS_CLASSES: Record<ReservationStatus, string> = {
  PENDING: "bg-gray-300 text-gray-800",
  CONFIRMED: "bg-gray-800 text-white",
  CHECKED_IN: "bg-orange-500 text-white",
  CHECKED_OUT: "bg-gray-200 text-gray-500",
  CANCELLED: "bg-gray-200 text-gray-500",
  NO_SHOW: "bg-gray-500 text-white",
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "Hold",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const dateRange = (stay: Reservation) =>
  `${formatStayDate(stay.checkIn).replace(
    /^\w{3}, /,
    "",
  )} → ${formatStayDate(stay.checkOut).replace(/^\w{3}, /, "")}`;

const ClockIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const StatusTag: React.FC<{ stay: Reservation }> = ({ stay }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase ${
      STATUS_CLASSES[stay.status]
    }`}
  >
    {stay.status === "PENDING" && <ClockIcon />}

    {STATUS_LABEL[stay.status]}

    {stay.status === "PENDING" && stay.holdExpiresAt && (
      <HoldTimer expiresAt={new Date(stay.holdExpiresAt)} />
    )}
  </span>
);

interface ReservationsTableProps {
  rows: Reservation[];
  onChanged: () => void;
}

export const ReservationsTable: React.FC<ReservationsTableProps> = ({
  rows,
  onChanged,
}) => {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const pendingCount = useMemo(
    () => rows.filter((stay) => stay.status === "PENDING").length,
    [rows],
  );

  const visible = useMemo(() => {
    const filtered =
      filter === "ALL"
        ? rows
        : rows.filter((stay) => stay.status === filter);

    const term = search.trim().toLowerCase();

    if (!term) return filtered;

    return filtered.filter(
      (stay) =>
        stay.guestName.toLowerCase().includes(term) ||
        stay.confirmationCode.toLowerCase().includes(term) ||
        stay.roomLabel.toLowerCase().includes(term),
    );
  }, [rows, filter, search]);

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex overflow-x-auto border border-gray-300 bg-white">
          {FILTERS.map((option, index) => {
            const active = option === filter;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold ${
                  index > 0 ? "border-l border-gray-300" : ""
                } ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
              >
                {option === "ALL"
                  ? "All"
                  : option.replace("_", " ")}

                {option === "PENDING" && pendingCount > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[9px] ${
                      active
                        ? "bg-white text-gray-800"
                        : "bg-orange-500 text-white"
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search guest, room, or confirmation..."
          className="flex-1 border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-orange-500"
        />
      </div>

      {/* Pending notice */}
      {pendingCount > 0 && (
        <div className="border-l-2 border-orange-500 bg-gray-200 px-4 py-3 text-xs text-gray-500">
          <span className="font-bold text-gray-800">
            {pendingCount} reservation
            {pendingCount !== 1 ? "s" : ""} on hold.
          </span>{" "}
          Rooms remain blocked while guests complete payment.
        </div>
      )}

      {/* Reservation count */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">
          Reservations
        </h2>

        <span className="text-xs text-gray-500">
          {visible.length} of {rows.length}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto border border-gray-300 bg-white md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-200">
              {[
                "Confirmation",
                "Guest",
                "Room",
                "Dates",
                "Guests",
                "Total",
                "Status",
                "",
              ].map((heading) => (
                <th
                  key={heading}
                  className={`px-4 py-3 text-left text-[10px] font-bold tracking-widest text-gray-500 uppercase ${
                    heading === "Guests" || heading === "Total"
                      ? "text-right"
                      : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visible.map((stay) => (
              <tr
                key={stay.id}
                className="border-b border-gray-300 last:border-0 hover:bg-gray-200"
              >
                <td className="px-4 py-4 text-xs font-bold text-gray-800">
                  {stay.confirmationCode}
                </td>

                <td className="px-4 py-4 text-sm font-bold text-gray-800">
                  {stay.guestName}
                </td>

                <td className="px-4 py-4 text-xs text-gray-500">
                  {stay.roomLabel}
                </td>

                <td className="px-4 py-4 text-xs text-gray-800">
                  {dateRange(stay)}
                  <span className="ml-1 text-gray-500">
                    · {stay.nights}n
                  </span>
                </td>

                <td className="px-4 py-4 text-right text-xs text-gray-500">
                  {stay.guestCount}
                </td>

                <td className="px-4 py-4 text-right text-sm font-bold text-gray-800">
                  {formatPeso(stay.totalAmount)}
                </td>

                <td className="px-4 py-4">
                  <StatusTag stay={stay} />
                </td>

                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-3">
                    {(stay.status === "PENDING" ||
                      stay.status === "CONFIRMED") && (
                      <LifecycleButton
                        reservationId={stay.id}
                        action="CANCEL"
                        onDone={onChanged}
                      />
                    )}

                    {stay.status === "CONFIRMED" && (
                      <LifecycleButton
                        reservationId={stay.id}
                        action="NO_SHOW"
                        onDone={onChanged}
                      />
                    )}

                    <Link
                      to={folioHref(stay.confirmationCode)}
                      className="text-xs font-bold text-orange-500 hover:text-orange-600"
                    >
                      {stay.status === "PENDING"
                        ? "View hold"
                        : "Folio"}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {visible.map((stay) => (
          <div
            key={stay.id}
            className="border border-gray-300 bg-white"
          >
            <div className="flex items-start justify-between border-b border-gray-300 p-4">
              <div>
                <p className="font-bold text-gray-800">
                  {stay.guestName}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {stay.confirmationCode}
                </p>
              </div>

              <StatusTag stay={stay} />
            </div>

            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="p-3">
                <p className="text-[10px] text-gray-500">
                  DATES
                </p>
                <p className="mt-1 text-xs font-bold text-gray-800">
                  {dateRange(stay)}
                </p>
                <p className="mt-1 text-[10px] text-gray-500">
                  {stay.nights} night
                  {stay.nights !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="border-l border-gray-300 p-3">
                <p className="text-[10px] text-gray-500">
                  GUESTS
                </p>
                <p className="mt-1 font-bold text-gray-800">
                  {stay.guestCount}
                </p>
              </div>

              <div className="border-l border-gray-300 p-3">
                <p className="text-[10px] text-gray-500">
                  TOTAL
                </p>
                <p className="mt-1 text-xs font-bold text-gray-800">
                  {formatPeso(stay.totalAmount)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4">
              <span className="text-xs text-gray-500">
                {stay.roomLabel}
              </span>

              <Link
                to={folioHref(stay.confirmationCode)}
                className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-800 hover:border-orange-500 hover:text-orange-500"
              >
                {stay.status === "PENDING"
                  ? "View hold"
                  : "Folio"}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="border border-gray-300 bg-white p-8 text-center">
          <p className="font-bold text-gray-800">
            No reservations yet
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Guest bookings will appear here.
          </p>

          <Link
            to="/admin/rooms"
            className="mt-4 inline-block bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
          >
            Review rooms
          </Link>
        </div>
      )}

      {/* Filter/search empty state */}
      {rows.length > 0 && visible.length === 0 && (
        <div className="border border-gray-300 bg-white p-8 text-center">
          <p className="font-bold text-gray-800">
            No matching reservations
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Try a different search or status filter.
          </p>

          <button
            type="button"
            onClick={() => {
              setFilter("ALL");
              setSearch("");
            }}
            className="mt-4 border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-800 hover:border-orange-500"
          >
            Show all
          </button>
        </div>
      )}
    </section>
  );
};