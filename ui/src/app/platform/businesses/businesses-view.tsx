"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandMark } from "@/components/app/brand-mark";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { SubscriptionBadge, TenantStatusBadge } from "@/components/app/status-badge";
import { BusinessFormDialog } from "@/components/platform/business-dialogs";
import { formatDate } from "@/lib/date";
import { formatPercent, formatPhone } from "@/lib/format";
import { useTenantStats } from "@/lib/hooks/use-platform";
import type { TenantStatus } from "@/lib/types";

type Row = ReturnType<typeof useTenantStats>[number];

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "name",
    header: "Business",
    accessorFn: (r) => r.tenant.name,
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <BrandMark name={row.original.tenant.name} color={row.original.brandColor} logo={row.original.logo} />
        <div>
          <div className="font-medium">{row.original.tenant.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.tenant.city}, {row.original.tenant.state}</div>
        </div>
      </div>
    ),
  },
  {
    id: "owner",
    header: "Owner",
    accessorFn: (r) => r.tenant.ownerName,
    cell: ({ row }) => (
      <div>
        <div>{row.original.tenant.ownerName}</div>
        <div className="text-xs text-muted-foreground">{formatPhone(row.original.tenant.ownerPhone)}</div>
      </div>
    ),
  },
  { id: "seats", header: "Seats", accessorFn: (r) => r.metrics?.totalSeats ?? 0, cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
  { id: "students", header: "Active students", accessorFn: (r) => r.metrics?.activeStudents ?? 0, cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
  { id: "occupancy", header: "Occupancy", accessorFn: (r) => r.metrics?.occupancyRate ?? 0, cell: ({ getValue }) => <span className="tabular">{formatPercent(getValue() as number)}</span> },
  {
    id: "plan",
    header: "Subscription",
    accessorFn: (r) => r.tier?.name ?? "",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.tier?.name}</span>
        <SubscriptionBadge status={row.original.tenant.subscription.status} />
      </div>
    ),
  },
  { id: "status", header: "Status", accessorFn: (r) => r.tenant.status, cell: ({ row }) => <TenantStatusBadge status={row.original.tenant.status} /> },
  { id: "created", header: "Registered", accessorFn: (r) => r.tenant.createdAt, cell: ({ getValue }) => <span className="tabular">{formatDate((getValue() as string).slice(0, 10))}</span> },
];

export function BusinessesView() {
  const stats = useTenantStats();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TenantStatus>("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stats.filter(
      (r) =>
        (status === "all" || r.tenant.status === status) &&
        (!q || r.tenant.name.toLowerCase().includes(q) || r.tenant.ownerName.toLowerCase().includes(q) || r.tenant.city.toLowerCase().includes(q)),
    );
  }, [stats, query, status]);

  return (
    <>
      <PageHeader
        title="Businesses"
        description="Reading room businesses on the platform. Each has an isolated workspace and data."
        actions={<Button onClick={() => setAdding(true)}><Plus /> Add business</Button>}
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Business, owner or city" className="pl-8" aria-label="Search businesses" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/platform/businesses/${r.tenant.id}`)}
        getRowLabel={(r) => `Open ${r.tenant.name}`}
        renderCard={(r) => (
          <div className="flex items-start gap-3">
            <BrandMark name={r.tenant.name} color={r.brandColor} logo={r.logo} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{r.tenant.name}</span>
                <TenantStatusBadge status={r.tenant.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {r.tenant.city} · {r.tenant.ownerName} · {r.metrics?.totalSeats ?? 0} seats · {r.metrics?.activeStudents ?? 0} students
              </div>
            </div>
          </div>
        )}
        empty={<EmptyState icon={Building2} title="No businesses match" />}
      />
      <BusinessFormDialog open={adding} onOpenChange={setAdding} onSaved={(t) => router.push(`/platform/businesses/${t.id}`)} />
    </>
  );
}
