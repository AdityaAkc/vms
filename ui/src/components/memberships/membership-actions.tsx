"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, MoreHorizontal, Receipt, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { membershipService } from "@/lib/services";
import type { MembershipView } from "@/lib/types";
import { RenewDialog } from "./renew-dialog";

/** Row-level actions for a membership (renew, collect, cancel). */
export function MembershipActions({ membership: m }: { membership: MembershipView }) {
  const { tenantId, views } = useTenant();
  const [dialog, setDialog] = useState<null | "renew" | "pay" | "cancel">(null);
  const [reason, setReason] = useState("");
  const cancel = useAction(async () => {
    await membershipService.cancel(tenantId, m.id, reason);
    return true;
  }, { success: `${m.code} cancelled — seat ${m.seatCode} released` });

  const renewed = views.memberships.some((x) => x.renewalOf === m.id && !x.cancelledAt);
  const canRenew = (m.status === "active" || m.status === "expiring" || m.status === "expired") && !renewed;
  const canCancel = m.status === "active" || m.status === "expiring" || m.status === "upcoming";
  const due = m.balance - m.amountPending > 0 && m.status !== "cancelled";

  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.code}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/students/${m.studentId}`}><User /> View student</Link>
          </DropdownMenuItem>
          {canRenew && <DropdownMenuItem onSelect={() => setDialog("renew")}><RefreshCw /> Renew</DropdownMenuItem>}
          {due && <DropdownMenuItem onSelect={() => setDialog("pay")}><Receipt /> Record payment</DropdownMenuItem>}
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}><Ban /> Cancel membership</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <RenewDialog membership={m} open={dialog === "renew"} onOpenChange={(o) => setDialog(o ? "renew" : null)} />
      <RecordPaymentDialog membershipId={m.id} open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : null)} />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title={`Cancel ${m.code}?`}
        description={`${m.studentName}'s seat ${m.seatCode} will be released. Recorded payments stay on file; refunds are handled outside the system.`}
        confirmLabel="Cancel membership"
        destructive
        pending={cancel.pending}
        onConfirm={async () => {
          if (await cancel.run()) setDialog(null);
        }}
      >
        <Field label="Reason">{(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </ConfirmDialog>
    </div>
  );
}
