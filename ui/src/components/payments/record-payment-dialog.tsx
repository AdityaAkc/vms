"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/app/combobox";
import { Field } from "@/components/app/field";
import { formatDate } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { paymentService } from "@/lib/services";
import type { Payment } from "@/lib/types";
import { EMPTY_PAYMENT, PaymentFields, validatePaymentDraft, type PaymentDraft } from "./payment-fields";

export function RecordPaymentDialog({
  open,
  onOpenChange,
  membershipId,
  studentId,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  membershipId?: string;
  studentId?: string;
  onRecorded?: (p: Payment) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <RecordPaymentForm
            initialMembershipId={membershipId}
            initialStudentId={studentId}
            onDone={(p) => {
              onOpenChange(false);
              if (p) onRecorded?.(p);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentForm({
  initialMembershipId,
  initialStudentId,
  onDone,
}: {
  initialMembershipId?: string;
  initialStudentId?: string;
  onDone: (p?: Payment) => void;
}) {
  const { tenantId, views, today } = useTenant();
  const initial = initialMembershipId ? views.membershipById.get(initialMembershipId) : undefined;
  const [membershipId, setMembershipId] = useState(initial?.id ?? "");
  const [studentFilter, setStudentFilter] = useState(initial?.studentId ?? initialStudentId ?? "");
  const membership = views.membershipById.get(membershipId);
  const outstanding = membership ? Math.max(0, membership.balance - membership.amountPending) : 0;

  const [payment, setPayment] = useState<PaymentDraft>({ ...EMPTY_PAYMENT, amount: outstanding ? String(outstanding) : "" });
  const [paidOn, setPaidOn] = useState(today);
  const [status, setStatus] = useState<"completed" | "pending">("completed");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const withDues = views.memberships.filter((m) => m.balance - m.amountPending > 0 && m.status !== "cancelled");
  const students = [...new Map(withDues.map((m) => [m.studentId, m.studentName])).entries()];
  const studentOptions = students.map(([id, name]) => {
    const due = withDues.filter((m) => m.studentId === id).reduce((s, m) => s + m.balance - m.amountPending, 0);
    return { value: id, label: name, description: `${formatCurrency(due)} due` };
  });
  const membershipOptions = withDues
    .filter((m) => m.studentId === studentFilter)
    .map((m) => ({
      value: m.id,
      label: `${m.code} · ${m.planName}`,
      description: `Seat ${m.seatCode} · ${formatCurrency(m.balance - m.amountPending)} due`,
    }));

  const errors = {
    membership: !membership ? "Select a membership" : null,
    amount: !Number(payment.amount) ? "Enter the amount received" : validatePaymentDraft(payment, outstanding),
    date: !paidOn ? "Choose a date" : paidOn > today ? "Date cannot be in the future" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const record = useAction(
    () =>
      paymentService.record(tenantId, membershipId, {
        amount: Number(payment.amount),
        method: payment.method,
        reference: payment.reference,
        paidOn,
        status,
        note,
      }),
    { success: (p) => `Payment of ${formatCurrency(p.amount)} recorded (${p.receiptNo})` },
  );

  const submit = async () => {
    setTouched(true);
    if (hasErrors) return;
    const p = await record.run();
    if (p) onDone(p);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          Log a fee payment received at the desk. Partial payments are allowed; the balance updates automatically.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {!initial && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Student" required>
              {(p) => (
                <Combobox
                  id={p.id}
                  options={studentOptions}
                  value={studentFilter}
                  onChange={(v) => {
                    setStudentFilter(v);
                    const first = withDues.find((m) => m.studentId === v);
                    setMembershipId(first?.id ?? "");
                    const due = first ? first.balance - first.amountPending : 0;
                    setPayment((pd) => ({ ...pd, amount: due ? String(due) : "" }));
                  }}
                  placeholder="Students with dues"
                  emptyText="No outstanding balances."
                />
              )}
            </Field>
            <Field label="Membership" required error={touched ? errors.membership ?? undefined : undefined}>
              {(p) => (
                <Combobox
                  id={p.id}
                  options={membershipOptions}
                  value={membershipId}
                  onChange={(v) => {
                    setMembershipId(v);
                    const m = views.membershipById.get(v);
                    setPayment((pd) => ({ ...pd, amount: m ? String(m.balance - m.amountPending) : "" }));
                  }}
                  placeholder={studentFilter ? "Select membership" : "Select a student first"}
                  disabled={!studentFilter}
                />
              )}
            </Field>
          </div>
        )}

        {membership && (
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-medium tabular">{formatCurrency(membership.totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="font-medium tabular">{formatCurrency(membership.amountPaid)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className="font-semibold text-destructive tabular">{formatCurrency(outstanding)}</div>
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {membership.studentName} · {membership.code} · Seat {membership.seatCode} · {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
              {membership.amountPending > 0 && ` · ${formatCurrency(membership.amountPending)} awaiting verification`}
            </div>
          </div>
        )}

        <PaymentFields
          value={payment}
          onChange={setPayment}
          max={outstanding}
          amountLabel="Amount"
          optional={false}
          error={touched ? errors.amount : null}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Payment date" required error={touched ? errors.date ?? undefined : undefined}>
            {(p) => <Input {...p} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-foreground/80">Status</legend>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as "completed" | "pending")} className="flex gap-4 pt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="st-completed" value="completed" />
                <Label htmlFor="st-completed" className="font-normal">Received</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="st-pending" value="pending" />
                <Label htmlFor="st-pending" className="font-normal">Awaiting verification</Label>
              </div>
            </RadioGroup>
          </fieldset>
        </div>
        <Field label="Note" hint="Optional, visible on the receipt">
          {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()} disabled={record.pending}>Cancel</Button>
        <Button onClick={submit} disabled={record.pending}>
          {record.pending && <Loader2 className="animate-spin" />}
          Record payment
        </Button>
      </DialogFooter>
    </>
  );
}
