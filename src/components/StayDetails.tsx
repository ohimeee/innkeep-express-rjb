import { Link } from "react-router-dom";

import { formatStayDate } from "../utils/dates";

interface StayDetailsProps {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests?: number;
  // Where "Change dates" goes. Only checkout passes it — a booked stay's dates
  // are changed at the front desk, not here.
  changeHref?: string;
}

export const StayDetails: React.FC<StayDetailsProps> = ({
  checkIn,
  checkOut,
  nights,
  guests,
  changeHref,
}) => {
  return (
    <div className="flex-col border-b-2 pb-5">
      <div className="my-5 flex items-baseline justify-between">
        <p className="text-xl font-bold">Stay details</p>
        {changeHref ? (
          <Link
            to={changeHref}
            className="text-sm font-semibold text-orange-500 hover:text-orange-700"
          >
            Change dates
          </Link>
        ) : null}
      </div>
      <div className="flex-col divide-y-2 divide-gray-400 border-2 border-gray-400">
        <div className="flex divide-x-2 divide-gray-400">
          <div className="flex-1 p-3">
            <p className="text-xs font-semibold text-orange-500">CHECK-IN</p>
            <p className="text-lg font-bold whitespace-nowrap sm:text-2xl">
              {formatStayDate(checkIn)}
            </p>
            <p className="text-xs text-gray-500">From 3:00 PM</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-xs font-semibold text-orange-500">CHECK-OUT</p>
            <p className="text-lg font-bold whitespace-nowrap sm:text-2xl">
              {formatStayDate(checkOut)}
            </p>
            <p className="text-xs text-gray-500">Until 11:00 AM</p>
          </div>
        </div>
        <div className="flex justify-between p-3">
          <span className="text-xs text-gray-500">Length of stay</span>
          <span className="text-sm font-bold">
            {nights} {nights === 1 ? "night" : "nights"}
          </span>
        </div>
        {guests ? (
          <div className="flex justify-between p-3">
            <span className="text-xs text-gray-500">Guests</span>
            <span className="text-sm font-bold">
              {guests} {guests === 1 ? "guest" : "guests"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
