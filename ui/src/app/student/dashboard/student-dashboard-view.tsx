"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarClock, Clock, LayoutGrid, MapPin, Phone, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingRequestBadge, MembershipStatusBadge, PaymentStatusBadge } from "@/components/app/status-badge";
import { StudentRenewDialog } from "@/components/student/student-renew-dialog";
import { useCurrentStudent } from "@/components/student/use-current-student";
import { WEEKDAYS, daysBetween, formatDate, formatTime } from "@/lib/date";
import { formatCurrency, formatPhone } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";

export function StudentDashboardView() {
  const { settings, views } = useTenant();
  const { student, memberships, pendingRequest } = useCurrentStudent();
  const [renewOpen, setRenewOpen] = useState(false);
  const m = student.current ?? student.upcoming;
  const window = settings.rules.renewalWindowDays;
  // Only nudge renewal inside the renewal window, or after expiry.
  const renewable =
    student.current && !student.upcoming && student.current.daysRemaining <= window
      ? student.current
      : !m && student.latest?.status === "expired"
        ? student.latest
        : null;
  const balance = student.balance;
  const first = student.name.split(" ")[0];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-brand/8 px-5 pt-6 pb-5 sm:px-6">
          <p className="text-sm text-muted-foreground">{settings.general.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hi {first} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {m
              ? m.status === "upcoming"
                ? `Your seat is reserved from ${formatDate(m.startDate)}.`
                : "Your seat is ready. Have a focused day."
              : "You don't have a seat right now. Book one in under a minute."}
          </p>
        </div>

        {m ? (
          <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
            <div className="flex size-24 flex-col items-center justify-center rounded-2xl bg-brand text-brand-foreground">
              <span className="text-[10px] tracking-wider uppercase opacity-80">Seat</span>
              <span className="text-2xl font-semibold tabular">{m.seatCode}</span>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.planName}</span>
                <MembershipStatusBadge status={m.status} />
                <PaymentStatusBadge status={m.paymentStatus} />
              </div>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{m.status === "upcoming" ? "Starts" : "Started"}</dt>
                  <dd className="font-medium tabular">{formatDate(m.startDate, "d MMM")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valid until</dt>
                  <dd className="font-medium tabular">{formatDate(student.coveredUntil ?? m.endDate, "d MMM yyyy")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Days left</dt>
                  <dd className="text-lg leading-tight font-semibold tabular">
                    {Math.max(0, daysBetween(views.today, student.coveredUntil ?? m.endDate) + 1)}
                  </dd>
                </div>
              </dl>
              {student.current && student.upcoming && (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden /> Renewed — next period starts {formatDate(student.upcoming.startDate)}.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <Button asChild size="lg" className="h-11 w-full sm:w-auto">
              <Link href="/student/book-seat"><LayoutGrid /> Book a seat</Link>
            </Button>
          </div>
        )}
      </section>

      {balance > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-danger-soft p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Outstanding payment: {formatCurrency(balance)}</p>
            <p className="text-muted-foreground">Please pay at the front desk (cash, UPI or bank transfer). Online payment is not available yet.</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/student/payments">Details</Link>
          </Button>
        </div>
      )}

      {renewable && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-warning-soft text-warning">
            <RefreshCw className="size-4" aria-hidden />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-medium">
              {renewable.status === "expired" ? `Your membership ended on ${formatDate(renewable.endDate)}` : `Keep seat ${renewable.seatCode} after ${formatDate(renewable.endDate)}`}
            </p>
            <p className="text-muted-foreground">Renew now to hold the same seat.</p>
          </div>
          <Button onClick={() => setRenewOpen(true)}>Renew membership</Button>
        </div>
      )}

      {pendingRequest && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
          <CalendarClock className="size-5 text-info" aria-hidden />
          <div className="flex-1 text-sm">
            <p className="font-medium">Booking request for seat {views.seatById.get(pendingRequest.seatId)?.code}</p>
            <p className="text-muted-foreground">Sent {formatDate(pendingRequest.createdAt.slice(0, 10))}. The front desk will confirm shortly.</p>
          </div>
          <BookingRequestBadge status="pending" />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Reading room</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                {formatTime(settings.hours.openTime)} – {formatTime(settings.hours.closeTime)}
                <span className="block text-xs text-muted-foreground">
                  {settings.hours.workingDays.length === 7 ? "Open all days" : `Open ${settings.hours.workingDays.map((d) => WEEKDAYS[d]).join(", ")}`}
                </span>
              </span>
            </p>
            {settings.general.address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {[settings.general.address, settings.general.city, settings.general.pincode].filter(Boolean).join(", ")}
              </p>
            )}
            {settings.general.phone && (
              <a href={`tel:+91${settings.general.phone}`} className="flex items-center gap-2 hover:underline">
                <Phone className="size-4 text-muted-foreground" aria-hidden /> {formatPhone(settings.general.phone)}
              </a>
            )}
            {settings.general.description && <p className="text-muted-foreground">{settings.general.description}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Facilities</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {settings.facilities.filter((f) => f.enabled).map((f) => (
                <li key={f.key} className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-brand" aria-hidden /> {f.label}
                </li>
              ))}
            </ul>
            {(() => {
              const next = settings.hours.holidays.filter((h) => h.date >= views.today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
              return next ? (
                <p className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Next holiday: <span className="font-medium text-foreground">{next.label}</span> on {formatDate(next.date, "EEE, d MMM")}
                </p>
              ) : null;
            })()}
          </CardContent>
        </Card>
      </div>

      {memberships.length > 0 && (
        <Link href="/student/membership" className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm hover:bg-muted/30">
          <span>View membership history ({memberships.length})</span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <StudentRenewDialog membership={renewable} open={renewOpen} onOpenChange={setRenewOpen} />
    </div>
  );
}
