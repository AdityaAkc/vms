/**
 * Pure derivation functions. These turn stored records into the view models
 * the UI renders. Statuses are always computed from dates + payments, never
 * stored, so an expired membership can never be shown as active.
 */
import { daysBetween, rangesOverlap } from "../date";
import type {
  ISODate,
  Membership,
  MembershipStatus,
  MembershipView,
  Payment,
  PaymentStatus,
  Seat,
  SeatView,
  Student,
  StudentView,
  TenantData,
} from "../types";

export function membershipStatus(
  m: Pick<Membership, "startDate" | "endDate" | "cancelledAt">,
  today: ISODate,
  expiringSoonDays: number,
): MembershipStatus {
  if (m.cancelledAt) return "cancelled";
  if (m.startDate > today) return "upcoming";
  if (m.endDate < today) return "expired";
  if (daysBetween(today, m.endDate) < expiringSoonDays) return "expiring";
  return "active";
}

/** Memberships that hold a seat today (active or expiring). */
export function isCurrent(status: MembershipStatus) {
  return status === "active" || status === "expiring";
}

/** Memberships that still block a seat for some future/present date range. */
export function isBlocking(m: Membership, today: ISODate) {
  return !m.cancelledAt && m.endDate >= today;
}

export function paymentStatusFor(total: number, paid: number): PaymentStatus {
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export interface TenantViews {
  today: ISODate;
  seats: SeatView[];
  removedSeats: Seat[];
  memberships: MembershipView[];
  students: StudentView[];
  payments: Payment[];
  seatById: Map<string, SeatView | Seat>;
  studentById: Map<string, StudentView>;
  membershipById: Map<string, MembershipView>;
}

export function deriveTenantViews(data: TenantData, today: ISODate): TenantViews {
  const soon = data.settings.rules.expiringSoonDays;
  const seatsById = new Map(data.seats.map((s) => [s.id, s]));
  const studentNames = new Map(data.students.map((s) => [s.id, s.name]));

  const paidByMembership = new Map<string, { paid: number; pending: number }>();
  for (const p of data.payments) {
    const entry = paidByMembership.get(p.membershipId) ?? { paid: 0, pending: 0 };
    if (p.status === "completed") entry.paid += p.amount;
    if (p.status === "pending") entry.pending += p.amount;
    paidByMembership.set(p.membershipId, entry);
  }

  const memberships: MembershipView[] = data.memberships.map((m) => {
    const status = membershipStatus(m, today, soon);
    const { paid, pending } = paidByMembership.get(m.id) ?? { paid: 0, pending: 0 };
    const balance = m.cancelledAt ? 0 : Math.max(0, m.totalAmount - paid);
    return {
      ...m,
      status,
      amountPaid: paid,
      amountPending: pending,
      balance,
      paymentStatus: paymentStatusFor(m.totalAmount, paid),
      daysRemaining: daysBetween(today, m.endDate),
      studentName: studentNames.get(m.studentId) ?? "Unknown student",
      seatCode: seatsById.get(m.seatId)?.code ?? "—",
    };
  });
  memberships.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const bySeat = new Map<string, MembershipView[]>();
  const byStudent = new Map<string, MembershipView[]>();
  for (const m of memberships) {
    (bySeat.get(m.seatId) ?? bySeat.set(m.seatId, []).get(m.seatId)!).push(m);
    (byStudent.get(m.studentId) ?? byStudent.set(m.studentId, []).get(m.studentId)!).push(m);
  }

  const activeSeats = data.seats
    .filter((s) => !s.removedAt)
    .sort((a, b) => a.number - b.number);

  const seats: SeatView[] = activeSeats.map((seat) => {
    const list = bySeat.get(seat.id) ?? [];
    const current = list.find((m) => isCurrent(m.status));
    const upcoming = list
      .filter((m) => m.status === "upcoming")
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
    let state: SeatView["state"] = "available";
    if (seat.isUnderMaintenance) state = "maintenance";
    else if (current) state = "occupied";
    else if (upcoming) state = "reserved";
    return {
      ...seat,
      state,
      current,
      upcoming,
      hasConflict: seat.isUnderMaintenance && Boolean(current || upcoming),
    };
  });

  const students: StudentView[] = data.students.map((s) => deriveStudent(s, byStudent.get(s.id) ?? []));
  students.sort((a, b) => a.name.localeCompare(b.name));

  const seatById = new Map<string, SeatView | Seat>(data.seats.map((s) => [s.id, s]));
  for (const s of seats) seatById.set(s.id, s);

  return {
    today,
    seats,
    removedSeats: data.seats.filter((s) => s.removedAt),
    memberships,
    students,
    payments: [...data.payments].sort((a, b) =>
      a.paidOn === b.paidOn ? (a.createdAt < b.createdAt ? 1 : -1) : a.paidOn < b.paidOn ? 1 : -1,
    ),
    seatById,
    studentById: new Map(students.map((s) => [s.id, s])),
    membershipById: new Map(memberships.map((m) => [m.id, m])),
  };
}

function deriveStudent(student: Student, list: MembershipView[]): StudentView {
  const live = list.filter((m) => m.status !== "cancelled");
  const current = live.find((m) => isCurrent(m.status));
  const upcomingAll = live
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const upcoming = upcomingAll[0];
  const latest = list[0];

  let coveredUntil: ISODate | undefined = current?.endDate;
  if (current) {
    // Follow back-to-back renewals.
    for (const u of upcomingAll) {
      if (coveredUntil && daysBetween(coveredUntil, u.startDate) <= 1) coveredUntil = u.endDate;
    }
  } else if (upcoming) {
    coveredUntil = upcomingAll[upcomingAll.length - 1]!.endDate;
  }

  const balance = list.reduce((sum, m) => sum + m.balance, 0);
  const totalDue = list.filter((m) => !m.cancelledAt).reduce((s, m) => s + m.totalAmount, 0);

  let membershipStatus: StudentView["membershipStatus"] = "none";
  if (current) membershipStatus = current.status;
  else if (upcoming) membershipStatus = "upcoming";
  else if (latest) membershipStatus = latest.status;

  return {
    ...student,
    current,
    upcoming,
    latest,
    membershipStatus,
    seatCode: (current ?? upcoming)?.seatCode,
    coveredUntil,
    balance,
    paymentStatus: list.length === 0 ? "none" : paymentStatusFor(totalDue, totalDue - balance),
  };
}

/** Does `seatId` have a non-cancelled membership overlapping [start, end]? */
export function findSeatConflict(
  memberships: Membership[],
  seatId: string,
  start: ISODate,
  end: ISODate,
  ignore: (m: Membership) => boolean = () => false,
): Membership | undefined {
  return memberships.find(
    (m) =>
      m.seatId === seatId &&
      !m.cancelledAt &&
      !ignore(m) &&
      rangesOverlap(m.startDate, m.endDate, start, end),
  );
}

export function findStudentConflict(
  memberships: Membership[],
  studentId: string,
  start: ISODate,
  end: ISODate,
  ignore: (m: Membership) => boolean = () => false,
): Membership | undefined {
  return memberships.find(
    (m) =>
      m.studentId === studentId &&
      !m.cancelledAt &&
      !ignore(m) &&
      rangesOverlap(m.startDate, m.endDate, start, end),
  );
}
