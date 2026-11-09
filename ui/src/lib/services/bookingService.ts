/**
 * Student self-service booking. Depending on the tenant's `bookingMode`
 * rule, a student either confirms a booking instantly (seat is held, payment
 * due at the desk) or submits a request the front desk must approve.
 */
import { daysBetween, formatDate, membershipEndDate } from "../date";
import { findSeatConflict } from "../domain/derive";
import { uid } from "../id";
import { getTenantData, setTenantData } from "../store/db";
import type { BookingRequest, Membership } from "../types";
import { fail, latency, nowIso, tenantToday } from "./core";
import { applyCreateMembership } from "./membershipService";

export type BookingOutcome =
  | { kind: "booking"; membership: Membership }
  | { kind: "request"; request: BookingRequest };

export interface StudentBookingInput {
  studentId: string;
  seatId: string;
  planId: string;
  startDate: string;
}

export const bookingService = {
  async book(tenantId: string, input: StudentBookingInput): Promise<BookingOutcome> {
    await latency(500);
    const data = getTenantData(tenantId);
    const today = tenantToday(tenantId);

    if (data.settings.rules.bookingMode === "instant") {
      const result = applyCreateMembership(data, { ...input, source: "student" }, today);
      setTenantData(tenantId, () => result.data);
      return { kind: "booking", membership: result.membership };
    }

    // Approval mode: validate up-front so the student gets immediate feedback,
    // but the seat is only held once the desk approves.
    const plan = data.plans.find((p) => p.id === input.planId && p.isActive);
    if (!plan) fail("Selected plan is not available.");
    const seat = data.seats.find((s) => s.id === input.seatId && !s.removedAt);
    if (!seat || seat.isUnderMaintenance) fail("This seat is not available for booking.");
    if (input.startDate < today) fail("Start date cannot be in the past.");
    if (daysBetween(today, input.startDate) > data.settings.rules.advanceBookingDays)
      fail(`Seats can be booked at most ${data.settings.rules.advanceBookingDays} days in advance.`);
    const end = membershipEndDate(input.startDate, plan.durationMonths);
    const clash = findSeatConflict(data.memberships, seat.id, input.startDate, end);
    if (clash) fail(`Seat ${seat.code} is booked until ${formatDate(clash.endDate)}.`, "seat_conflict");
    if (data.bookingRequests.some((r) => r.studentId === input.studentId && r.status === "pending"))
      fail("You already have a pending booking request. Withdraw it to submit a new one.");

    const request: BookingRequest = { id: uid("req"), ...input, status: "pending", createdAt: nowIso() };
    setTenantData(tenantId, (d) => ({ ...d, bookingRequests: [...d.bookingRequests, request] }));
    return { kind: "request", request };
  },

  async approve(tenantId: string, requestId: string) {
    await latency();
    const data = getTenantData(tenantId);
    const req = data.bookingRequests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") fail("This request is no longer pending.");
    const today = tenantToday(tenantId);
    const startDate = req.startDate < today ? today : req.startDate;
    const result = applyCreateMembership(
      data,
      { studentId: req.studentId, seatId: req.seatId, planId: req.planId, startDate, source: "student" },
      today,
    );
    setTenantData(tenantId, () => ({
      ...result.data,
      bookingRequests: result.data.bookingRequests.map((r) =>
        r.id === requestId ? { ...r, status: "approved", decidedAt: nowIso(), membershipId: result.membership.id } : r,
      ),
    }));
    return result.membership;
  },

  async decline(tenantId: string, requestId: string, note: string) {
    await latency(250);
    setTenantData(tenantId, (d) => ({
      ...d,
      bookingRequests: d.bookingRequests.map((r) =>
        r.id === requestId && r.status === "pending"
          ? { ...r, status: "declined", decidedAt: nowIso(), decisionNote: note.trim() || undefined }
          : r,
      ),
    }));
  },

  async withdraw(tenantId: string, requestId: string) {
    await latency(250);
    setTenantData(tenantId, (d) => ({
      ...d,
      bookingRequests: d.bookingRequests.map((r) =>
        r.id === requestId && r.status === "pending" ? { ...r, status: "withdrawn", decidedAt: nowIso() } : r,
      ),
    }));
  },
};
