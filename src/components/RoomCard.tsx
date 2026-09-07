import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { MoveRight } from "lucide-react";

import { formatPeso } from "../money";
import { typeLabel, type Room } from "../types";

interface RoomCardProps {
  room: Room;
  href: string;
  // True when the guest picked dates, so this room is known to be free for them.
  searched: boolean;
}

/**
 * One room on the catalog.
 *
 * The rate is formatted here rather than arriving pre-formatted. The Next
 * version had the server attach a `nightlyRateLabel`; the API returns the raw
 * `NUMERIC` string instead, and formatting stays a display concern.
 */
export const RoomCard: React.FC<RoomCardProps> = ({ room, href, searched }) => {
  // With dates chosen the API already filtered to what is free for them.
  // Without, the room is only bookable if nothing holds it tonight.
  const bookable = searched || room.availableTonight;

  return (
    <div className="relative flex aspect-6/5 w-full flex-col">
      <div className="absolute top-0 left-0 bg-orange-500 p-2 text-xs font-semibold tracking-widest text-white">
        {typeLabel(room.type)}
      </div>

      {bookable ? null : (
        <div className="absolute top-0 right-0 z-10 bg-gray-700 p-2 text-xs font-semibold tracking-widest text-white">
          Booked tonight
        </div>
      )}

      <div className="h-1/2 overflow-hidden">
        <img
          className={`h-full w-full object-cover ${bookable ? "" : "opacity-50 grayscale"}`}
          src={room.imageUrl ?? "https://picsum.photos/200"}
          alt={room.name}
        />
      </div>

      <div className="flex-col space-y-2 bg-gray-200 p-3">
        <span className="text-lg font-bold">{room.name}</span>

        <div className="flex items-center gap-2">
          <UserRound className="size-3" />
          <span className="text-xs text-gray-500">Sleeps {room.capacity}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {room.amenities.map((amenity) => (
            <span key={amenity} className="bg-white px-2 py-1 text-xs">
              {amenity}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t-2">
          <div>
            <p className="text-xl font-bold">{formatPeso(room.nightlyRate)}</p>
            <p className="text-xs text-gray-500">per night</p>
          </div>
          {bookable ? (
            <Link
              to={href}
              className="flex items-center gap-1 bg-orange-500 p-2 text-xs font-semibold tracking-widest text-white"
            >
              <span>Book Now</span>
              <MoveRight className="size-3" />
            </Link>
          ) : (
            // Not free tonight, but free some other night. Sending the guest to
            // the search is honest — a Book Now here would be refused, and
            // hiding the room would hide a room they could still have.
            <a
              href="#stay-search"
              className="flex items-center gap-1 border border-gray-400 p-2 text-xs font-semibold tracking-widest text-gray-600 hover:border-orange-500 hover:text-orange-500"
            >
              <span>Other dates</span>
              <MoveRight className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

