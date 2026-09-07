import { createContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { Room } from "../types";

interface State {
  rooms: Room[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Room[] }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  rooms: [],
  loading: false,
  error: null,
};

const roomReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, rooms: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

export const RoomContext = createContext<
  { state: State; dispatch: Dispatch<Action> } | undefined
>(undefined);

export const RoomProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(roomReducer, initialState);

  return (
    <RoomContext.Provider value={{ state, dispatch }}>
      {children}
    </RoomContext.Provider>
  );
};
