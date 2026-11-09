/**
 * Membership lifecycle: create, renew, cancel and seat transfers.
 *
 * NOTE (server-side enforcement required): the overlap checks below run
 * against the local snapshot only. Once a real API exists, seat/student
 * overlap must be enforced transactionally on the server (e.g. a unique
 * exclusion constraint on seat + date range) to prevent double booking
 * from concurrent requests.
 */
import { addDays, daysBetween, formatDate, membershipEndDate } from "../date";
import { findSeatConflict, findStudentConflict, isBlocking } from "../domain/derive";
import { pad } from "../id";
import { uid } from "../id";
import { getTenantData, setTenantData } from "../store/db";
import type {
  ISODate,
  Membership,
  Payment,
  PaymentMethod,
  SeatEvent,
  TenantData,
} from "../types";
import { fail, latency, nowIso, tenantToday } from "./core";
import { buildPayment } from "./paymentService";

export interface InitialPayment {
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

export interface CreateMembershipInput {
  studentId: string;
  seatId: string;
  planId: string;
  startDate: ISODate;
  discount?: number;
  payment?: InitialPayment;
  renewalOf?: string;
  source?: "admin" | "student";
}

/** Pure validation + construction. Returns updated data and the new record. */
export function applyCreateMembership(
  data: TenantData,
  input: CreateMembershipInput,
  today: ISODate,
): { data: TenantData; membership: Membership; payment?: Payment } {
  const source = input.source ?? "admin";
  const student = data.students.find((s) => s.id === input.studentId);
  if (!student) fail("Student not found.");
  if (student.status !== "active") fail(`${student.name} is marked inactive. Reactivate the student first.`);

  const plan = data.plans.find((p) => p.id === input.planId);
  if (!plan) fail("Membership plan not found.");
  if (!plan.isActive) fail(`The "${plan.name}" plan is not available for new memberships.`);

  const seat = data.seats.find((s) => s.id === input.seatId);
  if (!seat || seat.removedAt) fail("Seat not found.");
  if (seat.isUnderMaintenance) fail(`Seat ${seat.code} is under maintenance and cannot be booked.`);

  const rules = data.settings.rules;
  if (source === "student") {
    if (plan.durationMonths < rules.minDurationMonths)
      fail(`Minimum membership duration is ${rules.minDurationMonths} month(s).`);
    if (input.startDate < today) fail("Start date cannot be in the past.");
    if (daysBetween(today, input.startDate) > rules.advanceBookingDays)
      fail(`Seats can be booked at most ${rules.advanceBookingDays} days in advance.`);
  }

  const endDate = membershipEndDate(input.startDate, plan.durationMonths);
  const seatClash = findSeatConflict(data.memberships, seat.id, input.startDate, endDate);
  if (seatClash)
    fail(
      `Seat ${seat.code} is already booked from ${formatDate(seatClash.startDate)} to ${formatDate(seatClash.endDate)}.`,
      "seat_conflict",
    );
  const studentClash = findStudentConflict(data.memberships, student.id, input.startDate, endDate);
  if (studentClash)
    fail(
      `${student.name} already has membership ${studentClash.code} covering ${formatDate(studentClash.startDate)} – ${formatDate(studentClash.endDate)}.`,
      "student_conflict",
    );

  const discount = Math.max(0, Math.round(input.discount ?? 0));
  if (discount >= plan.price) fail("Discount must be less than the plan price.");
  const totalAmount = plan.price - discount;

  const now = nowIso();
  const membership: Membership = {
    id: uid("mem"),
    code: `M-${pad(data.counters.membership)}`,
    studentId: student.id,
    seatId: seat.id,
    planId: plan.id,
    planName: plan.name,
    durationMonths: plan.durationMonths,
    startDate: input.startDate,
    endDate,
    listPrice: plan.price,
    discount,
    totalAmount,
    source,
    renewalOf: input.renewalOf,
    createdAt: now,
  };
  const event: SeatEvent = {
    id: uid("evt"),
    seatId: seat.id,
    type: input.renewalOf ? "renewed" : "assigned",
    at: now,
    studentId: student.id,
    membershipId: membership.id,
  };

  let next: TenantData = {
    ...data,
    memberships: [...data.memberships, membership],
    seatEvents: [...data.seatEvents, event],
    counters: { ...data.counters, membership: data.counters.membership + 1 },
  };

  let payment: Payment | undefined;
  if (input.payment && input.payment.amount > 0) {
    const built = buildPayment(next, membership, totalAmount, {
      amount: input.payment.amount,
      method: input.payment.method,
      reference: input.payment.reference,
      paidOn: today,
      status: "completed",
    });
    next = built.data;
    payment = built.payment;
  }
  return { data: next, membership, payment };
}

export const membershipService = {
  async create(tenantId: string, input: CreateMembershipInput) {
    await latency();
    const result = applyCreateMembership(getTenantData(tenantId), input, tenantToday(tenantId));
    setTenantData(tenantId, () => result.data);
    return result.membership;
  },

  /** Suggested start date for a renewal: the day after expiry, or today. */
  renewalStart(m: Pick<Membership, "endDate">, today: ISODate): ISODate {
    return m.endDate >= today ? addDays(m.endDate, 1) : today;
  },

  async renew(
    tenantId: string,
    membershipId: string,
    input: { planId: string; seatId?: string; discount?: number; payment?: InitialPayment; source?: "admin" | "student" },
  ) {
    await latency();
    const data = getTenantData(tenantId);
    const today = tenantToday(tenantId);
    const prev = data.memberships.find((m) => m.id === membershipId);
    if (!prev) fail("Membership not found.");
    if (prev.cancelledAt) fail("A cancelled membership cannot be renewed. Create a new membership instead.");
    const later = data.memberships.find(
      (m) => m.studentId === prev.studentId && !m.cancelledAt && m.startDate > prev.endDate,
    );
    if (later) fail(`Already renewed — ${later.code} starts on ${formatDate(later.startDate)}.`);

    if (input.source === "student") {
      const window = data.settings.rules.renewalWindowDays;
      const daysLeft = daysBetween(today, prev.endDate);
      if (daysLeft > window) fail(`Renewal opens ${window} days before expiry (${formatDate(addDays(prev.endDate, -window))}).`);
    }

    const result = applyCreateMembership(
      data,
      {
        studentId: prev.studentId,
        seatId: input.seatId ?? prev.seatId,
        planId: input.planId,
        startDate: this.renewalStart(prev, today),
        discount: input.discount,
        payment: input.payment,
        renewalOf: prev.id,
        source: input.source ?? "admin",
      },
      today,
    );
    setTenantData(tenantId, () => result.data);
    return result.membership;
  },

  async cancel(tenantId: string, membershipId: string, reason: string) {
    await latency();
    const data = getTenantData(tenantId);
    const m = data.memberships.find((x) => x.id === membershipId);
    if (!m) fail("Membership not found.");
    if (m.cancelledAt) fail("Membership is already cancelled.");
    if (m.endDate < tenantToday(tenantId)) fail("Expired memberships cannot be cancelled.");
    const now = nowIso();
    setTenantData(tenantId, (d) => ({
      ...d,
      memberships: d.memberships.map((x) =>
        x.id === m.id ? { ...x, cancelledAt: now, cancelReason: reason.trim() || "Cancelled by admin" } : x,
      ),
      seatEvents: [
        ...d.seatEvents,
        { id: uid("evt"), seatId: m.seatId, type: "released", at: now, studentId: m.studentId, membershipId: m.id, note: reason },
      ],
    }));
  },

  /**
   * Move a student's current and upcoming memberships to another seat.
   * Updates the membership records (the student's seat) and the seat history
   * of both seats in one operation.
   */
  async changeSeat(tenantId: string, studentId: string, toSeatId: string, note?: string) {
    await latency();
    const data = getTenantData(tenantId);
    const today = tenantToday(tenantId);
    const target = data.seats.find((s) => s.id === toSeatId);
    if (!target || target.removedAt) fail("Target seat not found.");
    if (target.isUnderMaintenance) fail(`Seat ${target.code} is under maintenance.`);
    const affected = data.memberships.filter((m) => m.studentId === studentId && isBlocking(m, today));
    if (!affected.length) fail("This student has no current or upcoming membership to move.");
    if (affected.every((m) => m.seatId === toSeatId)) fail(`Student is already on seat ${target.code}.`);
    const ids = new Set(affected.map((m) => m.id));
    for (const m of affected) {
      const from = m.startDate < today ? today : m.startDate;
      const clash = findSeatConflict(data.memberships, toSeatId, from, m.endDate, (x) => ids.has(x.id));
      if (clash)
        fail(`Seat ${target.code} is booked from ${formatDate(clash.startDate)} to ${formatDate(clash.endDate)}.`, "seat_conflict");
    }
    const now = nowIso();
    const fromSeatId = affected[0]!.seatId;
    const fromSeat = data.seats.find((s) => s.id === fromSeatId);
    setTenantData(tenantId, (d) => ({
      ...d,
      memberships: d.memberships.map((m) => (ids.has(m.id) ? { ...m, seatId: toSeatId } : m)),
      seatEvents: [
        ...d.seatEvents,
        { id: uid("evt"), seatId: fromSeatId, type: "transferred_out", at: now, studentId, membershipId: affected[0]!.id, note: note || `Moved to ${target.code}` },
        { id: uid("evt"), seatId: toSeatId, type: "transferred_in", at: now, studentId, membershipId: affected[0]!.id, note: note || `Moved from ${fromSeat?.code ?? "another seat"}` },
      ],
    }));
  },
};
