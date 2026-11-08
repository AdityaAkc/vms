"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, Download, Eye, IndianRupee, MoreHorizontal, Receipt, Search, X, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { MembershipStatusBadge, PaymentRecordBadge, PaymentStatusBadge } from "@/components/app/status-badge";
import { RevenueChart } from "@/components/charts/charts";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { downloadCsv } from "@/lib/csv";
import { addDays, formatDate, formatMonthKey, monthKey } from "@/lib/date";
import { revenueByMonth } from "@/lib/domain/metrics";
import { PAYMENT_METHOD_LABEL, formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { paymentService } from "@/lib/services";
import type { MembershipView, Payment, PaymentMethod, PaymentRecordStatus } from "@/lib/types";

export function PaymentsView() {
  const { tenantId, views, settings, today } = useTenant();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") ?? "history");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PaymentRecordStatus>("all");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [recording, setRecording] = useState<{ membershipId?: string } | null>(null);

  const setPaymentStatus = useAction(async (p: Payment, s: PaymentRecordStatus) => {
    await paymentService.setStatus(tenantId, p.id, s);
    return s;
  }, { success: (s) => (s === "completed" ? "Marked as received" : "Marked as failed") });

  const thisMonth = monthKey(today);
  const lastMonth = monthKey(addDays(`${thisMonth}-01`, -1));
  const sum = (list: Payment[]) => list.reduce((s, p) => s + p.amount, 0);
  const completed = views.payments.filter((p) => p.status === "completed");
  const pendingVerification = views.payments.filter((p) => p.status === "pending");
  const dues = useMemo(
    () => views.memberships.filter((m) => m.balance > 0).sort((a, b) => b.balance - a.balance),
    [views.memberships],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.payments.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (method !== "all" && p.method !== method) return false;
      if (from && p.paidOn < from) return false;
      if (to && p.paidOn > to) return false;
      if (!q) return true;
      const name = views.studentById.get(p.studentId)?.name.toLowerCase() ?? "";
      return name.includes(q) || p.receiptNo.toLowerCase().includes(q) || (p.reference ?? "").toLowerCase().includes(q);
    });
  }, [views, query, status, method, from, to]);

  const months = useMemo(() => revenueByMonth(views, 12), [views]);

  const columns: ColumnDef<Payment, unknown>[] = [
    { accessorKey: "receiptNo", header: "Receipt", cell: ({ getValue }) => <span className="font-medium tabular">{getValue() as string}</span> },
    { accessorKey: "paidOn", header: "Date", cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
    { id: "student", header: "Student", accessorFn: (p) => views.studentById.get(p.studentId)?.name ?? "" },
    {
      id: "membership",
      header: "Membership",
      accessorFn: (p) => views.membershipById.get(p.membershipId)?.code ?? "",
      cell: ({ row }) => {
        const m = views.membershipById.get(row.original.membershipId);
        return m ? <span className="text-muted-foreground">{m.code} · {m.planName}</span> : "—";
      },
    },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="font-medium tabular">{formatCurrency(getValue() as number)}</span> },
    { accessorKey: "method", header: "Method", cell: ({ getValue }) => PAYMENT_METHOD_LABEL[getValue() as PaymentMethod] },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <PaymentRecordBadge status={getValue() as PaymentRecordStatus} /> },
    { accessorKey: "reference", header: "Reference", enableSorting: false, cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string) || "—"}</span> },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => <PaymentRowActions payment={row.original} onReceipt={() => setReceipt(row.original)} onStatus={(s) => setPaymentStatus.run(row.original, s)} />,
    },
  ];

  const dueColumns: ColumnDef<MembershipView, unknown>[] = [
    { accessorKey: "studentName", header: "Student" },
    { accessorKey: "code", header: "Membership", cell: ({ row }) => <span className="text-muted-foreground">{row.original.code} · {row.original.planName}</span> },
    { accessorKey: "seatCode", header: "Seat" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <MembershipStatusBadge status={row.original.status} /> },
    { accessorKey: "totalAmount", header: "Total", cell: ({ getValue }) => <span className="tabular">{formatCurrency(getValue() as number)}</span> },
    { accessorKey: "amountPaid", header: "Paid", cell: ({ getValue }) => <span className="tabular">{formatCurrency(getValue() as number)}</span> },
    {
      accessorKey: "balance",
      header: "Outstanding",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-destructive tabular">{formatCurrency(row.original.balance)}</span>
          <PaymentStatusBadge status={row.original.paymentStatus} />
          {row.original.amountPending > 0 && <span className="text-xs text-muted-foreground">({formatCurrency(row.original.amountPending)} verifying)</span>}
        </div>
      ),
    },
    {
      id: "collect",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.balance - row.original.amountPending > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setRecording({ membershipId: row.original.id })}>
            Collect
          </Button>
        ) : null,
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `${settings.general.name} payments ${from} to ${to}.csv`,
      ["Receipt", "Date", "Student", "Membership", "Amount", "Method", "Status", "Reference"],
      filtered.map((p) => [
        p.receiptNo,
        p.paidOn,
        views.studentById.get(p.studentId)?.name ?? "",
        views.membershipById.get(p.membershipId)?.code ?? "",
        p.amount,
        PAYMENT_METHOD_LABEL[p.method],
        p.status,
        p.reference ?? "",
      ]),
    );

  return (
    <>
      <PageHeader
        title="Payments"
        description="Fee collection records. These are bookkeeping entries — no online payment gateway is connected."
        actions={<Button onClick={() => setRecording({})}><Receipt /> Record payment</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Collected in ${formatMonthKey(thisMonth, "MMMM")}`} value={formatCurrency(sum(completed.filter((p) => monthKey(p.paidOn) === thisMonth)))} icon={IndianRupee} tone="success" />
        <StatCard label={`Collected in ${formatMonthKey(lastMonth, "MMMM")}`} value={formatCurrency(sum(completed.filter((p) => monthKey(p.paidOn) === lastMonth)))} icon={CheckCircle2} />
        <StatCard label="Awaiting verification" value={formatCurrency(sum(pendingVerification))} icon={Clock} tone="warning" hint={`${pendingVerification.length} payments`} />
        <StatCard label="Outstanding dues" value={formatCurrency(dues.reduce((s, m) => s + m.balance, 0))} icon={AlertCircle} tone="danger" hint={`${dues.length} memberships`} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="history">Payment history</TabsTrigger>
          <TabsTrigger value="dues">Outstanding ({dues.length})</TabsTrigger>
          <TabsTrigger value="monthly">Monthly collections</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-end">
            <div className="relative xl:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Student, receipt, reference" className="pl-8" aria-label="Search payments" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="xl:w-40" />
              <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="xl:w-40" />
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full xl:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Received</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger className="w-full xl:w-36" aria-label="Method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(query || status !== "all" || method !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus("all"); setMethod("all"); }}><X /> Reset</Button>
            )}
            <div className="flex items-center gap-3 xl:ml-auto">
              <span className="text-xs text-muted-foreground">
                {filtered.length} payments · {formatCurrency(sum(filtered.filter((p) => p.status === "completed")))} received
              </span>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}><Download /> CSV</Button>
            </div>
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            initialSorting={[{ id: "paidOn", desc: true }]}
            renderCard={(p) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{views.studentById.get(p.studentId)?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.receiptNo} · {formatDate(p.paidOn)} · {PAYMENT_METHOD_LABEL[p.method]}
                  </div>
                  <div className="mt-1.5"><PaymentRecordBadge status={p.status} /></div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold tabular">{formatCurrency(p.amount)}</span>
                  <PaymentRowActions payment={p} onReceipt={() => setReceipt(p)} onStatus={(s) => setPaymentStatus.run(p, s)} />
                </div>
              </div>
            )}
            empty={<EmptyState icon={Receipt} title="No payments in this range" description="Widen the date range or clear filters." />}
          />
        </TabsContent>

        <TabsContent value="dues">
          <DataTable
            columns={dueColumns}
            data={dues}
            initialSorting={[{ id: "balance", desc: true }]}
            renderCard={(m) => (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{m.studentName}</div>
                  <div className="text-xs text-muted-foreground">{m.code} · Seat {m.seatCode} · {formatCurrency(m.amountPaid)} of {formatCurrency(m.totalAmount)} paid</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-semibold text-destructive tabular">{formatCurrency(m.balance)}</span>
                  {m.balance - m.amountPending > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setRecording({ membershipId: m.id })}>Collect</Button>
                  )}
                </div>
              </div>
            )}
            empty={<EmptyState icon={CheckCircle2} title="No outstanding dues" description="Every membership is fully paid." />}
          />
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Collections by month</CardTitle>
              <CardDescription>Received payments over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <RevenueChart data={months} height={260} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Monthly collections table</caption>
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 font-medium">Month</th>
                      <th scope="col" className="py-2 text-right font-medium">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...months].reverse().map((m) => (
                      <tr key={m.month} className="border-b last:border-0">
                        <td className="py-2">{formatMonthKey(m.month, "MMMM yyyy")}</td>
                        <td className="py-2 text-right tabular">{formatCurrency(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReceiptDialog payment={receipt} open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)} />
      <RecordPaymentDialog
        open={recording !== null}
        membershipId={recording?.membershipId}
        onOpenChange={(o) => !o && setRecording(null)}
        onRecorded={(p) => setReceipt(p)}
      />
    </>
  );
}

function PaymentRowActions({
  payment,
  onReceipt,
  onStatus,
}: {
  payment: Payment;
  onReceipt: () => void;
  onStatus: (s: PaymentRecordStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${payment.receiptNo}`}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onReceipt}><Eye /> View receipt</DropdownMenuItem>
        {payment.status === "pending" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onStatus("completed")}><CheckCircle2 /> Mark as received</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onStatus("failed")}><XCircle /> Mark as failed</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
