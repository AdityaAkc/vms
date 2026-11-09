"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarRange, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/app/empty-state";
import { MembershipStatusBadge, PaymentStatusBadge, StatusPill } from "@/components/app/status-badge";
import { StudentRenewDialog } from "@/components/student/student-renew-dialog";
import { useCurrentStudent } from "@/components/student/use-current-student";
import { daysBetween, formatDate } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";

export function StudentMembershipView() {
  const { settings } = useTenant();
  const { student, memberships } = useCurrentStudent();
  const [renewOpen, setRenewOpen] = useState(false);
  const m = student.current ?? student.upcoming;
  const renewable = student.current && !student.upcoming ? student.current : !m && student.latest?.status === "expired" ? student.latest : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">My membership</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your seat, validity and renewal history.</p>
        </div>
        {renewable && <Button onClick={() => setRenewOpen(true)}><RefreshCw /> Renew</Button>}
      </div>

      {m ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">Seat {m.seatCode}</span>
              <MembershipStatusBadge status={m.status} />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="font-medium">{m.planName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Start date</dt><dd className="font-medium tabular">{formatDate(m.startDate)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expiry date</dt><dd className="font-medium tabular">{formatDate(m.endDate)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Payment</dt><dd className="mt-0.5"><PaymentStatusBadge status={m.paymentStatus} /></dd></div>
            </dl>
            {m.status !== "upcoming" && (
              <div>
                <Progress
                  value={(1 - m.daysRemaining / (daysBetween(m.startDate, m.endDate) + 1)) * 100}
                  className="h-2"
                  aria-label="Membership period elapsed"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{Math.max(0, m.daysRemaining + 1)} days remaining in this period</p>
              </div>
            )}
            {m.balance > 0 && (
              <p className="text-sm text-destructive">{formatCurrency(m.balance)} outstanding — pay at the front desk.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="No active membership"
            description="Book a seat to start a membership."
            action={<Button asChild><Link href="/student/book-seat">Book a seat</Link></Button>}
          />
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">History</CardTitle></CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memberships yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l pl-5">
              {memberships.map((x) => (
                <li key={x.id}>
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background bg-brand" aria-hidden />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{x.planName}</span>
                    <MembershipStatusBadge status={x.status} />
                    {x.renewalOf && <StatusPill tone="neutral" icon={RefreshCw}>Renewal</StatusPill>}
                  </div>
                  <div className="text-xs text-muted-foreground tabular">
                    Seat {x.seatCode} · {formatDate(x.startDate)} – {formatDate(x.endDate)} · {formatCurrency(x.totalAmount)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Policies</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Renewal: </span>{settings.rules.renewalPolicy}</p>
          <p><span className="font-medium text-foreground">Cancellation: </span>{settings.rules.cancellationPolicy}</p>
          <p>
            <span className="font-medium text-foreground">Seat change: </span>
            {settings.rules.allowStudentSeatChange ? settings.rules.seatChangePolicy : "Seat changes are not available for self-service. Please speak to the front desk."}
          </p>
        </CardContent>
      </Card>

      <StudentRenewDialog membership={renewable} open={renewOpen} onOpenChange={setRenewOpen} />
    </div>
  );
}
