"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Clock, Info, Loader2, PartyPopper, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookingRequestBadge } from "@/components/app/status-badge";
import { SeatLegend, SeatMap } from "@/components/seats/seat-map";
import { useCurrentStudent } from "@/components/student/use-current-student";
import { addDays, formatDate, membershipEndDate } from "@/lib/date";
import { isSeatAvailableFor } from "@/lib/domain/availability";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { bookingService } from "@/lib/services";
import type { BookingOutcome } from "@/lib/services/bookingService";
import type { SeatState, SeatView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BookSeatView() {
  const { student, pendingRequest, lastRequest } = useCurrentStudent();
  const { views } = useTenant();
  const [outcome, setOutcome] = useState<BookingOutcome | null>(null);
  const holding = student.current ?? student.upcoming;

  if (outcome) return <BookingResult outcome={outcome} />;

  if (student.status !== "active") {
    return <Notice title="Your account is inactive" body="Please contact the front desk to reactivate your account before booking." />;
  }
  if (holding) {
    return (
      <Notice
        title={`You already have seat ${holding.seatCode}`}
        body={`Your membership runs until ${formatDate(student.coveredUntil ?? holding.endDate)}. To extend it, renew from your dashboard. Seat changes are handled by the front desk.`}
        action={<Button asChild><Link href="/student/dashboard">Go to dashboard</Link></Button>}
      />
    );
  }
  if (pendingRequest) {
    return <PendingRequest requestId={pendingRequest.id} />;
  }
  return (
    <>
      {lastRequest?.status === "declined" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Your request for seat {views.seatById.get(lastRequest.seatId)?.code} was declined
            {lastRequest.decisionNote ? `: “${lastRequest.decisionNote}”` : "."} You can choose another seat below.
          </span>
        </div>
      )}
      <BookingFlow onBooked={setOutcome} />
    </>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <CalendarCheck className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function PendingRequest({ requestId }: { requestId: string }) {
  const { tenantId, data, views } = useTenant();
  const req = data.bookingRequests.find((r) => r.id === requestId)!;
  const plan = data.plans.find((p) => p.id === req.planId);
  const withdraw = useAction(async () => {
    await bookingService.withdraw(tenantId, requestId);
    return true;
  }, { success: "Request withdrawn" });
  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Your booking request</h1>
          <BookingRequestBadge status="pending" />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Seat</dt><dd className="font-medium">{views.seatById.get(req.seatId)?.code}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="font-medium">{plan?.name}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Start date</dt><dd className="font-medium">{formatDate(req.startDate)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-medium tabular">{plan && formatCurrency(plan.price)}</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">
          This is a <strong>request</strong>, not a confirmed booking. The seat is held only after the front desk approves it.
        </p>
        <Button variant="outline" disabled={withdraw.pending} onClick={() => withdraw.run()}>
          {withdraw.pending && <Loader2 className="animate-spin" />} Withdraw request
        </Button>
      </CardContent>
    </Card>
  );
}

function BookingFlow({ onBooked }: { onBooked: (o: BookingOutcome) => void }) {
  const { tenantId, data, views, settings, today } = useTenant();
  const { student } = useCurrentStudent();
  const rules = settings.rules;
  const plans = data.plans.filter((p) => p.isActive && p.durationMonths >= rules.minDurationMonths).sort((a, b) => a.durationMonths - b.durationMonths);
  const [planId, setPlanId] = useState(plans.find((p) => p.isFeatured)?.id ?? plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const plan = plans.find((p) => p.id === planId);
  const maxStart = addDays(today, rules.advanceBookingDays);
  const validStart = startDate >= today && startDate <= maxStart;
  const endDate = plan && validStart ? membershipEndDate(startDate, plan.durationMonths) : null;

  // Availability is evaluated for the whole chosen period, not just today.
  const stateFor = new Map<string, SeatState>();
  for (const s of views.seats) {
    if (s.isUnderMaintenance) stateFor.set(s.id, "maintenance");
    else if (!endDate) stateFor.set(s.id, s.state);
    else if (isSeatAvailableFor(data, s.id, startDate, endDate)) stateFor.set(s.id, "available");
    else stateFor.set(s.id, s.state === "available" ? "reserved" : s.state);
  }
  const freeCount = [...stateFor.values()].filter((s) => s === "available").length;
  const seat = seatId && stateFor.get(seatId) === "available" ? views.seats.find((s) => s.id === seatId) : undefined;

  const book = useAction(
    () => bookingService.book(tenantId, { studentId: student.id, seatId: seat!.id, planId, startDate }),
  );

  const approval = rules.bookingMode === "approval";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Book a seat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {approval
            ? "Pick a plan and a free seat, then send a request. The front desk confirms it."
            : "Pick a plan and a free seat. Your booking is confirmed instantly; pay at the front desk."}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium text-foreground/80">1. Choose a plan</div>
            <RadioGroup value={planId} onValueChange={setPlanId} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {plans.map((p) => (
                <Label
                  key={p.id}
                  htmlFor={`bp-${p.id}`}
                  className={cn(
                    "relative flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border p-3 font-normal transition-colors",
                    planId === p.id ? "border-brand/50 bg-brand/5 ring-1 ring-brand/30" : "hover:border-foreground/20",
                  )}
                >
                  <RadioGroupItem id={`bp-${p.id}`} value={p.id} className="sr-only" />
                  {p.isFeatured && <span className="absolute top-2 right-2 rounded-full bg-brand px-1.5 text-[10px] font-medium text-brand-foreground">Popular</span>}
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-lg font-semibold tabular">{formatCurrency(p.price)}</span>
                  <span className="text-xs text-muted-foreground tabular">{formatCurrency(Math.round(p.price / p.durationMonths))}/month</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs">2. Start date</Label>
              <Input
                id="start"
                type="date"
                min={today}
                max={maxStart}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-invalid={!validStart || undefined}
              />
            </div>
            <p className={cn("text-xs", validStart ? "text-muted-foreground" : "text-destructive")}>
              {validStart && endDate
                ? `Membership runs ${formatDate(startDate)} – ${formatDate(endDate)} · ${freeCount} seats free for these dates`
                : `Choose a date between ${formatDate(today)} and ${formatDate(maxStart)}.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-foreground/80">3. Pick a free seat</div>
            <SeatLegend showExpiring={false} />
          </div>
          <SeatMap
            seats={views.seats}
            layout={settings.layout}
            stateOf={(s) => stateFor.get(s.id) ?? s.state}
            isSelectable={(s: SeatView) => Boolean(endDate) && stateFor.get(s.id) === "available"}
            selectedId={seat?.id}
            onSelect={(s) => setSeatId(s.id)}
            density={views.seats.length > 60 ? "compact" : "comfortable"}
            ariaLabel="Seat map. Only available seats can be selected. Use arrow keys to move."
          />
          <p className="text-xs text-muted-foreground">Occupied, reserved and maintenance seats can&apos;t be selected.</p>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4">
              <div className="text-sm font-semibold">Summary</div>
              {seat && plan && endDate ? (
                <>
                  <dl className="space-y-2 text-sm">
                    <Row label="Seat" value={<span className="font-semibold">{seat.code}</span>} />
                    {seat.tags.length > 0 && <Row label="Features" value={seat.tags.join(", ")} />}
                    <Row label="Plan" value={plan.name} />
                    <Row label="Duration" value={`${plan.durationMonths} ${plan.durationMonths === 1 ? "month" : "months"}`} />
                    <Row label="Monthly fee" value={formatCurrency(Math.round(plan.price / plan.durationMonths))} />
                    <Row label="Start date" value={formatDate(startDate)} />
                    <Row label="End date" value={formatDate(endDate)} />
                  </dl>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-xl font-semibold tabular">{formatCurrency(plan.price)}</span>
                  </div>
                  <Button className="h-10 w-full" onClick={() => setConfirming(true)}>
                    {approval ? <><Send /> Review request</> : <><CalendarCheck /> Review booking</>}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a free seat on the map to see your total.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      {seat && plan && endDate && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="text-sm">
              <div className="font-semibold">Seat {seat.code} · {formatCurrency(plan.price)}</div>
              <div className="text-xs text-muted-foreground">{formatDate(startDate)} – {formatDate(endDate)}</div>
            </div>
            <Button className="ml-auto" onClick={() => setConfirming(true)}>{approval ? "Review request" : "Review booking"}</Button>
          </div>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(o) => !book.pending && setConfirming(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{approval ? "Send booking request?" : "Confirm your booking"}</DialogTitle>
            <DialogDescription>
              {approval
                ? "The front desk will review your request. Your seat is not reserved until it's approved."
                : "Your seat will be reserved immediately. Payment is collected at the front desk."}
            </DialogDescription>
          </DialogHeader>
          {seat && plan && endDate && (
            <dl className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <Row label="Seat" value={seat.code} />
              <Row label="Plan" value={`${plan.name} · ${plan.durationMonths} mo`} />
              <Row label="Period" value={`${formatDate(startDate)} – ${formatDate(endDate)}`} />
              <Row label="Amount payable" value={<span className="font-semibold">{formatCurrency(plan.price)}</span>} />
            </dl>
          )}
          <p className="text-xs text-muted-foreground">{rules.cancellationPolicy}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={book.pending}>Back</Button>
            <Button
              disabled={book.pending}
              onClick={async () => {
                const res = await book.run();
                setConfirming(false);
                if (res) onBooked(res);
                else setSeatId(null);
              }}
            >
              {book.pending && <Loader2 className="animate-spin" />}
              {approval ? "Send request" : "Confirm booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular">{value}</dd>
    </div>
  );
}

function BookingResult({ outcome }: { outcome: BookingOutcome }) {
  const { views, data, settings } = useTenant();
  if (outcome.kind === "request") {
    const r = outcome.request;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-info-soft text-info"><Clock className="size-6" aria-hidden /></span>
          <h1 className="text-lg font-semibold">Request sent — awaiting approval</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            You requested seat <strong>{views.seatById.get(r.seatId)?.code}</strong> from {formatDate(r.startDate)}. This is not yet a confirmed booking;
            {" "}{settings.general.name} will confirm it shortly.
          </p>
          <Button asChild><Link href="/student/dashboard">Back to home</Link></Button>
        </CardContent>
      </Card>
    );
  }
  const m = views.membershipById.get(outcome.membership.id) ?? outcome.membership;
  const plan = data.plans.find((p) => p.id === m.planId);
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><PartyPopper className="size-6" aria-hidden /></span>
        <h1 className="text-lg font-semibold">Booking confirmed</h1>
        <div className="flex size-20 flex-col items-center justify-center rounded-2xl bg-brand text-brand-foreground">
          <span className="text-[10px] uppercase opacity-80">Seat</span>
          <span className="text-xl font-semibold">{views.seatById.get(m.seatId)?.code}</span>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          {m.code} · {plan?.name ?? m.planName} · {formatDate(m.startDate)} – {formatDate(m.endDate)}
        </p>
        <p className="flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-warning" aria-hidden />
          Payment of {formatCurrency(m.totalAmount)} is due at the front desk.
        </p>
        <p className="text-xs text-muted-foreground">Demo booking — simulated in your browser. No payment has been taken.</p>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/student/membership">View membership</Link></Button>
          <Button asChild><Link href="/student/dashboard">Done</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
