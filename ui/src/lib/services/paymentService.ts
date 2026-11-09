/**
 * Payment records. These are bookkeeping entries for the demo — no payment
 * gateway is involved and no money moves.
 */
import { pad, uid } from "../id";
import { getTenantData, setTenantData } from "../store/db";
import type {
  ISODate,
  Membership,
  Payment,
  PaymentMethod,
  PaymentRecordStatus,
  TenantData,
} from "../types";
import { fail, latency, nowIso, tenantToday } from "./core";

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  paidOn: ISODate;
  reference?: string;
  note?: string;
  status: Exclude<PaymentRecordStatus, "failed">;
}

function receiptPrefix(data: TenantData) {
  const words = data.settings.general.name.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join("") || "RCP";
}

/** Amount already counted against a membership (completed + pending). */
function committed(data: TenantData, membershipId: string) {
  return data.payments
    .filter((p) => p.membershipId === membershipId && p.status !== "failed")
    .reduce((s, p) => s + p.amount, 0);
}

export function buildPayment(
  data: TenantData,
  membership: Membership,
  total: number,
  input: RecordPaymentInput,
): { data: TenantData; payment: Payment } {
  const amount = Math.round(input.amount);
  if (!(amount > 0)) fail("Amount must be greater than zero.");
  const outstanding = total - committed(data, membership.id);
  if (amount > outstanding)
    fail(`Amount exceeds the outstanding balance of ₹${outstanding.toLocaleString("en-IN")}.`);
  if (input.method !== "cash" && input.method !== "other" && !input.reference?.trim() && input.status === "completed")
    fail("A transaction reference is required for UPI and bank transfers.");

  const payment: Payment = {
    id: uid("pay"),
    receiptNo: `${receiptPrefix(data)}-${pad(data.counters.receipt, 5)}`,
    studentId: membership.studentId,
    membershipId: membership.id,
    amount,
    method: input.method,
    status: input.status,
    paidOn: input.paidOn,
    reference: input.reference?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: nowIso(),
  };
  return {
    payment,
    data: {
      ...data,
      payments: [...data.payments, payment],
      counters: { ...data.counters, receipt: data.counters.receipt + 1 },
    },
  };
}

export const paymentService = {
  async record(tenantId: string, membershipId: string, input: RecordPaymentInput) {
    await latency();
    const data = getTenantData(tenantId);
    const membership = data.memberships.find((m) => m.id === membershipId);
    if (!membership) fail("Membership not found.");
    if (membership.cancelledAt) fail("Payments cannot be recorded against a cancelled membership.");
    if (input.paidOn > tenantToday(tenantId)) fail("Payment date cannot be in the future.");
    const result = buildPayment(data, membership, membership.totalAmount, input);
    setTenantData(tenantId, () => result.data);
    return result.payment;
  },

  async setStatus(tenantId: string, paymentId: string, status: PaymentRecordStatus) {
    await latency(200);
    const data = getTenantData(tenantId);
    const p = data.payments.find((x) => x.id === paymentId);
    if (!p) fail("Payment not found.");
    if (p.status !== "pending") fail("Only pending payments can be updated.");
    setTenantData(tenantId, (d) => ({
      ...d,
      payments: d.payments.map((x) =>
        x.id === paymentId
          ? { ...x, status, note: status === "failed" ? "Marked as failed — not received" : x.note }
          : x,
      ),
    }));
  },
};
