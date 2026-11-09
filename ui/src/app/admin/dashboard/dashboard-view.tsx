"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Armchair,
  CalendarClock,
  CalendarPlus,
  CircleDollarSign,
  Hourglass,
  IndianRupee,
  LayoutGrid,
  Plus,
  Receipt,
  UserPlus,
  Users,
  CheckCircle2,
  Wrench,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonAvatar } from "@/components/app/brand-mark";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { MembershipStatusBadge, PaymentRecordBadge } from "@/components/app/status-badge";
import { LabeledBars, RevenueChart } from "@/components/charts/charts";
import { MembershipFormDialog } from "@/components/memberships/membership-form-dialog";
import { RenewDialog } from "@/components/memberships/renew-dialog";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { AddSeatsDialog } from "@/components/seats/capacity-dialogs";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { formatDate, relativeDays } from "@/lib/date";
import { dashboardMetrics, expiringWithin, expiryBuckets, revenueByMonth } from "@/lib/domain/metrics";
import { PAYMENT_METHOD_LABEL, formatCurrency, formatPercent } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import type { MembershipView } from "@/lib/types";
import { useRouter } from "next/navigation";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { tenant, views, data, today } = useTenant();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "student" | "seats" | "membership" | "payment">(null);
  const [renewing, setRenewing] = useState<MembershipView | null>(null);

  const m = useMemo(() => dashboardMetrics(views), [views]);
  const revenue = useMemo(() => revenueByMonth(views, 6), [views]);
  const buckets = useMemo(() => expiryBuckets(views), [views]);
  const expiring = useMemo(() => expiringWithin(views, 7).slice(0, 5), [views]);
  const recentStudents = useMemo(
    () => [...views.students].sort((a, b) => (a.joinedOn < b.joinedOn ? 1 : -1)).slice(0, 5),
    [views.students],
  );
  const recentPayments = views.payments.slice(0, 6);
  const pendingRequests = data.bookingRequests.filter((r) => r.status === "pending");
  const revenueDelta = m.lastMonthRevenue ? (m.monthRevenue - m.lastMonthRevenue) / m.lastMonthRevenue : 0;

  return (
    <>
      <PageHeader
        eyebrow={formatDate(today, "EEEE, d MMMM yyyy")}
        title={`${greeting()}, ${tenant.ownerName.split(" ")[0]}`}
        description="Here's how your reading room is doing today."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("payment")}>
              <Receipt /> Record payment
            </Button>
            <Button onClick={() => setDialog("membership")}>
              <CalendarPlus /> New membership
            </Button>
          </>
        }
      />

      {pendingRequests.length > 0 && (
        <Link
          href="/admin/memberships?tab=requests"
          className="mb-5 flex items-center gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3 text-sm transition-colors hover:border-info/50"
        >
          <Inbox className="size-4 text-info" aria-hidden />
          <span>
            <strong>{pendingRequests.length}</strong> seat booking {pendingRequests.length === 1 ? "request is" : "requests are"} waiting for your approval.
          </span>
          <ArrowRight className="ml-auto size-4 text-info" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total seats" value={m.totalSeats} icon={Armchair} hint={`${m.maintenance} under maintenance`} href="/admin/seats" />
        <StatCard
          label="Occupied"
          value={m.occupied}
          icon={Users}
          tone="brand"
          hint={`${formatPercent(m.occupancyRate)} occupancy`}
          href="/admin/seats"
        />
        <StatCard label="Available" value={m.available} icon={CheckCircle2} tone="success" hint="Ready to book today" href="/admin/seats" />
        <StatCard label="Reserved / upcoming" value={m.reserved} icon={CalendarClock} tone="info" hint="Starting soon" href="/admin/memberships?status=upcoming" />
        <StatCard label="Active students" value={m.activeStudents} icon={Users} hint="With a current or upcoming seat" href="/admin/students" />
        <StatCard
          label="Expiring soon"
          value={m.expiringSoon}
          icon={Hourglass}
          tone="warning"
          hint={`Within ${data.settings.rules.expiringSoonDays} days`}
          href="/admin/memberships/expiring"
        />
        <StatCard
          label="Pending payments"
          value={formatCurrency(m.pendingAmount)}
          icon={CircleDollarSign}
          tone="danger"
          hint={`${m.pendingCount} memberships with dues`}
          href="/admin/payments?tab=dues"
        />
        <StatCard
          label="Collected this month"
          value={formatCurrency(m.monthRevenue)}
          icon={IndianRupee}
          tone="success"
          hint={
            m.lastMonthRevenue
              ? `${revenueDelta >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(revenueDelta))} vs last month`
              : "No collections last month"
          }
          href="/admin/payments"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy overview</CardTitle>
            <CardDescription>Live state of all {m.totalSeats} seats</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/seats">
                  Seat layout <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular">{formatPercent(m.occupancyRate)}</span>
              <span className="text-sm text-muted-foreground">
                {m.occupied} of {m.totalSeats} seats occupied
              </span>
            </div>
            <OccupancyBar
              segments={[
                { key: "occupied", label: "Occupied", value: m.occupied, className: "bg-primary", icon: Users },
                { key: "reserved", label: "Reserved", value: m.reserved, className: "bg-warning", icon: CalendarClock },
                { key: "available", label: "Available", value: m.available, className: "bg-success", icon: CheckCircle2 },
                { key: "maintenance", label: "Maintenance", value: m.maintenance, className: "bg-muted-foreground/40", icon: Wrench },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly collections</CardTitle>
            <CardDescription>Payments received, last 6 months</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/reports">
                  Reports <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenue} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Memberships expiring this week</CardTitle>
            <CardDescription>Follow up before seats are released</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/memberships/expiring">
                  View all <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {expiring.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing expiring this week" description="All current members are covered for at least 7 days." />
            ) : (
              <ul className="divide-y">
                {expiring.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2.5">
                    <PersonAvatar name={x.studentName} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/students/${x.studentId}`} className="block truncate text-sm font-medium hover:underline">
                        {x.studentName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Seat {x.seatCode} · {x.planName} · ends {formatDate(x.endDate)} ({relativeDays(x.daysRemaining)})
                      </div>
                    </div>
                    {x.balance > 0 && <span className="hidden text-xs text-destructive sm:inline tabular">{formatCurrency(x.balance)} due</span>}
                    <Button size="sm" variant="outline" onClick={() => setRenewing(x)}>
                      Renew
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiry outlook</CardTitle>
            <CardDescription>Memberships not yet renewed</CardDescription>
          </CardHeader>
          <CardContent>
            <LabeledBars data={buckets.map((b) => ({ label: b.label, value: b.count }))} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: "Add student", icon: UserPlus, onClick: () => setDialog("student") },
              { label: "Add seat", icon: Plus, onClick: () => setDialog("seats") },
              { label: "Create membership", icon: CalendarPlus, onClick: () => setDialog("membership") },
              { label: "Record payment", icon: Receipt, onClick: () => setDialog("payment") },
              { label: "View seat layout", icon: LayoutGrid, onClick: () => router.push("/admin/seats") },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors outline-none last:col-span-2 hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <a.icon className="size-4 text-brand" aria-hidden />
                {a.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent registrations</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/students">All <ArrowRight data-icon="inline-end" /></Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recentStudents.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/30">
                    <PersonAvatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">Joined {formatDate(s.joinedOn)}</div>
                    </div>
                    <MembershipStatusBadge status={s.membershipStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/payments">All <ArrowRight data-icon="inline-end" /></Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <EmptyState icon={Receipt} title="No payments yet" />
            ) : (
              <ul className="divide-y">
                {recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{views.studentById.get(p.studentId)?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.paidOn)} · {PAYMENT_METHOD_LABEL[p.method]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium tabular">{formatCurrency(p.amount)}</div>
                      {p.status !== "completed" && <PaymentRecordBadge status={p.status} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <StudentFormDialog
        open={dialog === "student"}
        onOpenChange={(o) => setDialog(o ? "student" : null)}
        onSaved={(s) => router.push(`/admin/students/${s.id}`)}
      />
      <AddSeatsDialog open={dialog === "seats"} onOpenChange={(o) => setDialog(o ? "seats" : null)} />
      <MembershipFormDialog open={dialog === "membership"} onOpenChange={(o) => setDialog(o ? "membership" : null)} />
      <RecordPaymentDialog open={dialog === "payment"} onOpenChange={(o) => setDialog(o ? "payment" : null)} />
      <RenewDialog membership={renewing} open={Boolean(renewing)} onOpenChange={(o) => !o && setRenewing(null)} />
    </>
  );
}

function OccupancyBar({
  segments,
}: {
  segments: { key: string; label: string; value: number; className: string; icon: typeof Users }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.key} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 rounded-sm ${s.className}`} aria-hidden />
            <s.icon className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
