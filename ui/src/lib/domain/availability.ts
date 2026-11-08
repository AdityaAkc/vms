import type { ISODate, Seat, TenantData } from "../types";
import { findSeatConflict } from "./derive";

/** Seats that can be booked for the whole [start, end] range. */
export function seatsAvailableFor(
  data: TenantData,
  start: ISODate,
  end: ISODate,
  ignoreMembershipIds: Set<string> = new Set(),
): Seat[] {
  return data.seats
    .filter((s) => !s.removedAt && !s.isUnderMaintenance)
    .filter((s) => !findSeatConflict(data.memberships, s.id, start, end, (m) => ignoreMembershipIds.has(m.id)))
    .sort((a, b) => a.number - b.number);
}

export function isSeatAvailableFor(data: TenantData, seatId: string, start: ISODate, end: ISODate, ignore: Set<string> = new Set()) {
  const seat = data.seats.find((s) => s.id === seatId);
  if (!seat || seat.removedAt || seat.isUnderMaintenance) return false;
  return !findSeatConflict(data.memberships, seatId, start, end, (m) => ignore.has(m.id));
}
