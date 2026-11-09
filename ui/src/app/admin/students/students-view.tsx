"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Search, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonAvatar } from "@/components/app/brand-mark";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { MEMBERSHIP_STATUS_META, MembershipStatusBadge, PaymentStatusBadge, StatusPill } from "@/components/app/status-badge";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { formatDate } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency, formatPhone } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import type { StudentView } from "@/lib/types";

const columns: ColumnDef<StudentView, unknown>[] = [
  {
    accessorKey: "name",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={row.original.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            {row.original.name}
            {row.original.status === "inactive" && <StatusPill tone="neutral">Inactive</StatusPill>}
          </div>
          <div className="text-xs text-muted-foreground">{row.original.code}</div>
        </div>
      </div>
    ),
  },
  { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="tabular">{formatPhone(getValue() as string)}</span> },
  { accessorKey: "email", header: "Email", cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span> },
  {
    id: "seat",
    header: "Seat",
    accessorFn: (s) => s.seatCode ?? "",
    cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "membershipStatus",
    header: "Membership",
    cell: ({ row }) => <MembershipStatusBadge status={row.original.membershipStatus} />,
  },
  {
    id: "start",
    header: "Start",
    accessorFn: (s) => (s.current ?? s.upcoming ?? s.latest)?.startDate ?? "",
    cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span>,
  },
  {
    id: "expiry",
    header: "Expiry",
    accessorFn: (s) => s.coveredUntil ?? s.latest?.endDate ?? "",
    cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span>,
  },
  {
    accessorKey: "balance",
    header: "Payment",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <PaymentStatusBadge status={row.original.paymentStatus} />
        {row.original.balance > 0 && <span className="text-xs text-destructive tabular">{formatCurrency(row.original.balance)}</span>}
      </div>
    ),
  },
];

type MembershipFilter = "all" | StudentView["membershipStatus"];
type PaymentFilter = "all" | "paid" | "partial" | "unpaid";

export function StudentsView() {
  const { views, settings } = useTenant();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [membership, setMembership] = useState<MembershipFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return views.students.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (membership !== "all" && s.membershipStatus !== membership) return false;
      if (payment !== "all" && s.paymentStatus !== payment) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.email.includes(q) ||
        (qDigits.length >= 3 && s.phone.includes(qDigits)) ||
        (s.seatCode?.toLowerCase() === q)
      );
    });
  }, [views.students, query, membership, payment, status]);

  const filtersActive = query || membership !== "all" || payment !== "all" || status !== "active";

  const exportCsv = () =>
    downloadCsv(
      `${settings.general.name} students.csv`,
      ["Code", "Name", "Phone", "Email", "Seat", "Membership", "Expiry", "Balance"],
      filtered.map((s) => [
        s.code,
        s.name,
        s.phone,
        s.email,
        s.seatCode ?? "",
        MEMBERSHIP_STATUS_META[s.membershipStatus].label,
        s.coveredUntil ?? s.latest?.endDate ?? "",
        s.balance,
      ]),
    );

  return (
    <>
      <PageHeader
        title="Students"
        description={`${views.students.filter((s) => s.status === "active").length} active · ${views.students.length} total registered`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download /> Export
            </Button>
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> Add student
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email, seat"
            className="pl-8"
            aria-label="Search students"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
          <Select value={membership} onValueChange={(v) => setMembership(v as MembershipFilter)}>
            <SelectTrigger className="w-full lg:w-44" aria-label="Filter by membership status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All memberships</SelectItem>
              {(Object.keys(MEMBERSHIP_STATUS_META) as (keyof typeof MEMBERSHIP_STATUS_META)[]).map((k) => (
                <SelectItem key={k} value={k}>{MEMBERSHIP_STATUS_META[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payment} onValueChange={(v) => setPayment(v as PaymentFilter)}>
            <SelectTrigger className="w-full lg:w-36" aria-label="Filter by payment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full lg:w-36" aria-label="Filter by student status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active students</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start lg:self-auto"
            onClick={() => {
              setQuery("");
              setMembership("all");
              setPayment("all");
              setStatus("active");
            }}
          >
            <X /> Reset
          </Button>
        )}
        <span className="text-xs text-muted-foreground lg:ml-auto">{filtered.length} shown</span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(s) => router.push(`/admin/students/${s.id}`)}
        getRowLabel={(s) => `Open ${s.name}`}
        initialSorting={[{ id: "name", desc: false }]}
        renderCard={(s) => (
          <div className="flex items-start gap-3">
            <PersonAvatar name={s.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{s.name}</span>
                <MembershipStatusBadge status={s.membershipStatus} />
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatPhone(s.phone)} {s.seatCode && `· Seat ${s.seatCode}`}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <PaymentStatusBadge status={s.paymentStatus} />
                {s.coveredUntil && <span className="text-muted-foreground">until {formatDate(s.coveredUntil)}</span>}
                {s.balance > 0 && <span className="ml-auto text-destructive tabular">{formatCurrency(s.balance)} due</span>}
              </div>
            </div>
          </div>
        )}
        empty={
          views.students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students yet"
              description="Register your first student to start assigning seats."
              action={<Button onClick={() => setAdding(true)}><UserPlus /> Add student</Button>}
            />
          ) : (
            <EmptyState icon={Search} title="No students match these filters" description="Try clearing a filter or searching differently." />
          )
        }
      />

      <StudentFormDialog open={adding} onOpenChange={setAdding} onSaved={(s) => router.push(`/admin/students/${s.id}`)} />
    </>
  );
}
