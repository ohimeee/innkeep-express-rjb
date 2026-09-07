import { isDateString } from "./dates";

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 4;

export type RoomQuery = {
  /** Both dates or neither — a half-filled range cannot filter availability. */
  checkIn?: string;
  checkOut?: string;
  guests: number;
};

/**
 * The search is URL state, not React state.
 *
 * Putting it in the query string means a search can be shared, bookmarked and
 * reloaded, the back button steps through searches, and the catalog page has no
 * state of its own to fall out of step with what the address bar says.
 *
 * A malformed URL normalises rather than throws — `?guests=abc` or a check-out
 * before its check-in falls back to the full catalog, not an error page.
 */
export const parseSearch = (params: URLSearchParams): RoomQuery => {
  const checkInRaw = params.get("checkIn") ?? undefined;
  const checkOutRaw = params.get("checkOut") ?? undefined;

  const checkIn = isDateString(checkInRaw) ? checkInRaw : undefined;
  const checkOut = isDateString(checkOutRaw) ? checkOutRaw : undefined;

  const parsedGuests = Number(params.get("guests"));
  const guests = Number.isFinite(parsedGuests)
    ? Math.min(Math.max(Math.trunc(parsedGuests), MIN_GUESTS), MAX_GUESTS)
    : MIN_GUESTS;

  // `YYYY-MM-DD` sorts lexically, so this ordering check needs no Date objects
  // and therefore has no timezone behaviour.
  const hasRange = Boolean(checkIn && checkOut && checkIn < checkOut);

  return hasRange ? { checkIn, checkOut, guests } : { guests };
};

/** The query as a URLSearchParams, for pushing a search into the address bar. */
export const toSearchParams = (query: RoomQuery): URLSearchParams => {
  const params = new URLSearchParams({ guests: String(query.guests) });

  if (query.checkIn && query.checkOut) {
    params.set("checkIn", query.checkIn);
    params.set("checkOut", query.checkOut);
  }

  return params;
};

/**
 * Link from a room card into checkout. The chosen dates ride along in the URL
 * so the two pages agree without any shared state; checkout falls back to a
 * default stay when the catalog was browsed without dates.
 */
export const checkoutHref = (roomId: string, query: RoomQuery): string => {
  const params = toSearchParams(query);
  params.set("room", roomId);
  return `/booking/checkout?${params.toString()}`;
};
