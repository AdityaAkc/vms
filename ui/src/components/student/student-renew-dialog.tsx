"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addDays, formatDate, membershipEndDate } from "@/lib/date";
import { isSeatAvailableFor } from "@/lib/domain/availability";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { membershipService } from "@/lib/services";
import type { MembershipView } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Student self-renewal: same seat, choose a plan, pay at the desk. */
export function StudentRenewDialog({
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
      <DialogContent className="sm:max-w-lg">
        {open && membership && <RenewForm membership={membership} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenewForm({ membership, onDone }: { membership: MembershipView; onDone: () => void }) {
  const { tenantId, data, today, settings } = useTenant();
  const plans = data.plans.filter((p) => p.isActive && p.durationMonths >= settings.rules.minDurationMonths);
  const [planId, setPlanId] = useState(plans.find((p) => p.id === membership.planId)?.id ?? plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);
  const start = membershipService.renewalStart(membership, today);
  const end = plan ? membershipEndDate(start, plan.durationMonths) : start;
  const seatFree = isSeatAvailableFor(data, membership.seatId, start, end);
  const window = settings.rules.renewalWindowDays;
  const opensOn = addDays(membership.endDate, -window);
  const tooEarly = membership.daysRemaining > window;

  const renew = useAction(
    () => membershipService.renew(tenantId, membership.id, { planId, source: "student" }),
    { success: (m) => `Renewed! Seat ${membership.seatCode} is yours until ${formatDate(m.endDate)}.` },
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Renew your seat</DialogTitle>
        <DialogDescription>
          Keep seat {membership.seatCode}. Your new period starts {formatDate(start)}.
        </DialogDescription>
      </DialogHeader>

      {tooEarly ? (
        <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          Renewal opens {window} days before expiry — on {formatDate(opensOn)}. Come back then, or ask the front desk.
        </div>
      ) : (
        <>
          <RadioGroup value={planId} onValueChange={setPlanId} className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => (
              <Label
                key={p.id}
                htmlFor={`rp-${p.id}`}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 font-normal",
                  planId === p.id ? "border-brand/50 bg-brand/5 ring-1 ring-brand/30" : "hover:border-foreground/20",
                )}
              >
                <RadioGroupItem id={`rp-${p.id}`} value={p.id} className="sr-only" />
                <span>
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.durationMonths} {p.durationMonths === 1 ? "month" : "months"}</span>
                </span>
                <span className="font-semibold tabular">{formatCurrency(p.price)}</span>
              </Label>
            ))}
          </RadioGroup>
          <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <dt className="text-muted-foreground">New period</dt>
            <dd className="text-right tabular">{formatDate(start)} – {formatDate(end)}</dd>
            <dt className="font-medium">Amount due</dt>
            <dd className="text-right font-semibold tabular">{plan ? formatCurrency(plan.price) : "—"}</dd>
          </dl>
          {!seatFree && (
            <p className="text-sm text-destructive">
              Seat {membership.seatCode} is already booked by someone else for this period. Please contact the front desk to choose another seat.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Pay at the front desk (cash, UPI or bank transfer). Your receipt will appear under Payments. {settings.rules.renewalPolicy}
          </p>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>{tooEarly ? "Close" : "Cancel"}</Button>
        {!tooEarly && (
          <Button disabled={!plan || !seatFree || renew.pending} onClick={async () => (await renew.run()) && onDone()}>
            {renew.pending && <Loader2 className="animate-spin" />} Confirm renewal
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
