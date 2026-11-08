import { isBlocking } from "../domain/derive";
import { pad, uid } from "../id";
import { getTenantData, setTenantData } from "../store/db";
import type { Gender, Student } from "../types";
import { fail, latency, nowIso, tenantToday } from "./core";

export interface StudentInput {
  name: string;
  phone: string;
  email: string;
  gender: Gender;
  dateOfBirth?: string;
  address: string;
  guardianName?: string;
  guardianPhone?: string;
  preparingFor?: string;
}

function normalise(input: StudentInput): StudentInput {
  return {
    ...input,
    name: input.name.trim().replace(/\s+/g, " "),
    phone: input.phone.replace(/\D/g, "").slice(-10),
    email: input.email.trim().toLowerCase(),
    address: input.address.trim(),
    guardianName: input.guardianName?.trim() || undefined,
    guardianPhone: input.guardianPhone?.replace(/\D/g, "").slice(-10) || undefined,
    dateOfBirth: input.dateOfBirth || undefined,
    preparingFor: input.preparingFor || undefined,
  };
}

function assertUnique(tenantId: string, input: StudentInput, ignoreId?: string) {
  const data = getTenantData(tenantId);
  const others = data.students.filter((s) => s.id !== ignoreId);
  if (others.some((s) => s.phone === input.phone)) fail("Another student is already registered with this phone number.");
  if (input.email && others.some((s) => s.email === input.email)) fail("Another student is already registered with this email.");
}

export const studentService = {
  async create(tenantId: string, raw: StudentInput) {
    await latency();
    const input = normalise(raw);
    if (input.phone.length !== 10) fail("Enter a valid 10-digit mobile number.");
    assertUnique(tenantId, input);
    const data = getTenantData(tenantId);
    const student: Student = {
      ...input,
      id: uid("stu"),
      code: `STU-${pad(data.counters.student, 3)}`,
      joinedOn: tenantToday(tenantId),
      status: "active",
      notes: [],
    };
    setTenantData(tenantId, (d) => ({
      ...d,
      students: [...d.students, student],
      counters: { ...d.counters, student: d.counters.student + 1 },
    }));
    return student;
  },

  async update(tenantId: string, studentId: string, raw: StudentInput) {
    await latency();
    const input = normalise(raw);
    if (input.phone.length !== 10) fail("Enter a valid 10-digit mobile number.");
    assertUnique(tenantId, input, studentId);
    setTenantData(tenantId, (d) => ({
      ...d,
      students: d.students.map((s) => (s.id === studentId ? { ...s, ...input } : s)),
    }));
  },

  /**
   * Mark inactive. If the student still holds a current/upcoming booking the
   * caller must explicitly choose to cancel it — we never silently release a
   * paid seat.
   */
  async deactivate(tenantId: string, studentId: string, opts: { reason: string; cancelBookings: boolean }) {
    await latency();
    const data = getTenantData(tenantId);
    const today = tenantToday(tenantId);
    const blocking = data.memberships.filter((m) => m.studentId === studentId && isBlocking(m, today));
    if (blocking.length && !opts.cancelBookings)
      fail("This student has an active or upcoming membership. Choose to cancel it, or keep the student active.", "needs_ack");
    const now = nowIso();
    const ids = new Set(blocking.map((m) => m.id));
    setTenantData(tenantId, (d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === studentId ? { ...s, status: "inactive", inactiveReason: opts.reason.trim() || undefined } : s,
      ),
      memberships: d.memberships.map((m) =>
        ids.has(m.id) ? { ...m, cancelledAt: now, cancelReason: "Student marked inactive" } : m,
      ),
      seatEvents: [
        ...d.seatEvents,
        ...blocking.map((m) => ({
          id: uid("evt"),
          seatId: m.seatId,
          type: "released" as const,
          at: now,
          studentId,
          membershipId: m.id,
          note: "Student marked inactive",
        })),
      ],
    }));
  },

  async reactivate(tenantId: string, studentId: string) {
    await latency(250);
    setTenantData(tenantId, (d) => ({
      ...d,
      students: d.students.map((s) => (s.id === studentId ? { ...s, status: "active", inactiveReason: undefined } : s)),
    }));
  },

  async addNote(tenantId: string, studentId: string, text: string) {
    await latency(200);
    if (!text.trim()) fail("Note cannot be empty.");
    setTenantData(tenantId, (d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === studentId ? { ...s, notes: [{ id: uid("note"), text: text.trim(), at: nowIso() }, ...s.notes] } : s,
      ),
    }));
  },

  async deleteNote(tenantId: string, studentId: string, noteId: string) {
    await latency(150);
    setTenantData(tenantId, (d) => ({
      ...d,
      students: d.students.map((s) => (s.id === studentId ? { ...s, notes: s.notes.filter((n) => n.id !== noteId) } : s)),
    }));
  },
};
