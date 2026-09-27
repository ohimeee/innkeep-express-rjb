import { Lock } from "lucide-react";

import { ConfirmButton } from "./ConfirmButton";
import type { Quote } from "../../utils/pricing";
import { formatPeso } from "../../utils/money";
import { typeLabel, type Room } from "../../types";

interface BookingCardProps {
  room: Room;
  quote: Quote;
  pending: boolean;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  room,
  quote,
  pending,
}) => {
  return (
    <div className="flex w-full flex-col lg:mt-5">
      <div className="aspect-2/1 overflow-hidden">
        <img
          className="h-full w-full object-cover"
          src={room.imageUrl ?? "/rooms/default.jpg"}
          alt={room.name}
        />
      </div>

      <div className="flex-col divide-y-2 divide-black bg-gray-200 p-3">
        <div className="flex flex-col">
          <p className="text-xs font-semibold text-orange-500">
            {typeLabel(room.type).toUpperCase()} | ROOM {room.number}
          </p>
          <div className="flex items-center justify-between gap-4 pb-5">
            <div>
              <p className="text-2xl font-bold">{room.name}</p>
              <p className="text-xs text-gray-500">{room.description}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatPeso(room.nightlyRate)}
              </p>
              <p className="text-xs text-gray-500">per night</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col py-5">
          <p className="mb-5 text-xs font-semibold tracking-widest text-gray-500">
            PRICE BREAKDOWN
          </p>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p>Room rate</p>
              <p className="text-xs text-gray-500">
                {formatPeso(room.nightlyRate)} x {quote.nights}{" "}
                {quote.nights === 1 ? "night" : "nights"}
              </p>
            </div>
            <div>
              <p className="text-lg font-bold">{quote.roomTotalLabel}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Taxes &amp; fees {"(12%)"}</span>
            <span className="text-lg font-bold">{quote.taxLabel}</span>
          </div>
        </div>
        <div className="flex flex-col py-5">
          <p className="text-xl font-bold">Total</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Incl. taxes &amp; fees | PHP
            </span>
            <span className="text-3xl font-bold text-orange-500">
              {quote.totalLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          <ConfirmButton pending={pending} />
          <div className="mb-2 flex gap-2 text-xs text-gray-600">
            <Lock className="mt-0.5 size-3 shrink-0" />
            <p>
              You pay on Xendit&apos;s secure page — card, GCash, Maya or online
              banking. The room is held for 15 minutes while you do.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Plans change? Cancel from your booking page any time before
            check-in and anything paid is refunded to the original payment
            method.
          </p>
        </div>
      </div>
    </div>
  );
};
