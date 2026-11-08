"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/app/combobox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { SEAT_TAGS } from "@/config/app";
import { formatDate } from "@/lib/date";
import { seatsAvailableFor } from "@/lib/domain/availability";
import { isBlocking } from "@/lib/domain/derive";
import { seatCodeFor } from "@/lib/domain/seats";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { membershipService, seatService } from "@/lib/services";
import type { SeatView, TenantSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------ Layout ------------------------------ */

export function LayoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <LayoutForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function LayoutForm({ onDone }: { onDone: () => void }) {
  const { tenantId, settings, views } = useTenant();
  const [layout, setLayout] = useState<TenantSettings["layout"]>(settings.layout);
  const [renumberOpen, setRenumberOpen] = useState(false);
  const rows = Math.ceil(views.seats.length / Math.max(1, layout.columns));
  const save = useAction(async () => {
    await seatService.updateLayout(tenantId, layout);
    return true;
  }, { success: "Layout updated" });
  const renumber = useAction(async () => {
    await seatService.updateLayout(tenantId, layout);
    await seatService.renumber(tenantId);
    return true;
  }, { success: "Seats renumbered to match the layout" });

  const sample = [0, 1, layout.columns].map((i) => seatCodeFor(i, i + 1, layout)).join(", ");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configure layout</DialogTitle>
        <DialogDescription>Arrange seats into rows and columns to mirror your floor plan.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Seats per row (columns)">
          {(p) => (
            <Input
              {...p}
              type="number"
              min={2}
              max={30}
              value={layout.columns}
              onChange={(e) => setLayout({ ...layout, columns: Math.max(1, Number(e.target.value) || 1) })}
            />
          )}
        </Field>
        <Field label="Aisle after every" hint="0 for no aisle">
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              value={layout.aisleEvery}
              onChange={(e) => setLayout({ ...layout, aisleEvery: Math.max(0, Number(e.target.value) || 0) })}
            />
          )}
        </Field>
        <Field label="Seat numbering">
          {(p) => (
            <Select value={layout.numbering} onValueChange={(v) => setLayout({ ...layout, numbering: v as TenantSettings["layout"]["numbering"] })}>
              <SelectTrigger id={p.id} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="row-letter">Row letter + number (A-01)</SelectItem>
                <SelectItem value="numeric">Sequential (S-01)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Prefix" hint="For sequential numbering">
          {(p) => (
            <Input {...p} maxLength={4} value={layout.prefix} disabled={layout.numbering !== "numeric"} onChange={(e) => setLayout({ ...layout, prefix: e.target.value.toUpperCase() })} />
          )}
        </Field>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="font-medium tabular">{views.seats.length}</span> seats → <span className="font-medium tabular">{rows}</span> rows ×{" "}
        <span className="font-medium tabular">{layout.columns}</span> columns. New seats will be numbered like {sample}.
      </div>
      <p className="text-xs text-muted-foreground">
        Changing numbering affects new seats only. Use <em>Renumber all seats</em> to relabel existing seats by position —
        bookings and history stay attached to the same physical seat.
      </p>
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={() => setRenumberOpen(true)} disabled={save.pending}>Renumber all seats…</Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onDone}>Cancel</Button>
          <Button disabled={save.pending} onClick={async () => (await save.run()) && onDone()}>
            {save.pending && <Loader2 className="animate-spin" />} Save layout
          </Button>
        </div>
      </DialogFooter>
      <ConfirmDialog
        open={renumberOpen}
        onOpenChange={setRenumberOpen}
        title="Renumber all seats?"
        description="Every active seat will get a new number based on its position in the layout. Inform students whose seat label changes."
        confirmLabel="Renumber"
        pending={renumber.pending}
        onConfirm={async () => {
          if (await renumber.run()) {
            setRenumberOpen(false);
            onDone();
          }
        }}
      />
    </>
  );
}

/* ------------------------------ Edit seat ------------------------------ */

export function EditSeatDialog({ seat, open, onOpenChange }: { seat: SeatView | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open && seat && <EditSeatForm seat={seat} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function EditSeatForm({ seat, onDone }: { seat: SeatView; onDone: () => void }) {
  const { tenantId } = useTenant();
  const [code, setCode] = useState(seat.code);
  const [tags, setTags] = useState<string[]>(seat.tags);
  const [notes, setNotes] = useState(seat.notes ?? "");
  const save = useAction(async () => {
    await seatService.updateSeat(tenantId, seat.id, { code, tags, notes });
    return true;
  }, { success: "Seat updated" });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit seat {seat.code}</DialogTitle>
        <DialogDescription>Seat number, features and internal notes.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Field label="Seat number" required hint="Must be unique in this reading room">
          {(p) => <Input {...p} value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-foreground/80">Features</legend>
          <div className="flex flex-wrap gap-1.5">
            {SEAT_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    on ? "border-brand/40 bg-brand/10 text-brand" : "text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Notes" hint="Visible to staff only">
          {(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button disabled={save.pending || !code.trim()} onClick={async () => (await save.run()) && onDone()}>
          {save.pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------ Maintenance ------------------------------ */

export function MaintenanceDialog({ seat, open, onOpenChange }: { seat: SeatView | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open && seat && <MaintenanceForm seat={seat} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function MaintenanceForm({ seat, onDone }: { seat: SeatView; onDone: () => void }) {
  const { tenantId } = useTenant();
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const member = seat.current ?? seat.upcoming;
  const save = useAction(async () => {
    await seatService.setMaintenance(tenantId, seat.id, true, { note, acknowledgeOccupied: ack });
    return true;
  }, { success: `Seat ${seat.code} disabled for maintenance` });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Disable seat {seat.code}</DialogTitle>
        <DialogDescription>Disabled seats are hidden from booking until you enable them again.</DialogDescription>
      </DialogHeader>
      {member && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
          <p className="flex items-start gap-2 font-medium text-[oklch(0.45_0.1_65)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            This seat is {seat.current ? "occupied" : "reserved"} by {member.studentName} until {formatDate(member.endDate)}.
          </p>
          <p className="mt-1 pl-6 text-xs text-muted-foreground">
            Their booking is not cancelled. The seat will be flagged so you can transfer them to another seat.
          </p>
          <label className="mt-3 flex items-center gap-2 pl-6 text-xs">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} /> I understand, disable anyway
          </label>
        </div>
      )}
      <Field label="Reason" hint="e.g. Chair repair, lamp replacement">
        {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button variant="destructive" disabled={save.pending || (Boolean(member) && !ack)} onClick={async () => (await save.run()) && onDone()}>
          {save.pending && <Loader2 className="animate-spin" />} Disable seat
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------ Change seat ------------------------------ */

/** Move a student's current + upcoming bookings to another free seat. */
export function ChangeSeatDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && studentId && <ChangeSeatForm studentId={studentId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ChangeSeatForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const { tenantId, data, views, today } = useTenant();
  const student = views.studentById.get(studentId)!;
  const affected = data.memberships.filter((m) => m.studentId === studentId && isBlocking(m, today));
  const from = affected.reduce((min, m) => (m.startDate < min ? m.startDate : min), affected[0]?.endDate ?? today);
  const start = from < today ? today : from;
  const end = affected.reduce((max, m) => (m.endDate > max ? m.endDate : max), today);
  const options = seatsAvailableFor(data, start, end, new Set(affected.map((m) => m.id)))
    .filter((s) => !affected.some((m) => m.seatId === s.id))
    .map((s) => ({ value: s.id, label: `Seat ${s.code}`, description: s.tags.join(", ") || undefined }));
  const [seatId, setSeatId] = useState("");
  const [note, setNote] = useState("");
  const target = options.find((o) => o.value === seatId);
  const save = useAction(async () => {
    await membershipService.changeSeat(tenantId, studentId, seatId, note);
    return true;
  }, { success: `${student.name} moved to ${target?.label ?? "new seat"}` });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change seat</DialogTitle>
        <DialogDescription>
          {student.name} is on seat {student.seatCode}. Only seats free from {formatDate(start)} to {formatDate(end)} are listed.
        </DialogDescription>
      </DialogHeader>
      {affected.length === 0 ? (
        <p className="text-sm text-muted-foreground">This student has no current or upcoming membership.</p>
      ) : (
        <div className="space-y-4">
          <Field label="New seat" required hint={`${options.length} seats available`}>
            {(p) => <Combobox id={p.id} options={options} value={seatId} onChange={setSeatId} placeholder="Select a seat" />}
          </Field>
          <Field label="Reason" hint="Saved in the seat history">
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Requested a window seat" />}
          </Field>
          {affected.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Applies to {affected.length} bookings (current and upcoming renewal).
            </p>
          )}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button disabled={!seatId || save.pending} onClick={async () => (await save.run()) && onDone()}>
          {save.pending && <Loader2 className="animate-spin" />} Move student
        </Button>
      </DialogFooter>
    </>
  );
}
