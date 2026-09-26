import { NavLink } from "./NavLink";

export const GuestNavbar: React.FC = () => {
  return (
    <nav className="flex items-center justify-between border-b bg-white px-8 py-2 text-black">
      <h1 className="text-lg font-bold tracking-tight">InnKeep Express</h1>

      <div className="flex gap-6 text-sm">
        <NavLink href="/">Rooms</NavLink>

        <NavLink href="/find-booking">Find booking</NavLink>
      </div>
    </nav>
  );
};

