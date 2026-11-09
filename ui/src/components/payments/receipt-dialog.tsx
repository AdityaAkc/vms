"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/app/brand-mark";
import { PaymentRecordBadge } from "@/components/app/status-badge";
import { formatDate, formatDateTime } from "@/lib/date";
import { PAYMENT_METHOD_LABEL, formatCurrency, formatPhone } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import type { Payment } from "@/lib/types";

/** Print-friendly payment receipt. Clearly marked as a demo record. */
export function ReceiptDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { settings, views } = useTenant();
  if (!payment) return null;
  const membership = views.membershipById.get(payment.membershipId);
  const student = views.studentById.get(payment.studentId);
  const g = settings.general;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="sr-only">Receipt {payment.receiptNo}</DialogTitle>
        <DialogDescription className="sr-only">Payment receipt preview</DialogDescription>
        <div className="print-area rounded-lg border bg-white p-6 text-[13px] text-foreground">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandMark name={g.name} logo={g.logoDataUrl} color={g.brandColor} size="lg" />
              <div>
                <div className="text-base font-semibold">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[g.address, g.city, g.pincode].filter(Boolean).join(", ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {g.phone && formatPhone(g.phone)} {g.email && `· ${g.email}`}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between border-b pb-3">
            <div>
              <div className="text-[11px] tracking-wider text-muted-foreground uppercase">Payment receipt</div>
              <div className="text-lg font-semibold tabular">{payment.receiptNo}</div>
            </div>
            <PaymentRecordBadge status={payment.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            <Item label="Received from" value={student?.name ?? "—"} />
            <Item label="Student ID" value={student?.code ?? "—"} />
            <Item label="Payment date" value={formatDate(payment.paidOn)} />
            <Item label="Method" value={PAYMENT_METHOD_LABEL[payment.method]} />
            <Item label="Membership" value={membership ? `${membership.code} · ${membership.planName}` : "—"} />
            <Item label="Seat" value={membership?.seatCode ?? "—"} />
            <Item
              label="Period"
              value={membership ? `${formatDate(membership.startDate)} – ${formatDate(membership.endDate)}` : "—"}
            />
            <Item label="Reference" value={payment.reference ?? "—"} />
          </dl>

          <div className="mt-5 rounded-md bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="text-xl font-semibold tabular">{formatCurrency(payment.amount)}</span>
            </div>
            {membership && (
              <div className="mt-2 flex justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>Membership total {formatCurrency(membership.totalAmount)}</span>
                <span>Balance due {formatCurrency(membership.balance)}</span>
              </div>
            )}
          </div>
          {payment.note && <p className="mt-3 text-xs text-muted-foreground">Note: {payment.note}</p>}

          <p className="mt-6 border-t border-dashed pt-3 text-center text-[11px] text-muted-foreground">
            Demo receipt generated {formatDateTime(payment.createdAt)}. This is a sample record, not a tax invoice
            or proof of an actual transaction.
          </p>
        </div>
        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer /> Print receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
