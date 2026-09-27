import { Link } from "react-router-dom";

import { Logo } from "./Logo";

export const GuestFooter: React.FC = () => {
  return (
    <footer className="border-t-2 bg-gray-100">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-8">
        <div>
          <Logo />
          <p className="mt-2 text-xs text-gray-500">
            Boutique stays in Iloilo City, Philippines
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-orange-500">
            YOUR STAY
          </p>
          <p>Check-in from 3:00 PM</p>
          <p>Check-out until 11:00 AM</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-orange-500">
            GUESTS
          </p>
          <Link to="/" className="block hover:text-orange-500">
            Browse rooms
          </Link>
          <Link to="/find-booking" className="block hover:text-orange-500">
            Find your booking
          </Link>
        </div>
      </div>
    </footer>
  );
};
