"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarPlus, Check, Hourglass, Inbox, Search, X, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonAvatar } from "@/components/app/brand-mark";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { BookingRequestBadge, MEMBERSHIP_STATUS_META, MembershipStatusBadge, PaymentStatusBadge } from "@/components/app/status-badge";
import { MembershipActions } from "@/components/memberships/membership-actions";
import { MembershipFormDialog } from "@/components/memberships/membership-form-dialog";
import { formatDate, formatDateTime, membershipEndDate } from "@/lib/date";
import { isSeatAvailableFor } from "@/lib/domain/availability";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { bookingService } from "@/lib/services";
import type { BookingRequest, MembershipStatus, MembershipView } from "@/lib/types";

const columns: ColumnDef<MembershipView, unknown>[] = [
  {
    accessorKey: "studentName",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={row.original.studentName} className="size-7" />
        <div>
          <div className="font-medium">{row.original.studentName}</div>
          <div className="text-xs text-muted-foreground">{row.original.code}</div>
        </div>
      </div>
    ),
  },
  { accessorKey: "seatCode", header: "Seat" },
  { accessorKey: "planName", header: "Plan" },
  { accessorKey: "startDate", header: "Start", cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
  { accessorKey: "endDate", header: "Expiry", cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
  { accessorKey: "totalAmount", header: "Total", cell: ({ getValue }) => <span className="tabular">{formatCurrency(getValue() as number)}</span> },
  { accessorKey: "amountPaid", header: "Paid", cell: ({ getValue }) => <span className="tabular">{formatCurrency(getValue() as number)}</span> },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className={row.original.balance > 0 ? "text-destructive tabular" : "text-muted-foreground tabular"}>
          {formatCurrency(row.original.balance)}
        </span>
        <PaymentStatusBadge status={row.original.paymentStatus} />
      </div>
    ),
  },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <MembershipStatusBadge status={row.original.status} /> },
  { id: "actions", header: "", enableSorting: false, cell: ({ row }) => <MembershipActions membership={row.original} /> },
];

type StatusFilter = "all" | MembershipStatus;

export function MembershipsView() {
  const { views, data } = useTenant();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "requests" ? "requests" : "all");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) || "all");
  const [planName, setPlanName] = useState("all");
  const [payment, setPayment] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const planNames = useMemo(() => [...new Set(views.memberships.map((m) => m.planName))].sort(), [views.memberships]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.memberships.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (planName !== "all" && m.planName !== planName) return false;
      if (payment !== "all" && m.paymentStatus !== payment) return false;
      if (!q) return true;
      return m.studentName.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || m.seatCode.toLowerCase() === q;
    });
  }, [views.memberships, status, planName, payment, query]);

  const counts = useMemo(() => {
    const c: Record<MembershipStatus, number> = { active: 0, expiring: 0, upcoming: 0, expired: 0, cancelled: 0 };
    views.memberships.forEach((m) => c[m.status]++);
    return c;
  }, [views.memberships]);
  const pending = data.bookingRequests.filter((r) => r.status === "pending");

  return (
    <>
      <PageHeader
        title="Memberships"
        description="Monthly seat reservations, renewals and their payment status."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/memberships/expiring"><Hourglass /> Expiring</Link>
            </Button>
            <Button onClick={() => setCreating(true)}><CalendarPlus /> New membership</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["active", "expiring", "upcoming", "expired", "cancelled"] as MembershipStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTab("all");
              setStatus(status === s ? "all" : s);
            }}
            aria-pressed={status === s}
            className="text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
          >
            <StatCard
              label={MEMBERSHIP_STATUS_META[s].label}
              value={counts[s]}
              icon={MEMBERSHIP_STATUS_META[s].icon}
              tone={s === "active" ? "success" : s === "expiring" ? "warning" : s === "upcoming" ? "info" : s === "cancelled" ? "danger" : "default"}
              className={status === s ? "border-primary/40 ring-1 ring-primary/20" : "hover:border-foreground/20"}
            />
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="all">All memberships</TabsTrigger>
          <TabsTrigger value="requests">
            Booking requests {pending.length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-[10px] font-semibold">{pending.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Student, code or seat" className="pl-8" aria-label="Search memberships" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-full lg:w-40" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(Object.keys(counts) as MembershipStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{MEMBERSHIP_STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={planName} onValueChange={setPlanName}>
                <SelectTrigger className="w-full lg:w-40" aria-label="Plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {planNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger className="w-full lg:w-36" aria-label="Payment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(status !== "all" || planName !== "all" || payment !== "all" || query) && (
              <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setPlanName("all"); setPayment("all"); setQuery(""); }}>
                <X /> Reset
              </Button>
            )}
            <span className="text-xs text-muted-foreground lg:ml-auto">{filtered.length} shown</span>
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(m) => router.push(`/admin/students/${m.studentId}`)}
            getRowLabel={(m) => `Open ${m.studentName}`}
            initialSorting={[{ id: "startDate", desc: true }]}
            renderCard={(m) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.studentName}</span>
                  <MembershipStatusBadge status={m.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.code} · Seat {m.seatCode} · {m.planName} · {formatDate(m.startDate)} – {formatDate(m.endDate)}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <PaymentStatusBadge status={m.paymentStatus} />
                  {m.balance > 0 && <span className="text-destructive tabular">{formatCurrency(m.balance)} due</span>}
                </div>
              </div>
            )}
            empty={<EmptyState icon={CalendarRange} title="No memberships match" description="Adjust filters or create a membership." />}
          />
        </TabsContent>

        <TabsContent value="requests">
          <BookingRequests />
        </TabsContent>
      </Tabs>

      <MembershipFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function BookingRequests() {
  const { tenantId, data, views, settings } = useTenant();
  const [declining, setDeclining] = useState<BookingRequest | null>(null);
  const [note, setNote] = useState("");
  const approve = useAction((id: string) => bookingService.approve(tenantId, id), {
    success: (m) => `Approved — membership ${m.code} created`,
  });
  const decline = useAction(async () => {
    await bookingService.decline(tenantId, declining!.id, note);
    return true;
  }, { success: "Request declined" });

  const requests = [...data.bookingRequests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-xs text-muted-foreground">
        {settings.rules.bookingMode === "approval"
          ? "Students submit seat requests from their portal. Approving creates the membership and holds the seat."
          : "Instant booking is on — students confirm seats themselves. Switch to approval mode in Settings → Booking rules."}
      </div>
      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title="No booking requests" description="Requests from the student portal will appear here." />
      ) : (
        <ul className="divide-y">
          {requests.map((r) => {
            const student = views.studentById.get(r.studentId);
            const seat = views.seatById.get(r.seatId);
            const plan = data.plans.find((p) => p.id === r.planId);
            const end = plan ? membershipEndDate(r.startDate, plan.durationMonths) : r.startDate;
            const free = isSeatAvailableFor(data, r.seatId, r.startDate, end);
            return (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <PersonAvatar name={student?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{student?.name}</span>
                    <BookingRequestBadge status={r.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Seat {seat?.code} · {plan?.name} ({plan && formatCurrency(plan.price)}) · from {formatDate(r.startDate)} · requested{" "}
                    {formatDateTime(r.createdAt)}
                  </div>
                  {r.status === "pending" && !free && (
                    <div className="mt-1 text-xs text-destructive">Seat is no longer free for these dates — decline or ask the student to pick another seat.</div>
                  )}
                  {r.decisionNote && <div className="mt-1 text-xs text-muted-foreground">Note: {r.decisionNote}</div>}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setNote(""); setDeclining(r); }}>
                      <X /> Decline
                    </Button>
                    <Button size="sm" disabled={!free || approve.pending} onClick={() => approve.run(r.id)}>
                      <Check /> Approve
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(declining)}
        onOpenChange={(o) => !o && setDeclining(null)}
        title="Decline booking request?"
        description="The student will see the request as declined in their portal."
        confirmLabel="Decline"
        destructive
        pending={decline.pending}
        onConfirm={async () => {
          if (await decline.run()) setDeclining(null);
        }}
      >
        <Field label="Message to student (optional)">{(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </ConfirmDialog>
    </div>
  );
}
