import { addDays, monthKey, rangesOverlap, recentMonthKeys } from "../date";
import type { PaymentMethod } from "../types";
import type { TenantViews } from "./derive";

export interface DashboardMetrics {
  totalSeats: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  occupancyRate: number;
  activeStudents: number;
  expiringSoon: number;
  pendingAmount: number;
  pendingCount: number;
  monthRevenue: number;
  lastMonthRevenue: number;
}

export function dashboardMetrics(v: TenantViews): DashboardMetrics {
  const count = (state: string) => v.seats.filter((s) => s.state === state).length;
  const occupied = count("occupied");
  const totalSeats = v.seats.length;
  const thisMonth = monthKey(v.today);
  const lastMonth = monthKey(addDays(`${thisMonth}-01`, -1));
  const revenueFor = (key: string) =>
    v.payments
      .filter((p) => p.status === "completed" && monthKey(p.paidOn) === key)
      .reduce((s, p) => s + p.amount, 0);
  const due = v.memberships.filter((m) => m.balance > 0);
  return {
    totalSeats,
    occupied,
    available: count("available"),
    reserved: count("reserved"),
    maintenance: count("maintenance"),
    occupancyRate: totalSeats ? occupied / totalSeats : 0,
    activeStudents: v.students.filter(
      (s) => s.status === "active" && (s.current || s.upcoming),
    ).length,
    expiringSoon: v.memberships.filter((m) => m.status === "expiring" && !hasRenewal(v, m.studentId, m.endDate)).length,
    pendingAmount: due.reduce((s, m) => s + m.balance, 0),
    pendingCount: due.length,
    monthRevenue: revenueFor(thisMonth),
    lastMonthRevenue: revenueFor(lastMonth),
  };
}

export function revenueByMonth(v: TenantViews, months = 6) {
  const keys = recentMonthKeys(v.today, months);
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const p of v.payments) {
    if (p.status !== "completed") continue;
    const k = monthKey(p.paidOn);
    if (totals.has(k)) totals.set(k, totals.get(k)! + p.amount);
  }
  return keys.map((k) => ({ month: k, revenue: totals.get(k)! }));
}

/** Seat occupancy on the 15th of each month (or today for the current month). */
export function occupancyByMonth(v: TenantViews, months = 6) {
  const keys = recentMonthKeys(v.today, months);
  const capacity = v.seats.length || 1;
  return keys.map((k) => {
    const probe = k === monthKey(v.today) ? v.today : `${k}-15`;
    const occupied = new Set(
      v.memberships
        .filter((m) => !m.cancelledAt && m.startDate <= probe && m.endDate >= probe)
        .map((m) => m.seatId),
    ).size;
    return { month: k, occupied, rate: Math.min(1, occupied / capacity) };
  });
}

export function expiryBuckets(v: TenantViews) {
  const live = v.memberships.filter(
    (m) => (m.status === "active" || m.status === "expiring") && !hasRenewal(v, m.studentId, m.endDate),
  );
  const within = (min: number, max: number) =>
    live.filter((m) => m.daysRemaining >= min && m.daysRemaining <= max).length;
  return [
    { key: "7", label: "0–7 days", count: within(0, 7) },
    { key: "15", label: "8–15 days", count: within(8, 15) },
    { key: "30", label: "16–30 days", count: within(16, 30) },
    {
      key: "expired",
      label: "Expired (30d)",
      count: v.memberships.filter(
        (m) => m.status === "expired" && m.daysRemaining >= -30 && !hasRenewal(v, m.studentId, m.endDate),
      ).length,
    },
  ];
}

export function hasRenewal(v: TenantViews, studentId: string, after: string) {
  return v.memberships.some(
    (m) => m.studentId === studentId && !m.cancelledAt && m.startDate > after,
  );
}

export function collectionsByMethod(v: TenantViews, sinceDays = 180) {
  const since = addDays(v.today, -sinceDays);
  const totals: Record<PaymentMethod, number> = { cash: 0, upi: 0, bank_transfer: 0, other: 0 };
  for (const p of v.payments) {
    if (p.status === "completed" && p.paidOn >= since) totals[p.method] += p.amount;
  }
  return totals;
}

export function planMix(v: TenantViews) {
  const counts = new Map<string, number>();
  for (const m of v.memberships) {
    if (m.status === "cancelled") continue;
    if (!rangesOverlap(m.startDate, m.endDate, addDays(v.today, -180), v.today)) continue;
    counts.set(m.planName, (counts.get(m.planName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function expiringWithin(v: TenantViews, days: number) {
  return v.memberships
    .filter((m) => (m.status === "active" || m.status === "expiring") && m.daysRemaining <= days)
    .filter((m) => !hasRenewal(v, m.studentId, m.endDate))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function newStudentsThisMonth(v: TenantViews) {
  const k = monthKey(v.today);
  return v.students.filter((s) => monthKey(s.joinedOn) === k).length;
}
