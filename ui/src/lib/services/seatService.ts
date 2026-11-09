/**
 * Seat inventory and layout management.
 *
 * Seats are soft-deleted (`removedAt`) so their booking history is kept.
 * A seat can only be removed when it has no current or upcoming booking and
 * no pending booking request.
 */
import { isBlocking } from "../domain/derive";
import { generateSeats, seatCodeFor } from "../domain/seats";
import { uid } from "../id";
import { getTenantData, setTenantData } from "../store/db";
import type { Seat, TenantData, TenantSettings } from "../types";
import { fail, latency, nowIso, tenantToday } from "./core";

export const MAX_SEATS = 500;

export function seatRemovalBlocker(data: TenantData, seatId: string, today: string): string | null {
  const booking = data.memberships.find((m) => m.seatId === seatId && isBlocking(m, today));
  if (booking) return booking.startDate > today ? "Has an upcoming booking" : "Occupied by an active member";
  const request = data.bookingRequests.find((r) => r.seatId === seatId && r.status === "pending");
  if (request) return "Has a pending booking request";
  return null;
}

export const seatService = {
  async addSeats(tenantId: string, count: number) {
    await latency();
    const data = getTenantData(tenantId);
    const n = Math.floor(count);
    if (!(n >= 1)) fail("Enter at least 1 seat.");
    const active = data.seats.filter((s) => !s.removedAt).length;
    if (active + n > MAX_SEATS) fail(`A reading room can have at most ${MAX_SEATS} seats.`);
    const now = nowIso();
    const created = generateSeats(data.seats, n, data.settings.layout, data.counters.seat, () => uid("seat"), now);
    setTenantData(tenantId, (d) => ({
      ...d,
      seats: [...d.seats, ...created],
      seatEvents: [...d.seatEvents, ...created.map((s) => ({ id: uid("evt"), seatId: s.id, type: "created" as const, at: now }))],
      counters: { ...d.counters, seat: d.counters.seat + n },
    }));
    return created;
  },

  async updateSeat(tenantId: string, seatId: string, patch: Pick<Seat, "code" | "tags" | "notes">) {
    await latency(250);
    const data = getTenantData(tenantId);
    const code = patch.code.trim().toUpperCase();
    if (!code) fail("Seat number is required.");
    if (code.length > 12) fail("Seat number must be 12 characters or fewer.");
    if (data.seats.some((s) => s.id !== seatId && s.code.toUpperCase() === code))
      fail(`Seat number ${code} is already used by another seat (including removed seats).`);
    setTenantData(tenantId, (d) => ({
      ...d,
      seats: d.seats.map((s) => (s.id === seatId ? { ...s, code, tags: patch.tags, notes: patch.notes?.trim() || undefined } : s)),
      seatEvents: [...d.seatEvents, { id: uid("evt"), seatId, type: "edited", at: nowIso() }],
    }));
  },

  /**
   * Toggle maintenance. Putting an occupied seat under maintenance requires
   * explicit acknowledgement; the member keeps their booking and the seat is
   * flagged so the admin can transfer them.
   */
  async setMaintenance(
    tenantId: string,
    seatId: string,
    on: boolean,
    opts: { note?: string; acknowledgeOccupied?: boolean } = {},
  ) {
    await latency(250);
    const data = getTenantData(tenantId);
    const seat = data.seats.find((s) => s.id === seatId);
    if (!seat || seat.removedAt) fail("Seat not found.");
    if (on && seatRemovalBlocker(data, seatId, tenantToday(tenantId)) && !opts.acknowledgeOccupied)
      fail("This seat has an active or upcoming booking. Confirm to disable it anyway.", "needs_ack");
    setTenantData(tenantId, (d) => ({
      ...d,
      seats: d.seats.map((s) =>
        s.id === seatId
          ? { ...s, isUnderMaintenance: on, maintenanceNote: on ? opts.note?.trim() || "Under maintenance" : undefined }
          : s,
      ),
      seatEvents: [
        ...d.seatEvents,
        { id: uid("evt"), seatId, type: on ? "maintenance_on" : "maintenance_off", at: nowIso(), note: on ? opts.note : undefined },
      ],
    }));
  },

  async removeSeats(tenantId: string, seatIds: string[]) {
    await latency();
    const data = getTenantData(tenantId);
    const today = tenantToday(tenantId);
    if (!seatIds.length) fail("Select at least one seat to remove.");
    const blocked = seatIds
      .map((id) => ({ seat: data.seats.find((s) => s.id === id), reason: seatRemovalBlocker(data, id, today) }))
      .filter((x) => x.reason);
    if (blocked.length)
      fail(`Cannot remove ${blocked.map((b) => b.seat?.code).join(", ")} — seats with bookings are protected.`, "seat_in_use");
    const ids = new Set(seatIds);
    const now = nowIso();
    setTenantData(tenantId, (d) => ({
      ...d,
      seats: d.seats.map((s) => (ids.has(s.id) ? { ...s, removedAt: now } : s)),
      seatEvents: [...d.seatEvents, ...seatIds.map((seatId) => ({ id: uid("evt"), seatId, type: "removed" as const, at: now }))],
    }));
  },

  async restoreSeat(tenantId: string, seatId: string) {
    await latency(250);
    const data = getTenantData(tenantId);
    if (data.seats.filter((s) => !s.removedAt).length >= MAX_SEATS) fail(`Seat limit of ${MAX_SEATS} reached.`);
    setTenantData(tenantId, (d) => ({
      ...d,
      seats: d.seats.map((s) => (s.id === seatId ? { ...s, removedAt: undefined } : s)),
      seatEvents: [...d.seatEvents, { id: uid("evt"), seatId, type: "restored", at: nowIso() }],
    }));
  },

  async updateLayout(tenantId: string, layout: TenantSettings["layout"]) {
    await latency(250);
    if (layout.columns < 2 || layout.columns > 30) fail("Columns must be between 2 and 30.");
    if (layout.aisleEvery < 0 || layout.aisleEvery >= layout.columns) fail("Aisle position must be smaller than the column count.");
    setTenantData(tenantId, (d) => ({ ...d, settings: { ...d.settings, layout } }));
  },

  /**
   * Re-label every active seat to match its current grid position. Bookings
   * reference seats by id, so history and memberships remain intact.
   */
  async renumber(tenantId: string) {
    await latency();
    const data = getTenantData(tenantId);
    const active = data.seats.filter((s) => !s.removedAt).sort((a, b) => a.number - b.number);
    const codes = new Map(active.map((s, i) => [s.id, seatCodeFor(i, i + 1, data.settings.layout)]));
    const newCodes = new Set(codes.values());
    const now = nowIso();
    setTenantData(tenantId, (d) => ({
      ...d,
      seats: d.seats.map((s) => {
        if (codes.has(s.id)) return { ...s, code: codes.get(s.id)! };
        // Removed seats keep a distinct historical label.
        return newCodes.has(s.code) ? { ...s, code: `${s.code}-OLD${s.number}` } : s;
      }),
      seatEvents: [
        ...d.seatEvents,
        ...active.map((s) => ({ id: uid("evt"), seatId: s.id, type: "edited" as const, at: now, note: `Renumbered ${s.code} → ${codes.get(s.id)}` })),
      ],
    }));
  },
};
