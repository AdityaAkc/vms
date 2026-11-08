"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  CalendarPlus,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Receipt,
  RefreshCw,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
  Eye,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/app/brand-mark";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { MembershipStatusBadge, PaymentRecordBadge, PaymentStatusBadge, StatusPill } from "@/components/app/status-badge";
import { MembershipFormDialog } from "@/components/memberships/membership-form-dialog";
import { RenewDialog } from "@/components/memberships/renew-dialog";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { ChangeSeatDialog } from "@/components/seats/seat-dialogs";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { daysBetween, formatDate, formatDateTime, relativeDays } from "@/lib/date";
import { PAYMENT_METHOD_LABEL, formatCurrency, formatPhone } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { membershipService, studentService } from "@/lib/services";
import type { MembershipView, Payment } from "@/lib/types";

type DialogKind = "edit" | "assign" | "change" | "renew" | "payment" | "deactivate" | "reactivate" | "cancel";

export function StudentDetailView() {
  const { id } = useParams<{ id: string }>();
  const { tenantId, views, data } = useTenant();
  const student = views.studentById.get(id);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [paymentFor, setPaymentFor] = useState<string | undefined>();
  const [renewTarget, setRenewTarget] = useState<MembershipView | null>(null);

  if (!student) {
    return (
      <EmptyState
        title="Student not found"
        description="This student doesn't exist in this reading room."
        action={<Button asChild variant="outline"><Link href="/admin/students">Back to students</Link></Button>}
      />
    );
  }

  const memberships = views.memberships.filter((m) => m.studentId === student.id);
  const payments = views.payments.filter((p) => p.studentId === student.id);
  const seatEvents = data.seatEvents
    .filter((e) => e.studentId === student.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const holding = student.current ?? student.upcoming;
  const renewable = student.current && !student.upcoming ? student.current : !student.current && student.latest?.status === "expired" ? student.latest : null;
  const active = student.status === "active";
  const open = (k: DialogKind) => setDialog(k);
  const close = (o: boolean) => !o && setDialog(null);

  return (
    <>
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Students
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <PersonAvatar name={student.name} className="size-14 text-base" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{student.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{student.code}</span>
              <span aria-hidden>·</span>
              <span>Joined {formatDate(student.joinedOn)}</span>
              <MembershipStatusBadge status={student.membershipStatus} />
              {!active && <StatusPill tone="neutral" icon={UserX}>Inactive</StatusPill>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {active && !holding && (
            <Button onClick={() => open("assign")}>
              <CalendarPlus /> Assign seat
            </Button>
          )}
          {active && renewable && (
            <Button
              variant={holding ? "outline" : "default"}
              onClick={() => {
                setRenewTarget(renewable);
                open("renew");
              }}
            >
              <RefreshCw /> Renew
            </Button>
          )}
          {holding && (
            <Button variant="outline" onClick={() => open("change")}>
              <ArrowLeftRight /> Change seat
            </Button>
          )}
          {student.balance > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setPaymentFor(memberships.find((m) => m.balance - m.amountPending > 0)?.id);
                open("payment");
              }}
            >
              <Receipt /> Record payment
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => open("edit")}><Pencil /> Edit details</DropdownMenuItem>
              {holding && (
                <DropdownMenuItem onSelect={() => open("cancel")}><Ban /> Cancel membership</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {active ? (
                <DropdownMenuItem variant="destructive" onSelect={() => open("deactivate")}><UserX /> Mark inactive</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => open("reactivate")}><UserCheck /> Reactivate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!active && student.inactiveReason && (
        <div className="mb-5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Marked inactive: {student.inactiveReason}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <CurrentMembershipCard
            membership={student.current ?? student.upcoming}
            coveredUntil={student.coveredUntil}
            renewedAhead={Boolean(student.current && student.upcoming)}
            onAssign={active ? () => open("assign") : undefined}
          />

          <Tabs defaultValue="memberships">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="memberships">Memberships ({memberships.length})</TabsTrigger>
              <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
              <TabsTrigger value="bookings">Seat history</TabsTrigger>
              <TabsTrigger value="notes">Notes ({student.notes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="memberships">
              <Card className="py-0">
                {memberships.length === 0 ? (
                  <EmptyState title="No memberships yet" description="Assign a seat to create the first membership." />
                ) : (
                  <ul className="divide-y">
                    {memberships.map((m) => (
                      <li key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{m.planName}</span>
                            <span className="text-xs text-muted-foreground">{m.code}</span>
                            <MembershipStatusBadge status={m.status} />
                            {m.renewalOf && <StatusPill tone="neutral" icon={RefreshCw}>Renewal</StatusPill>}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground tabular">
                            Seat {m.seatCode} · {formatDate(m.startDate)} – {formatDate(m.endDate)}
                            {m.cancelReason && ` · ${m.cancelReason}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="text-right">
                            <div className="tabular">{formatCurrency(m.amountPaid)} / {formatCurrency(m.totalAmount)}</div>
                            <PaymentStatusBadge status={m.paymentStatus} />
                          </div>
                          {m.balance - m.amountPending > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPaymentFor(m.id);
                                open("payment");
                              }}
                            >
                              Collect
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="py-0">
                {payments.length === 0 ? (
                  <EmptyState icon={Receipt} title="No payments recorded" />
                ) : (
                  <ul className="divide-y">
                    {payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular">{formatCurrency(p.amount)}</span>
                            <PaymentRecordBadge status={p.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.receiptNo} · {formatDate(p.paidOn)} · {PAYMENT_METHOD_LABEL[p.method]}
                            {p.reference && ` · ${p.reference}`}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setReceipt(p)}>
                          <Eye /> Receipt
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="bookings">
              <Card className="py-0">
                {seatEvents.length === 0 ? (
                  <EmptyState title="No seat activity" />
                ) : (
                  <ol className="divide-y">
                    {seatEvents.map((e) => {
                      const seat = views.seatById.get(e.seatId);
                      const label = {
                        assigned: "Seat assigned",
                        renewed: "Renewed on seat",
                        transferred_in: "Moved to seat",
                        transferred_out: "Moved off seat",
                        released: "Seat released",
                      }[e.type as string] ?? e.type;
                      return (
                        <li key={e.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                          <div>
                            <span className="font-medium">{label}</span> {seat?.code}
                            {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <NotesPanel studentId={student.id} notes={student.notes} tenantId={tenantId} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <a href={`tel:+91${student.phone}`} className="flex items-center gap-2 hover:underline">
                <Phone className="size-4 text-muted-foreground" aria-hidden /> {formatPhone(student.phone)}
              </a>
              {student.email && (
                <a href={`mailto:${student.email}`} className="flex items-center gap-2 break-all hover:underline">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden /> {student.email}
                </a>
              )}
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {student.address}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <InfoItem label="Gender" value={student.gender[0]!.toUpperCase() + student.gender.slice(1)} />
                <InfoItem label="Date of birth" value={formatDate(student.dateOfBirth)} />
                <InfoItem label="Preparing for" value={student.preparingFor ?? "—"} className="col-span-2" />
                <InfoItem label="Guardian" value={student.guardianName ?? "—"} />
                <InfoItem label="Guardian phone" value={student.guardianPhone ? formatPhone(student.guardianPhone) : "—"} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Account summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <InfoItem label="Total billed" value={formatCurrency(memberships.filter((m) => !m.cancelledAt).reduce((s, m) => s + m.totalAmount, 0))} />
                <InfoItem label="Total paid" value={formatCurrency(memberships.reduce((s, m) => s + m.amountPaid, 0))} />
                <InfoItem
                  label="Outstanding"
                  value={<span className={student.balance > 0 ? "text-destructive" : undefined}>{formatCurrency(student.balance)}</span>}
                />
                <InfoItem label="Memberships" value={String(memberships.length)} />
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <StudentFormDialog student={student} open={dialog === "edit"} onOpenChange={close} />
      <MembershipFormDialog defaultStudentId={student.id} open={dialog === "assign"} onOpenChange={close} />
      <ChangeSeatDialog studentId={student.id} open={dialog === "change"} onOpenChange={close} />
      <RenewDialog membership={renewTarget} open={dialog === "renew"} onOpenChange={close} />
      <RecordPaymentDialog membershipId={paymentFor} open={dialog === "payment"} onOpenChange={close} />
      <ReceiptDialog payment={receipt} open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)} />
      <DeactivateDialog
        open={dialog === "deactivate"}
        onOpenChange={close}
        tenantId={tenantId}
        studentId={student.id}
        name={student.name}
        holding={holding}
      />
      <ReactivateDialog open={dialog === "reactivate"} onOpenChange={close} tenantId={tenantId} studentId={student.id} name={student.name} />
      <CancelMembershipDialog open={dialog === "cancel"} onOpenChange={close} tenantId={tenantId} membership={holding} />
    </>
  );
}

function InfoItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular">{value}</dd>
    </div>
  );
}

function CurrentMembershipCard({
  membership: m,
  coveredUntil,
  renewedAhead,
  onAssign,
}: {
  membership?: MembershipView;
  coveredUntil?: string;
  renewedAhead: boolean;
  onAssign?: () => void;
}) {
  if (!m) {
    return (
      <Card>
        <EmptyState
          icon={CalendarPlus}
          title="No current membership"
          description="This student doesn't hold a seat right now."
          action={onAssign && <Button onClick={onAssign}><CalendarPlus /> Assign seat</Button>}
        />
      </Card>
    );
  }
  const totalDays = daysBetween(m.startDate, m.endDate) + 1;
  const elapsed = Math.max(0, Math.min(totalDays, totalDays - m.daysRemaining - 1));
  const upcoming = m.status === "upcoming";
  return (
    <Card>
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex size-20 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-[10px] tracking-wider uppercase opacity-70">Seat</span>
          <span className="text-xl font-semibold tabular">{m.seatCode}</span>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{m.planName}</span>
            <span className="text-xs text-muted-foreground">{m.code}</span>
            <MembershipStatusBadge status={m.status} />
            <PaymentStatusBadge status={m.paymentStatus} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <InfoItem label="Start" value={formatDate(m.startDate)} />
            <InfoItem label="Expiry" value={formatDate(m.endDate)} />
            <InfoItem label={upcoming ? "Starts" : "Days left"} value={upcoming ? relativeDays(m.daysRemaining - totalDays + 1) : Math.max(0, m.daysRemaining)} />
            <InfoItem label="Balance" value={<span className={m.balance > 0 ? "text-destructive" : undefined}>{formatCurrency(m.balance)}</span>} />
          </dl>
          {!upcoming && <Progress value={(elapsed / totalDays) * 100} className="h-1.5" aria-label="Membership period elapsed" />}
          {renewedAhead && coveredUntil && (
            <p className="text-xs text-success">Renewed — seat covered until {formatDate(coveredUntil)}.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NotesPanel({ tenantId, studentId, notes }: { tenantId: string; studentId: string; notes: { id: string; text: string; at: string }[] }) {
  const [text, setText] = useState("");
  const add = useAction(async () => {
    await studentService.addNote(tenantId, studentId, text);
    return true;
  });
  const del = useAction(async (noteId: string) => {
    await studentService.deleteNote(tenantId, studentId, noteId);
    return true;
  });
  return (
    <Card>
      <CardContent className="space-y-4">
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await add.run()) setText("");
          }}
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an internal note (only staff can see this)" rows={2} aria-label="New note" />
          <Button type="submit" size="sm" disabled={!text.trim() || add.pending}>
            {add.pending && <Loader2 className="animate-spin" />} Add note
          </Button>
        </form>
        {notes.length === 0 ? (
          <EmptyState icon={StickyNote} title="No notes yet" className="py-6" />
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="group flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p>{n.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.at)}</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Delete note" onClick={() => del.run(n.id)} disabled={del.pending}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeactivateDialog({
  open,
  onOpenChange,
  tenantId,
  studentId,
  name,
  holding,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string;
  studentId: string;
  name: string;
  holding?: MembershipView;
}) {
  const [reason, setReason] = useState("");
  const [cancelBookings, setCancelBookings] = useState(false);
  const run = useAction(async () => {
    await studentService.deactivate(tenantId, studentId, { reason, cancelBookings });
    return true;
  }, { success: `${name} marked inactive` });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${name} inactive?`}
      description="Inactive students can't be assigned seats until reactivated. Their history is kept."
      confirmLabel="Mark inactive"
      destructive
      pending={run.pending}
      onConfirm={async () => {
        if (holding && !cancelBookings) return;
        if (await run.run()) onOpenChange(false);
      }}
    >
      <div className="space-y-3">
        <Field label="Reason">{(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Exam completed" />}</Field>
        {holding && (
          <label className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-xs">
            <Checkbox checked={cancelBookings} onCheckedChange={(v) => setCancelBookings(v === true)} className="mt-0.5" />
            <span>
              Also cancel membership {holding.code} and release seat {holding.seatCode}. Required — a student can&apos;t be
              inactive while holding a seat. Payments already made are not refunded automatically.
            </span>
          </label>
        )}
      </div>
    </ConfirmDialog>
  );
}

function ReactivateDialog({ open, onOpenChange, tenantId, studentId, name }: { open: boolean; onOpenChange: (o: boolean) => void; tenantId: string; studentId: string; name: string }) {
  const run = useAction(async () => {
    await studentService.reactivate(tenantId, studentId);
    return true;
  }, { success: `${name} is active again` });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reactivate ${name}?`}
      description="They can be assigned a seat again."
      confirmLabel="Reactivate"
      pending={run.pending}
      onConfirm={async () => {
        if (await run.run()) onOpenChange(false);
      }}
    />
  );
}

function CancelMembershipDialog({ open, onOpenChange, tenantId, membership }: { open: boolean; onOpenChange: (o: boolean) => void; tenantId: string; membership?: MembershipView }) {
  const [reason, setReason] = useState("");
  const run = useAction(async () => {
    await membershipService.cancel(tenantId, membership!.id, reason);
    return true;
  }, { success: "Membership cancelled and seat released" });
  if (!membership) return null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel ${membership.code}?`}
      description={`Seat ${membership.seatCode} will be released immediately. Recorded payments stay on file; refunds must be handled separately.`}
      confirmLabel="Cancel membership"
      destructive
      pending={run.pending}
      onConfirm={async () => {
        if (await run.run()) onOpenChange(false);
      }}
    >
      <Field label="Reason">{(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Student relocated" />}</Field>
    </ConfirmDialog>
  );
}
