"use client";

import { useTenant } from "@/lib/hooks/use-tenant";
import { useSession } from "@/lib/store/session";

/** The signed-in student, resolved within the current tenant only. */
export function useCurrentStudent() {
  const { views, data } = useTenant();
  const studentId = useSession((s) => s.session?.studentId);
  const student = studentId ? views.studentById.get(studentId) : undefined;
  if (!student) throw new Error("Student session without a matching student in this tenant");
  const memberships = views.memberships.filter((m) => m.studentId === student.id);
  const payments = views.payments.filter((p) => p.studentId === student.id);
  const pendingRequest = data.bookingRequests.find((r) => r.studentId === student.id && r.status === "pending");
  const lastRequest = [...data.bookingRequests]
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return { student, memberships, payments, pendingRequest, lastRequest };
}
