"use client";

import { useState } from "react";
import { Eye, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { PaymentRecordBadge } from "@/components/app/status-badge";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { useCurrentStudent } from "@/components/student/use-current-student";
import { formatDate } from "@/lib/date";
import { PAYMENT_METHOD_LABEL, formatCurrency } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import type { Payment } from "@/lib/types";

export function StudentPaymentsView() {
  const { views } = useTenant();
  const { student, payments, memberships } = useCurrentStudent();
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const paid = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const dues = memberships.filter((m) => m.balance > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your receipts and any outstanding fees.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card size="sm"><CardContent><div className="text-xs text-muted-foreground">Total paid</div><div className="text-xl font-semibold tabular">{formatCurrency(paid)}</div></CardContent></Card>
        <Card size="sm">
          <CardContent>
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className={`text-xl font-semibold tabular ${student.balance > 0 ? "text-destructive" : ""}`}>{formatCurrency(student.balance)}</div>
          </CardContent>
        </Card>
      </div>

      {dues.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Wallet className="size-4 text-destructive" aria-hidden /> Due now</div>
            <ul className="divide-y text-sm">
              {dues.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <span>
                    {m.planName} · Seat {m.seatCode}
                    <span className="block text-xs text-muted-foreground">{formatDate(m.startDate)} – {formatDate(m.endDate)}{m.amountPending > 0 && ` · ${formatCurrency(m.amountPending)} being verified`}</span>
                  </span>
                  <span className="font-semibold text-destructive tabular">{formatCurrency(m.balance)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Pay at the front desk by cash, UPI or bank transfer. Online payment is planned for a future release.</p>
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Receipts appear here after you pay at the front desk." />
        ) : (
          <ul className="divide-y">
            {payments.map((p) => {
              const m = views.membershipById.get(p.membershipId);
              return (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular">{formatCurrency(p.amount)}</span>
                      <PaymentRecordBadge status={p.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(p.paidOn)} · {PAYMENT_METHOD_LABEL[p.method]} · {m?.planName} (Seat {m?.seatCode})
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setReceipt(p)} aria-label={`View receipt ${p.receiptNo}`}>
                    <Eye /> <span className="hidden sm:inline">Receipt</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <ReceiptDialog payment={receipt} open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)} />
    </div>
  );
}
