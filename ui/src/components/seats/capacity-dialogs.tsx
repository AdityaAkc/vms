"use client";

import { useMemo, useState } from "react";
import { Lock, Loader2, Minus, Plus } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/app/field";
import { generateSeats } from "@/lib/domain/seats";
import { pluralize } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { seatService } from "@/lib/services";
import { MAX_SEATS, seatRemovalBlocker } from "@/lib/services/seatService";
import { cn } from "@/lib/utils";

export function AddSeatsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { tenantId, data, views } = useTenant();
  const [count, setCount] = useState("10");
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const current = views.seats.length;
  const preview = useMemo(
    () => (n > 0 && n <= 200 ? generateSeats(data.seats, n, data.settings.layout, data.counters.seat, () => "", "") : []),
    [n, data],
  );
  const error = n < 1 ? "Enter at least 1 seat" : current + n > MAX_SEATS ? `Maximum ${MAX_SEATS} seats` : null;

  const add = useAction((k: number) => seatService.addSeats(tenantId, k), {
    success: (s) => `${pluralize(s.length, "seat")} added — capacity is now ${current + s.length}`,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !add.pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add seats</DialogTitle>
          <DialogDescription>Increase capacity. New seats are added to the end of the layout and are immediately bookable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Number of seats to add" error={error ?? undefined}>
            {(p) => (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label="Decrease" onClick={() => setCount(String(Math.max(1, n - 1)))}>
                  <Minus />
                </Button>
                <Input {...p} inputMode="numeric" className="w-24 text-center tabular" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
                <Button type="button" variant="outline" size="icon" aria-label="Increase" onClick={() => setCount(String(n + 1))}>
                  <Plus />
                </Button>
              </div>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Current</div>
              <div className="font-semibold tabular">{current}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Adding</div>
              <div className="font-semibold text-success tabular">+{n}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">New capacity</div>
              <div className="font-semibold tabular">{current + n}</div>
            </div>
          </div>
          {preview.length > 0 && (
            <p className="text-xs text-muted-foreground">
              New seat numbers: <span className="font-medium text-foreground">{preview[0]!.code}</span>
              {preview.length > 1 && <> to <span className="font-medium text-foreground">{preview[preview.length - 1]!.code}</span></>}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.pending}>Cancel</Button>
          <Button
            disabled={Boolean(error) || add.pending}
            onClick={async () => {
              if (await add.run(n)) onOpenChange(false);
            }}
          >
            {add.pending && <Loader2 className="animate-spin" />}
            Add {pluralize(n, "seat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reduce capacity. Seats with any current/upcoming booking are locked and can
 * never be selected; removal is a soft delete so history is preserved.
 */
export function RemoveSeatsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">{open && <RemoveSeatsForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function RemoveSeatsForm({ onDone }: { onDone: () => void }) {
  const { tenantId, data, views, today } = useTenant();
  const seats = views.seats;
  const blockers = useMemo(
    () => new Map(seats.map((s) => [s.id, seatRemovalBlocker(data, s.id, today)])),
    [seats, data, today],
  );
  const eligible = seats.filter((s) => !blockers.get(s.id));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const selectLast = (n: number) => {
    const ids = [...eligible].sort((a, b) => b.number - a.number).slice(0, n).map((s) => s.id);
    setSelected(new Set(ids));
  };

  const remove = useAction(async () => {
    await seatService.removeSeats(tenantId, [...selected]);
    return true;
  }, {
    success: `${pluralize(selected.size, "seat")} removed — capacity is now ${seats.length - selected.size}`,
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const codes = seats.filter((s) => selected.has(s.id)).map((s) => s.code);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reduce capacity</DialogTitle>
        <DialogDescription>
          Choose seats to remove. Seats with an active or upcoming booking are locked — move or end those bookings first.
        </DialogDescription>
      </DialogHeader>

      {!confirming ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{eligible.length} of {seats.length} seats are eligible.</span>
            <span className="ml-auto flex gap-1.5">
              {[5, 10].map((n) => (
                <Button key={n} variant="outline" size="sm" disabled={eligible.length < n} onClick={() => selectLast(n)}>
                  Last {n} eligible
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear</Button>
            </span>
          </div>
          <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-5">
            {seats.map((s) => {
              const reason = blockers.get(s.id);
              const checked = selected.has(s.id);
              return (
                <label
                  key={s.id}
                  title={reason ?? undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    reason ? "cursor-not-allowed bg-muted/50 text-muted-foreground" : "cursor-pointer hover:bg-muted/40",
                    checked && "border-destructive/40 bg-danger-soft",
                  )}
                >
                  {reason ? (
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Checkbox checked={checked} onCheckedChange={() => toggle(s.id)} aria-label={`Remove seat ${s.code}`} />
                  )}
                  <span className="font-medium tabular">{s.code}</span>
                  {reason && <span className="sr-only">locked: {reason}</span>}
                </label>
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Locked seats show the reason on hover. Removed seats keep their booking history and can be restored.
          </p>
        </div>
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            You are about to remove <strong>{pluralize(selected.size, "seat")}</strong> ({codes.slice(0, 12).join(", ")}
            {codes.length > 12 ? "…" : ""}). Capacity will change from {seats.length} to {seats.length - selected.size}.
            No existing bookings are affected.
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => (confirming ? setConfirming(false) : onDone())} disabled={remove.pending}>
          {confirming ? "Back" : "Cancel"}
        </Button>
        {!confirming ? (
          <Button variant="destructive" disabled={!selected.size} onClick={() => setConfirming(true)}>
            Review removal ({selected.size})
          </Button>
        ) : (
          <Button
            variant="destructive"
            disabled={remove.pending}
            onClick={async () => {
              if (await remove.run()) onDone();
            }}
          >
            {remove.pending && <Loader2 className="animate-spin" />}
            Remove {pluralize(selected.size, "seat")}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
