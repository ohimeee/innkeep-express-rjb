import { useCallback, useContext, useEffect } from "react";

import { RoomContext } from "../context/RoomContext";
import { fetchRooms } from "../api/roomService";
import { RoomsInventory } from "../components/RoomsInventory";

export const RoomsPage: React.FC = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error("RoomsPage must be used within a RoomProvider.");
  const { state, dispatch } = context;

  // No date range and one guest: the inventory screen shows every room,
  // including ones that are fully booked, otherwise there is no way to edit them.
  const loadRooms = useCallback(async () => {
    dispatch({ type: "FETCH_START" });

    try {
      const data = await fetchRooms({ guests: 1 });
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
    }
  }, [dispatch]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  if (state.loading)
    return <p className="py-10 text-[#201e1d]/55">Loading rooms...</p>;

  if (state.error)
    return (
      <p role="alert" className="py-10 text-[#b8250e]">
        Error: {state.error}
      </p>
    );

  return <RoomsInventory rooms={state.rooms} onSaved={loadRooms} />;
};
