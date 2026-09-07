import { useContext, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { RoomContext } from "../context/RoomContext";
import { fetchRooms } from "../api/roomService";
import { checkoutHref, parseSearch } from "../search";
import { RoomCard } from "./RoomCard";

// The catalog grid. The search lives in the URL rather than in state, so a
// search can be shared or reloaded and the back button walks through previous
// searches — see search.ts.
export const RoomList: React.FC = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error("RoomList must be used within a RoomProvider.");
  const { state, dispatch } = context;

  const [searchParams] = useSearchParams();
  const query = parseSearch(searchParams);

  // The URL string, not the parsed object: `query` is a fresh object every
  // render, so depending on it directly would refetch forever.
  const search = searchParams.toString();

  useEffect(() => {
    const loadRooms = async () => {
      dispatch({ type: "FETCH_START" });

      try {
        const data = await fetchRooms(parseSearch(new URLSearchParams(search)));
        dispatch({ type: "FETCH_SUCCESS", payload: data });
      } catch (error) {
        dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
      }
    };
    loadRooms();
  }, [dispatch, search]);

  if (state.loading) return <p className="py-10 text-gray-500">Loading rooms...</p>;

  if (state.error)
    return (
      <p role="alert" className="py-10 text-orange-700">
        Error: {state.error} — is the API running on port 3000?
      </p>
    );

  if (state.rooms.length === 0)
    return (
      <p className="py-10 text-gray-500">
        {query.checkIn && query.checkOut
          ? "No rooms free for those dates. Try shortening your stay or lowering the guest count."
          : "No rooms have been added yet."}
      </p>
    );

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {state.rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          href={checkoutHref(room.id, query)}
          // With dates chosen, everything on screen is already free for them.
          // Without, the card falls back to whether it is free tonight.
          searched={Boolean(query.checkIn && query.checkOut)}
        />
      ))}
    </div>
  );
};
