import { useState } from "react";

import { cancelReservation, markNoShow } from "../api/reservationService";
import { Spinner } from "./Spinner";

interface LifecycleButtonProps {
  reservationId: string;
  action: "CANCEL" | "NO_SHOW";
  onDone: () => void;
}

const COPY = {
  CANCEL: { idle: "Cancel", confirm: "Sure?", busy: "Cancelling…" },
  NO_SHOW: { idle: "No-show", confirm: "Sure?", busy: "Marking…" },
};

// Cancel a booking, or mark it a no-show.
//
// Two clicks, not a browser confirm(). Both actions free a room and neither can
// be undone in the app, so a stray click on a busy front desk should not be
// enough — but a modal for something this small is worse than the risk.
export const LifecycleButton: React.FC<LifecycleButtonProps> = ({
  reservationId,
  action,
  onDone,
}) => {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (action === "CANCEL") {
        await cancelReservation(reservationId);
      } else {
        await markNoShow(reservationId);
      }
      onDone();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  const copy = COPY[action];

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        onBlur={() => setArmed(false)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
          armed ? "text-[#b8250e] underline" : "text-[#201e1d]/55"
        } hover:text-[#b8250e]`}
      >
        {busy && <Spinner />}
        {busy ? copy.busy : armed ? copy.confirm : copy.idle}
      </button>
      {error ? (
        <span
          role="alert"
          className="max-w-[30ch] text-right text-[10.5px] leading-snug text-[#b8250e]"
        >
          {error}
        </span>
      ) : null}
    </span>
  );
};
