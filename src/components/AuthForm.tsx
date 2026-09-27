import { useContext, useState } from "react";
import { ArrowRight } from "lucide-react";

import { AuthContext } from "../context/AuthContext";
import { login } from "../api/authService";

interface AuthFormProps {
  onDone?: () => void;
}

const FIELD_CLASSES =
  "w-full border-2 border-gray-300 bg-white p-3 outline-none focus:border-orange-500";

// Sign-in only. Staff accounts are made through the API (see api.http), never
// from a screen — a sign-up form here would be a door anyone could walk in by.
export const AuthForm: React.FC<AuthFormProps> = ({ onDone }) => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthForm must be used within AuthProvider");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);

    try {
      const { token } = await login(username, password);
      context.dispatch({ type: "LOGIN", payload: token });
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      {error ? (
        <p role="alert" className="border-2 border-orange-500 bg-orange-50 p-3 text-sm text-orange-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-xs font-semibold tracking-widest text-gray-500">
          USERNAME
        </label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={FIELD_CLASSES}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs font-semibold tracking-widest text-gray-500">
          PASSWORD
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD_CLASSES}
          required
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex items-center justify-between bg-orange-500 p-4 font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
      >
        <span>{pending ? "Signing in..." : "Sign in"}</span>
        <ArrowRight className="size-5" />
      </button>
    </form>
  );
};
