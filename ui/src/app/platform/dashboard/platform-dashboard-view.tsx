"use client";

import Link from "next/link";
import { ArrowRight, Armchair, Building2, IndianRupee, PauseCircle, Users, Ban, CheckCircle2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/components/app/brand-mark";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SubscriptionBadge, TenantStatusBadge } from "@/components/app/status-badge";
import { LabeledBars } from "@/components/charts/charts";
import { daysBetween, formatDate, todayIn } from "@/lib/date";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { useProductName, useTenantStats } from "@/lib/hooks/use-platform";

export function PlatformDashboardView() {
  const stats = useTenantStats();
  const productName = useProductName();
  const today = todayIn();
  const count = (s: string) => stats.filter((x) => x.tenant.status === s).length;
  const seats = stats.reduce((s, x) => s + (x.metrics?.totalSeats ?? 0), 0);
  const students = stats.reduce((s, x) => s + (x.metrics?.activeStudents ?? 0), 0);
  const mrr = stats
    .filter((x) => x.tenant.status === "active" && x.tenant.subscription.status === "active")
    .reduce((s, x) => s + (x.tier?.monthlyFee ?? 0), 0);
  const gmv = stats.reduce((s, x) => s + (x.metrics?.monthRevenue ?? 0), 0);
  const trials = stats.filter((x) => x.tenant.subscription.status === "trial");
  const attention = stats.filter((x) => x.tenant.status !== "active" || x.tenant.subscription.status === "past_due");

  return (
    <>
      <PageHeader title="Platform overview" description={`Every reading room business running on ${productName}.`} actions={<Button asChild><Link href="/platform/businesses">Manage businesses</Link></Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Businesses" value={stats.length} icon={Building2} hint={`${count("active")} active`} href="/platform/businesses" />
        <StatCard label="Active" value={count("active")} icon={CheckCircle2} tone="success" />
        <StatCard label="Inactive" value={count("inactive")} icon={PauseCircle} />
        <StatCard label="Suspended" value={count("suspended")} icon={Ban} tone="danger" />
        <StatCard label="Active students" value={formatNumber(students)} icon={Users} tone="brand" hint="Across all businesses" />
        <StatCard label="Total seats" value={formatNumber(seats)} icon={Armchair} />
        <StatCard label="Subscription MRR" value={formatCurrency(mrr)} icon={IndianRupee} tone="success" hint="Paying, active businesses" />
        <StatCard label="Fees recorded this month" value={formatCurrency(gmv)} icon={Wallet} tone="info" hint="Collected by businesses (demo)" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Businesses</CardTitle>
            <CardDescription>Occupancy and this month&apos;s collections</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild><Link href="/platform/businesses">All <ArrowRight data-icon="inline-end" /></Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {stats.map(({ tenant, metrics, brandColor, logo }) => (
                <li key={tenant.id}>
                  <Link href={`/platform/businesses/${tenant.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/30">
                    <BrandMark name={tenant.name} color={brandColor} logo={logo} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{tenant.name}</div>
                      <div className="text-xs text-muted-foreground">{tenant.city} · {metrics?.totalSeats ?? 0} seats · {formatPercent(metrics?.occupancyRate ?? 0)} occupied</div>
                    </div>
                    <div className="hidden text-right text-sm tabular sm:block">{formatCurrency(metrics?.monthRevenue ?? 0)}</div>
                    <TenantStatusBadge status={tenant.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Active students by business</CardTitle>
            </CardHeader>
            <CardContent>
              <LabeledBars data={stats.map((s) => ({ label: s.tenant.name, value: s.metrics?.activeStudents ?? 0 }))} format={formatNumber} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {attention.length === 0 && trials.length === 0 && <p className="text-muted-foreground">All businesses are in good standing.</p>}
              {attention.map(({ tenant }) => (
                <Link key={tenant.id} href={`/platform/businesses/${tenant.id}`} className="flex items-start justify-between gap-2 hover:underline">
                  <span>
                    <span className="font-medium">{tenant.name}</span>
                    <span className="block text-xs text-muted-foreground">{tenant.statusReason ?? "Subscription past due"}</span>
                  </span>
                  <TenantStatusBadge status={tenant.status} />
                </Link>
              ))}
              {trials.map(({ tenant }) => (
                <Link key={tenant.id} href={`/platform/businesses/${tenant.id}`} className="flex items-start justify-between gap-2 hover:underline">
                  <span>
                    <span className="font-medium">{tenant.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Trial ends {formatDate(tenant.subscription.renewsOn)} ({daysBetween(today, tenant.subscription.renewsOn)} days)
                    </span>
                  </span>
                  <SubscriptionBadge status="trial" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
