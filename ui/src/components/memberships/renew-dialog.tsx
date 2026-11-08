"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/app/combobox";
import { Field } from "@/components/app/field";
import { EMPTY_PAYMENT, PaymentFields, validatePaymentDraft, type PaymentDraft } from "@/components/payments/payment-fields";
import { formatDate, membershipEndDate } from "@/lib/date";
import { isSeatAvailableFor, seatsAvailableFor } from "@/lib/domain/availability";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { membershipService } from "@/lib/services";
import type { MembershipView } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Renew a membership. The renewal is a new membership that starts the day
 * after the current one ends (or today, if already expired), so history and
 * receipts of the earlier period stay intact.
 */
export function RenewDialog({
  membership,
  open,
  onOpenChange,
}: {
  membership: MembershipView | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && membership && <RenewForm membership={membership} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenewForm({ membership, onDone }: { membership: MembershipView; onDone: () => void }) {
  const { tenantId, data, today } = useTenant();
  const plans = data.plans.filter((p) => p.isActive);
  const samePlan = plans.find((p) => p.id === membership.planId);
  const [planId, setPlanId] = useState(samePlan?.id ?? plans[0]?.id ?? "");
  const [seatMode, setSeatMode] = useState<"same" | "change">("same");
  const [newSeat, setNewSeat] = useState("");
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState<PaymentDraft>(EMPTY_PAYMENT);
  const [touched, setTouched] = useState(false);

  const plan = plans.find((p) => p.id === planId);
  const start = membershipService.renewalStart(membership, today);
  const end = plan ? membershipEndDate(start, plan.durationMonths) : start;
  const sameSeatFree = isSeatAvailableFor(data, membership.seatId, start, end);
  const effectiveMode = sameSeatFree ? seatMode : "change";
  const options = seatsAvailableFor(data, start, end).map((s) => ({
    value: s.id,
    label: `Seat ${s.code}`,
    description: s.tags.join(", ") || undefined,
  }));
  const seatId = effectiveMode === "same" ? membership.seatId : newSeat;
  const discountNum = Number(discount || 0);
  const total = plan ? Math.max(0, plan.price - discountNum) : 0;
  const payNow = Number(payment.amount || 0);

  const errors = {
    plan: !plan ? "Select a plan" : null,
    seat: !seatId || (effectiveMode === "change" && !options.some((o) => o.value === seatId)) ? "Select a seat" : null,
    discount: plan && discountNum >= plan.price ? "Discount must be less than the plan price" : null,
    payment: validatePaymentDraft(payment, total),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const renew = useAction(
    () =>
      membershipService.renew(tenantId, membership.id, {
        planId,
        seatId,
        discount: discountNum,
        payment: payNow > 0 ? { amount: payNow, method: payment.method, reference: payment.reference } : undefined,
      }),
    { success: (m) => `Renewed — ${m.code} runs ${formatDate(m.startDate)} to ${formatDate(m.endDate)}` },
  );

  const submit = async () => {
    setTouched(true);
    if (hasErrors) return;
    if (await renew.run()) onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RefreshCw className="size-4 text-brand" aria-hidden /> Renew membership
        </DialogTitle>
        <DialogDescription>
          {membership.studentName} · {membership.code} · currently on seat {membership.seatCode}, ends {formatDate(membership.endDate)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-foreground/80">Plan</legend>
          <RadioGroup value={planId} onValueChange={setPlanId} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {plans.map((p) => (
              <Label
                key={p.id}
                htmlFor={`plan-${p.id}`}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-3 font-normal transition-colors",
                  planId === p.id ? "border-brand/50 bg-brand/5 ring-1 ring-brand/30" : "hover:border-foreground/20",
                )}
              >
                <RadioGroupItem id={`plan-${p.id}`} value={p.id} className="sr-only" />
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.durationMonths} mo · {formatCurrency(p.price)}</span>
              </Label>
            ))}
          </RadioGroup>
          {!samePlan && (
            <p className="mt-2 text-xs text-muted-foreground">
              The previous plan “{membership.planName}” is no longer offered. Pick a current plan.
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">New period</div>
            <div className="text-sm font-medium tabular">
              {formatDate(start)} → {formatDate(end)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Seat</div>
            {sameSeatFree ? (
              <RadioGroup value={seatMode} onValueChange={(v) => setSeatMode(v as "same" | "change")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="seat-same" value="same" />
                  <Label htmlFor="seat-same" className="font-normal">Keep {membership.seatCode}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="seat-change" value="change" />
                  <Label htmlFor="seat-change" className="font-normal">Change seat</Label>
                </div>
              </RadioGroup>
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-[oklch(0.5_0.12_65)]">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                Seat {membership.seatCode} is booked by someone else for this period. Choose another seat.
              </p>
            )}
            {effectiveMode === "change" && (
              <Combobox
                options={options}
                value={newSeat}
                onChange={setNewSeat}
                placeholder="Select a free seat"
                invalid={touched && Boolean(errors.seat)}
              />
            )}
          </div>
        </div>

        <Field label="Discount" hint="Optional, in ₹" error={touched ? errors.discount ?? undefined : undefined} className="max-w-48">
          {(p) => <Input {...p} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" />}
        </Field>

        <Separator />
        <PaymentFields value={payment} onChange={setPayment} max={total} error={touched ? errors.payment : null} />

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Renewal total</span>
          <span className="font-semibold tabular">{formatCurrency(total)}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={renew.pending}>Cancel</Button>
        <Button onClick={submit} disabled={renew.pending}>
          {renew.pending && <Loader2 className="animate-spin" />}
          Confirm renewal
        </Button>
      </DialogFooter>
    </>
  );
}
