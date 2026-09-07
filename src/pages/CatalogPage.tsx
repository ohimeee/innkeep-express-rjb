import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import InfoBar from "../components/guest/InfoBar";
import RoomCard from "../components/guest/RoomCard";
import { fetchRooms } from "../api/roomService";
import { checkoutHref, parseSearch } from "../search";
import type { Room } from "../types";

/** Rooms, loading and error as one value — the shape pie-frontend's reducer uses. */
type State = {
  rooms: Room[];
  loading: boolean;
  error: string;
};

const INITIAL: State = { rooms: [], loading: true, error: "" };

/**
 * The room catalog, and the availability search that filters it.
 *
 * The query comes from the URL rather than component state, so a search can be
 * shared or reloaded and the back button walks through previous searches. This
 * is what the Next version got from a server component reading `searchParams`;
 * `useSearchParams` plays the same role here and the fetch runs in an effect.
 */
const CatalogPage = () => {
  const [searchParams] = useSearchParams();
  const query = parseSearch(searchParams);

  const [state, setState] = useState<State>(INITIAL);

  // The URL string, not the parsed object: `query` is a fresh object every
  // render, so depending on it directly would refetch forever.
  const search = searchParams.toString();

  useEffect(() => {
    let cancelled = false;

    // Nothing is set synchronously here. The previous results stay on screen
    // until the new ones land, which avoids both a flash of empty state and
    // the cascading render that a setState in the effect body causes.
    fetchRooms(parseSearch(new URLSearchParams(search)))
      .then((rooms) => {
        if (!cancelled) setState({ rooms, loading: false, error: "" });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;

        setState({
          rooms: [],
          loading: false,
          error:
            cause instanceof Error ? cause.message : "Could not load rooms",
        });
      });

    // A slow response from an earlier search must not overwrite a newer one —
    // without this, two searches in quick succession can leave the older
    // result on screen.
    return () => {
      cancelled = true;
    };
  }, [search]);

  const searched = Boolean(query.checkIn && query.checkOut);

  return (
    <div className="flex-col">
      <div className="border-b-2 py-5">
        <p className="text-xs font-medium text-orange-500">BOUTIQUE STAYS</p>
        <h1 className="text-4xl font-bold">Rooms &amp; suites</h1>
      </div>

      {/* Still the static bar from the design. Wiring it to the search is
          IMPLEMENTATION2.md step 7 — the query above already reads the URL, so
          it only needs inputs that push dates into it. */}
      <InfoBar />

      {state.loading ? (
        <p className="py-10 text-gray-500">Loading rooms…</p>
      ) : state.error ? (
        <p role="alert" className="py-10 text-orange-700">
          {state.error} — is the API running on port 4000?
        </p>
      ) : state.rooms.length === 0 ? (
        <p className="py-10 text-gray-500">
          {searched
            ? "No rooms free for those dates. Try shortening your stay or lowering the guest count."
            : "No rooms have been added yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {state.rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              href={checkoutHref(room.id, query)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
