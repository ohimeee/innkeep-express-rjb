import { useCallback, useContext, useEffect } from "react";

import { ReservationContext } from "../../context/ReservationContext";
import { fetchReservations } from "../../api/reservationService";
import { ReservationsTable } from "../../components/reservations/ReservationsTable";
import { WalkInForm } from "../../components/reservations/WalkInForm";

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
    <div className="space-y-8">
      <div>
        <div className="text-xs font-bold tracking-widest text-orange-500 uppercase">
          Bookings
        </div>
        <h1 className="mt-1 text-3xl font-bold">Reservations</h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage guest reservations, holds, and walk-in bookings.
        </p>
      </div>

      {state.loading ? (
        <p className="py-10 text-sm text-gray-500">Loading reservations...</p>
      ) : state.error ? (
        <p role="alert" className="py-10 text-sm text-orange-500">
          Error: {state.error}
        </p>
      ) : (
        <>
          <ReservationsTable
            rows={state.reservations}
            onChanged={loadReservations}
          />
          <WalkInForm onTaken={loadReservations} />
        </>
      )}
    </div>
  );
};
