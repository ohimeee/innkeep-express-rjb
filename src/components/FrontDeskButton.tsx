import { useState } from "react";

import { checkIn, checkOut } from "../api/reservationService";
import { Spinner } from "./Spinner";

interface FrontDeskButtonProps {
  reservationId: string;
  transition: "IN" | "OUT";
  label: string;
  pendingLabel: string;
  className: string;
  // The parent refetches after a successful transition. Without server-side
  // revalidation there is nothing else to redraw the row with its new status.
  onDone: () => void;
}

// The check-in / check-out button, wherever it appears.
//
// No optimistic update. A check-out can be refused for a balance the desk has
// to collect first, and briefly showing "Checked out" before snapping back is
// exactly the wrong thing to tell someone standing at the counter.
export const FrontDeskButton: React.FC<FrontDeskButtonProps> = ({
  reservationId,
  transition,
  label,
  pendingLabel,
  className,
  onDone,
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      if (transition === "IN") {
        await checkIn(reservationId);
      } else {
        await checkOut(reservationId);
      }
      onDone();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-none flex-col items-end gap-1.5"
    >
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold ${
          pending ? "cursor-progress opacity-60" : "cursor-pointer"
        } ${className}`}
      >
        {pending && <Spinner />}
        {pending ? pendingLabel : label}
      </button>

      {error ? (
        <p
          role="alert"
          className="max-w-[34ch] text-right text-[11px] leading-snug text-[#b8250e]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
};
