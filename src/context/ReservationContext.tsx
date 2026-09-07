import { createContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { Reservation } from "../types";

interface State {
  reservations: Reservation[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Reservation[] }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  reservations: [],
  loading: false,
  error: null,
};

const reservationReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, reservations: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

export const ReservationContext = createContext<
  { state: State; dispatch: Dispatch<Action> } | undefined
>(undefined);

export const ReservationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reservationReducer, initialState);

  return (
    <ReservationContext.Provider value={{ state, dispatch }}>
      {children}
    </ReservationContext.Provider>
  );
};
