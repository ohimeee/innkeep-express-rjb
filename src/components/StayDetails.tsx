import { formatStayDate } from "../dates";

interface StayDetailsProps {
  checkIn: string;
  checkOut: string;
  nights: number;
}

export const StayDetails: React.FC<StayDetailsProps> = ({
  checkIn,
  checkOut,
  nights,
}) => {
  return (
    <div className="flex-col border-b-2 pb-5">
      <p className="my-5 text-xl font-bold">Stay details</p>
      <div className="flex-col divide-y-2 divide-gray-400 border-2 border-gray-400">
        <div className="flex divide-x-2 divide-gray-400">
          <div className="flex-1 p-3">
            <p className="text-xs font-semibold text-orange-500">CHECK-IN</p>
            <p className="text-2xl font-bold">{formatStayDate(checkIn)}</p>
            <p className="text-xs text-gray-500">From 3:00 PM</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-xs font-semibold text-orange-500">CHECK-OUT</p>
            <p className="text-2xl font-bold">{formatStayDate(checkOut)}</p>
            <p className="text-xs text-gray-500">Until 11:00 AM</p>
          </div>
        </div>
        <div className="flex justify-between p-3">
          <span className="text-xs text-gray-500">Length of stay</span>
          <span className="text-sm font-bold">
            {nights} {nights === 1 ? "night" : "nights"}
          </span>
        </div>
      </div>
    </div>
  );
};
