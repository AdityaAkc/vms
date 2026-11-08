"use client";

import { useMemo } from "react";
import { Download, IndianRupee, Percent, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { LabeledBars, OccupancyTrendChart, RevenueChart } from "@/components/charts/charts";
import { downloadCsv } from "@/lib/csv";
import { addDays, formatMonthKey } from "@/lib/date";
import { collectionsByMethod, newStudentsThisMonth, occupancyByMonth, planMix, revenueByMonth } from "@/lib/domain/metrics";
import { PAYMENT_METHOD_LABEL, formatCurrency, formatPercent } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import type { PaymentMethod } from "@/lib/types";

export function ReportsView() {
  const { views, settings, today } = useTenant();
  const revenue = useMemo(() => revenueByMonth(views, 12), [views]);
  const occupancy = useMemo(() => occupancyByMonth(views, 6), [views]);
  const methods = useMemo(() => collectionsByMethod(views, 180), [views]);
  const plans = useMemo(() => planMix(views), [views]);

  const renewal = useMemo(() => {
    const since = addDays(today, -90);
    const ended = views.memberships.filter((m) => !m.cancelledAt && m.endDate >= since && m.endDate < today);
    const renewed = ended.filter((m) =>
      views.memberships.some((x) => x.studentId === m.studentId && !x.cancelledAt && x.startDate > m.endDate),
    );
    return { ended: ended.length, renewed: renewed.length, rate: ended.length ? renewed.length / ended.length : 0 };
  }, [views, today]);

  const last6 = revenue.slice(-6);
  const avgRevenue = last6.reduce((s, r) => s + r.revenue, 0) / Math.max(1, last6.length);
  const avgOccupancy = occupancy.reduce((s, o) => s + o.rate, 0) / Math.max(1, occupancy.length);
  const methodTotal = Object.values(methods).reduce((s, v) => s + v, 0);

  const exportCsv = () =>
    downloadCsv(
      `${settings.general.name} monthly report.csv`,
      ["Month", "Collections (INR)", "Occupancy %", "Seats held"],
      revenue.map((r) => {
        const o = occupancy.find((x) => x.month === r.month);
        return [formatMonthKey(r.month, "MMMM yyyy"), r.revenue, o ? Math.round(o.rate * 100) : "", o?.occupied ?? ""];
      }),
    );

  return (
    <>
      <PageHeader
        title="Reports"
        description="Performance of your reading room over time."
        actions={<Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avg. monthly collections" value={formatCurrency(avgRevenue)} hint="Last 6 months" icon={IndianRupee} tone="success" />
        <StatCard label="Avg. occupancy" value={formatPercent(avgOccupancy)} hint="Last 6 months" icon={Percent} tone="brand" />
        <StatCard label="Renewal rate" value={formatPercent(renewal.rate)} hint={`${renewal.renewed} of ${renewal.ended} ended in 90 days`} icon={RefreshCw} tone="info" />
        <StatCard label="New students" value={newStudentsThisMonth(views)} hint="Registered this month" icon={UserPlus} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Collections</CardTitle>
            <CardDescription>Payments received per month, last 12 months</CardDescription>
          </CardHeader>
          <CardContent><RevenueChart data={revenue} height={240} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Occupancy trend</CardTitle>
            <CardDescription>Share of current seats held mid-month (today for this month)</CardDescription>
          </CardHeader>
          <CardContent><OccupancyTrendChart data={occupancy} height={240} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Collections by payment method</CardTitle>
            <CardDescription>Last 6 months · {formatCurrency(methodTotal)} total</CardDescription>
          </CardHeader>
          <CardContent>
            <LabeledBars
              colorByIndex
              format={formatCurrency}
              data={(Object.keys(methods) as PaymentMethod[]).map((k) => ({
                label: PAYMENT_METHOD_LABEL[k],
                value: methods[k],
                hint: methodTotal ? `· ${formatPercent(methods[k] / methodTotal)}` : undefined,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plan mix</CardTitle>
            <CardDescription>Memberships active in the last 6 months, by plan</CardDescription>
          </CardHeader>
          <CardContent>
            {plans.length ? (
              <LabeledBars data={plans.map((p) => ({ label: p.name, value: p.count }))} />
            ) : (
              <p className="text-sm text-muted-foreground">No memberships yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
