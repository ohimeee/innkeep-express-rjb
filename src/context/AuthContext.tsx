import { createContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'LOGIN'; payload: string }
  | { type: 'LOGOUT' };

interface TokenPayload {
  username: string;
  exp: number;
}

// Reads the payload the API signed — { userId, username, exp }. Only for
// display and the expiry timer; the API verifies the signature on every call,
// so nothing here is trusted for access.
const readToken = (token: string): TokenPayload | null => {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
};

const stateFor = (token: string | null): AuthState => {
  const payload = token ? readToken(token) : null;

  // A token that has already run out is no login at all. Treating it as one
  // would open /admin and then fail every request on it.
  if (!token || !payload || payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem('token');
    return { token: null, username: null, isAuthenticated: false };
  }

  return { token, username: payload.username, isAuthenticated: true };
};

const initialState: AuthState = stateFor(localStorage.getItem('token'));

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "LOGIN":
      localStorage.setItem('token', action.payload);
      return stateFor(action.payload);
    case "LOGOUT":
      localStorage.removeItem('token');
      return { ...state, token: null, username: null, isAuthenticated: false };
    default:
      return state;
  }
};

export const AuthContext = createContext<
  { state: AuthState; dispatch: Dispatch<AuthAction> } | undefined
>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // The API signs tokens for an hour. Sign out the moment it lapses, so the
  // desk lands on the login screen rather than on a wall of failed requests.
  useEffect(() => {
    if (!state.token) return;
    const payload = readToken(state.token);
    if (!payload) return;

    const timer = setTimeout(
      () => dispatch({ type: 'LOGOUT' }),
      payload.exp * 1000 - Date.now()
    );
    return () => clearTimeout(timer);
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
};
