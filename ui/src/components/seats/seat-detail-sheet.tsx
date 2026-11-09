"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarPlus,
  History,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PersonAvatar } from "@/components/app/brand-mark";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { MembershipStatusBadge, PaymentStatusBadge, SeatStateBadge } from "@/components/app/status-badge";
import { MembershipFormDialog } from "@/components/memberships/membership-form-dialog";
import { RenewDialog } from "@/components/memberships/renew-dialog";
import { formatDate, formatDateTime, relativeDays } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { seatService } from "@/lib/services";
import { seatRemovalBlocker } from "@/lib/services/seatService";
import type { MembershipView, SeatEventType, SeatView } from "@/lib/types";
import { ChangeSeatDialog, EditSeatDialog, MaintenanceDialog } from "./seat-dialogs";

const EVENT_LABEL: Record<SeatEventType, string> = {
  created: "Seat added",
  assigned: "Assigned",
  renewed: "Renewed",
  transferred_in: "Moved in",
  transferred_out: "Moved out",
  released: "Released",
  maintenance_on: "Disabled for maintenance",
  maintenance_off: "Enabled",
  edited: "Details edited",
  removed: "Removed",
  restored: "Restored",
};

export function SeatDetailSheet({ seat, onOpenChange }: { seat: SeatView | null; onOpenChange: (o: boolean) => void }) {
  const { tenantId, data, views, today } = useTenant();
  const [dialog, setDialog] = useState<null | "edit" | "maintenance" | "assign" | "transfer" | "renew" | "remove" | "enable">(null);
  const live = seat ? views.seats.find((s) => s.id === seat.id) ?? seat : null;

  const enable = useAction(async () => {
    await seatService.setMaintenance(tenantId, live!.id, false);
    return true;
  }, { success: "Seat enabled and bookable again" });
  const remove = useAction(async () => {
    await seatService.removeSeats(tenantId, [live!.id]);
    return true;
  }, { success: "Seat removed" });

  if (!live) return null;
  const blocker = seatRemovalBlocker(data, live.id, today);
  const member = live.current ?? live.upcoming;
  const history = data.seatEvents
    .filter((e) => e.seatId === live.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 25);
  const memberships = views.memberships.filter((m) => m.seatId === live.id);

  return (
    <>
      <Sheet open={Boolean(seat)} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg">Seat {live.code}</SheetTitle>
              <SeatStateBadge state={live.state} />
            </div>
            <SheetDescription>
              {live.tags.length ? live.tags.join(" · ") : "Standard seat"}
              {live.isUnderMaintenance && live.maintenanceNote ? ` — ${live.maintenanceNote}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 p-5">
            {live.hasConflict && (
              <div className="flex gap-2 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                This seat is disabled but still has a booking. Move the student to another seat.
              </div>
            )}

            {member ? (
              <MemberCard membership={member} upcomingOnly={!live.current} />
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {live.isUnderMaintenance ? "Seat is disabled and not bookable." : "No one is assigned to this seat."}
              </div>
            )}
            {live.current && live.upcoming && (
              <p className="-mt-3 text-xs text-muted-foreground">
                Next: {live.upcoming.studentName} from {formatDate(live.upcoming.startDate)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {!live.isUnderMaintenance && !member && (
                <Button className="col-span-2" onClick={() => setDialog("assign")}>
                  <CalendarPlus /> Assign student
                </Button>
              )}
              {member && (
                <>
                  <Button variant="outline" onClick={() => setDialog("transfer")}>
                    <ArrowLeftRight /> Transfer
                  </Button>
                  {live.current && (
                    <Button variant="outline" onClick={() => setDialog("renew")}>
                      <RefreshCw /> Renew
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" onClick={() => setDialog("edit")}>
                <Pencil /> Edit seat
              </Button>
              {live.isUnderMaintenance ? (
                <Button variant="outline" onClick={() => setDialog("enable")}>
                  <RotateCcw /> Enable seat
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDialog("maintenance")}>
                  <Wrench /> Disable
                </Button>
              )}
              <Button
                variant="ghost"
                className="col-span-2 text-destructive hover:text-destructive"
                disabled={Boolean(blocker)}
                onClick={() => setDialog("remove")}
              >
                <Trash2 /> {blocker ? `Can't remove — ${blocker.toLowerCase()}` : "Remove seat"}
              </Button>
            </div>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <History className="size-3.5" aria-hidden /> Booking history
              </h3>
              {memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {memberships.slice(0, 8).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <Link href={`/admin/students/${m.studentId}`} className="font-medium hover:underline">{m.studentName}</Link>
                        <div className="text-muted-foreground tabular">{formatDate(m.startDate)} – {formatDate(m.endDate)}</div>
                      </div>
                      <MembershipStatusBadge status={m.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Activity</h3>
              <ol className="relative space-y-3 border-l pl-4">
                {history.map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="absolute -left-[4.5px] mt-1 size-2 rounded-full bg-border" aria-hidden />
                    <span className="font-medium">{EVENT_LABEL[e.type]}</span>
                    {e.studentId && <> · {views.studentById.get(e.studentId)?.name}</>}
                    {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                    <div className="text-muted-foreground">{formatDateTime(e.at)}</div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <EditSeatDialog seat={live} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      <MaintenanceDialog seat={live} open={dialog === "maintenance"} onOpenChange={(o) => setDialog(o ? "maintenance" : null)} />
      <MembershipFormDialog defaultSeatId={live.id} open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} />
      <ChangeSeatDialog studentId={member?.studentId ?? null} open={dialog === "transfer"} onOpenChange={(o) => setDialog(o ? "transfer" : null)} />
      <RenewDialog membership={live.current ?? null} open={dialog === "renew"} onOpenChange={(o) => setDialog(o ? "renew" : null)} />
      <ConfirmDialog
        open={dialog === "enable"}
        onOpenChange={(o) => setDialog(o ? "enable" : null)}
        title={`Enable seat ${live.code}?`}
        description="The seat becomes available for booking again."
        confirmLabel="Enable seat"
        pending={enable.pending}
        onConfirm={async () => {
          if (await enable.run()) setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={(o) => setDialog(o ? "remove" : null)}
        title={`Remove seat ${live.code}?`}
        description="Capacity reduces by one. The seat's history is kept and it can be restored later from Removed seats."
        confirmLabel="Remove seat"
        destructive
        pending={remove.pending}
        onConfirm={async () => {
          if (await remove.run()) {
            setDialog(null);
            onOpenChange(false);
          }
        }}
      />
    </>
  );
}

function MemberCard({ membership: m, upcomingOnly }: { membership: MembershipView; upcomingOnly: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <PersonAvatar name={m.studentName} className="size-10" />
        <div className="min-w-0 flex-1">
          <Link href={`/admin/students/${m.studentId}`} className="block truncate font-medium hover:underline">
            {m.studentName}
          </Link>
          <div className="text-xs text-muted-foreground">
            {upcomingOnly ? "Reserved · starts " : ""}
            {m.code} · {m.planName}
          </div>
        </div>
        <MembershipStatusBadge status={m.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Start date</dt>
          <dd className="font-medium tabular">{formatDate(m.startDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expiry date</dt>
          <dd className="font-medium tabular">
            {formatDate(m.endDate)}
            {!upcomingOnly && <span className="ml-1 font-normal text-muted-foreground">({relativeDays(m.daysRemaining)})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment</dt>
          <dd className="mt-0.5"><PaymentStatusBadge status={m.paymentStatus} /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="font-medium tabular">{formatCurrency(m.balance)}</dd>
        </div>
      </dl>
    </div>
  );
}
