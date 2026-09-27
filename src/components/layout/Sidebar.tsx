import { useContext } from "react";
import { LogOut, UserRound } from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";

export const Sidebar: React.FC = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Sidebar must be used within AuthProvider");
  const { state, dispatch } = context;

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-white p-5 text-black border-r-2 border-black">
      <Logo to="/admin" />
      <h2 className="mt-6 mb-8 text-2xl font-bold">Admin</h2>

      <div className="flex flex-col gap-4">
        <NavLink href="/admin">Dashboard</NavLink>

        <NavLink href="/admin/rooms">Rooms</NavLink>

        <NavLink href="/admin/reservations">Reservations</NavLink>
      </div>

      {/* Pinned to the bottom, so whoever sits down at the desk can see whose
          session is open before posting a charge on it. */}
      <div className="mt-auto border-t-2 border-black pt-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <UserRound className="size-4 text-orange-500" />
          <span className="font-semibold">{state.username}</span>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "LOGOUT" })}
          className="flex w-full items-center justify-between border-2 border-gray-300 p-2 text-sm font-semibold text-gray-700 hover:border-orange-500 hover:text-orange-500"
        >
          Sign out
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
};
