import { NavLink } from "./NavLink";

export const Sidebar: React.FC = () => {
  return (
    <aside className="min-h-screen w-64 bg-white p-5 text-black border-r-2 border-black">
      <h2 className="mb-8 text-2xl font-bold">Admin</h2>

      <div className="flex flex-col gap-4">
        <NavLink href="/admin">Dashboard</NavLink>

        <NavLink href="/admin/rooms">Rooms</NavLink>

        <NavLink href="/admin/reservations">Reservations</NavLink>
      </div>
    </aside>
  );
};

