"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, LayoutGrid, List, Minus, Plus, Search, Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { MembershipStatusBadge, SeatStateBadge } from "@/components/app/status-badge";
import { AddSeatsDialog, RemoveSeatsDialog } from "@/components/seats/capacity-dialogs";
import { LayoutDialog } from "@/components/seats/seat-dialogs";
import { SeatDetailSheet } from "@/components/seats/seat-detail-sheet";
import { SeatLegend, SeatMap, needsRenewal } from "@/components/seats/seat-map";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatPercent } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { seatService } from "@/lib/services";
import type { SeatState, SeatView } from "@/lib/types";

type Filter = "all" | SeatState | "expiring";

const columns: ColumnDef<SeatView, unknown>[] = [
  { accessorKey: "number", header: "Seat", cell: ({ row }) => <span className="font-medium tabular">{row.original.code}</span> },
  { accessorKey: "state", header: "Status", cell: ({ row }) => <SeatStateBadge state={row.original.state} /> },
  {
    id: "student",
    header: "Student",
    accessorFn: (s) => (s.current ?? s.upcoming)?.studentName ?? "",
    cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span>,
  },
  {
    id: "start",
    header: "Start",
    accessorFn: (s) => (s.current ?? s.upcoming)?.startDate ?? "",
    cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span>,
  },
  {
    id: "end",
    header: "Expiry",
    accessorFn: (s) => (s.current ?? s.upcoming)?.endDate ?? "",
    cell: ({ row, getValue }) => (
      <span className="flex items-center gap-2 tabular">
        {formatDate(getValue() as string)}
        {needsRenewal(row.original) && <MembershipStatusBadge status="expiring" />}
      </span>
    ),
  },
  { id: "tags", header: "Features", accessorFn: (s) => s.tags.join(", "), enableSorting: false, cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span> },
];

export function SeatsView() {
  const { tenantId, settings, views } = useTenant();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("seat");
  const selected = views.seats.find((s) => s.id === selectedId) ?? null;

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [density, setDensity] = useState<"comfortable" | "compact">(views.seats.length > 60 ? "compact" : "comfortable");
  const [dialog, setDialog] = useState<null | "add" | "remove" | "layout">(null);

  const counts = useMemo(() => {
    const c: Record<SeatState, number> = { available: 0, occupied: 0, reserved: 0, maintenance: 0 };
    views.seats.forEach((s) => c[s.state]++);
    return c;
  }, [views.seats]);
  const expiringCount = views.seats.filter(needsRenewal).length;

  const q = query.trim().toLowerCase();
  const matches = (s: SeatView) => {
    if (filter === "expiring" && !needsRenewal(s)) return false;
    if (filter !== "all" && filter !== "expiring" && s.state !== filter) return false;
    if (!q) return true;
    const m = s.current ?? s.upcoming;
    return s.code.toLowerCase().includes(q) || Boolean(m?.studentName.toLowerCase().includes(q));
  };

  const openSeat = (seat: SeatView | null) => {
    const next = new URLSearchParams(params.toString());
    if (seat) next.set("seat", seat.id);
    else next.delete("seat");
    router.replace(`/admin/seats${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const restore = useAction(async (id: string) => {
    await seatService.restoreSeat(tenantId, id);
    return true;
  }, { success: "Seat restored" });

  const total = views.seats.length;

  return (
    <>
      <PageHeader
        title="Seats"
        description={`${total} seats · ${settings.layout.columns} per row`}
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("layout")}>
              <Settings2 /> Layout
            </Button>
            <Button variant="outline" onClick={() => setDialog("remove")}>
              <Minus /> Reduce
            </Button>
            <Button onClick={() => setDialog("add")}>
              <Plus /> Add seats
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[1.2fr_2fr] md:items-center">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular">{formatPercent(total ? counts.occupied / total : 0)}</span>
            <span className="text-sm text-muted-foreground">occupied right now</span>
          </div>
          <Progress value={total ? (counts.occupied / total) * 100 : 0} className="mt-2 h-1.5" aria-label="Occupancy" />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {[
            ["Capacity", total],
            ["Occupied", counts.occupied],
            ["Available", counts.available],
            ["Reserved", counts.reserved],
            ["Disabled", counts.maintenance],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-semibold tabular">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Tabs defaultValue="map">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <TabsList>
              <TabsTrigger value="map"><LayoutGrid /> Floor plan</TabsTrigger>
              <TabsTrigger value="list"><List /> List</TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find seat or student"
                className="w-full pl-8 sm:w-56"
                aria-label="Find seat or student"
              />
            </div>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(v) => setFilter((v as Filter) || "all")}
            className="flex-wrap"
            aria-label="Filter seats by status"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="available">Available</ToggleGroupItem>
            <ToggleGroupItem value="occupied">Occupied</ToggleGroupItem>
            <ToggleGroupItem value="reserved">Reserved</ToggleGroupItem>
            <ToggleGroupItem value="expiring">Expiring ({expiringCount})</ToggleGroupItem>
            <ToggleGroupItem value="maintenance">Disabled</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <TabsContent value="map" className="space-y-3">
          {total === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={LayoutGrid}
                title="No seats yet"
                description="Add seats to build your floor plan."
                action={<Button onClick={() => setDialog("add")}><Plus /> Add seats</Button>}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SeatLegend counts={counts} />
                <ToggleGroup type="single" size="sm" variant="outline" value={density} onValueChange={(v) => v && setDensity(v as typeof density)} aria-label="Seat size">
                  <ToggleGroupItem value="comfortable">Large</ToggleGroupItem>
                  <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <SeatMap
                seats={views.seats}
                layout={settings.layout}
                selectedId={selectedId}
                onSelect={openSeat}
                isDimmed={(s) => !matches(s)}
                showOccupant
                density={density}
                ariaLabel="Reading room floor plan. Use arrow keys to move between seats."
              />
              <p className="text-xs text-muted-foreground">
                Click a seat to see the member, transfer, renew or disable it. Use arrow keys to move between seats.
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="list">
          <DataTable
            columns={columns}
            data={views.seats.filter(matches)}
            onRowClick={openSeat}
            getRowLabel={(s) => `Open seat ${s.code}`}
            pageSize={20}
            renderCard={(s) => {
              const m = s.current ?? s.upcoming;
              return (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Seat {s.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {m ? `${m.studentName} · until ${formatDate(m.endDate)}` : s.tags.join(", ") || "—"}
                    </div>
                  </div>
                  <SeatStateBadge state={s.state} />
                </div>
              );
            }}
            empty={<EmptyState icon={Search} title="No seats match" description="Try a different filter or search." />}
          />
        </TabsContent>
      </Tabs>

      {views.removedSeats.length > 0 && (
        <details className="mt-8 rounded-xl border bg-card">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
            <Archive className="size-4 text-muted-foreground" aria-hidden /> Removed seats ({views.removedSeats.length})
          </summary>
          <ul className="divide-y border-t">
            {views.removedSeats.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium">{s.code}</span>
                  <span className="ml-2 text-xs text-muted-foreground">Removed {formatDateTime(s.removedAt)}</span>
                </div>
                <Button size="sm" variant="outline" disabled={restore.pending} onClick={() => restore.run(s.id)}>
                  <RotateCcw /> Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <SeatDetailSheet seat={selected} onOpenChange={(o) => !o && openSeat(null)} />
      <AddSeatsDialog open={dialog === "add"} onOpenChange={(o) => setDialog(o ? "add" : null)} />
      <RemoveSeatsDialog open={dialog === "remove"} onOpenChange={(o) => setDialog(o ? "remove" : null)} />
      <LayoutDialog open={dialog === "layout"} onOpenChange={(o) => setDialog(o ? "layout" : null)} />
    </>
  );
}
