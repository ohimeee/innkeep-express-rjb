import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchReservationByCode } from "../api/reservationService";

// Code lookup, which is the whole of "my bookings" when guests have no
// accounts. The code is the only thing tying a person to a reservation.
export const FindBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [missed, setMissed] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = String(new FormData(event.currentTarget).get("code") ?? "")
      .trim()
      .toUpperCase();

    if (!code) return;

    setSearching(true);
    setMissed(false);

    try {
      await fetchReservationByCode(code);
      navigate(`/booking/${encodeURIComponent(code)}`);
    } catch {
      // A mistyped code is a typo, not an error page. The response is also
      // identical whether the code exists or not, so this form cannot be used
      // to enumerate bookings.
      setMissed(true);
      setSearching(false);
    }
  };

  return (
    <div className="flex-col">
      <div className="border-b-2 py-5">
        <p className="text-xs font-medium text-orange-500">GUEST LOOKUP</p>
        <h1 className="text-4xl font-bold">Find your booking</h1>
      </div>

      <form onSubmit={handleSubmit} className="my-8 flex-col">
        <label htmlFor="code" className="text-xs text-gray-500">
          Confirmation code
        </label>
        <div className="mt-2 flex w-full max-w-md">
          <input
            id="code"
            name="code"
            required
            placeholder="IKX-4820"
            className="flex-1 border-2 border-gray-400 bg-gray-200 p-3 tracking-widest uppercase"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-orange-500 px-6 text-sm font-bold tracking-wider text-white disabled:bg-orange-300"
          >
            {searching ? "Finding..." : "Find"}
          </button>
        </div>

        {missed ? (
          <p role="alert" className="mt-3 text-sm text-orange-700">
            No booking matches that code. Check it against your confirmation
            email.
          </p>
        ) : null}
      </form>
    </div>
  );
};
