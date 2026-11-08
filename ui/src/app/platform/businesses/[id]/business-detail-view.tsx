"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, Mail, MapPin, Pencil, PauseCircle, Phone, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/components/app/brand-mark";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { SubscriptionBadge, TenantStatusBadge } from "@/components/app/status-badge";
import { RevenueChart } from "@/components/charts/charts";
import { BusinessFormDialog, TenantStatusDialog } from "@/components/platform/business-dialogs";
import { WEEKDAYS, formatDate, formatTime } from "@/lib/date";
import { revenueByMonth } from "@/lib/domain/metrics";
import { formatCurrency, formatPercent, formatPhone } from "@/lib/format";
import { useTenantStats } from "@/lib/hooks/use-platform";
import { useDb } from "@/lib/store/db";
import { useSession } from "@/lib/store/session";
import type { TenantStatus } from "@/lib/types";

export function BusinessDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const stats = useTenantStats();
  const row = stats.find((s) => s.tenant.id === id);
  const data = useDb((s) => s.tenants[id]);
  const signIn = useSession((s) => s.signIn);
  const [editing, setEditing] = useState(false);
  const [statusTarget, setStatusTarget] = useState<TenantStatus | null>(null);
  

  if (!row || !data) {
    return <EmptyState title="Business not found" action={<Button asChild variant="outline"><Link href="/platform/businesses">Back</Link></Button>} />;
  }
  const { tenant, metrics, tier } = row;
  const revenue = row.views ? revenueByMonth(row.views, 6) : [];
  const s = data.settings;

  return (
    <>
      <Link href="/platform/businesses" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Businesses
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <BrandMark name={tenant.name} color={s.general.brandColor} logo={s.general.logoDataUrl} size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{tenant.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {tenant.city}, {tenant.state} · since {formatDate(tenant.createdAt.slice(0, 10))}
              <TenantStatusBadge status={tenant.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
          {tenant.status === "active" ? (
            <>
              <Button variant="outline" onClick={() => setStatusTarget("inactive")}><PauseCircle /> Deactivate</Button>
              <Button variant="destructive" onClick={() => setStatusTarget("suspended")}><Ban /> Suspend</Button>
            </>
          ) : (
            <Button onClick={() => setStatusTarget("active")}><PlayCircle /> Activate</Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              signIn({ role: "owner", tenantId: tenant.id });
              router.push("/admin/dashboard");
            }}
          >
            <ExternalLink /> Open workspace
          </Button>
        </div>
      </div>

      {tenant.status !== "active" && tenant.statusReason && (
        <div className="mb-5 rounded-lg border border-destructive/20 bg-danger-soft px-4 py-3 text-sm">
          <span className="font-medium capitalize">{tenant.status}:</span> {tenant.statusReason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Seats" value={metrics?.totalSeats ?? 0} hint={`${metrics?.available ?? 0} available`} />
        <StatCard label="Occupancy" value={formatPercent(metrics?.occupancyRate ?? 0)} hint={`${metrics?.occupied ?? 0} occupied`} tone="brand" />
        <StatCard label="Active students" value={metrics?.activeStudents ?? 0} hint={`${row.studentCount} registered`} />
        <StatCard label="Collected this month" value={formatCurrency(metrics?.monthRevenue ?? 0)} hint={`${formatCurrency(metrics?.pendingAmount ?? 0)} outstanding`} tone="success" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Collections</CardTitle>
            <CardDescription>Fees recorded by this business, last 6 months</CardDescription>
          </CardHeader>
          <CardContent><RevenueChart data={revenue} /></CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-sm">Owner</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium">{tenant.ownerName}</div>
              <a href={`tel:+91${tenant.ownerPhone}`} className="flex items-center gap-2 hover:underline"><Phone className="size-4 text-muted-foreground" aria-hidden /> {formatPhone(tenant.ownerPhone)}</a>
              <a href={`mailto:${tenant.ownerEmail}`} className="flex items-center gap-2 break-all hover:underline"><Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden /> {tenant.ownerEmail}</a>
              {s.general.address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {s.general.address}, {s.general.city}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Subscription</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Tier</dt><dd className="font-medium">{tier?.name ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5"><SubscriptionBadge status={tenant.subscription.status} /></dd></div>
                <div><dt className="text-xs text-muted-foreground">Fee</dt><dd className="font-medium tabular">{tier ? `${formatCurrency(tier.monthlyFee)}/mo` : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{tenant.subscription.status === "trial" ? "Trial ends" : "Renews on"}</dt><dd className="font-medium tabular">{formatDate(tenant.subscription.renewsOn)}</dd></div>
              </dl>
              {tier?.seatLimit && (metrics?.totalSeats ?? 0) > tier.seatLimit && (
                <p className="mt-3 text-xs text-destructive">Uses {metrics?.totalSeats} seats — above the {tier.name} limit of {tier.seatLimit}.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Platform billing is not automated in this version.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Hours</dt><dd className="font-medium">{formatTime(s.hours.openTime)} – {formatTime(s.hours.closeTime)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Days</dt><dd className="font-medium">{s.hours.workingDays.length === 7 ? "All week" : s.hours.workingDays.map((d) => WEEKDAYS[d]).join(", ")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Active plans</dt><dd className="font-medium">{data.plans.filter((p) => p.isActive).length}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Booking</dt><dd className="font-medium">{s.rules.bookingMode === "instant" ? "Instant" : "Approval"}</dd></div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <BusinessFormDialog tenant={tenant} open={editing} onOpenChange={setEditing} />
      <TenantStatusDialog tenant={tenant} target={statusTarget} onClose={() => setStatusTarget(null)} />
    </>
  );
}
