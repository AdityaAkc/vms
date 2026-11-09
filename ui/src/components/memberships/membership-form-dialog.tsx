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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/app/combobox";
import { Field } from "@/components/app/field";
import { MEMBERSHIP_STATUS_META } from "@/components/app/status-badge";
import { PaymentFields, EMPTY_PAYMENT, validatePaymentDraft, type PaymentDraft } from "@/components/payments/payment-fields";
import { formatDate, membershipEndDate } from "@/lib/date";
import { seatsAvailableFor } from "@/lib/domain/availability";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { membershipService } from "@/lib/services";
import type { Membership } from "@/lib/types";

/**
 * Create a membership (assign a seat). Seat options are limited to seats
 * free for the full date range of the selected plan.
 */
export function MembershipFormDialog({
  open,
  onOpenChange,
  defaultStudentId,
  defaultSeatId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultStudentId?: string;
  defaultSeatId?: string;
  onCreated?: (m: Membership) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <MembershipForm
            defaultStudentId={defaultStudentId}
            defaultSeatId={defaultSeatId}
            onDone={(m) => {
              onOpenChange(false);
              if (m) onCreated?.(m);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MembershipForm({
  defaultStudentId,
  defaultSeatId,
  onDone,
}: {
  defaultStudentId?: string;
  defaultSeatId?: string;
  onDone: (m?: Membership) => void;
}) {
  const { tenantId, data, views, today } = useTenant();
  const activePlans = data.plans.filter((p) => p.isActive);
  const featured = activePlans.find((p) => p.isFeatured) ?? activePlans[0];

  const [studentId, setStudentId] = useState(defaultStudentId ?? "");
  const [planId, setPlanId] = useState(featured?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [seatId, setSeatId] = useState(defaultSeatId ?? "");
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState<PaymentDraft>(EMPTY_PAYMENT);
  const [touched, setTouched] = useState(false);

  const plan = activePlans.find((p) => p.id === planId);
  const endDate = plan && startDate ? membershipEndDate(startDate, plan.durationMonths) : undefined;
  const available = endDate ? seatsAvailableFor(data, startDate, endDate) : [];
  const seatOk = available.some((s) => s.id === seatId);

  const discountNum = Number(discount || 0);
  const total = plan ? Math.max(0, plan.price - discountNum) : 0;
  const payNow = Number(payment.amount || 0);

  const studentOptions = views.students
    .filter((s) => s.status === "active")
    .map((s) => ({
      value: s.id,
      label: s.name,
      description: `${s.code} · ${s.seatCode ? `Seat ${s.seatCode} · ` : ""}${MEMBERSHIP_STATUS_META[s.membershipStatus].label}`,
      keywords: [s.phone],
    }));
  const seatOptions = available.map((s) => ({
    value: s.id,
    label: `Seat ${s.code}`,
    description: s.tags.join(", ") || undefined,
  }));

  const errors = {
    student: !studentId ? "Select a student" : null,
    plan: !plan ? "Select a plan" : null,
    start: !startDate ? "Choose a start date" : null,
    seat: !seatId ? "Select a seat" : !seatOk ? "This seat is not free for the selected dates" : null,
    discount: plan && (discountNum < 0 || discountNum >= plan.price) ? "Discount must be less than the plan price" : null,
    payment: validatePaymentDraft(payment, total),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const create = useAction(
    () =>
      membershipService.create(tenantId, {
        studentId,
        seatId,
        planId,
        startDate,
        discount: discountNum,
        payment: payNow > 0 ? { amount: payNow, method: payment.method, reference: payment.reference } : undefined,
      }),
    { success: (m) => `Membership ${m.code} created` },
  );

  const submit = async () => {
    setTouched(true);
    if (hasErrors) return;
    const m = await create.run();
    if (m) onDone(m);
  };

  const show = (e: string | null) => (touched ? e : null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>New membership</DialogTitle>
        <DialogDescription>Assign a seat to a student for a membership plan.</DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Student" required error={show(errors.student) ?? undefined} className="sm:col-span-2">
            {(p) => (
              <Combobox
                id={p.id}
                options={studentOptions}
                value={studentId}
                onChange={setStudentId}
                placeholder="Search by name, code or phone"
                disabled={Boolean(defaultStudentId)}
                invalid={Boolean(show(errors.student))}
              />
            )}
          </Field>
          <Field label="Plan" required error={show(errors.plan) ?? undefined}>
            {(p) => (
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger id={p.id} className="h-9 w-full">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((pl) => (
                    <SelectItem key={pl.id} value={pl.id}>
                      {pl.name} · {formatCurrency(pl.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field
            label="Start date"
            required
            error={show(errors.start) ?? undefined}
            hint={endDate ? `Ends ${formatDate(endDate)}` : undefined}
          >
            {(p) => <Input {...p} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
          </Field>
          <Field
            label="Seat"
            required
            error={show(errors.seat) ?? (seatId && !seatOk ? errors.seat! : undefined)}
            hint={`${available.length} seats free for these dates`}
          >
            {(p) => (
              <Combobox
                id={p.id}
                options={seatOptions}
                value={seatOk ? seatId : ""}
                onChange={setSeatId}
                placeholder="Select a free seat"
                searchPlaceholder="Search seat number"
                emptyText="No free seats for these dates."
              />
            )}
          </Field>
          <Field label="Discount" error={show(errors.discount) ?? undefined} hint="Optional, in ₹">
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
              />
            )}
          </Field>
        </div>

        <Separator />
        <PaymentFields value={payment} onChange={setPayment} max={total} error={show(errors.payment)} />

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <dl className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
            <dt className="text-muted-foreground">Plan price</dt>
            <dd className="text-right tabular sm:text-left">{plan ? formatCurrency(plan.price) : "—"}</dd>
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-right tabular sm:text-left">{formatCurrency(discountNum)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium tabular sm:text-left">{formatCurrency(total)}</dd>
            <dt className="text-muted-foreground">Balance after payment</dt>
            <dd className="text-right tabular sm:text-left">{formatCurrency(Math.max(0, total - payNow))}</dd>
          </dl>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()} disabled={create.pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={create.pending || (touched && hasErrors)}>
          {create.pending && <Loader2 className="animate-spin" />}
          Create membership
        </Button>
      </DialogFooter>
    </>
  );
}
