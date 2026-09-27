import { useContext } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { AuthForm } from "../../components/AuthForm";
import { AuthContext } from "../../context/AuthContext";

// Where the guard sent them from, so signing in lands on the page they wanted
// rather than always on the dashboard.
interface FromState {
  from?: string;
}

export const LoginPage: React.FC = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("LoginPage must be used within AuthProvider");

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as FromState | null)?.from ?? "/admin";

  if (context.state.isAuthenticated) return <Navigate to={from} replace />;

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <img
          src="/rooms/201.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/10" />
        <div className="absolute right-0 bottom-0 left-0 p-12 text-white">
          <p className="text-xs font-semibold tracking-widest text-orange-300">
            FRONT DESK
          </p>
          <p className="mt-2 max-w-md text-4xl font-bold">
            Arrivals, folios and every room, in one place.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[480px] lg:flex-none">
        <img src="/logo.png" alt="InnKeep Express" className="mb-10 h-12 w-fit" />

        <p className="text-xs font-semibold tracking-widest text-orange-500">
          STAFF ONLY
        </p>
        <h1 className="mb-2 text-3xl font-bold">Sign in to the front desk</h1>
        <p className="mb-8 text-sm text-gray-500">
          Use the account the hotel set up for you. Sessions last an hour.
        </p>

        <AuthForm onDone={() => navigate(from, { replace: true })} />

        <Link
          to="/"
          className="mt-10 text-sm font-semibold text-orange-500 hover:text-orange-700"
        >
          {"<"} Back to the guest site
        </Link>
      </div>
    </div>
  );
};
