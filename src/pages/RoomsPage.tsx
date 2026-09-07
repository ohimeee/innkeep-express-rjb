import { useCallback, useContext, useEffect } from "react";

import { RoomContext } from "../context/RoomContext";
import { fetchAllRooms } from "../api/roomService";
import { RoomsInventory } from "../components/RoomsInventory";

export const RoomsPage: React.FC = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error("RoomsPage must be used within a RoomProvider.");
  const { state, dispatch } = context;

  // The inventory shows every room — fully booked ones and ones taken out of
  // service alike. Hiding either would leave rooms nobody could edit.
  const loadRooms = useCallback(async () => {
    dispatch({ type: "FETCH_START" });

    try {
      const data = await fetchAllRooms();
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
