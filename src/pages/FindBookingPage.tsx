import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchReservationByCode } from "../api/reservationService";

const PREFIX = "IKX";

// Every code is `IKX-` plus four digits, so the guest only ever has to type the
// digits — the prefix and the dash write themselves. Typing the prefix out is
// fine too: the letters echo back as they are typed and the dash lands once
// `IKX` is complete. Pasting from the email works because only the digits are
// ever read.
//
// `previous` is what the field held a keystroke ago, and it exists for one
// case: backspacing the dash off `IKX-`. Without it the dash is re-added the
// instant it is deleted and the field cannot be cleared.
const formatCode = (raw: string, previous: string) => {
  const deleting = raw.length < previous.length;
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = clean.replace(/\D/g, "").slice(0, 4);

  if (digits) return `${PREFIX}-${digits}`;

  // No digits yet, so echo back however much of IKX has been typed. Letters
  // that are not the next one in the prefix are dropped rather than shown,
  // which keeps the field from ever holding something that is not a code.
  const kept = clean
    .replace(/[^A-Z]/g, "")
    .split("")
    .reduce((acc, letter) => (PREFIX[acc.length] === letter ? acc + letter : acc), "");

  return kept === PREFIX && !deleting ? `${PREFIX}-` : kept;
};

// Code lookup, which is the whole of "my bookings" when guests have no
// accounts. The code is the only thing tying a person to a reservation.
export const FindBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [missed, setMissed] = useState(false);
  const [searching, setSearching] = useState(false);

  // A half-typed code is not worth a round trip, and "no booking matches that
  // code" is a misleading thing to say about `IKX-16`.
  const complete = /^IKX-\d{4}$/.test(code);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!complete) return;

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
            value={code}
            onChange={(event) =>
              setCode((current) => formatCode(event.target.value, current))
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder="IKX-4820"
            className="flex-1 border-2 border-gray-400 bg-gray-200 p-3 tracking-widest uppercase"
          />
          <button
            type="submit"
            disabled={searching || !complete}
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
