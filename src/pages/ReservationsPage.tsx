import { useCallback, useContext, useEffect } from "react";

import { ReservationContext } from "../context/ReservationContext";
import { fetchReservations } from "../api/reservationService";
import { ReservationsTable } from "../components/ReservationsTable";
import { WalkInForm } from "../components/WalkInForm";

export const ReservationsPage: React.FC = () => {
  const context = useContext(ReservationContext);
  if (!context)
    throw new Error(
      "ReservationsPage must be used within a ReservationProvider.",
    );
  const { state, dispatch } = context;

  const loadReservations = useCallback(async () => {
    dispatch({ type: "FETCH_START" });

    try {
      const data = await fetchReservations();
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", payload: (error as Error).message });
    }
  }, [dispatch]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
        Bookings
      </div>

      {state.loading ? (
        <p className="py-10 text-[#201e1d]/55">Loading reservations...</p>
      ) : state.error ? (
        <p role="alert" className="py-10 text-[#b8250e]">
          Error: {state.error}
        </p>
      ) : (
        <>
          <ReservationsTable rows={state.reservations} />
          <WalkInForm onTaken={loadReservations} />
        </>
      )}
    </div>
  );
};
